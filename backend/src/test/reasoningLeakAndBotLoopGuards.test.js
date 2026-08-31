import { describe, expect, it } from "vitest";
import {
  validateOutboundMessage,
  extractJsonFromLlmText,
  MAX_OUTBOUND_MESSAGE_LENGTH,
} from "../services/jsonExtractor.js";
import {
  parseAIResponse,
  checkBotLoop,
  fetchTemplate,
  DEFAULT_BUILTIN_TEMPLATES,
} from "../chatbot-ai-engine.js";

describe("ITEM 1 — Proteção contra Vazamento de Raciocínio (<think>) e Dump da LLM", () => {
  const REAL_INCIDENT_FIXTURE = `<think>
The user keeps sending the same error message "🙁 Ops! Opção inválida! _ARANTES IMOVEIS_".
This looks like a copy-paste error or a bot loop on their end.
My instructions say to act as Lara, the virtual assistant for Sonhare Viagens.

Plan:
1. Acknowledge the "Arantes Imóveis" text briefly and politely clarify that this is Sonhare Viagens.
2. Ask how I can help with travel plans or if they have a specific destination in mind.

Draft:
"Olá! Aqui é a Lara da Sonhare Viagens. Parece que você enviou uma mensagem de outro atendimento por engano. 😊 Como posso te ajudar com suas viagens ou planejamento de férias hoje?"

Final Polish: Keep it friendly and concise.
Classification: FRIO (likely a bot or wrong number).
</think>
Olá! Aqui é a Lara da Sonhare Viagens. Parece que você enviou uma mensagem de outro atendimento por engano. 😊 Como posso te ajudar com suas viagens ou planejamento de férias hoje?`;

  const RAW_LEAK_ONLY_THINKING = `<think>
Here's a thinking process that leads to the suggested response:
- The user is replying with automated menu options.
- Let me analyze how to respond in Portuguese.
- I will act as a travel agent.
</think>`;

  it("bloqueia o texto real do incidente do dia 31/08 contendo bloco <think>", () => {
    const result = validateOutboundMessage(REAL_INCIDENT_FIXTURE);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("contains_reasoning_tag:<think");
  });

  it("bloqueia respostas contendo marcadores de raciocínio da LLM mesmo sem tag <think>", () => {
    expect(validateOutboundMessage("Here's a thinking process that leads to the response: Olá!").valid).toBe(false);
    expect(validateOutboundMessage("Let me analyze the customer's request carefully.").valid).toBe(false);
    expect(validateOutboundMessage("**Analyze:** The customer is looking for hotels.").valid).toBe(false);
    expect(validateOutboundMessage("My instructions say to act as a sales representative.").valid).toBe(false);
    expect(validateOutboundMessage("The user keeps sending error messages, so I will draft a reply.").valid).toBe(false);
    expect(validateOutboundMessage("Draft:\nOlá tudo bem?").valid).toBe(false);
    expect(validateOutboundMessage("Final Polish: Keep it friendly.").valid).toBe(false);
  });

  it("bloqueia mensagens com tamanho excessivo (> 1500 caracteres, dump de monólogo)", () => {
    const hugeMessage = "A".repeat(MAX_OUTBOUND_MESSAGE_LENGTH + 10);
    const result = validateOutboundMessage(hugeMessage);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("message_exceeds_max_length");
  });

  it("parseAIResponse no incidente real limpa o bloco <think> e entrega a mensagem legítima ao invés de silenciar", () => {
    const parsed = parseAIResponse(REAL_INCIDENT_FIXTURE);
    expect(parsed.mensagem).toBe("Olá! Aqui é a Lara da Sonhare Viagens. Parece que você enviou uma mensagem de outro atendimento por engano. 😊 Como posso te ajudar com suas viagens ou planejamento de férias hoje?");
    expect(parsed.mensagem).not.toContain("<think>");
    expect(parsed.mensagem).not.toContain("Arantes Imóveis");
    expect(parsed.contratoQuebrado).toBe(true);
  });

  it("teto de 1500 caracteres é aplicado ao texto JÁ LIMPO (dump longo de think + mensagem curta passa com sucesso)", () => {
    const hugeThinkingBlock = "<think>\n" + "A".repeat(2500) + "\n</think>\nOlá, tudo bem? Como posso te ajudar?";
    const parsed = parseAIResponse(hugeThinkingBlock);
    expect(parsed.mensagem).toBe("Olá, tudo bem? Como posso te ajudar?");
    expect(parsed.contratoQuebrado).toBe(true);
  });

  it("parseAIResponse com dump EXCLUSIVO de <think> descarta a mensagem em vez de vazar para o cliente", () => {
    const parsed = parseAIResponse(RAW_LEAK_ONLY_THINKING);
    expect(parsed.mensagem).toBe("");
    expect(parsed.contratoQuebrado).toBe(true);
  });

  it("extractJsonFromLlmText remove tags <think> e isola o JSON válido se existir", () => {
    const llmOutputWithThinkAndJson = `<think>
Thinking about user query...
</think>
{
  "mensagem": "Olá! Como posso ajudar com sua viagem?",
  "status_conversa": "aguardando_usuario",
  "dados": {},
  "classificacao": "MORNO",
  "finalizado": false
}`;
    const parsed = parseAIResponse(llmOutputWithThinkAndJson);
    expect(parsed.mensagem).toBe("Olá! Como posso ajudar com sua viagem?");
    expect(parsed.classificacao).toBe("MORNO");
    expect(parsed.contratoQuebrado).toBeFalsy();
  });
});

describe("ITEM 2 — Catálogo de Templates e Fallback Resiliente", () => {
  it("DEFAULT_BUILTIN_TEMPLATES contém exclusivamente 'generico' e não ex-clientes", () => {
    expect(DEFAULT_BUILTIN_TEMPLATES).toHaveProperty("generico");
    expect(DEFAULT_BUILTIN_TEMPLATES).not.toHaveProperty("outlier");
    expect(DEFAULT_BUILTIN_TEMPLATES).not.toHaveProperty("infinie");
    expect(DEFAULT_BUILTIN_TEMPLATES.generico.template_key).toBe("generico");
    expect(DEFAULT_BUILTIN_TEMPLATES.generico.data_fields.length).toBeGreaterThan(0);
  });

  it("fetchTemplate faz fallback seguro para 'generico' sem quebrar quando template não existe no banco", async () => {
    const mockDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
            is: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };

    const template = await fetchTemplate(mockDb, "some-tenant", "template_inexistente_xyz");
    expect(template).toBeDefined();
    expect(template.template_key).toBe("generico");
    expect(template.display_name).toBe("Atendimento Geral / Vendas");
  });
});

describe("ITEM 3 — Freio contra Loop de Bot (checkBotLoop)", () => {
  const repeatedText = "🙁 Ops! Opção inválida! _ARANTES IMOVEIS_\n\nDigite uma das opções válidas.";

  it("identifica loop quando as últimas 3 mensagens do contato são idênticas", () => {
    const historico = [
      { role: "user", content: repeatedText },
      { role: "assistant", content: "Olá! Aqui é da Sonhare." },
      { role: "user", content: repeatedText },
      { role: "assistant", content: "Como posso ajudar?" },
    ];

    const result = checkBotLoop(historico, repeatedText, 3);
    expect(result.isLoop).toBe(true);
    expect(result.count).toBe(3);
    expect(result.reason).toContain("3 mensagens idênticas consecutivas");
  });

  it("não identifica loop se o usuário enviou menos de 3 mensagens idênticas", () => {
    const historico = [
      { role: "user", content: repeatedText },
      { role: "assistant", content: "Olá!" },
    ];

    const result = checkBotLoop(historico, repeatedText, 3);
    expect(result.isLoop).toBe(false);
    expect(result.count).toBe(2);
  });

  it("não identifica loop se as mensagens do usuário forem variadas", () => {
    const historico = [
      { role: "user", content: "Olá, quanto custa?" },
      { role: "assistant", content: "Olá! Depende do destino." },
      { role: "user", content: "Quero ir para Porto Seguro." },
      { role: "assistant", content: "Ótima escolha!" },
    ];

    const result = checkBotLoop(historico, "Qual é o valor para janeiro?", 3);
    expect(result.isLoop).toBe(false);
    expect(result.count).toBe(1);
  });

  it("normaliza espaços em branco e caixa alta/baixa para comparação justa", () => {
    const historico = [
      { role: "user", content: "  MENU PRINCIPAL  " },
      { role: "user", content: "menu principal" },
    ];

    const result = checkBotLoop(historico, "Menu Principal\n", 3);
    expect(result.isLoop).toBe(true);
    expect(result.count).toBe(3);
  });
});
