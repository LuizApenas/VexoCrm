// backend/src/domains/leads/chatInsight.js
// Análise inteligente da conversa do WhatsApp para o Banco de Dados e WhatsApp Inbox.
//
// Lê o histórico da conversa e devolve no formato padrão (máximo 6 linhas):
// 🎯 [o que a pessoa quer]
// 📋 [fatos já estabelecidos: quantidades, datas, destino, valores, nomes]
// 🤝 [o que foi combinado ou prometido]
// ⏭️ [próximo passo concreto]

import { callLlmChatCompletion } from "../../chatbot-ai-engine.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export const DEFAULT_SUMMARY_PROMPT = `Você resume conversas de WhatsApp para o dono do negócio se situar sem precisar reler tudo.

Ele abre o chat depois de dias e precisa lembrar em dez segundos o que já foi combinado.

FORMATO EXATO, no máximo seis linhas:

🎯 [o que a pessoa quer, uma linha]
📋 [fatos já estabelecidos: quantas pessoas, datas, destino, valores, nomes. Literal, tirado da conversa]
🤝 [o que foi combinado ou prometido]
⏭️ [próximo passo concreto, uma linha]

REGRAS
· 📋 é a linha mais importante. São os fatos que se esquecem: "2 adultos e 1 criança de 4 anos", "quer ir em janeiro", "orçamento até 8 mil". Varra a conversa INTEIRA, não só as últimas mensagens.
· Nunca invente. O que não foi dito não entra.
· Bloco sem conteúdo real recebe "nada ainda". Nunca preencha com frase de efeito.
· ⏭️ jamais pode ser "dar continuidade ao contato comercial" nem "qualificar o interesse". Isso não diz nada. Tem que ser a ação exata: "cotar Maceió em janeiro para 2 adultos e 1 criança".
· Não use travessão.
· Não repita a conversa. Isso é resumo, não transcrição.
· Sem subitens (a)(b)(c), sem parágrafos, sem numeração.`;

function getModel() {
  const raw = String(process.env.GROQ_CAMPAIGN_AI_MODEL || process.env.GROQ_MODEL || "").trim();
  if (!raw || raw.includes(" ") || raw.includes("gpt-oss")) return DEFAULT_GROQ_MODEL;
  return raw;
}

/**
 * Normaliza e formata o retorno da IA no padrão estrito de 4 seções (máximo 6 linhas).
 * Tolera JSON parcial, chaves ausentes ou texto corrido sem descartar a resposta.
 */
export function formatSummaryOutput(raw) {
  if (!raw) return null;

  let objetivo = "";
  let fatos = "";
  let combinados = "";
  let proximo = "";

  // 1. Tenta interpretar como JSON
  let parsed = null;
  if (typeof raw === "object" && raw !== null) {
    parsed = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    try {
      parsed = JSON.parse(trimmed);
    } catch (_) {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (_) {}
      }
    }
  }

  if (parsed && typeof parsed === "object") {
    objetivo = String(parsed.objetivo || parsed.o_que_quer || parsed.interesse || "").trim();
    fatos = String(parsed.fatos || parsed.fatos_estabelecidos || parsed.pontos_chave || "").trim();
    combinados = String(parsed.combinados || parsed.o_que_foi_combinado || parsed.acordos || "").trim();
    proximo = String(parsed.proximo_passo || parsed.proxima_acao || parsed.acao || "").trim();
  } else if (typeof raw === "string") {
    // 2. Extrai de texto corrido baseado nos marcadores de emoji
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("🎯")) objetivo = line.replace(/^🎯\s*/, "").trim();
      else if (line.startsWith("📋")) fatos = line.replace(/^📋\s*/, "").trim();
      else if (line.startsWith("🤝")) combinados = line.replace(/^🤝\s*/, "").trim();
      else if (line.startsWith("⏭️")) proximo = line.replace(/^⏭️\s*/, "").trim();
      else if (!objetivo && !line.startsWith("📋") && !line.startsWith("🤝") && !line.startsWith("⏭️")) {
        // Se a primeira linha não tem emoji, assume objetivo
        objetivo = line;
      }
    }
  }

  // Limpeza de frases proibidas / vazias
  const sanitize = (val) => {
    if (!val || val === "null" || val === "undefined") return "nada ainda";
    let cleaned = val
      .replace(/[—–]/g, "-") // sem travessão
      .replace(/\b(dar continuidade ao contato comercial|qualificar o interesse)\b/gi, "nada ainda")
      .trim();
    return cleaned || "nada ainda";
  };

  objetivo = sanitize(objetivo);
  fatos = sanitize(fatos);
  combinados = sanitize(combinados);
  proximo = sanitize(proximo);

  // Se todos os 4 blocos forem "nada ainda", não é um resumo válido
  if (objetivo === "nada ainda" && fatos === "nada ainda" && combinados === "nada ainda" && proximo === "nada ainda") {
    return null;
  }

  const formattedLines = [
    `🎯 ${objetivo}`,
    `📋 ${fatos}`,
    `🤝 ${combinados}`,
    `⏭️ ${proximo}`,
  ];

  // Limite estrito de no máximo 6 linhas e 500 caracteres
  return formattedLines.slice(0, 6).join("\n").slice(0, 500);
}

/**
 * Busca prompt customizado do tenant se existir
 */
async function resolvePromptForTenant(clientId, options = {}) {
  if (options.customPrompt && typeof options.customPrompt === "string") {
    return options.customPrompt.trim();
  }

  if (!clientId) return DEFAULT_SUMMARY_PROMPT;

  // 1. Tenta via Postgres Pool se fornecido
  if (options.pool) {
    try {
      const res = await options.pool.query(
        "SELECT content FROM public.chatbot_prompts WHERE client_id = $1 AND type = 'resumo' LIMIT 1",
        [clientId]
      );
      if (res?.rows?.[0]?.content && res.rows[0].content.trim().length > 10) {
        return res.rows[0].content.trim();
      }
    } catch (_) {}
  }

  // 2. Tenta via Supabase client se fornecido
  if (options.supabase) {
    try {
      const { data } = await options.supabase
        .from("chatbot_prompts")
        .select("content")
        .eq("client_id", clientId)
        .eq("type", "resumo")
        .maybeSingle();
      if (data?.content && data.content.trim().length > 10) {
        return data.content.trim();
      }
    } catch (_) {}
  }

  return DEFAULT_SUMMARY_PROMPT;
}

/**
 * @param {string[]} messages  mensagens da conversa (ordem cronológica)
 * @param {string} contactName
 * @param {object} [options] { clientId, customPrompt, supabase, pool }
 * @returns {Promise<{summary:string|null, canalSugerido:string|null, prioridade:string|null, error?:string}|null>}
 */
export async function summarizeChatWithAI(messages, contactName, options = {}) {
  const texts = (messages || []).map((m) => String(m || "").trim()).filter(Boolean);
  if (texts.length === 0) {
    return { summary: null, error: "Nenhuma mensagem fornecida para análise." };
  }

  const clientId = options?.clientId || null;
  const promptToUse = await resolvePromptForTenant(clientId, options);

  // Varre a conversa inteira (até 100 mensagens ou 16.000 caracteres para não perder fatos iniciais)
  const conversa = texts.slice(-100).join("\n").slice(0, 16000);

  let lastError = null;

  // 1. Tenta via callLlmChatCompletion (suporta Groq, OpenAI, Gemini com retries automáticos)
  try {
    const rawResult = await callLlmChatCompletion({
      model: getModel(),
      temperature: 0.1,
      max_tokens: 350,
      messages: [
        { role: "system", content: promptToUse },
        { role: "user", content: `Contato: ${contactName || "desconhecido"}\n\nHistórico da Conversa:\n${conversa}` },
      ],
    });

    if (rawResult) {
      const summary = formatSummaryOutput(rawResult);
      if (summary) {
        return {
          summary,
          canalSugerido: "followup",
          prioridade: "media",
        };
      }
      lastError = "Formatação do resumo retornou vazio a partir da resposta da IA.";
    }
  } catch (err) {
    lastError = err?.message || String(err);
    console.warn("[chat-insight] callLlmChatCompletion falhou, tentando fallback direto:", lastError);
  }

  // 2. Fallback direto para Groq API com modelos canônicos
  if (process.env.GROQ_API_KEY) {
    const modelsToTry = [getModel(), "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
    for (const m of Array.from(new Set(modelsToTry))) {
      try {
        const response = await fetch(GROQ_BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: m,
            temperature: 0.1,
            max_tokens: 350,
            messages: [
              { role: "system", content: promptToUse },
              { role: "user", content: `Contato: ${contactName || "desconhecido"}\n\nHistórico da Conversa:\n${conversa}` },
            ],
          }),
        });

        if (!response.ok) {
          lastError = `Groq API status ${response.status}: ${response.statusText}`;
          continue;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          lastError = "Groq retornou conteúdo vazio.";
          continue;
        }

        const summary = formatSummaryOutput(content);
        if (summary) {
          return {
            summary,
            canalSugerido: "followup",
            prioridade: "media",
          };
        }
      } catch (e) {
        lastError = e?.message || String(e);
        console.warn(`[chat-insight] groq fallback (${m}) falhou:`, lastError);
      }
    }
  }

  // Falhou completamente: retorna null / erro explicativo. NUNCA template de mentira!
  return {
    summary: null,
    error: lastError || "Falha na chamada ao modelo de IA.",
  };
}
