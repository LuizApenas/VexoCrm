// Extração assistida por IA dos campos do briefing a partir da transcrição.
//
// Substitui a heurística por palavra-chave que rodava no front. Aquela abordagem
// procurava a palavra na frase e devolvia a linha encontrada, o que numa
// transcrição real produzia sistematicamente o texto errado: a pergunta em vez
// da resposta, o nome de quem falou colado no valor, trechos do resumo
// automático da reunião e fragmentos sem sentido ("Ja."). Conversa humana não é
// estruturada o bastante para casamento de string.
//
// Reusa a mesma infra de IA do contrato e das campanhas (Groq / API compatível
// com OpenAI) — sem dependência nem chave nova.
import { sendError } from "../../services/httpInfra.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const STRICT_JSON_MODELS = new Set(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);

function getModel() {
  return process.env.GROQ_CAMPAIGN_AI_MODEL || DEFAULT_GROQ_MODEL;
}

// Campos do formulário de briefing. As descrições são o que guia a IA, então
// valem mais que o nome da chave. Espelham DEFAULT_BRIEFING_FIELDS no front.
const CAMPOS = {
  logo: "Onde está a logomarca em alta resolução ou como será enviada",
  instagram: "Login, usuário ou forma de acesso ao Instagram",
  facebook: "Login ou forma de acesso ao Facebook / página comercial",
  possui_bm: "Se a empresa possui Business Manager. Responda exatamente Sim, Não ou Não sei",
  google: "Login ou forma de acesso ao Google Ads / Analytics",
  site: "Endereço do site da empresa",
  dominios_dns: "Onde o domínio está hospedado (Cloudflare, Registro.br, etc.)",
  whatsapp: "Número de WhatsApp comercial",
  concorrentes: "Principais concorrentes diretos citados",
  inspiracao: "Perfis ou marcas citados como referência de estética",
  servicos: "Produtos e serviços que a empresa vende (core business) E o diferencial competitivo, o que faz o cliente escolher este negócio em vez do concorrente",
  localizacao: "Região, cidade ou abrangência geográfica de atuação",
  ticket_margem: "Ticket médio e margem de lucro",
  ja_rodou_trafego: "Se já investiu em tráfego pago antes. Responda exatamente Sim, Não ou Não sei",
  trafego_historico: "Com quem já rodou tráfego, resultados obtidos, o que funcionou e o que não funcionou",
  dores_publico: "Dores e necessidades do público-alvo",
  base_existente: "Se tem base de clientes, lista de e-mail ou seguidores para remarketing",
  produtos_trafego: "Quais produtos ou serviços serão o foco das campanhas pagas",
  objetivo_trafego: "Objetivo das campanhas (reconhecimento, alcance, leads, engajamento, vendas, remarketing)",
  verba: "Valor de verba disponível para anúncios",
  verba_periodicidade: "Periodicidade da verba. Responda exatamente Mensal, Semanal ou Por campanha/período",
  divisao_verba: "Como a verba se divide entre Google e Meta",
  sazonalidade: "Datas comemorativas, lançamentos ou promoções que puxam a demanda",
  tipo_pagamento: "Forma de pagamento da mídia",
  bloqueado: "Assuntos que a empresa NÃO quer abordar nos perfis",
  temas: "Temas que combinam com a empresa e devem ser abordados",
  "publico_alvo.genero": "Gênero do público-alvo",
  "publico_alvo.idade": "Faixa etária do público-alvo",
  "publico_alvo.classe": "Classe social do público-alvo",
  "publico_alvo.interesses": "Interesses e comportamentos do público-alvo",
  "publico_alvo.outros_detalhes": "Outros detalhes do público-alvo",
};

// json_schema não aceita ponto no nome da propriedade em todos os modelos, então
// as chaves viajam com underscore e são traduzidas de volta na saída.
const paraChaveIA = (k) => k.replace(/\./g, "__");
const daChaveIA = (k) => k.replace(/__/g, ".");

const BRIEFING_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(
    Object.entries(CAMPOS).map(([k, desc]) => [paraChaveIA(k), { type: "string", description: desc }])
  ),
  required: Object.keys(CAMPOS).map(paraChaveIA),
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  "Você extrai dados de briefing comercial a partir da transcrição de uma reunião em português do Brasil.",
  "Responda APENAS com JSON válido, sem markdown.",
  "REGRAS OBRIGATÓRIAS:",
  "1. NUNCA invente. Se a informação não estiver clara na transcrição, retorne string vazia.",
  "2. Extraia a RESPOSTA do cliente, nunca a pergunta de quem entrevista.",
  "3. NUNCA inclua o nome de quem falou no valor. Sem 'Fulano:', sem '[Fulano]', e sem citar",
  "   a pessoa em terceira pessoa ('Fulano confirma que...'). Escreva só o conteúdo da resposta.",
  "4. Ignore o resumo automático, itens de ação, marcações de tempo (00:13:31) e saudações.",
  "5. Não repita o mesmo texto em campos diferentes. Se dois campos disputam o mesmo trecho,",
  "   deixe no mais específico e retorne vazio no outro.",
  "6. Responda de forma curta e direta, com o fato, não com a narrativa da conversa.",
  "7. Nos campos que pedem uma opção exata, use exatamente uma das opções indicadas.",
].join(" ");

export async function extractBriefingFields(req, res) {
  try {
    const { transcricao } = req.body || {};
    if (!transcricao || String(transcricao).trim().length < 30) {
      return sendError(res, 400, "BAD_REQUEST", "Cole a transcrição da reunião para a IA extrair os campos.");
    }

    if (!process.env.GROQ_API_KEY) {
      return sendError(res, 503, "AI_DISABLED", "IA indisponível: GROQ_API_KEY não configurada no servidor.");
    }

    const model = getModel();
    const payload = {
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extraia os campos do briefing da transcrição abaixo:\n\n"""\n${String(transcricao).slice(0, 24000)}\n"""`,
        },
      ],
      response_format: STRICT_JSON_MODELS.has(model)
        ? { type: "json_schema", json_schema: { name: "briefing_fields", strict: true, schema: BRIEFING_SCHEMA } }
        : { type: "json_object" },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let parsed;
    try {
      const response = await fetch(GROQ_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      if (!response.ok) throw new Error(rawBody || `Groq HTTP ${response.status}`);
      const data = JSON.parse(rawBody);
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("A IA retornou uma resposta vazia.");
      parsed = JSON.parse(content);
    } finally {
      clearTimeout(timeout);
    }

    // Rede de segurança: mesmo instruída, a IA pode devolver o nome do falante.
    const limparFalante = (t) =>
      String(t || "")
        .replace(/^\s*\[?[\p{Lu}][\p{L}.'\- ]{1,40}\]?\s*:\s*/u, "")
        .replace(/\s*\(\d{1,2}:\d{2}(:\d{2})?\)\s*$/, "")
        .trim();

    const out = {};
    for (const chave of Object.keys(CAMPOS)) {
      const bruto = parsed?.[paraChaveIA(chave)] ?? parsed?.[chave];
      out[chave] = typeof bruto === "string" ? limparFalante(bruto) : "";
    }

    res.json({ success: true, data: out });
  } catch (error) {
    console.error("[extractBriefingFields] Error:", error);
    if (!res.headersSent) {
      sendError(res, 500, "INTERNAL_ERROR", "Erro ao extrair o briefing com a IA.");
    }
  }
}

export { CAMPOS as CAMPOS_BRIEFING, daChaveIA };
