import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateOutboundMessage, extractJsonFromLlmText } from "../services/jsonExtractor.js";
import { parseAIResponse, runChatbotAI } from "../chatbot-ai-engine.js";

process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "chave-de-teste";

describe("Guarda de Saída (validateOutboundMessage)", () => {
  it("recusa mensagens que começam com { ou [", () => {
    expect(validateOutboundMessage('{"mensagem":"Olá"}').valid).toBe(false);
    expect(validateOutboundMessage('[{"mensagem":"Olá"}]').valid).toBe(false);
    expect(validateOutboundMessage('   { "dados": {} }').valid).toBe(false);
  });

  it("recusa mensagens contendo blocos de markdown ```", () => {
    expect(validateOutboundMessage('```json\n{"mensagem":"teste"}\n```').valid).toBe(false);
    expect(validateOutboundMessage('Aqui está: ``` texto ```').valid).toBe(false);
  });

  it("recusa mensagens contendo chaves internas do contrato", () => {
    expect(validateOutboundMessage('Olá status_conversa aguardando').valid).toBe(false);
    expect(validateOutboundMessage('Veja seu lead_source').valid).toBe(false);
    expect(validateOutboundMessage('A sua spin_fase atual').valid).toBe(false);
    expect(validateOutboundMessage('resumo_chat do cliente').valid).toBe(false);
    expect(validateOutboundMessage('classificacao do lead').valid).toBe(false);
    expect(validateOutboundMessage('finalizado: true').valid).toBe(false);
    expect(validateOutboundMessage('"mensagem": "Olá"').valid).toBe(false);
    expect(validateOutboundMessage('"dados": {"segmento":"odonto"}').valid).toBe(false);
  });

  it("aceita mensagens de texto humano limpas e naturais", () => {
    expect(validateOutboundMessage("Olá, tudo bem? Como posso ajudar você hoje?").valid).toBe(true);
    expect(validateOutboundMessage("Você já pensou em usar um sistema automático?").valid).toBe(true);
    expect(validateOutboundMessage("Perfeito! Posso agendar para amanhã às 14h?").valid).toBe(true);
  });
});

describe("Incidente de Produção 26/08 13:46 — Proteção de JSON cru e Parse Resiliente", () => {
  const RAW_PRODUCTION_LEAK = `{"mensagem":"Você já pensou em usar um sistema que responda automaticamente e agende pacientes sem esse atraso?","status_conversa":"aguardando_usuario","dados":{"nome":"Joao do pe de feijao","segmento":"odontologia","telefone":"3499999999","lead_source":"Instagram","resumo_chat":"🎯 Confirmar se o que foi conversado anteriormente ainda está válido\\n📋 nada ainda\\n🤝 nada ainda\\n⏭️ Pedir ao João que informe seu segmento de atuação..."`;

  it("extrai cirurgicamente a mensagem humana do JSON truncado da Groq 20B", () => {
    const res = parseAIResponse(RAW_PRODUCTION_LEAK);
    expect(res.mensagem).toBe("Você já pensou em usar um sistema que responda automaticamente e agende pacientes sem esse atraso?");
    expect(validateOutboundMessage(res.mensagem).valid).toBe(true);
    expect(res.mensagem).not.toContain("status_conversa");
    expect(res.mensagem).not.toContain("Joao do pe de feijao");
  });

  it("se a resposta for JSON completamente corrompido e irrecuperável, descarta mensagem em vez de vazar JSON cru", () => {
    const corrupted = `{"status_conversa":"aguardando_usuario","dados":{"segmento":"odonto"`;
    const res = parseAIResponse(corrupted);
    expect(res.mensagem).toBe("");
    expect(res.contratoQuebrado).toBe(true);
  });

  it("se a LLM colocar JSON cru dentro do campo mensagem, a guarda de saída bloqueia", () => {
    const objComVazamento = {
      mensagem: '{"dados":{"segmento":"odonto"},"status_conversa":"aguardando"}',
      status_conversa: "aguardando_usuario",
    };
    const res = parseAIResponse(objComVazamento);
    expect(res.mensagem).toBe("");
    expect(res.contratoQuebrado).toBe(true);
  });
});

describe("Escalada da Escada em Falha de Formato (runChatbotAI)", () => {
  let fetchSpy;
  let chamadasModelos = [];

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
  });

  it("quando o primeiro modelo produz lixo com JSON vazado, escala para o próximo modelo da escada", async () => {
    chamadasModelos = [];

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      chamadasModelos.push(body.model);

      // Primeiro modelo (ex: gpt-oss-20b) gera lixo de JSON sem mensagem válida
      if (chamadasModelos.length === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '{"corrupted_json_sem_mensagem": true' } }] }),
          text: async () => '{"corrupted_json_sem_mensagem": true',
        };
      }

      // Segundo modelo (ex: gpt-oss-120b) responde com JSON perfeito
      const validJson = JSON.stringify({
        mensagem: "Olá! Como posso ajudar você hoje?",
        status_conversa: "aguardando_usuario",
        dados: { segmento: "saude" },
        classificacao: "QUENTE",
        finalizado: false,
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: validJson } }] }),
        text: async () => validJson,
      };
    });

    const res = await runChatbotAI({
      systemPrompt: "Você é a assistente virtual.",
      history: [],
      newMessages: ["Olá"],
      existingData: {},
      llmModel: "openai/gpt-oss-20b",
    });

    expect(chamadasModelos.length).toBeGreaterThanOrEqual(2);
    expect(chamadasModelos[0]).toBe("openai/gpt-oss-20b");
    expect(res.mensagem).toBe("Olá! Como posso ajudar você hoje?");
    expect(res.classificacao).toBe("QUENTE");
    expect(res.contratoQuebrado).toBeFalsy();
  });

  it("se todos os modelos falharem em produzir mensagem válida, silencia a resposta (mensagem='') sem estourar 500", async () => {
    chamadasModelos = [];

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      chamadasModelos.push(body.model);

      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"lixo": true, "status_conversa": "x"' } }] }),
        text: async () => '{"lixo": true, "status_conversa": "x"',
      };
    });

    const res = await runChatbotAI({
      systemPrompt: "Você é a assistente virtual.",
      history: [],
      newMessages: ["Olá"],
      existingData: {},
      llmModel: "openai/gpt-oss-20b",
    });

    expect(res.mensagem).toBe("");
    expect(res.mensagemAusente).toBe(true);
    expect(res.contratoQuebrado).toBe(true);
  });
});
