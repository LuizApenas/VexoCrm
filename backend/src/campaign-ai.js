const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
// Modelo instruct, nao de raciocinio. Medido 06/08/2026: gerar 25 variacoes e
// seguir especificacao de formatacao, nao deduzir — e o gpt-oss-20b queimava
// ~3.4k tokens "pensando" antes de escrever, estourando o teto e devolvendo
// 400 json_validate_failed com failed_generation vazio. Baixar o esforco de
// raciocinio consertava o orcamento e quebrava a saida (loop de repeticao,
// contagem errada). O llama nao tem esse overhead: 0 token de raciocinio, e o
// limite da camada gratuita e maior — 12000 TPM contra 8000 do gpt-oss-20b
// (header x-ratelimit-limit-tokens da propria API, mesma chave).
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const STRICT_JSON_MODELS = new Set(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
const CURIOSITY_NAME_TECHNIQUE = {
  name: "name_curiosity_recovery",
  label: "Name + curiosity recovery",
  summary:
    "When a lead is about to stop, think, or postpone, call them by name and open a useful curiosity gap instead of applying pressure.",
  useCases: [
    "WhatsApp sales follow-up",
    "Objection recovery for 'vou pensar'",
    "Reactivation of indecisive leads",
  ],
  example:
    "Oi, {{nome}}, rapidinho... antes de voce decidir, deixa eu te mostrar um ponto que talvez mude sua visao.",
};

export const VIP_SALES_TECHNIQUE = {
  name: "vip_high_ticket",
  label: "Venda VIP / High-ticket",
  summary:
    "Foque em exclusividade, benefícios premium e status. Evite parecer desesperado por vendas. Demonstre escassez real e atendimento personalizado.",
  useCases: [
    "Vendas High-ticket",
    "Lançamentos VIP",
    "Produtos de Luxo e Exclusivos",
  ],
  example:
    "Olá, {{nome}}. Como você está no nosso grupo seleto, reservei uma oportunidade exclusiva para você.",
};

// Groq was returning unrealistic gaps (e.g. 172800s = 48h) for WhatsApp steps; AI assist stays within chat-like ranges.
const MAX_AI_STEP_DELAY_SECONDS = 3600;
const MAX_AI_LEAD_DELAY_SECONDS = 3600;

function clampAiDelaySeconds(value, maxSeconds) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, maxSeconds);
}

/** Normalize delay fields after Groq (defense in depth vs schema drift or json_object mode). */
function clampCampaignAiDelaySuggestion(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const seq = Array.isArray(parsed.sequence) ? parsed.sequence : [];
  return {
    ...parsed,
    sequence: seq.map((step) => ({
      ...step,
      delayAfterSeconds: clampAiDelaySeconds(step.delayAfterSeconds, MAX_AI_STEP_DELAY_SECONDS),
    })),
    leadDelaySeconds: clampAiDelaySeconds(parsed.leadDelaySeconds, MAX_AI_LEAD_DELAY_SECONDS),
  };
}

function getGroqModel() {
  return process.env.GROQ_CAMPAIGN_AI_MODEL || DEFAULT_GROQ_MODEL;
}

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

const SEGMENT_OPERATOR_LABELS = {
  equals: "igual a",
  contains: "contém",
  gt: "maior que",
  lt: "menor que",
};

function sanitizeSegmentContext(segmentation = {}) {
  if (!segmentation || typeof segmentation !== "object") return {};

  // Shape novo unificado: { filters:[{field,operator,value}] }.
  if (Array.isArray(segmentation.filters)) {
    const filters = segmentation.filters
      .filter((f) => f && f.field && (f.value ?? "") !== "")
      .map((f) => ({
        campo: normalizeString(f.field),
        condicao: SEGMENT_OPERATOR_LABELS[f.operator] || normalizeString(f.operator) || "igual a",
        valor: normalizeString(f.value),
      }));
    return { filtros: filters };
  }

  // Shape legado (campanhas antigas) — mantido p/ compat.
  return {
    gender: normalizeString(segmentation.gender),
    productType: normalizeString(segmentation.productType),
    ticket: normalizeString(segmentation.ticket),
    ticketThreshold:
      segmentation.ticketThreshold === null || segmentation.ticketThreshold === undefined
        ? null
        : Number(segmentation.ticketThreshold),
    interest: normalizeString(segmentation.interest),
    campaignTag: normalizeString(segmentation.campaignTag),
  };
}

function sanitizeSequence(sequence = []) {
  if (!Array.isArray(sequence)) return [];

  return sequence.map((step, index) => ({
    id: normalizeString(step?.id) || `step-${index + 1}`,
    type: normalizeString(step?.type).toLowerCase() === "image" ? "image" : "text",
    order: Number(step?.order) || index + 1,
    text: normalizeString(step?.text),
    hasImage: Boolean(step?.image?.dataUrl || step?.image),
    enabled: step?.enabled !== false,
    delayAfterSeconds: Number(step?.delayAfterSeconds) || 0,
  }));
}

function buildTechniqueContext(style = "") {
  const normalizedStyle = normalizeString(style).toLowerCase();
  
  if (normalizedStyle.includes("vip") || normalizedStyle.includes("high") || normalizedStyle.includes("premium")) {
    return {
      activeTechnique: VIP_SALES_TECHNIQUE,
      priority: "high",
    };
  }

  const shouldPrioritizeTechnique =
    !normalizedStyle ||
    normalizedStyle.includes("curios") ||
    normalizedStyle.includes("nome") ||
    normalizedStyle.includes("obje") ||
    normalizedStyle.includes("pensar") ||
    normalizedStyle.includes("indecis") ||
    normalizedStyle.includes("whatsapp");

  return {
    activeTechnique: CURIOSITY_NAME_TECHNIQUE,
    priority: shouldPrioritizeTechnique ? "high" : "supporting",
  };
}

function buildChatPayload({ taskPrompt, schemaName, schema, preferJsonObject = false }) {
  const model = getGroqModel();
  const basePayload = {
    model,
    temperature: 0.3,
    // Medido 06/08/2026: completion real fica em ~600 tokens; 3000 e folga.
    max_completion_tokens: 3000,
    messages: [
      {
        role: "system",
        content:
          "Voce eh um estrategista de outbound B2B/B2C em portugues do Brasil. Responda apenas com JSON valido, sem markdown. Nao invente dados pessoais e nao solicite envio automatico.",
      },
      {
        role: "user",
        content: taskPrompt,
      },
    ],
  };

  if (STRICT_JSON_MODELS.has(model) && !preferJsonObject) {
    return {
      ...basePayload,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      },
    };
  }

  return {
    ...basePayload,
    response_format: {
      type: "json_object",
    },
  };
}

async function callGroqJson({ taskPrompt, schemaName, schema, preferJsonObject = false }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_DISABLED");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(GROQ_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(buildChatPayload({ taskPrompt, schemaName, schema, preferJsonObject })),
      signal: controller.signal,
    });

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(rawBody || `Groq HTTP ${response.status}`);
    }

    const payload = JSON.parse(rawBody);
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq retornou uma resposta vazia.");
    }

    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

export function getGroqCampaignAiStatus() {
  return {
    enabled: Boolean(process.env.GROQ_API_KEY),
    provider: "groq",
    model: getGroqModel(),
  };
}

export async function generateCampaignCopySuggestion(input = {}) {
  const context = {
    campaignName: normalizeString(input.campaignName),
    goal: normalizeString(input.goal),
    style: normalizeString(input.style),
    segmentation: sanitizeSegmentContext(input.segmentation),
    technique: buildTechniqueContext(input.style),
  };

  return callGroqJson({
    schemaName: "campaign_copy_suggestion",
    schema: {
      type: "object",
      properties: {
        copy: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["copy", "rationale"],
      additionalProperties: false,
    },
    taskPrompt: `Gere uma copy inicial em pt-BR para uma campanha outbound.
Contexto:
${JSON.stringify(context, null, 2)}

Regras:
- Nao use markdown.
- A copy deve ser objetiva, natural e pronta para WhatsApp.
- Use {{nome}} quando fizer sentido chamar o lead pelo nome, sem inventar nomes reais.
- Crie curiosidade util, principalmente para leads indecisos ou que responderiam "vou pensar".
- Nao cite telefones, nomes reais de leads ou listas.
- Evite pressao, urgencia falsa e promessas exageradas.
- Rationale curta, no maximo 2 frases.`,
  });
}

// A validacao por json_schema so vale para os modelos em STRICT_JSON_MODELS. Com
// qualquer outro (ex.: llama-3.3-70b-versatile) o payload cai em json_object, que
// nao impoe minItems/maxItems nem o nome das chaves — o modelo devolvia menos
// variacoes que o pedido, e as vezes num formato que o front nao sabia ler
// (a tela ficava vazia). Estas duas funcoes tornam a leitura tolerante e
// completam o que faltar.
function extractVariantList(parsed) {
  const pools = [
    parsed?.variants,
    parsed?.variacoes,
    parsed?.variations,
    parsed?.mensagens,
    parsed?.messages,
    parsed?.items,
    Array.isArray(parsed) ? parsed : null,
  ];

  for (const pool of pools) {
    if (!Array.isArray(pool) || pool.length === 0) continue;
    const texts = pool
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          return normalizeString(entry.text || entry.variant || entry.mensagem || entry.message);
        }
        return "";
      })
      .filter(Boolean);
    if (texts.length > 0) return texts;
  }

  return [];
}

function dedupeVariants(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

// Teto de variacoes. Tem que bater com MAX_TEXT_VARIANTS de campaign-outbound.js:
// se este for maior, o envio corta o excedente em silencio.
const MAX_TEMPLATE_VARIANTS = 30;

// Buckets estruturais. Pedir "N variacoes diferentes" devolve N parafrases com o
// mesmo esqueleto; pedir quantidade POR BUCKET impoe a diversidade em vez de
// esperar por ela.
//
// SEM frase-exemplo aqui de proposito. Exemplo e o sinal mais forte de um
// prompt: as frases que estavam nestas regras eram todas de disponibilidade
// ("pode falar agora?"), entao uma base de cobranca ou lembrete era puxada
// para o registro do exemplo em vez de variar a mensagem do cliente. A
// ancoragem tem que vir do baseText, nunca do codigo.
const VARIANT_BUCKETS = [
  { key: "curta_direta", share: 0.15, rule: "no maximo 6 palavras, SEM saudacao." },
  { key: "saudacao_pergunta", share: 0.2, rule: "comeca com saudacao e TERMINA EM PONTO DE INTERROGACAO. Uma unica frase." },
  // {{nome}} NAO e bucket: virou regra global aplicada dentro de cada lote.
  // Como bucket, so ~20% das variacoes usariam nome, abaixo do piso de 30% que
  // o antiban precisa — e leads sem nome dependem das que nao usam.
  // needsSubject: so entra quando o baseText declara o assunto. Sem assunto o
  // modelo inventa marcador ("falar sobre X") e o "X" chega literal no lead.
  { key: "com_motivo", share: 0.15, rule: "diz por que voce esta entrando em contato, usando SOMENTE o assunto que ja aparece no baseText. Nao invente assunto novo.", needsSubject: true },
  { key: "duas_frases", share: 0.15, rule: "duas frases, entre 15 e 25 palavras no total." },
  { key: "afirmacao", share: 0.15, rule: "PROIBIDO ponto de interrogacao nesta variacao. Nao pergunte nada: termine em ponto final." },
];

function sanitizeAvailableVariables(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeString(item).replace(/[{}]/g, "").trim().toLowerCase())
        .filter((item) => /^[\p{L}0-9_]+$/u.test(item))
    )
  );
}

// Ruido de abordagem: saudacao, disponibilidade e conectivos. O que sobra
// depois de tirar isto e o assunto do contato — se sobrar algo.
const SUBJECT_STOPWORDS = new Set([
  "ola", "oi", "opa", "fala", "bom", "boa", "dia", "tarde", "noite", "tudo", "bem", "certo",
  "voce", "vc", "tu", "eu", "me", "te", "se", "a", "o", "as", "os", "um", "uma", "e", "de",
  "do", "da", "dos", "das", "em", "no", "na", "para", "pra", "por", "com", "que", "esta",
  "estou", "sera", "pode", "podendo", "poderia", "consegue", "conseguiria", "tem", "teria",
  "ter", "falar", "conversar", "atender", "responder", "agora", "hoje", "momento", "minuto",
  "minutinho", "segundo", "tempo", "disponivel", "disponibilidade", "rapidinho", "aqui",
  "sobre", "assunto", "tema", "coisa", "algo", "nome", "telefone", "por_favor", "favor",
]);

/**
 * O baseText declara o assunto do contato?
 *
 * "Ola, bom dia! Voce esta podendo falar agora?" -> nao (so disponibilidade).
 * "Vi que voce tem interesse em energia solar, consegue falar?" -> sim.
 *
 * Importa porque o bucket com_motivo exige dizer o motivo: sem assunto na base
 * o modelo preenche com marcador ("falar sobre X") e o "X" vai literal pro lead.
 */
function baseTextDeclaresSubject(baseText) {
  const limpo = normalizeString(baseText)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/[^a-z0-9\s]/g, " ");

  const restantes = limpo
    .split(/\s+/)
    .filter(Boolean)
    .filter((palavra) => palavra.length >= 3 && !SUBJECT_STOPWORDS.has(palavra));

  return restantes.length > 0;
}

/**
 * Distribui `count` entre os buckets por maior-resto, com piso de 1 em cada.
 * Bucket sem pre-requisito atendido ({{nome}} ausente, assunto ausente) sai da
 * lista e sua cota e redistribuida entre os demais pelo peso relativo.
 */
function buildVariantBucketPlan(count, hasNameVariable, hasSubject) {
  const buckets = VARIANT_BUCKETS.filter(
    (bucket) => (hasNameVariable || !bucket.needsName) && (hasSubject || !bucket.needsSubject)
  );
  if (count < buckets.length) return [];

  const totalShare = buckets.reduce((acc, bucket) => acc + bucket.share, 0);
  const raw = buckets.map((bucket) => ({ bucket, exact: (bucket.share / totalShare) * count }));
  const plan = raw.map((entry) => ({ ...entry, size: Math.max(1, Math.floor(entry.exact)) }));

  let assigned = plan.reduce((acc, entry) => acc + entry.size, 0);
  const byRemainder = [...plan].sort(
    (a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact))
  );
  let cursor = 0;
  while (assigned < count) {
    byRemainder[cursor % byRemainder.length].size += 1;
    assigned += 1;
    cursor += 1;
  }
  const bySize = [...plan].sort((a, b) => b.size - a.size);
  cursor = 0;
  while (assigned > count) {
    const entry = bySize[cursor % bySize.length];
    if (entry.size > 1) {
      entry.size -= 1;
      assigned -= 1;
    }
    cursor += 1;
  }

  return plan.map((entry) => ({ key: entry.bucket.key, rule: entry.bucket.rule, size: entry.size }));
}

export async function generateCampaignTemplateVariants(input = {}) {
  const count = Math.min(
    Math.max(Number.parseInt(String(input.count ?? "8"), 10) || 8, 2),
    MAX_TEMPLATE_VARIANTS
  );
  // O modelo erra a contagem para baixo. Pedir com margem e cortar depois sai
  // mais barato que uma segunda chamada de complemento.
  const askCount = Math.min(count + 3, MAX_TEMPLATE_VARIANTS);
  const baseText = normalizeString(input.baseText);
  const availableVariables = sanitizeAvailableVariables(input.availableVariables);
  const hasNameVariable = availableVariables.includes("nome");
  const hasSubject = baseTextDeclaresSubject(baseText);
  const bucketPlan = buildVariantBucketPlan(askCount, hasNameVariable, hasSubject);
  // Bounds folgados de proposito. Medido 05/08/2026 contra a Groq
  // (openai/gpt-oss-20b): com minItems=maxItems=N o json_schema estrito devolve
  // 400 json_validate_failed de forma intermitente em N alto (20 e 25 falharam,
  // 30 passou, na mesma bateria). Quem garante a contagem exata e o nosso
  // dedupe + complemento + slice, nao o schema.
  const schema = {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: Math.min(count, 6),
        items: { type: "string" },
      },
      rationale: { type: "string" },
    },
    required: ["variants", "rationale"],
    additionalProperties: false,
  };

  // Regras globais, repetidas em toda chamada. Curtas de proposito: o prompt
  // inteiro de 14 regras por chamada era o que estourava orcamento e fazia o
  // modelo ignorar metade delas.
  const regrasGlobais = [
    `Nao mude o sentido, a oferta nem o proposito. Mantenha o tom do "baseText".`,
    `Nunca repita literalmente outra variacao, nem com troca de uma palavra.`,
    hasSubject
      ? `Use SOMENTE o assunto que ja esta no "baseText". Nao invente assunto, produto ou beneficio.`
      : `O "baseText" NAO declara assunto. Nao invente um e nao use marcador de posicao (letra solta, colchetes, parenteses, sublinhado, sinais de menor/maior).`,
    availableVariables.length > 0
      ? `Variaveis permitidas: ${availableVariables.map((name) => `{{${name}}}`).join(", ")}. Nenhuma outra.`
      : `Nao use nenhuma variavel {{...}}.`,
    `Proibido vocabulario de chamada telefonica (verbos de ligar/atender). E mensagem de texto. Ex. do erro: "estou ligando", "pode atender".`,
    hasNameVariable
      ? `Metade das variacoes deste lote deve usar {{nome}} e a outra metade NAO pode usar (leads sem nome preenchido dependem dessas). Nas que usarem, varie a posicao: em umas no inicio, em outras no meio, em outras no fim.`
      : null,
    hasNameVariable
      ? `{{nome}} e o DESTINATARIO. Dirija-se a ele em segunda pessoa, nunca fale sobre ele como a um terceiro.`
      : null,
    `Sem markdown, sem lista numerada, sem emoji excessivo.`,
  ].filter(Boolean);

  // Buckets disjuntos, 2 por chamada. Cada chamada leva as regras globais + as
  // regras de 2 buckets, em vez das 14 regras inteiras: encurta o prompt por
  // chamada (nao triplica, como fariam lotes com o mesmo prompt) e impede
  // agrupamento entre lotes por construcao, porque buckets diferentes nao
  // competem pela mesma forma.
  // Pares ANTAGONICOS, nao parecidos. Dois buckets proximos no mesmo lote fazem
  // o modelo borrar a diferenca e um deles some — foi o que aconteceu quando os
  // pares saiam da ordem da lista. Comprimentos opostos num lote, terminacoes
  // opostas no outro, e com_motivo sozinho porque nao tem antagonista.
  const PARES_ANTAGONICOS = [
    ["curta_direta", "duas_frases"],
    ["saudacao_pergunta", "afirmacao"],
    ["com_motivo"],
  ];
  const porChave = new Map(bucketPlan.map((bucket) => [bucket.key, bucket]));
  const grupos = PARES_ANTAGONICOS
    .map((chaves) => chaves.map((chave) => porChave.get(chave)).filter(Boolean))
    .filter((grupo) => grupo.length > 0);

  // Cota de saudacao POR LOTE. So o bucket saudacao_pergunta pede saudacao, mas
  // sem cota explicita o modelo enfeita os outros lotes e o total estoura os
  // 60%. Alvo global de 50% para sobrar margem.
  const tetoSaudacoes = Math.floor(askCount * 0.5);
  const tamanhoSaudacaoPergunta = porChave.get("saudacao_pergunta")?.size ?? 0;
  const gruposSemSaudacao = grupos.filter(
    (grupo) => !grupo.some((bucket) => bucket.key === "saudacao_pergunta")
  ).length;
  const sobraSaudacao = Math.max(0, tetoSaudacoes - tamanhoSaudacaoPergunta);
  const cotaPorGrupoSemSaudacao = gruposSemSaudacao > 0 ? Math.floor(sobraSaudacao / gruposSemSaudacao) : 0;

  const aberturasUsadas = [];
  const colhidas = [];
  let rationale = "";

  for (const grupo of grupos) {
    const alvo = grupo.reduce((acc, bucket) => acc + bucket.size, 0);
    // Margem: o modelo erra a contagem para baixo.
    const pedido = alvo + 2;
    const temSaudacaoPergunta = grupo.some((bucket) => bucket.key === "saudacao_pergunta");
    const cotaSaudacao = temSaudacaoPergunta
      ? (porChave.get("saudacao_pergunta")?.size ?? 0) + 1
      : cotaPorGrupoSemSaudacao;

    const promptGrupo = `Voce escreve mensagens de WhatsApp em pt-BR. Gere ${pedido} variacoes da mensagem base, para rotacao de texto antiban.

Mensagem base:
"""${baseText}"""

FORMATOS OBRIGATORIOS (some ${pedido}; distribua entre os dois):
${grupo.map((bucket) => `- ${bucket.size + 1} do tipo "${bucket.key}": ${bucket.rule}`).join("\n")}

COTA DE SAUDACAO NESTE LOTE: no maximo ${cotaSaudacao} das ${pedido} variacoes podem comecar com saudacao (ola, oi, bom dia, boa tarde, boa noite, e ai). As outras ${pedido - cotaSaudacao} tem que comecar direto, SEM saudacao nenhuma.

REGRAS:
${regrasGlobais.map((regra, i) => `${i + 1}. ${regra}`).join("\n")}
${aberturasUsadas.length > 0
  ? `${regrasGlobais.length + 1}. NAO comece nenhuma variacao com estas aberturas, ja usadas: ${aberturasUsadas.map((abertura) => `"${abertura}"`).join(", ")}. No maximo 3 variacoes no total podem compartilhar as 3 primeiras palavras.\n`
  : `${regrasGlobais.length + 1}. Varie a abertura: no maximo 3 variacoes podem compartilhar as 3 primeiras palavras.\n`}
FORMATO DA RESPOSTA (obrigatorio):
Responda APENAS com {"variants": ["..."], "rationale": "..."} — sem markdown, sem texto fora do JSON.`;

    try {
      const parsedGrupo = await callGroqJson({
        schemaName: "campaign_template_variants",
        schema,
        taskPrompt: promptGrupo,
        preferJsonObject: true,
      });
      const novas = extractVariantList(parsedGrupo);
      colhidas.push(...novas);
      if (!rationale) rationale = normalizeString(parsedGrupo?.rationale);
      for (const variante of novas) {
        const abertura = variante.split(/\s+/).slice(0, 3).join(" ");
        if (abertura && !aberturasUsadas.includes(abertura)) aberturasUsadas.push(abertura);
      }
    } catch (err) {
      // Um grupo que falha nao pode zerar os outros. Sem nenhum grupo o erro sobe.
      console.warn(
        `[campaign-ai] grupo de buckets ${grupo.map((b) => b.key).join("+")} falhou:`,
        err?.message || err
      );
    }
  }

  const variants = dedupeVariants(colhidas);
  if (variants.length === 0) {
    throw new Error("Groq nao devolveu nenhuma variacao utilizavel.");
  }

  return {
    variants: variants.slice(0, count),
    requested: count,
    rationale,
  };
}

export async function suggestCampaignSequence(input = {}) {
  const context = {
    campaignName: normalizeString(input.campaignName),
    goal: normalizeString(input.goal),
    style: normalizeString(input.style),
    segmentation: sanitizeSegmentContext(input.segmentation),
    existingSequence: sanitizeSequence(input.sequence),
    technique: buildTechniqueContext(input.style),
  };

  const parsed = await callGroqJson({
    schemaName: "campaign_sequence_suggestion",
    schema: {
      type: "object",
      properties: {
        sequence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["text", "image"] },
              text: { type: "string" },
              delayAfterSeconds: { type: "integer", minimum: 0, maximum: MAX_AI_STEP_DELAY_SECONDS },
              enabled: { type: "boolean" },
            },
            required: ["type", "text", "delayAfterSeconds", "enabled"],
            additionalProperties: false,
          },
        },
        leadDelaySeconds: { type: "integer", minimum: 0, maximum: MAX_AI_LEAD_DELAY_SECONDS },
        rationale: { type: "string" },
      },
      required: ["sequence", "leadDelaySeconds", "rationale"],
      additionalProperties: false,
    },
    taskPrompt: `Sugira uma sequencia ordenada de campanha outbound em pt-BR.
Contexto:
${JSON.stringify(context, null, 2)}

Regras:
- Entregue entre 1 e 5 passos.
- Use type=image apenas quando fizer sentido indicar um passo com imagem.
- Quando type=image, o campo text deve ser a legenda/caption sugerida ou string vazia.
- Delays em segundos: entre passos na mesma conversa prefira 60 a 900; raramente ate 1800; nunca acima de ${MAX_AI_STEP_DELAY_SECONDS} (teto do schema).
- leadDelaySeconds entre leads diferentes: prefira 30 a 180; nunca acima de ${MAX_AI_LEAD_DELAY_SECONDS}.
- Nao use markdown.
- Inclua pelo menos um passo de recuperacao com {{nome}} e curiosidade se a campanha permitir follow-up.
- Nao inclua nenhuma informacao pessoal real.`,
  });
  return clampCampaignAiDelaySuggestion(parsed);
}

export async function suggestCampaignDelays(input = {}) {
  const context = {
    campaignName: normalizeString(input.campaignName),
    goal: normalizeString(input.goal),
    style: normalizeString(input.style),
    segmentation: sanitizeSegmentContext(input.segmentation),
    sequence: sanitizeSequence(input.sequence),
    technique: buildTechniqueContext(input.style),
  };

  const parsed = await callGroqJson({
    schemaName: "campaign_delay_suggestion",
    schema: {
      type: "object",
      properties: {
        sequence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              delayAfterSeconds: { type: "integer", minimum: 0, maximum: MAX_AI_STEP_DELAY_SECONDS },
            },
            required: ["id", "delayAfterSeconds"],
            additionalProperties: false,
          },
        },
        leadDelaySeconds: { type: "integer", minimum: 0, maximum: MAX_AI_LEAD_DELAY_SECONDS },
        rationale: { type: "string" },
      },
      required: ["sequence", "leadDelaySeconds", "rationale"],
      additionalProperties: false,
    },
    taskPrompt: `Sugira ordem temporal e delays para esta sequencia outbound em pt-BR.
Contexto:
${JSON.stringify(context, null, 2)}

Regras:
- Nao altere ids.
- Responda apenas com novos delays.
- Valores em segundos inteiros.
- Entre passos na mesma conversa prefira 60 a 900 segundos; raramente ate 1800; nunca acima de ${MAX_AI_STEP_DELAY_SECONDS}.
- leadDelaySeconds entre leads: prefira 30 a 180; nunca acima de ${MAX_AI_LEAD_DELAY_SECONDS}.
- Nao sugira intervalos de dias ou dezenas de horas; isso nao eh adequado para assistente de atraso entre mensagens.
- Nao inclua markdown.`,
  });
  return clampCampaignAiDelaySuggestion(parsed);
}

export async function rewriteCampaignStep(input = {}) {
  const context = {
    campaignName: normalizeString(input.campaignName),
    goal: normalizeString(input.goal),
    style: normalizeString(input.style),
    segmentation: sanitizeSegmentContext(input.segmentation),
    technique: buildTechniqueContext(input.style),
    step: {
      id: normalizeString(input.step?.id) || "step",
      type: normalizeString(input.step?.type).toLowerCase() === "image" ? "image" : "text",
      text: normalizeString(input.step?.text),
      enabled: input.step?.enabled !== false,
      hasImage: Boolean(input.step?.image?.dataUrl || input.step?.image),
      delayAfterSeconds: Number(input.step?.delayAfterSeconds) || 0,
    },
  };

  return callGroqJson({
    schemaName: "campaign_step_rewrite",
    schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["text", "rationale"],
      additionalProperties: false,
    },
    taskPrompt: `Reescreva um unico passo de campanha outbound em pt-BR.
Contexto:
${JSON.stringify(context, null, 2)}

Regras:
- Nao altere o tipo do passo.
- Se for passo image, gere apenas a legenda/caption no campo text.
- Nao use markdown.
- Mantenha a copy pronta para WhatsApp.
- Quando o contexto indicar indecisao, use {{nome}} e abra uma curiosidade util sem pressionar.`,
  });
}
