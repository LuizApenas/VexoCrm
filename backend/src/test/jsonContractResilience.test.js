import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  stripLegacyJsonSection,
  buildJsonInstruction,
  parseAIResponse,
  runChatbotAI,
} from "../chatbot-ai-engine.js";

describe("Resiliência do Contrato de Saída JSON e Desacoplamento do Prompt do Usuário", () => {
  const promptSonhareSemJson = `Você é a Lara, assistente virtual da Sonhare Viagens.
Seu objetivo é atender clientes no WhatsApp de forma calorosa, ágil e acolhedora.
Aplique o método SPIN para entender o destino desejado, quantidade de pessoas e datas.
Nunca faça mais de uma pergunta por mensagem.`;

  const promptGeracaoDigitalComJson = `Você é o consultor comercial da Geração Digital.
Qualifique leads interessados em marketing digital e inteligência de vendas.

FORMATO DE RESPOSTA (JSON obrigatório):
{
  "mensagem": "texto da resposta para o lead",
  "status_conversa": "aguardando_usuario" | "em_atendimento" | "finalizado",
  "dados": { "interesse": "...", "cidade": "..." },
  "classificacao": "QUENTE" | "MORNO" | "FRIO",
  "finalizado": false,
  "spin_fase": "situacao" | "problema" | "implicacao" | "necessidade"
}`;

  it("1. Prompt SEM seção de JSON (Sonhare): anexa automaticamente o contrato oficial de saída", () => {
    const cleanPrompt = stripLegacyJsonSection(promptSonhareSemJson);
    expect(cleanPrompt).toBe(promptSonhareSemJson.trim());

    const jsonInstruction = buildJsonInstruction();
    const finalSystemPrompt = `${cleanPrompt}\n${jsonInstruction}`;

    expect(finalSystemPrompt).toContain("Você é a Lara, assistente virtual da Sonhare Viagens.");
    expect(finalSystemPrompt).toContain("FORMATO DE RESPOSTA OBRIGATÓRIO — RETORNE EXCLUSIVAMENTE JSON");
    expect(finalSystemPrompt).toContain('"mensagem":');
    expect(finalSystemPrompt).toContain('"status_conversa":');
    expect(finalSystemPrompt).toContain('"dados":');
    expect(finalSystemPrompt).toContain('"classificacao":');
    expect(finalSystemPrompt).toContain('"spin_fase":');
    expect(finalSystemPrompt).toContain('"finalizado":');
  });

  it("2. Prompt COM seção de JSON (Geração Digital): remove schema legado e anexa contrato único sem duplicar", () => {
    const cleanPrompt = stripLegacyJsonSection(promptGeracaoDigitalComJson);
    
    // O texto limpo preserva o comportamento mas remove o bloco "FORMATO DE RESPOSTA (JSON obrigatório):..."
    expect(cleanPrompt).toContain("Você é o consultor comercial da Geração Digital.");
    expect(cleanPrompt).not.toContain("FORMATO DE RESPOSTA (JSON obrigatório):");

    const jsonInstruction = buildJsonInstruction();
    const finalSystemPrompt = `${cleanPrompt}\n${jsonInstruction}`;

    // Contém o contrato oficial exatamente UMA vez
    const occurrences = (finalSystemPrompt.match(/FORMATO DE RESPOSTA/g) || []).length;
    expect(occurrences).toBe(1);
    expect(finalSystemPrompt).toContain('"mensagem":');
  });

  it("3. parseAIResponse extrai corretamente respostas JSON válidas", () => {
    const jsonOutput = JSON.stringify({
      mensagem: "Olá! Tudo bem? Para onde você planeja viajar nas próximas férias?",
      status_conversa: "aguardando_usuario",
      dados: { destino: "Nordeste" },
      lead_source: "Instagram",
      classificacao: "QUENTE",
      spin_fase: "situacao",
      finalizado: false,
    });

    const parsed = parseAIResponse(jsonOutput);
    expect(parsed.mensagem).toBe("Olá! Tudo bem? Para onde você planeja viajar nas próximas férias?");
    expect(parsed.status_conversa).toBe("aguardando_usuario");
    expect(parsed.dados).toEqual({ destino: "Nordeste" });
    expect(parsed.lead_source).toBe("organico");
    expect(parsed.classificacao).toBe("QUENTE");
    expect(parsed.spin_fase).toBe("situacao");
    expect(parsed.finalizado).toBe(false);
  });

  it("4. parseAIResponse tolera JSON dentro de blocos Markdown (```json ... ```)", () => {
    const markdownOutput = `Aqui está a resposta estruturada:
\`\`\`json
{
  "mensagem": "Perfeito! Quantos adultos e crianças viajarão com você?",
  "status_conversa": "aguardando_usuario",
  "dados": { "destino": "Maceió", "periodo": "Janeiro" },
  "classificacao": "QUENTE",
  "spin_fase": "problema",
  "finalizado": false
}
\`\`\``;

    const parsed = parseAIResponse(markdownOutput);
    expect(parsed.mensagem).toBe("Perfeito! Quantos adultos e crianças viajarão com você?");
    expect(parsed.dados.destino).toBe("Maceió");
    expect(parsed.classificacao).toBe("QUENTE");
    expect(parsed.spin_fase).toBe("problema");
  });

  it("5. parseAIResponse tolera resposta em texto puro sem quebrar a aplicação (fallback elegante)", () => {
    const plainTextOutput = "Olá, meu nome é Lara da Sonhare Viagens! Em que posso ajudar você hoje?";

    const parsed = parseAIResponse(plainTextOutput);
    expect(parsed.mensagem).toBe(plainTextOutput);
    expect(parsed.status_conversa).toBe("aguardando_usuario");
    // classificacao NAO pode ser "FRIO" aqui: o modelo nao classificou nada nesta
    // resposta. Gravar "FRIO" seria o mesmo defeito do || "QUENTE" — valor
    // inventado pelo codigo se passando por saida da IA.
    expect(parsed.classificacao).toBe(null);
    expect(parsed.contratoQuebrado).toBe(true);
    expect(parsed.finalizado).toBe(false);
  });

  it("6. parseAIResponse trata null e undefined sem lançar erro", () => {
    const parsedNull = parseAIResponse(null);
    expect(parsedNull.mensagem).toContain("Desculpe");
    expect(parsedNull.status_conversa).toBe("aguardando_usuario");
    expect(parsedNull.classificacao).toBe(null);
    expect(parsedNull.contratoQuebrado).toBe(true);

    const parsedUndefined = parseAIResponse(undefined);
    expect(parsedUndefined.mensagem).toContain("Desculpe");
  });

  it("7. Mutação: sem anexo automático do contrato, prompt do usuário sem JSON não conteria schema de saída", () => {
    // Simula a mutação onde o sistema não anexa buildJsonInstruction
    const systemPromptSemContrato = promptSonhareSemJson;

    // Sem o anexo, o prompt é cego quanto ao formato de resposta JSON esperado
    expect(systemPromptSemContrato).not.toContain('"mensagem"');
    expect(systemPromptSemContrato).not.toContain('"status_conversa"');
    expect(systemPromptSemContrato).not.toContain('"dados"');
    expect(systemPromptSemContrato).not.toContain('"classificacao"');

    // Com o anexo pelo código, o contrato é garantido
    const systemPromptCorrigido = `${systemPromptSemContrato}\n${buildJsonInstruction()}`;
    expect(systemPromptCorrigido).toContain('"mensagem"');
    expect(systemPromptCorrigido).toContain('"dados"');
  });
});
