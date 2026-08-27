import { describe, expect, it } from "vitest";
import { normalizeMessageText } from "../lib/messageFormatting";

describe("Normalização de Quebras de Linha em Bolhas (normalizeMessageText)", () => {
  it("converte quebras de linha simples no meio de frases em espaços", () => {
    const raw = "Boa. A gente criou um sistema que atende, qualifica e agenda seus\nleads no WhatsApp sozinho, 24 horas por dia.";
    const result = normalizeMessageText(raw);
    expect(result).toBe("Boa. A gente criou um sistema que atende, qualifica e agenda seus leads no WhatsApp sozinho, 24 horas por dia.");
  });

  it("preserva quebras duplas (parágrafos intencionais)", () => {
    const raw = "Boa. A gente criou um sistema que atende, qualifica e agenda seus\nleads no WhatsApp sozinho, 24 horas por dia.\n\nQuem usa para de perder cliente por demora na resposta. Queria te mostrar\nfuncionando numa call de 15 minutos.\n\nFaz sentido pra você?";
    const expected = "Boa. A gente criou um sistema que atende, qualifica e agenda seus leads no WhatsApp sozinho, 24 horas por dia.\n\nQuem usa para de perder cliente por demora na resposta. Queria te mostrar funcionando numa call de 15 minutos.\n\nFaz sentido pra você?";
    expect(normalizeMessageText(raw)).toBe(expected);
  });

  it("preserva quebras quando a linha anterior termina com pontuação final e próxima linha começa com maiúscula", () => {
    const raw = "Primeiro ponto importante.\nSegundo ponto importante!";
    expect(normalizeMessageText(raw)).toBe("Primeiro ponto importante.\nSegundo ponto importante!");
  });

  it("converte caso real de corte artificial de ~60 colunas", () => {
    const raw = "Vi seu contato e queria te mostrar uma coisa rapida que a gente\nmontou pra quem vende pelo WhatsApp.";
    expect(normalizeMessageText(raw)).toBe("Vi seu contato e queria te mostrar uma coisa rapida que a gente montou pra quem vende pelo WhatsApp.");
  });
});
