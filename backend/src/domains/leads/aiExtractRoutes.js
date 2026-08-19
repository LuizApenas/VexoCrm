// backend/src/domains/leads/aiExtractRoutes.js
// Endpoint de extração semântica e inteligente de contatos/conversas com Groq (Llama 3.3 70B Versatile).

import Groq from "groq-sdk";

let _groq = null;
function getGroq() {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

export function registerAiExtractRoutes(app, deps) {
  const {
    requireFirebaseAuth,
    requireAppViewAccess,
  } = deps;

  app.post(
    "/api/leads/ai-extract",
    requireFirebaseAuth,
    requireAppViewAccess("leads"),
    async (req, res) => {
      try {
        const { rawText, defaultOrigin } = req.body || {};

        if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
          return res.status(400).json({
            success: false,
            error: {
              code: "MISSING_RAW_TEXT",
              message: "O texto ou diálogo para análise é obrigatório.",
            },
          });
        }

        if (!process.env.GROQ_API_KEY) {
          return res.status(503).json({
            success: false,
            error: {
              code: "GROQ_DISABLED",
              message: "Groq não configurado no servidor.",
            },
          });
        }

        const prompt = `Você é um extrator de contatos comerciais de alta precisão. Analise o texto abaixo (que pode conter diálogos de Instagram Direct, LinkedIn, E-mail ou WhatsApp) e extraia TODOS os contatos/leads identificáveis.

Para cada contato encontrado, retorne um objeto JSON com:
- "nome": string (Nome da pessoa ou perfil, ou "Não informado")
- "telefone": string (Apenas os dígitos com DDD do Brasil ex: 5534999999999, ou null se não houver telefone)
- "email": string ou null
- "origem": string (ex: "${defaultOrigin || "Instagram Direct"}")
- "interesse": string (resumo do produto, dor ou serviço procurado)
- "temperatura": "Quente" | "Morno" | "Frio"
- "valor_estimado": number ou null

Retorne ESTRITAMENTE um JSON no formato:
{
  "leads": [
    {
      "nome": "...",
      "telefone": "55...",
      "email": "...",
      "origem": "...",
      "interesse": "...",
      "temperatura": "Quente",
      "valor_estimado": null
    }
  ]
}

Texto para análise:
"""
${rawText}
"""`;

        const groq = getGroq();
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Você é um extrator de contatos comerciais que responde ESTRITAMENTE com um objeto JSON válido contendo a chave 'leads'.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const rawContent = completion.choices?.[0]?.message?.content || "{}";
        let parsed = {};
        try {
          parsed = JSON.parse(rawContent);
        } catch {
          const match = rawContent.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          } else {
            throw new Error("A IA não retornou um JSON válido.");
          }
        }

        const rawLeads = Array.isArray(parsed.leads) ? parsed.leads : [];
        const leads = rawLeads.map((item) => {
          let cleanPhone = null;
          if (item.telefone) {
            const digits = String(item.telefone).replace(/\D/g, "");
            if (digits.length >= 8) {
              cleanPhone = digits.startsWith("55") ? digits : `55${digits}`;
            }
          }

          return {
            nome: String(item.nome || "Não informado").trim(),
            telefone: cleanPhone,
            email: item.email ? String(item.email).trim() : null,
            origem: String(item.origem || defaultOrigin || "Instagram Direct").trim(),
            interesse: String(item.interesse || "Geral").trim(),
            temperatura: ["Quente", "Morno", "Frio"].includes(item.temperatura)
              ? item.temperatura
              : "Morno",
            valor_estimado:
              typeof item.valor_estimado === "number" ? item.valor_estimado : null,
          };
        });

        return res.json({
          success: true,
          leads,
        });
      } catch (error) {
        console.error("[ai-extract] Erro ao extrair leads:", error);
        return res.status(500).json({
          success: false,
          error: {
            code: "AI_EXTRACT_FAILED",
            message:
              error instanceof Error ? error.message : "Falha na extração de contatos com IA.",
          },
        });
      }
    }
  );
}
