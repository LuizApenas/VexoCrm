// Resumo do Inbox: contrato de saida anexado pelo codigo, sem JSON estrito.
//
// DECISAO (item 3 do bloco): nem (a) nem (b) como enunciados.
//
// A hipotese B2 dizia que o resumo tambem sofria json_validate_failed. Nao
// sofre: summarizeChatWithAI NUNCA passou response_format — nem na chamada via
// callLlmChatCompletion, nem no fallback direto a Groq. Logo (b) "deixar de
// exigir JSON estrito" ja e o estado atual, e nao muda nada. E (a) "voltar a
// pedir JSON" jogaria fora o formato de quatro linhas que o dono acabou de
// escrever, para depois remontar as mesmas quatro linhas em codigo — trabalho
// a mais para chegar no mesmo lugar, com uma volta a mais para o modelo errar.
//
// O que faltava era o MESMO principio do item 1: o formato nao pode depender de
// o dono lembrar de escreve-lo. Ele agora e anexado pelo codigo.
//
// formatSummaryOutput continua fazendo sentido nos dois mundos — e o parser
// tolerante que aceita tanto JSON quanto as quatro linhas. E o que salva quando
// o modelo escorrega de um formato para o outro.

import { describe, expect, it } from "vitest";
import {
  buildSummarySystemPrompt,
  formatSummaryOutput,
  SUMMARY_OUTPUT_CONTRACT,
  DEFAULT_SUMMARY_PROMPT,
} from "../domains/leads/chatInsight.js";

const PROMPT_DO_DONO_SEM_FORMATO = `Você resume conversas de WhatsApp da Sonhare Viagens.
Seja direto. O dono precisa lembrar em dez segundos o que foi combinado.`;

describe("o contrato de saida e anexado pelo codigo", () => {
  it("prompt sem os marcadores recebe o contrato", () => {
    const final = buildSummarySystemPrompt(PROMPT_DO_DONO_SEM_FORMATO);
    expect(final).toContain("Você resume conversas de WhatsApp da Sonhare Viagens.");
    expect(final).toContain("FORMATO DE SAÍDA OBRIGATÓRIO");
    for (const marcador of ["🎯", "📋", "🤝", "⏭"]) {
      expect(final).toContain(marcador);
    }
    // Depois do texto do dono, nunca antes.
    expect(final.indexOf("FORMATO DE SAÍDA OBRIGATÓRIO")).toBeGreaterThan(
      final.indexOf("Você resume conversas")
    );
  });

  it("prompt que ja tem os quatro marcadores nao recebe de novo", () => {
    const final = buildSummarySystemPrompt(DEFAULT_SUMMARY_PROMPT);
    expect(final).toBe(DEFAULT_SUMMARY_PROMPT.trim());
    expect(final).not.toContain(SUMMARY_OUTPUT_CONTRACT.trim());
  });

  it("a chamada NAO pede JSON estrito — foi a decisao, e esta no fonte", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const fonte = readFileSync(resolve("src/domains/leads/chatInsight.js"), "utf8");
    expect(fonte).not.toContain("response_format");
  });
});

describe("o resumo e gerado com o prompt novo", () => {
  it("as quatro linhas com emoji viram resumo", () => {
    const daIa = [
      "🎯 Quer pacote para Maceió em janeiro",
      "📋 2 adultos e 1 criança de 4 anos, orçamento até 8 mil",
      "🤝 Prometido enviar cotação até sexta",
      "⏭️ Cotar Maceió em janeiro para 2 adultos e 1 criança",
    ].join("\n");

    const resumo = formatSummaryOutput(daIa);
    expect(resumo).toContain("🎯 Quer pacote para Maceió em janeiro");
    expect(resumo).toContain("📋 2 adultos e 1 criança de 4 anos, orçamento até 8 mil");
    expect(resumo).toContain("🤝 Prometido enviar cotação até sexta");
    expect(resumo).toContain("⏭️ Cotar Maceió em janeiro");
  });

  it("marcador SEM o seletor de variacao tambem e lido", () => {
    // O modelo emite ora "⏭️" (com U+FE0F) ora "⏭" cru. startsWith("⏭️")
    // falhava no segundo caso e a linha caia para "nada ainda", sem erro.
    const daIa = ["🎯 Quer viajar", "📋 2 pessoas", "🤝 nada ainda", "⏭ Enviar cotação hoje"].join("\n");
    const resumo = formatSummaryOutput(daIa);
    expect(resumo).toContain("Enviar cotação hoje");
    expect(resumo).not.toContain("⏭️ nada ainda");
  });

  it("continua aceitando JSON, para o modelo que escorregar de formato", () => {
    const resumo = formatSummaryOutput(
      JSON.stringify({
        objetivo: "Quer pacote para Maceió",
        fatos: "2 adultos, janeiro",
        combinados: "Cotação até sexta",
        proximo_passo: "Enviar cotação",
      })
    );
    expect(resumo).toContain("🎯 Quer pacote para Maceió");
    expect(resumo).toContain("⏭️ Enviar cotação");
  });

  it("bloco vazio vira 'nada ainda', nunca frase de efeito inventada", () => {
    const resumo = formatSummaryOutput("🎯 Quer viajar\n📋 nada ainda\n🤝 nada ainda\n⏭️ nada ainda");
    expect(resumo).toContain("🎯 Quer viajar");
    expect((resumo.match(/nada ainda/g) || []).length).toBe(3);
  });

  it("resposta sem conteudo nenhum devolve null — nunca template de mentira", () => {
    expect(formatSummaryOutput("")).toBe(null);
    expect(formatSummaryOutput(null)).toBe(null);
  });
});
