// backend/src/domains/leads/aiExtractRoutes.js
// Endpoint de extração semântica e inteligente de contatos/conversas com Groq (Llama 3.3 70B Versatile).

import { callLlmChatCompletion } from "../../chatbot-ai-engine.js";

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

        if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
          return res.status(503).json({
            success: false,
            error: {
              code: "GROQ_DISABLED",
              message: "Provedor de IA não configurado no servidor.",
            },
          });
        }

        const prompt = `Você é um extrator de contatos comerciais de alta precisão.
Analise o texto abaixo (que contém diálogos de Instagram Direct, LinkedIn, E-mail ou WhatsApp) e extraia TODOS os contatos/leads identificáveis.

Para cada contato encontrado, retorne um objeto JSON com:
- "nome": string (Nome da pessoa ou @username do perfil, ex: "Eliés Sousa" ou "@eliessousa")
- "telefone": string ou null (Apenas dígitos com DDD ex: 5534999999999, ou null se não houver telefone no texto)
- "email": string ou null
- "origem": string (ex: "${defaultOrigin || "Instagram Direct"}")
- "interesse": string (resumo do assunto ou produto. Se for conversa informal/direct, coloque "Interação no Direct")
- "temperatura": "Quente" | "Morno" | "Frio"
- "valor_estimado": number ou null

MESMO QUE NÃO HAJA NÚMERO DE TELEFONE, retorne o contato com o Nome/Perfil identificado.

Retorne ESTRITAMENTE um JSON no formato:
{
  "leads": [
    {
      "nome": "...",
      "telefone": "55...",
      "email": null,
      "origem": "Instagram Direct",
      "interesse": "Interação no Direct",
      "temperatura": "Frio",
      "valor_estimado": null
    }
  ]
}

Texto para análise:
"""
${rawText}
"""`;

        const rawContent = await callLlmChatCompletion({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente que responde APENAS com um objeto JSON contendo a propriedade 'leads'.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        let parsed = {};
        try {
          parsed = JSON.parse(rawContent);
        } catch (parseError) {
          console.warn("[ai-extract] JSON parse fallback:", parseError);
          const match = String(rawContent || "").match(/\{[\s\S]*\}/);
          if (match) {
            try {
              parsed = JSON.parse(match[0]);
            } catch {
              parsed = {};
            }
          }
        }

        const rawLeads = Array.isArray(parsed?.leads) ? parsed.leads : [];
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
