// Análise inteligente da conversa do WhatsApp para o Banco de Dados.
//
// Antes o "Resumo Semântico da IA" era só `messages.slice(0,3).join(" | ")` —
// copiava a primeira frase da conversa e não dizia nada útil. Aqui a conversa é
// lida por um modelo e devolve: pontos-chave, diagnóstico do lead e a próxima
// ação recomendada (follow-up ou campanha), que é o que o operador precisa para
// decidir a abordagem.
//
// Se a IA não estiver configurada ou falhar, o chamador usa o resumo heurístico
// como fallback — a extração nunca quebra por causa disto.

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

function getModel() {
  const raw = String(process.env.GROQ_CAMPAIGN_AI_MODEL || "").trim();
  // Env quebrada (ex.: "llama 3.3 70b/llama 3.1 8b/mixtral") derruba a chamada com
  // model_not_found; nesses casos cai no padrão.
  if (!raw || raw.includes(" ") || raw.split("/").length > 2) return DEFAULT_GROQ_MODEL;
  return raw;
}

const PROMPT = `Você analisa conversas de WhatsApp de uma agência para qualificar leads.

Receba a conversa e devolva JSON com EXATAMENTE estas chaves:
{
  "pontos_chave": "1 a 3 frases curtas com o que de fato foi tratado (assunto, necessidade, objeções, combinados). Sem repetir a mensagem literal.",
  "diagnostico": "leitura do estágio do lead: qual o interesse real, o que trava a decisão e o nível de prontidão para compra.",
  "proxima_acao": "a abordagem recomendada, concreta e acionável (o que dizer/oferecer e quando).",
  "canal_sugerido": "followup" | "campanha" | "contato_direto",
  "prioridade": "alta" | "media" | "baixa"
}

Regras:
- Português do Brasil, linguagem comercial simples, sem jargão.
- Baseie-se SÓ na conversa. Não invente fatos, valores ou combinados.
- Se a conversa for irrelevante (spam, engano, mensagem automática), diga isso em pontos_chave e use prioridade "baixa".
- Responda SOMENTE o JSON, sem texto fora dele.`;

/**
 * @param {string[]} messages  mensagens da conversa (ordem cronológica)
 * @param {string} contactName
 * @returns {Promise<{summary:string, canalSugerido:string|null, prioridade:string|null}|null>}
 */
export async function summarizeChatWithAI(messages, contactName) {
  const texts = (messages || []).map((m) => String(m || "").trim()).filter(Boolean);
  if (!process.env.GROQ_API_KEY || texts.length === 0) return null;

  // Conversa recortada: as últimas mensagens são as que importam para a decisão.
  const conversa = texts.slice(-25).join("\n").slice(0, 6000);

  try {
    const response = await fetch(GROQ_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: `Contato: ${contactName || "desconhecido"}\n\nConversa:\n${conversa}` },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn("[chat-insight] Groq HTTP", response.status, body.slice(0, 200));
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    const pontos = String(parsed?.pontos_chave || "").trim();
    const diag = String(parsed?.diagnostico || "").trim();
    const acao = String(parsed?.proxima_acao || "").trim();
    if (!pontos && !diag && !acao) return null;

    const summary = [
      pontos && `📌 ${pontos}`,
      diag && `🔎 ${diag}`,
      acao && `➡️ ${acao}`,
    ].filter(Boolean).join("\n");

    return {
      summary: summary.slice(0, 1200),
      canalSugerido: parsed?.canal_sugerido ? String(parsed.canal_sugerido) : null,
      prioridade: parsed?.prioridade ? String(parsed.prioridade) : null,
    };
  } catch (err) {
    console.warn("[chat-insight] falhou:", err?.message || err);
    return null;
  }
}
