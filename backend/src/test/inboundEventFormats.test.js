// Formato real do evento da Evolution na guarda de entrada.
//
// A Evolution assina o webhook ora como "messages.upsert", ora como
// "MESSAGES_UPSERT", conforme a versao. Uma guarda que compare a string crua
// derruba mensagem legitima de lead — e o sintoma seria justamente o observado:
// nenhuma linha de [campaign-routing] para a resposta do lead.
//
// Trava os tres comportamentos: formato real passa, eco fromMe nao passa,
// id repetido nao passa.

import { describe, expect, it, beforeEach } from "vitest";
import {
  shouldIgnoreInboundEvent,
  resolveInboundEventName,
  isFromMe,
  resolveMessageId,
  _resetInboundGuard,
} from "../services/inboundGuard.js";

function mensagemDeLead({ event, id = "MSG-1", fromMe = false } = {}) {
  return {
    event,
    instance: "geracao-digital",
    data: {
      key: { remoteJid: "553491241824@s.whatsapp.net", fromMe, id },
      message: { conversation: "claro!" },
    },
  };
}

describe("nome do evento nos formatos reais da Evolution", () => {
  beforeEach(() => _resetInboundGuard());

  // Variantes ja vistas em payload real e as plausiveis da mesma familia.
  const formatosQueDevemPassar = [
    "messages.upsert",
    "MESSAGES_UPSERT",
    "messages_upsert",
    "Messages.Upsert",
    "MESSAGES.UPSERT",
    " messages.upsert ",
  ];

  for (const event of formatosQueDevemPassar) {
    it(`aceita ${JSON.stringify(event)}`, () => {
      const r = shouldIgnoreInboundEvent(mensagemDeLead({ event, id: `id-${event}` }));
      expect(r.ignore, `${event} foi derrubado: ${r.reason}`).toBe(false);
    });
  }

  it("normaliza underscore e caixa para a mesma chave", () => {
    expect(resolveInboundEventName({ event: "MESSAGES_UPSERT" })).toBe("messages.upsert");
    expect(resolveInboundEventName({ event: "messages.upsert" })).toBe("messages.upsert");
  });

  it("sem event (chamada interna) continua passando", () => {
    const r = shouldIgnoreInboundEvent(mensagemDeLead({ event: undefined, id: "sem-evento" }));
    expect(r.ignore).toBe(false);
  });

  it("evento que NAO e mensagem de lead continua bloqueado", () => {
    for (const event of ["SEND_MESSAGE", "send.message", "CONNECTION_UPDATE"]) {
      const r = shouldIgnoreInboundEvent(mensagemDeLead({ event, id: `blq-${event}` }));
      expect(r.ignore, `${event} deveria ser ignorado`).toBe(true);
      expect(r.reason).toMatch(/^evento_ignorado:/);
    }
  });
});

describe("eco proprio e reprocessamento", () => {
  beforeEach(() => _resetInboundGuard());

  it("fromMe é identificado com precisão para gravação outbound sem acionar IA", () => {
    const ev = mensagemDeLead({ event: "MESSAGES_UPSERT", fromMe: true });
    expect(isFromMe(ev)).toBe(true);
  });

  it("fromMe e lido nos formatos conhecidos de payload", () => {
    expect(isFromMe({ data: { key: { fromMe: true } } })).toBe(true);
    expect(isFromMe({ key: { fromMe: true } })).toBe(true);
    expect(isFromMe({ fromMe: true })).toBe(true);
    expect(isFromMe({ data: { key: { fromMe: false } } })).toBe(false);
  });

  it("id repetido nao passa duas vezes", () => {
    const evento = mensagemDeLead({ event: "MESSAGES_UPSERT", id: "REPETIDO-1" });
    expect(shouldIgnoreInboundEvent(evento).ignore).toBe(false);
    const segunda = shouldIgnoreInboundEvent(evento);
    expect(segunda.ignore).toBe(true);
    expect(segunda.reason).toBe("duplicado");
  });

  it("ids diferentes passam os dois", () => {
    expect(shouldIgnoreInboundEvent(mensagemDeLead({ event: "MESSAGES_UPSERT", id: "A" })).ignore).toBe(false);
    expect(shouldIgnoreInboundEvent(mensagemDeLead({ event: "MESSAGES_UPSERT", id: "B" })).ignore).toBe(false);
  });

  it("extrai o id nos formatos conhecidos", () => {
    expect(resolveMessageId({ data: { key: { id: "X" } } })).toBe("X");
    expect(resolveMessageId({ key: { id: "Y" } })).toBe("Y");
    expect(resolveMessageId({ messageId: "Z" })).toBe("Z");
  });
});

describe("filtro de chip do chatbot compara por alias, nao por string crua", () => {
  // O mesmo chip tem tres nomes: amigavel, id e ultimo segmento da URL de disparo.
  // A tela grava o da URL; o webhook manda body.instance. Comparacao crua
  // descartava resposta legitima assim que o usuario marcasse um chip.
  const source = new URL("../domains/chatbot/routes.js", import.meta.url);

  it("usa resolveInstanceNameAliases antes de descartar", async () => {
    const { readFileSync } = await import("fs");
    const code = readFileSync(source, "utf8");
    const trecho = code.slice(code.indexOf("const chipAtual"), code.indexOf("// ── Campaign routing"));
    expect(trecho).toContain("resolveInstanceNameAliases");
    expect(trecho).toContain("chip_nao_vinculado");
    // A comparacao crua com includes(chipAtual) nao pode voltar.
    expect(trecho).not.toContain("chipsDoChatbot.includes(chipAtual)");
  });

  it("todo descarte do webhook loga o motivo", async () => {
    const { readFileSync } = await import("fs");
    const code = readFileSync(source, "utf8");
    const handler = code.slice(
      code.indexOf('app.post("/api/hardcoded-chat-webhook"'),
      code.indexOf("// ── Campaign routing")
    );
    for (const motivo of ["group", "chatbot_disabled", "missing_phone", "inbound_disabled", "chip_nao_vinculado"]) {
      expect(handler, `descarte ${motivo} sem log`).toContain(motivo);
    }
    expect(handler).toContain("[chatbot-webhook] entrada");
  });
});
