// Guarda de entrada do webhook do WhatsApp.
//
// Existe por causa de um loop real em producao: o alerta de recontato enviado
// para o SDR voltou como mensagem de ENTRADA e disparou outro alerta, 8 vezes
// seguidas — 8 chamadas de LLM e 8 envios, o bot conversando com ele mesmo.
//
// Sao tres travas independentes de proposito. A de fromMe sozinha ja existia e
// nao segurou: o webhook e assinado tambem em SEND_MESSAGE (services/
// evolution.js), e o eco de uma mensagem enviada nem sempre traz key.fromMe no
// mesmo lugar. Uma trava que depende do formato do payload de terceiro nao pode
// ser a unica.

const processados = new Map();
const TTL_MS = 10 * 60 * 1000;
const MAX_IDS = 5000;

/** Evolution manda "messages.upsert" ou "MESSAGES_UPSERT" conforme a versao. */
export function resolveInboundEventName(body) {
  const bruto = body?.event ?? body?.Event ?? body?.eventName ?? "";
  return String(bruto || "").trim().toLowerCase().replace(/_/g, ".");
}

/** Cobre os formatos ja vistos: data.key.key, key solto e o campo plano. */
export function isFromMe(body) {
  return (
    body?.data?.key?.fromMe === true ||
    body?.key?.fromMe === true ||
    body?.data?.fromMe === true ||
    body?.fromMe === true
  );
}

export function resolveMessageId(body) {
  const bruto =
    body?.data?.key?.id ??
    body?.data?.[0]?.key?.id ??
    body?.data?.messages?.[0]?.key?.id ??
    body?.key?.id ??
    body?.messageId ??
    body?.data?.messageId ??
    body?.id ??
    "";
  return String(bruto || "").trim();
}

function registrarId(id, agora) {
  processados.set(id, agora);
  if (processados.size <= MAX_IDS) return;
  // Poda os mais antigos primeiro; Map preserva ordem de insercao.
  const excedente = processados.size - MAX_IDS;
  let removidos = 0;
  for (const chave of processados.keys()) {
    processados.delete(chave);
    if (++removidos >= excedente) break;
  }
}

/**
 * Deve ignorar este evento? Roda ANTES de qualquer buffering, chamada de LLM ou
 * envio. Devolve o motivo para o log — silencio sem motivo esconde loop.
 */
export function shouldIgnoreInboundEvent(body, agora = Date.now()) {
  if (isFromMe(body)) return { ignore: true, reason: "fromMe" };

  // Sem event (chamada interna do proprio backend) segue o fluxo. Com event
  // diferente de messages.upsert — SEND_MESSAGE, por exemplo — nao e mensagem
  // de lead: e o eco do que nos mesmos mandamos.
  const evento = resolveInboundEventName(body);
  if (evento && evento !== "messages.upsert") {
    return { ignore: true, reason: `evento_ignorado:${evento}` };
  }

  // Trava independente das duas acima: o MESMO id reprocessado nao gera segundo
  // envio, venha ele por reentrega da Evolution, retry ou caminho novo.
  const id = resolveMessageId(body);
  if (id) {
    const visto = processados.get(id);
    if (visto !== undefined && agora - visto < TTL_MS) {
      return { ignore: true, reason: "duplicado" };
    }
    registrarId(id, agora);
  } else if (evento === "messages.upsert") {
    console.warn("[inbound-guard] messageId vazio no evento messages.upsert da Evolution:", JSON.stringify(body).slice(0, 200));
  }

  return { ignore: false, reason: null };
}

/** Só para teste: zera a memória de deduplicação. */
export function _resetInboundGuard() {
  processados.clear();
}
