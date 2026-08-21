// backend/src/domains/leads/chatInsight.js
// Análise inteligente da conversa do WhatsApp para o Banco de Dados e WhatsApp Inbox.
//
// Lê o histórico da conversa e devolve: pontos-chave (📌), diagnóstico do lead (🔎)
// e a próxima ação recomendada (➡️) para o operador.

import { callLlmChatCompletion } from "../../chatbot-ai-engine.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

function getModel() {
  const raw = String(process.env.GROQ_CAMPAIGN_AI_MODEL || process.env.GROQ_MODEL || "").trim();
  if (!raw || raw.includes(" ") || raw.includes("gpt-oss")) return DEFAULT_GROQ_MODEL;
  return raw;
}

const PROMPT = `Você analisa conversas de WhatsApp para qualificar leads comerciais.

Receba o histórico de mensagens e devolva JSON com EXATAMENTE estas chaves:
{
  "pontos_chave": "1 a 3 frases curtas com o que de fato foi tratado (assunto, necessidade, objeções, dúvidas, combinados). Sem repetir a mensagem literal.",
  "diagnostico": "leitura do estágio do lead: qual o interesse real, o que trava a decisão e o nível de prontidão para avançar/comprar.",
  "proxima_acao": "a abordagem recomendada, concreta e acionável para o consultor (o que dizer/oferecer e quando).",
  "canal_sugerido": "followup" | "campanha" | "contato_direto",
  "prioridade": "alta" | "media" | "baixa"
}

Regras:
- Português do Brasil, linguagem comercial simples, direta e profissional.
- Baseie-se SÓ nas mensagens. Se houver áudios ou conversa inicial curta, sintetize o contexto até o momento e oriente o consultor a ouvir/dar prosseguimento.
- Responda SOMENTE o JSON, sem texto fora dele.`;

/**
 * @param {string[]} messages  mensagens da conversa (ordem cronológica)
 * @param {string} contactName
 * @returns {Promise<{summary:string, canalSugerido:string|null, prioridade:string|null}|null>}
 */
export async function summarizeChatWithAI(messages, contactName) {
  const texts = (messages || []).map((m) => String(m || "").trim()).filter(Boolean);
  if (texts.length === 0) return null;

  // Conversa recortada: as últimas 30 mensagens
  const conversa = texts.slice(-30).join("\n").slice(0, 8000);

  // 1. Tenta via callLlmChatCompletion (suporta Groq, OpenAI, Gemini com retries automáticos)
  try {
    const rawResult = await callLlmChatCompletion({
      model: getModel(),
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `Contato: ${contactName || "desconhecido"}\n\nHistórico da Conversa:\n${conversa}` },
      ],
    });

    if (rawResult) {
      let parsed = null;
      try {
        parsed = typeof rawResult === "object" ? rawResult : JSON.parse(rawResult);
      } catch (_) {
        const match = String(rawResult).match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (_) {}
        }
      }

      const pontos = String(parsed?.pontos_chave || "").trim();
      const diag = String(parsed?.diagnostico || "").trim();
      const acao = String(parsed?.proxima_acao || "").trim();

      if (pontos || diag || acao) {
        const summary = [
          pontos && `📌 ${pontos}`,
          diag && `🔎 ${diag}`,
          acao && `➡️ ${acao}`,
        ].filter(Boolean).join("\n\n");

        return {
          summary: summary.slice(0, 1200),
          canalSugerido: parsed?.canal_sugerido ? String(parsed.canal_sugerido) : null,
          prioridade: parsed?.prioridade ? String(parsed.prioridade) : null,
        };
      }
    }
  } catch (err) {
    console.warn("[chat-insight] callLlmChatCompletion falhou, tentando fallback direto:", err?.message || err);
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
            temperature: 0.2,
            max_tokens: 500,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: PROMPT },
              { role: "user", content: `Contato: ${contactName || "desconhecido"}\n\nHistórico da Conversa:\n${conversa}` },
            ],
          }),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;

        const parsed = JSON.parse(content);
        const pontos = String(parsed?.pontos_chave || "").trim();
        const diag = String(parsed?.diagnostico || "").trim();
        const acao = String(parsed?.proxima_acao || "").trim();
        if (!pontos && !diag && !acao) continue;

        const summary = [
          pontos && `📌 ${pontos}`,
          diag && `🔎 ${diag}`,
          acao && `➡️ ${acao}`,
        ].filter(Boolean).join("\n\n");

        return {
          summary: summary.slice(0, 1200),
          canalSugerido: parsed?.canal_sugerido ? String(parsed.canal_sugerido) : null,
          prioridade: parsed?.prioridade ? String(parsed.prioridade) : null,
        };
      } catch (e) {
        console.warn(`[chat-insight] groq fallback (${m}) falhou:`, e?.message || e);
      }
    }
  }

  return null;
}
