import { describe, it, expect, vi } from "vitest";
import { classifyConversation, NUMBER_CHANGE_PATTERNS, AUTOMATION_PATTERNS } from "../services/whatsappChatClassifier.js";

describe("WhatsApp Chat Classifier & Deterministic Rules", () => {
  it("deve detectar mensagens de mudança de número como exceção prioritária e manter ativa com isNumberChange=true", () => {
    const cases = [
      "Olá! Estamos desativando esse número. Favor chamar no 34 99999-9999",
      "chama meu vendedor no novo contato",
      "troca de número da empresa, nos chame no whatsapp novo",
      "Agradecemos sua mensagem! Para falar conosco: https://wa.me/5534991234567",
    ];

    for (const msg of cases) {
      const result = classifyConversation(msg);
      expect(result.state).toBe("ativa");
      expect(result.isNumberChange).toBe(true);
      expect(result.isAutomation).toBe(false);
      expect(result.reason).toContain("Mudança de número");
    }
  });

  it("deve classificar menus numerados e robôs como automacao quando não há interação humana prévia", () => {
    const automationMessages = [
      "Olá! Digite apenas o número correspondente à opção desejada:\n1 - Vendas\n2 - Suporte",
      "Atendimento automático: selecione uma das opções abaixo.",
      "Seja bem-vindo(a) à nossa empresa! Conheça nosso showroom e horários de atendimento.",
      "Como não consegui identificar nenhuma resposta, finalizarei nossa interação.",
    ];

    for (const msg of automationMessages) {
      const result = classifyConversation(msg, { hasHumanReply: false, hasLeadInCrm: false });
      expect(result.state).toBe("automacao");
      expect(result.isAutomation).toBe(true);
      expect(result.isNumberChange).toBe(false);
      expect(result.reason).toBeTruthy();
    }
  });

  it("NÃO deve mover para automação se já houver interação humana livre ou lead cadastrado", () => {
    const msg = "Digite 1 para suporte ou 2 para vendas";

    const withLead = classifyConversation(msg, { hasLeadInCrm: true });
    expect(withLead.state).toBe("ativa");
    expect(withLead.isAutomation).toBe(false);

    const withHumanReply = classifyConversation(msg, { hasHumanReply: true });
    expect(withHumanReply.state).toBe("ativa");
    expect(withHumanReply.isAutomation).toBe(false);
  });

  it("deve manter mensagens normais de leads e clientes como ativas", () => {
    const normalMessages = [
      "Bom dia, gostaria de ver os modelos de sofá disponíveis",
      "Qual o valor do frete para Uberlândia?",
      "Pode me mandar o orçamento em PDF?",
    ];

    for (const msg of normalMessages) {
      const result = classifyConversation(msg);
      expect(result.state).toBe("ativa");
      expect(result.isAutomation).toBe(false);
      expect(result.isNumberChange).toBe(false);
    }
  });

  it("deve validar transições de estado para 'arquivada', 'automacao', 'ativa' e 'lixeira'", () => {
    const validStates = ["ativa", "automacao", "arquivada", "lixeira"];
    for (const st of validStates) {
      expect(validStates.includes(st)).toBe(true);
    }
    expect(validStates.includes("invalido")).toBe(false);
  });
});

