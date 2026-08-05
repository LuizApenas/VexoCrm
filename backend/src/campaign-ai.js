const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
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
    // gpt-oss-20b e modelo de raciocinio: medido 05/08/2026, o prompt de
    // variacoes gasta ~3.4k tokens so pensando. Teto de 6000 cobre raciocinio + resposta
    // sem estourar o limite de 8000 TPM (Tokens Per Minute) da Groq.
    max_completion_tokens: 6000,
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
const VARIANT_BUCKETS = [
  { key: "curta_direta", share: 0.15, rule: "no maximo 6 palavras, SEM saudacao. Ex.: \"Consegue falar agora?\"" },
  { key: "saudacao_pergunta", share: 0.2, rule: "saudacao + pergunta, uma unica frase. Ex.: \"Oi, tudo bem? Pode falar?\"" },
  { key: "com_nome", share: 0.2, rule: "usa a variavel {{nome}}. Ex.: \"{{nome}}, voce tem um minuto?\"", needsName: true },
  { key: "com_motivo", share: 0.15, rule: "diz por que voce esta entrando em contato. Ex.: \"Passei aqui pra falar sobre X, tem um momento?\"" },
  { key: "duas_frases", share: 0.15, rule: "duas frases, entre 15 e 25 palavras no total." },
  { key: "afirmacao", share: 0.15, rule: "NAO termina em ponto de interrogacao. Ex.: \"Me avisa quando puder falar.\"" },
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

/**
 * Distribui `count` entre os buckets por maior-resto, com piso de 1 em cada.
 * Sem {{nome}} disponivel o bucket com_nome sai e sua cota vai para os outros.
 */
function buildVariantBucketPlan(count, hasNameVariable) {
  const buckets = VARIANT_BUCKETS.filter((bucket) => hasNameVariable || !bucket.needsName);
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

const GREETING_PATTERN = /^(ola|olá|oi|opa|fala|bom dia|boa tarde|boa noite|tudo bem|e ai|e aí)\b/i;

function countWords(text) {
  return normalizeString(text).split(/\s+/).filter(Boolean).length;
}

/** Checagem barata de quais estruturas faltam, para direcionar a chamada de complemento. */
function describeMissingStructures(variants, hasNameVariable) {
  const missing = [];
  if (!variants.some((v) => countWords(v) <= 6 && !GREETING_PATTERN.test(v))) {
    missing.push("- uma frase curta e direta, no maximo 6 palavras, SEM saudacao");
  }
  if (!variants.some((v) => !/\?\s*$/.test(v))) {
    missing.push('- uma variacao que NAO termine em "?"');
  }
  if (!variants.some((v) => v.split(/[.!?]+\s/).filter(Boolean).length >= 2)) {
    missing.push("- uma variacao de duas frases, entre 15 e 25 palavras");
  }
  if (hasNameVariable && !variants.some((v) => /\{\{\s*nome\s*\}\}/i.test(v))) {
    missing.push("- uma variacao que use {{nome}}");
  }
  if (variants.length > 0) {
    const words = variants.map(countWords);
    if (Math.max(...words) < Math.min(...words) * 3) {
      missing.push("- uma variacao bem mais longa que as existentes (3x o tamanho da menor)");
    }
  }
  return missing.length > 0 ? missing.join("\n") : "- nenhuma especifica; apenas varie bastante a estrutura";
}

export async function generateCampaignTemplateVariants(input = {}) {
  const count = Math.min(
    Math.max(Number.parseInt(String(input.count ?? "8"), 10) || 8, 2),
    MAX_TEMPLATE_VARIANTS
  );
  const baseText = normalizeString(input.baseText);
  const availableVariables = sanitizeAvailableVariables(input.availableVariables);
  const hasNameVariable = availableVariables.includes("nome");
  const bucketPlan = buildVariantBucketPlan(count, hasNameVariable);
  const nameMin = hasNameVariable ? Math.ceil(count * 0.35) : 0;
  const nameMax = hasNameVariable ? Math.floor(count * 0.6) : 0;
  const context = {
    campaignName: normalizeString(input.campaignName),
    goal: normalizeString(input.goal),
    style: normalizeString(input.style),
    baseText,
    count,
    availableVariables,
    segmentation: sanitizeSegmentContext(input.segmentation),
    sequence: sanitizeSequence(input.sequence)
  };

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

  // Formato explicito no prompt: em json_object o modelo nao recebe o schema,
  // entao a forma precisa estar escrita no texto, senao ele inventa as chaves.
  const formatoObrigatorio = `

FORMATO DA RESPOSTA (obrigatorio):
Responda APENAS com um objeto JSON exatamente assim, sem markdown e sem texto fora do JSON:
{"variants": ["variacao 1", "variacao 2", "..."], "rationale": "explicacao curta"}
O array "variants" DEVE conter EXATAMENTE ${count} strings diferentes entre si.`;

  const taskPrompt = `Você é um especialista em comunicação via WhatsApp (pt-BR). Gere ${count} variações da mensagem em "baseText" para rotação de texto antiban.

O objetivo NÃO é reescrever a mesma frase de ${count} jeitos. Paráfrases com o mesmo esqueleto são agrupadas trivialmente por um classificador de similaridade — que é exatamente o que a detecção de spam do WhatsApp faz. O que protege o chip é DIVERSIDADE ESTRUTURAL: comprimentos diferentes, número de frases diferente, com e sem saudação, com e sem pergunta.

Contexto da mensagem:
${JSON.stringify(context, null, 2)}

DISTRIBUIÇÃO OBRIGATÓRIA POR ESTRUTURA (some exatamente ${count}):
${bucketPlan.length > 0
  ? bucketPlan.map((bucket) => `- ${bucket.size} do tipo "${bucket.key}": ${bucket.rule}`).join("\n")
  : `- Distribua entre: frase curta e direta sem saudação, saudação + pergunta, mensagem com o motivo do contato, mensagem de duas frases, e ao menos uma que NÃO termine em "?".`}

REGRAS:
1. O sentido, a oferta e o propósito não podem mudar. Mantenha o tom e o nível de formalidade do "baseText".
2. VOCÊ PODE E DEVE mudar estrutura, comprimento, número de frases e tipo de frase (pergunta pode virar afirmação e vice-versa). Isso é o objetivo, não um efeito colateral.
3. A variação mais longa deve ter pelo menos 3× o número de palavras da mais curta.
4. No máximo 60% das variações podem começar com saudação.
5. Ao menos uma variação NÃO pode terminar em "?".
6. ${hasNameVariable
  ? `Entre ${nameMin} e ${nameMax} das ${count} variações devem usar {{nome}}. As demais NÃO podem usar {{nome}} — leads sem nome preenchido dependem delas.`
  : `NENHUMA variação pode usar {{nome}}: essa variável não existe nesta campanha.`}
7. ${availableVariables.length > 0
  ? `Só é permitido usar estas variáveis: ${availableVariables.map((name) => `{{${name}}}`).join(", ")}. Nenhuma outra, em hipótese alguma.`
  : `NÃO use nenhuma variável {{...}}. Esta campanha não tem variáveis disponíveis.`}
8. Nenhuma variação pode ser repetição literal de outra.
9. Não use AIDA, PAS, falsa urgência, nem invente benefício ou dor que não esteja no "baseText".
10. Sem markdown, sem lista numerada, sem emoji excessivo. Mensagens limpas, prontas para envio.${formatoObrigatorio}`;

  let parsed;
  try {
    parsed = await callGroqJson({ schemaName: "campaign_template_variants", schema, taskPrompt });
  } catch (err) {
    // A validacao estrita da Groq falha de forma intermitente em contagem alta e
    // derruba a requisicao inteira (502 na rota). O json_object nao valida forma,
    // e a leitura tolerante + complemento abaixo ja cobrem o que vier torto.
    // Falha nas DUAS tentativas continua subindo — nao engolir erro.
    console.warn("[campaign-ai] json_schema falhou, repetindo em json_object:", err?.message || err);
    parsed = await callGroqJson({
      schemaName: "campaign_template_variants",
      schema,
      taskPrompt,
      preferJsonObject: true,
    });
  }

  let variants = dedupeVariants(extractVariantList(parsed));

  // Completa o que faltou numa unica chamada extra. Sem isso, modelo sem
  // json_schema devolvia 3 de 8 e o usuario ficava sem as variacoes restantes.
  if (variants.length < count) {
    try {
      const faltam = count - variants.length;
      const extra = await callGroqJson({
        schemaName: "campaign_template_variants",
        schema,
        taskPrompt: `Gere mais ${faltam} variações humanizadas em pt-BR da mensagem base abaixo, para rotação antiban.

Mensagem base:
"""${baseText}"""

Variações que JÁ existem (não repita nenhuma, nem com pequenas trocas):
${variants.map((v, i) => `${i + 1}. ${v}`).join("\n")}

ESTRUTURAS QUE AINDA FALTAM — priorize estas:
${describeMissingStructures(variants, hasNameVariable)}

Regras: mantenha o sentido e o tom da mensagem base, mas VARIE a estrutura e o comprimento (não parafraseie). ${availableVariables.length > 0
  ? `Só use estas variáveis: ${availableVariables.map((name) => `{{${name}}}`).join(", ")}.`
  : `NÃO use nenhuma variável {{...}}.`} Sem markdown.

FORMATO DA RESPOSTA (obrigatorio):
Responda APENAS com {"variants": ["..."], "rationale": "..."} contendo EXATAMENTE ${faltam} strings.`,
      });
      variants = dedupeVariants([...variants, ...extractVariantList(extra)]);
    } catch (err) {
      // Uma falha aqui nao pode derrubar as variacoes que ja vieram.
      console.warn("[campaign-ai] complemento de variacoes falhou:", err?.message || err);
    }
  }

  return {
    variants: variants.slice(0, count),
    requested: count,
    rationale: normalizeString(parsed?.rationale),
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
