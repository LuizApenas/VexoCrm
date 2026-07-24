// Transcrição do áudio da reunião (Groq Whisper).
//
// O navegador grava o microfone em SEGMENTOS curtos e manda um a um. Cada
// segmento é um arquivo completo e independente, então a transcrição vai
// aparecendo durante a reunião em vez de só no fim. Isso também contorna o
// limite de tamanho por arquivo da API, que uma reunião inteira estouraria.
//
// O áudio NÃO é gravado em lugar nenhum: chega, é transcrito e descartado.
// Fica só o texto, que o operador revisa na tela antes de preencher o briefing.
//
// Reusa a mesma chave da extração do briefing (GROQ_API_KEY).
import { sendError } from "../../services/httpInfra.js";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_MODEL = "whisper-large-v3-turbo";

// Teto por segmento. O express aceita 15mb de JSON e base64 infla ~33%, então
// mantemos folga. Segmento de ~2 min em Opus mono fica bem abaixo disso.
const MAX_BASE64_CHARS = 9_000_000;

export async function transcribeBriefingAudio(req, res) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return sendError(res, 503, "AI_DISABLED", "Transcrição indisponível: GROQ_API_KEY não configurada no servidor.");
    }

    const { audio_base64, mime_type } = req.body || {};
    if (!audio_base64 || typeof audio_base64 !== "string") {
      return sendError(res, 400, "BAD_REQUEST", "Envie o áudio do segmento em audio_base64.");
    }
    if (audio_base64.length > MAX_BASE64_CHARS) {
      return sendError(res, 413, "AUDIO_TOO_LARGE", "Segmento de áudio muito longo. Grave em blocos menores.");
    }

    // Aceita tanto data URL quanto base64 puro.
    const puro = audio_base64.includes(",") ? audio_base64.split(",").pop() : audio_base64;
    let buffer;
    try {
      buffer = Buffer.from(puro, "base64");
    } catch {
      return sendError(res, 400, "BAD_REQUEST", "Áudio inválido.");
    }
    if (!buffer?.length) {
      return sendError(res, 400, "BAD_REQUEST", "Áudio vazio.");
    }

    const tipo = typeof mime_type === "string" && mime_type.startsWith("audio/") ? mime_type : "audio/webm";
    const extensao = tipo.includes("ogg") ? "ogg" : tipo.includes("mp4") ? "m4a" : "webm";

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: tipo }), `segmento.${extensao}`);
    form.append("model", process.env.GROQ_TRANSCRIBE_MODEL || DEFAULT_MODEL);
    form.append("language", "pt");
    form.append("response_format", "json");
    // Sem contexto o Whisper erra jargão comercial recorrente destas reuniões.
    form.append(
      "prompt",
      "Reunião comercial de agência de marketing digital em português do Brasil. " +
        "Termos comuns: tráfego pago, Meta Ads, Google Ads, Business Manager, briefing, ticket médio, verba, remarketing."
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let texto = "";
    try {
      const resposta = await fetch(GROQ_TRANSCRIBE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: form,
        signal: controller.signal,
      });
      const bruto = await resposta.text();
      if (!resposta.ok) throw new Error(bruto || `Groq HTTP ${resposta.status}`);
      texto = String(JSON.parse(bruto)?.text || "").trim();
    } finally {
      clearTimeout(timeout);
    }

    // buffer sai de escopo aqui; nada é escrito em disco nem no banco.
    res.json({ success: true, texto });
  } catch (error) {
    console.error("[transcribeBriefingAudio] Error:", error);
    if (!res.headersSent) {
      sendError(res, 500, "INTERNAL_ERROR", "Erro ao transcrever o áudio.");
    }
  }
}
