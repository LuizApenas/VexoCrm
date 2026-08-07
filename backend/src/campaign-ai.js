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
    // Medido 06/08/2026: completion real fica em ~600 tokens. O teto NAO e
    // consumo, mas a Groq cobra do rate limit o PEDIDO (prompt +
    // max_completion_tokens): com 3000, as 3 chamadas por geracao somavam
    // ~12300 contra o TPM de 12000 e o ultimo lote levava 429 em silencio —
    // o usuario recebia 13 variacoes de 25 sem ver erro nenhum. 1200 cobre o
    // dobro do consumo real e derruba o pedido para ~2100 por chamada.
    max_completion_tokens: 1200,
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
// ATENCAO: nao existe bucket de comprimento extremo. Havia um ("no maximo 6
// palavras") e ele era IMPOSSIVEL de cumprir sem jogar fora o pedido da
// mensagem — numa base real com oferta composta + CTA, o modelo devolveu
// "Estrategias de vendas para voce": manchete, nao mensagem. Variedade de
// comprimento continua, mas com piso derivado do baseText em runtime.
const VARIANT_BUCKETS = [
  { key: "direta", share: 0.15, rule: "começa direto no ponto, SEM saudação. Mensagem completa, com o pedido." },
  { key: "saudacao_pergunta", share: 0.2, rule: "começa com saudação e termina fazendo o pedido em forma de pergunta." },
  // {{nome}} NAO e bucket: virou regra global aplicada dentro de cada lote.
  // Como bucket, so ~20% das variacoes usariam nome, abaixo do piso de 30% que
  // o antiban precisa — e leads sem nome dependem das que nao usam.
  // needsSubject: so entra quando o baseText declara o assunto. Sem assunto o
  // modelo inventa marcador ("falar sobre X") e o "X" chega literal no lead.
  { key: "com_motivo", share: 0.15, rule: "diz por que você está entrando em contato, usando SOMENTE o assunto que já aparece no baseText. Não invente assunto novo.", needsSubject: true },
  { key: "duas_frases", share: 0.15, rule: "duas ou três frases, a variação mais longa do conjunto." },
  // needsNoQuestion: se a base PERGUNTA, toda variacao tem que perguntar
  // (invariante do pedido). Um bucket que proibe interrogacao seria
  // incompativel — some do plano nesse caso, em vez de brigar com o invariante.
  { key: "afirmacao", share: 0.15, rule: "faz o pedido em forma de afirmação, sem ponto de interrogação.", needsNoQuestion: true },
];

function contarPalavras(texto) {
  return normalizeString(texto).split(/\s+/).filter(Boolean).length;
}

function semAcentoMinusculo(texto) {
  return normalizeString(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Classe fechada do portugues: artigos, preposicoes, contracoes e possessivos.
// Nao e heuristica morfologica — e lista finita. O invariante de "mensalidade
// da sua matricula" e {mensalidade, matricula}; exigir "da" e "sua" reprovava
// parafrase correta por causa de palavra que nao carrega informacao nenhuma.
const PALAVRAS_FUNCIONAIS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "em", "na", "no", "nas", "nos",
  "um", "uma", "uns", "umas", "e", "com", "para", "pra", "ao", "aos",
  "seu", "sua", "seus", "suas", "meu", "minha", "nosso", "nossa",
]);

function palavrasDeConteudo(elemento) {
  return semAcentoMinusculo(elemento)
    .split(/\s+/)
    .filter(Boolean)
    .filter((palavra) => !PALAVRAS_FUNCIONAIS.has(palavra));
}

function contemPalavra(alvo, palavra) {
  const escapado = palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapado}([^\\p{L}\\p{N}]|$)`, "u").test(alvo);
}

/**
 * O elemento concreto sobreviveu na variacao?
 *
 * Cada palavra e buscada por limite de palavra, NAO por substring: elemento
 * curto como "IA" casaria dentro de "estrategias" e daria por preservado o que
 * sumiu.
 *
 * Elemento de varias palavras casa FROUXO — todas as palavras presentes, em
 * qualquer posicao, nao a frase contigua. Rede de seguranca para quando a
 * extracao escorregar e devolver frase em vez de substantivo: "vaga na oficina"
 * estava reprovando "na oficina esta semana, temos vaga", que preserva tudo.
 */
function variacaoPreservaElemento(variacao, elemento) {
  const alvo = semAcentoMinusculo(variacao);
  const palavras = palavrasDeConteudo(elemento);
  if (palavras.length === 0) return true;
  return palavras.every((palavra) => contemPalavra(alvo, palavra));
}

function sanitizeElementos(lista) {
  if (!Array.isArray(lista)) return [];
  return Array.from(
    new Set(
      lista
        .map((item) => normalizeString(typeof item === "string" ? item : item?.texto || item?.valor))
        .filter((item) => item.length >= 2 && item.length <= 40)
        // Elemento so de palavra funcional nao e invariante de coisa nenhuma:
        // some da lista em vez de reprovar variacao.
        .filter((item) => palavrasDeConteudo(item).length > 0)
    )
    // Teto de 4: o prompt ja pede no maximo 4, isto e so a rede. Lista longa de
    // invariantes reprova parafrase legitima e o gerador entrega menos.
  ).slice(0, 4);
}

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
function buildVariantBucketPlan(count, hasNameVariable, hasSubject, baseTemPergunta) {
  const buckets = VARIANT_BUCKETS.filter(
    (bucket) =>
      (hasNameVariable || !bucket.needsName) &&
      (hasSubject || !bucket.needsSubject) &&
      (!baseTemPergunta || !bucket.needsNoQuestion)
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
  const baseTemPergunta = baseText.includes("?");
  // Piso de comprimento derivado da BASE, nao chumbado. Mensagem com oferta
  // composta + CTA nao cabe em 3 palavras: cortar demais joga fora o pedido.
  const pisoPalavras = Math.max(3, Math.ceil(contarPalavras(baseText) * 0.4));
  const bucketPlan = buildVariantBucketPlan(askCount, hasNameVariable, hasSubject, baseTemPergunta);
  // Bounds folgados de proposito. Medido 05/08/2026 contra a Groq
  // (openai/gpt-oss-20b): com minItems=maxItems=N o json_schema estrito devolve
  // 400 json_validate_failed de forma intermitente em N alto (20 e 25 falharam,
  // 30 passou, na mesma bateria). Quem garante a contagem exata e o nosso
  // dedupe + complemento + slice, nao o schema.
  const schema = {
    type: "object",
    properties: {
      pedido: { type: "string" },
      elementos: { type: "array", items: { type: "string" } },
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
    `Escreva em português do Brasil com ortografia correta e TODOS os acentos. Nunca escreva sem acento.`,
    `INVARIANTE 1 — cada variação tem que ser uma MENSAGEM COMPLETA E ENVIÁVEL, que sozinha faz sentido para quem recebe sem nenhum contexto. Manchete, título ou fragmento não serve.`,
    `INVARIANTE 2 — cada variação tem que fazer O MESMO PEDIDO da base.${baseTemPergunta ? " A base PERGUNTA, então toda variação tem que perguntar." : ""} Se a base oferece uma escolha, a variação oferece a MESMA escolha.`,
    `INVARIANTE 3 — todos os elementos concretos da base sobrevivem em cada variação: números, durações, cargos, nomes de serviço ou tecnologia. Se a base cita duas tecnologias, a variação cita as duas.`,
    `Cada variação tem no mínimo ${pisoPalavras} palavras. Encurtar cortando o pedido é proibido.`,
    `Não mude o sentido, a oferta nem o propósito. Mantenha o tom do "baseText".`,
    `Nunca repita literalmente outra variação, nem com troca de uma palavra.`,
    hasSubject
      ? `Use SOMENTE o assunto que já está no "baseText". Não invente assunto, produto ou benefício.`
      : `O "baseText" NÃO declara assunto. Não invente um e não use marcador de posição (letra solta, colchetes, parênteses, sublinhado, sinais de menor/maior).`,
    availableVariables.length > 0
      ? `Variáveis permitidas: ${availableVariables.map((name) => `{{${name}}}`).join(", ")}. Nenhuma outra.`
      : `Não use nenhuma variável {{...}}.`,
    `Proibido vocabulário de chamada telefônica (verbos de ligar/atender). É mensagem de texto. Ex. do erro: "estou ligando", "pode atender".`,
    // Saudacao temporal e proibida: a variacao e gerada uma vez e disparada
    // horas depois. Nao existe resolucao por hora em lugar nenhum do envio
    // (confirmado por grep em campaign-outbound.js), entao "Bom dia" gerado de
    // manha sai as 19h — horario errado e assinatura de automacao, o oposto do
    // que a camada antiban existe para esconder.
    `PROIBIDA saudação que dependa da hora ("bom dia", "boa tarde", "boa noite"). A mensagem é disparada horas depois de ser escrita e sairia com o horário errado. Use apenas saudação atemporal.`,
    hasNameVariable
      ? `Metade das variações deste lote deve usar {{nome}} e a outra metade NÃO pode usar (leads sem nome preenchido dependem dessas). Nas que usarem, varie a posição: em umas no início, em outras no meio, em outras no fim.`
      : null,
    hasNameVariable
      ? `{{nome}} é o DESTINATÁRIO. Dirija-se a ele em segunda pessoa, nunca fale sobre ele como a um terceiro.`
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
    ["direta", "duas_frases"],
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
  let pedidoDaBase = "";
  const elementosDaBase = [];
  let invariantesCongelados = false;

  for (const grupo of grupos) {
    const alvo = grupo.reduce((acc, bucket) => acc + bucket.size, 0);
    // Margem: o modelo erra a contagem para baixo.
    const pedido = alvo + 2;
    const temSaudacaoPergunta = grupo.some((bucket) => bucket.key === "saudacao_pergunta");
    const cotaSaudacao = temSaudacaoPergunta
      ? (porChave.get("saudacao_pergunta")?.size ?? 0) + 1
      : cotaPorGrupoSemSaudacao;

    const promptGrupo = `Você escreve mensagens de WhatsApp em português do Brasil. Gere ${pedido} variações da mensagem base, para rotação de texto antiban.

Mensagem base:
"""${baseText}"""

FORMATOS OBRIGATÓRIOS (somam ${pedido}; distribua entre os dois):
${grupo.map((bucket) => `- ${bucket.size + 1} do tipo "${bucket.key}": ${bucket.rule}`).join("\n")}

COTA DE SAUDAÇÃO NESTE LOTE: no máximo ${cotaSaudacao} das ${pedido} variações podem começar com uma saudação atemporal, do tipo "Olá" ou "Oi". As outras ${pedido - cotaSaudacao} têm que começar direto, SEM saudação nenhuma.

REGRAS:
${regrasGlobais.map((regra, i) => `${i + 1}. ${regra}`).join("\n")}
${aberturasUsadas.length > 0
  ? `${regrasGlobais.length + 1}. NÃO comece nenhuma variação com estas aberturas, já usadas: ${aberturasUsadas.map((abertura) => `"${abertura}"`).join(", ")}. No máximo 3 variações no total podem compartilhar as 3 primeiras palavras.\n`
  : `${regrasGlobais.length + 1}. Varie a abertura: no máximo 3 variações podem compartilhar as 3 primeiras palavras.\n`}
ANTES DE ESCREVER AS VARIAÇÕES, extraia da mensagem base:
- "pedido": em uma frase, o que a mensagem pede de quem recebe.
- "elementos": no MÁXIMO 4 itens, os de maior valor informativo — aqueles que,
  se sumissem, mudariam o que está sendo oferecido.
  É elemento: substantivo concreto, número, valor, duração, nome próprio,
  cargo, nome de produto, tecnologia ou serviço.
  NÃO é elemento: verbo em qualquer forma, frase inteira, adjetivo, e
  substantivo genérico que não identifica nada específico.
  Escreva cada elemento como ele aparece na base, sem flexionar.
  Se a base não tiver nenhum, devolva lista vazia.
Depois gere as variações preservando o pedido e todos os elementos em TODAS elas.

FORMATO DA RESPOSTA (obrigatório):
Responda APENAS com {"pedido": "...", "elementos": ["..."], "variants": ["..."], "rationale": "..."} — sem markdown, sem texto fora do JSON.`;

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
      // Invariante e da BASE, nao do lote: congela na primeira extracao. Unir os
      // 3 lotes furava o teto de 4 (cada um extrai o seu) e ainda misturava
      // recortes diferentes da mesma ideia — "venceu ontem" de um, "boleto
      // perdeu a validade" de outro. A uniao virava 5+ invariantes e reprovava
      // parafrase legitima em massa: 39 descartes numa base so.
      if (!invariantesCongelados) {
        const extraidos = sanitizeElementos(parsedGrupo?.elementos);
        const pedido = normalizeString(parsedGrupo?.pedido);
        if (pedido || extraidos.length > 0) {
          pedidoDaBase = pedido;
          elementosDaBase.push(...extraidos);
          invariantesCongelados = true;
        }
      }
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

  // Validacao no codigo. O prompt pede o invariante; isto CONFERE. Variacao que
  // perde o pedido ou um elemento concreto vai para o lixo com motivo — entregar
  // manchete em vez de mensagem foi o defeito que quebrou em producao.
  // Pura: mesma entrada, mesmo veredito. Precisa ser reexecutavel porque a
  // autocorrecao abaixo revalida o mesmo material com a lista de elementos
  // encurtada, sem gastar chamada nova.
  const validar = (lista, elementos) => {
    const aprovadas = [];
    const descartadas = [];
    const porElemento = new Map();
    for (const variacao of lista) {
      const palavras = contarPalavras(variacao);
      if (palavras < pisoPalavras) {
        descartadas.push({ texto: variacao, motivo: `curta demais (${palavras} palavras, piso ${pisoPalavras})` });
        continue;
      }
      if (baseTemPergunta && !variacao.includes("?")) {
        descartadas.push({ texto: variacao, motivo: "a base pergunta e a variacao nao pergunta" });
        continue;
      }
      const faltando = elementos.filter((elemento) => !variacaoPreservaElemento(variacao, elemento));
      if (faltando.length > 0) {
        for (const elemento of faltando) porElemento.set(elemento, (porElemento.get(elemento) || 0) + 1);
        descartadas.push({ texto: variacao, motivo: `perdeu da base: ${faltando.join(", ")}` });
        continue;
      }
      aprovadas.push(variacao);
    }
    return { aprovadas, descartadas, porElemento };
  };

  let elementosEmUso = [...elementosDaBase];
  let poolBruto = dedupeVariants(colhidas);
  let veredito = validar(poolBruto, elementosEmUso);
  let variants = veredito.aprovadas;
  let descartadas = veredito.descartadas;
  let descartesPorElemento = veredito.porElemento;
  const elementosRemovidos = [];

  // Faltou depois do descarte: pede mais, em vez de entregar menos calado.
  if (variants.length < count) {
    const faltam = count - variants.length;
    try {
      const reposicao = await callGroqJson({
        schemaName: "campaign_template_variants",
        schema,
        preferJsonObject: true,
        taskPrompt: `Você escreve mensagens de WhatsApp em português do Brasil, com ortografia correta e todos os acentos. Gere ${faltam + 2} variações da mensagem base.

Mensagem base:
"""${baseText}"""

O QUE NÃO PODE FALTAR EM NENHUMA VARIAÇÃO:
- o pedido: ${pedidoDaBase || "o mesmo pedido que a mensagem base faz"}
${elementosDaBase.length > 0 ? `- estes elementos, todos: ${elementosDaBase.join(", ")}` : "- os elementos concretos da base"}
- mínimo de ${pisoPalavras} palavras${baseTemPergunta ? "\n- ponto de interrogação: a base pergunta" : ""}

Cada variação é uma MENSAGEM COMPLETA E ENVIÁVEL, não manchete nem fragmento.
Proibida saudação que dependa da hora ("bom dia", "boa tarde", "boa noite").

Não repita nenhuma destas, que já existem:
${variants.map((v, i) => `${i + 1}. ${v}`).join("\n")}

FORMATO DA RESPOSTA (obrigatório):
Responda APENAS com {"variants": ["..."], "rationale": "..."} — sem markdown, sem texto fora do JSON.`,
      });
      poolBruto = dedupeVariants([...poolBruto, ...extractVariantList(reposicao)]);
      veredito = validar(poolBruto, elementosEmUso);
      variants = veredito.aprovadas;
      descartadas = veredito.descartadas;
      descartesPorElemento = veredito.porElemento;
    } catch (err) {
      console.warn("[campaign-ai] reposicao de variacoes descartadas falhou:", err?.message || err);
    }
  }

  // AUTOCORRECAO SEM CUSTO DE TOKEN. Quando um unico elemento responde pela
  // maioria dos descartes e a taxa passa de 50%, o defeito esta na EXTRACAO
  // daquele elemento, nao nas variacoes — o modelo devolveu sintagma em vez de
  // substantivo. Tira o elemento e revalida o material que ja esta em maos:
  // o texto ja foi gerado e pago, so o criterio muda.
  for (let tentativa = 0; tentativa < elementosEmUso.length; tentativa += 1) {
    const total = variants.length + descartadas.length;
    if (total === 0 || descartadas.length / total <= 0.5) break;

    const [campeao, vezes] = [...descartesPorElemento.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (!campeao || vezes <= descartadas.length / 2) break;

    const antes = variants.length;
    elementosEmUso = elementosEmUso.filter((elemento) => elemento !== campeao);
    elementosRemovidos.push(campeao);
    veredito = validar(poolBruto, elementosEmUso);
    variants = veredito.aprovadas;
    descartadas = veredito.descartadas;
    descartesPorElemento = veredito.porElemento;
    console.warn(
      `[campaign-ai] autocorrecao: elemento "${campeao}" reprovou ${vezes} de ${antes + vezes}; removido da lista. Variacoes aprovadas: ${antes} -> ${variants.length}, sem chamada nova.`
    );
  }

  // Entregou menos que o pedido mesmo depois da reposicao: registra QUAL
  // invariante mais reprovou. Sem isto, a proxima regressao custa outra
  // investigacao inteira para descobrir que o culpado era um elemento so.
  if (variants.length < count && descartesPorElemento.size > 0) {
    const ranking = [...descartesPorElemento.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([elemento, vezes]) => `"${elemento}" (${vezes}x)`)
      .join(", ");
    console.warn(
      `[campaign-ai] entregou ${variants.length} de ${count}; ${descartadas.length} descartadas. Elementos que mais reprovaram: ${ranking}`
    );
  }

  if (variants.length === 0) {
    throw new Error("Groq nao devolveu nenhuma variacao utilizavel.");
  }

  return {
    variants: variants.slice(0, count),
    requested: count,
    discarded: descartadas,
    discardedCount: descartadas.length,
    invariants: { pedido: pedidoDaBase, elementos: elementosEmUso, removidos: elementosRemovidos },
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
