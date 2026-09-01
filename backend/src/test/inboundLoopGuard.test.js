// Loop do alerta de SDR: o texto do proprio alerta voltava como mensagem de
// entrada e disparava outro alerta — 8 chamadas de LLM e 8 envios de WhatsApp
// num ciclo. Este teste exercita a guarda REAL do webhook.
//
// O que ele prova, para cada trava: evento bloqueado nao chega em LLM nem em
// envio, e mensagem de lead de verdade continua passando.

import { describe, expect, it, beforeEach } from "vitest";
import {
  shouldIgnoreInboundEvent,
  isFromMe,
  resolveInboundEventName,
  resolveMessageId,
  _resetInboundGuard,
} from "../services/inboundGuard.js";

const ALERTA_SDR =
  "🔔 *Lead recontato — já qualificado anteriormente*\n📱 Número: 5534999996397";

/** Simula o handler: so chama LLM/envio quando a guarda deixa passar. */
function processarEvento(body, efeitos, agora) {
  const fromMe = isFromMe(body);
  const guarda = shouldIgnoreInboundEvent(body, agora);
  if (guarda.ignore) {
    efeitos.ignorados.push(guarda.reason);
    return guarda.reason;
  }
  if (fromMe) {
    efeitos.gravadasOutbound = (efeitos.gravadasOutbound || 0) + 1;
    return "fromMe";
  }
  efeitos.chamadasLLM += 1;
  efeitos.enviosWhatsApp += 1;
  return null;
}

function novosEfeitos() {
  return { chamadasLLM: 0, enviosWhatsApp: 0, ignorados: [] };
}

describe("guarda de loop do webhook de entrada", () => {
  beforeEach(() => _resetInboundGuard());

  it("evento fromMe=true nao gera envio nem chamada de LLM", () => {
    const efeitos = novosEfeitos();
    const motivo = processarEvento(
      { data: { key: { id: "MSG1", fromMe: true, remoteJid: "5534984085015@s.whatsapp.net" }, message: { conversation: ALERTA_SDR } } },
      efeitos,
      1000
    );

    expect(motivo).toBe("fromMe");
    expect(efeitos.chamadasLLM).toBe(0);
    expect(efeitos.enviosWhatsApp).toBe(0);
  });

  it("evento fromMe=false de lead real gera chamada de LLM e envio", () => {
    const efeitos = novosEfeitos();
    const motivo = processarEvento(
      {
        event: "messages.upsert",
        data: { key: { id: "MSG2", fromMe: false, remoteJid: "5534999996397@s.whatsapp.net" }, message: { conversation: "Posso sim" } },
      },
      efeitos,
      1000
    );

    expect(motivo).toBeNull();
    expect(efeitos.chamadasLLM).toBe(1);
    expect(efeitos.enviosWhatsApp).toBe(1);
  });

  it("eco de SEND_MESSAGE e ignorado mesmo sem fromMe no payload", () => {
    // O webhook e assinado em MESSAGES_UPSERT e SEND_MESSAGE. O eco do que nos
    // enviamos nem sempre traz key.fromMe — foi assim que o alerta voltou.
    const efeitos = novosEfeitos();
    const motivo = processarEvento(
      { event: "SEND_MESSAGE", data: { key: { id: "MSG3" }, message: { conversation: ALERTA_SDR } } },
      efeitos,
      1000
    );

    expect(motivo).toBe("evento_ignorado:send.message");
    expect(efeitos.chamadasLLM).toBe(0);
    expect(efeitos.enviosWhatsApp).toBe(0);
  });

  it("mesmo id reprocessado nao gera segundo envio", () => {
    const efeitos = novosEfeitos();
    const evento = {
      event: "messages.upsert",
      data: { key: { id: "MSG4", fromMe: false, remoteJid: "5534999996397@s.whatsapp.net" }, message: { conversation: "Posso sim" } },
    };

    expect(processarEvento(evento, efeitos, 1000)).toBeNull();
    expect(processarEvento(evento, efeitos, 2000)).toBe("duplicado");
    expect(processarEvento(evento, efeitos, 3000)).toBe("duplicado");

    expect(efeitos.chamadasLLM).toBe(1);
    expect(efeitos.enviosWhatsApp).toBe(1);
  });

  it("o ciclo real de 8 alertas para no primeiro", () => {
    const efeitos = novosEfeitos();
    for (let i = 0; i < 8; i += 1) {
      processarEvento(
        { event: "SEND_MESSAGE", data: { key: { id: `LOOP${i}`, fromMe: true }, message: { conversation: ALERTA_SDR } } },
        efeitos,
        1000 + i
      );
    }

    expect(efeitos.chamadasLLM).toBe(0);
    expect(efeitos.enviosWhatsApp).toBe(0);
    expect(efeitos.ignorados).toHaveLength(8);
  });

  it("chamada interna sem campo event continua passando", () => {
    // campaigns/routes.js posta {clientId, phone, message} sem "event".
    const efeitos = novosEfeitos();
    const motivo = processarEvento(
      { clientId: "geracao-digital", phone: "5534999996397", message: "Posso sim" },
      efeitos,
      1000
    );

    expect(motivo).toBeNull();
    expect(efeitos.chamadasLLM).toBe(1);
  });

  it("id ausente nao bloqueia mensagem legitima", () => {
    const efeitos = novosEfeitos();
    processarEvento({ clientId: "t", phone: "5511", message: "oi" }, efeitos, 1000);
    processarEvento({ clientId: "t", phone: "5511", message: "tudo bem?" }, efeitos, 2000);
    expect(efeitos.chamadasLLM).toBe(2);
  });

  it("detecta fromMe nos formatos conhecidos de payload", () => {
    expect(isFromMe({ data: { key: { fromMe: true } } })).toBe(true);
    expect(isFromMe({ key: { fromMe: true } })).toBe(true);
    expect(isFromMe({ data: { fromMe: true } })).toBe(true);
    expect(isFromMe({ fromMe: true })).toBe(true);
    expect(isFromMe({ data: { key: { fromMe: false } } })).toBe(false);
    expect(isFromMe({})).toBe(false);
  });

  it("normaliza o nome do evento entre as versoes da Evolution", () => {
    expect(resolveInboundEventName({ event: "MESSAGES_UPSERT" })).toBe("messages.upsert");
    expect(resolveInboundEventName({ event: "messages.upsert" })).toBe("messages.upsert");
    expect(resolveInboundEventName({})).toBe("");
    expect(resolveMessageId({ data: { key: { id: "ABC" } } })).toBe("ABC");
    expect(resolveMessageId({ waMessageId: "WAM123" })).toBe("WAM123");
    expect(resolveMessageId({})).toBe("");
  });

  it("encaminhamento interno sem messageId é rejeitado imediatamente", () => {
    const efeitos = novosEfeitos();
    const motivo = processarEvento(
      { isInternalForward: true, clientId: "geracao-digital", phone: "5534999996397", message: "Mensagem forward" },
      efeitos,
      1000
    );

    expect(motivo).toBe("internal_forward_missing_id");
    expect(efeitos.chamadasLLM).toBe(0);
    expect(efeitos.enviosWhatsApp).toBe(0);
  });

  it("encaminhamento interno com messageId passa no 1o turno e bloqueia duplicata", () => {
    const efeitos = novosEfeitos();
    const payload = {
      isInternalForward: true,
      waMessageId: "WA_ORIG_999",
      clientId: "geracao-digital",
      phone: "5534999996397",
      message: "Mensagem forward",
    };

    const primeiro = processarEvento(payload, efeitos, 1000);
    expect(primeiro).toBeNull();
    expect(efeitos.chamadasLLM).toBe(1);

    const segundo = processarEvento(payload, efeitos, 1050);
    expect(segundo).toBe("duplicado");
    expect(efeitos.chamadasLLM).toBe(1);
  });
});
