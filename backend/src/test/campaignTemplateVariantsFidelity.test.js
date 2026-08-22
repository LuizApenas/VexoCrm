import { describe, expect, it } from "vitest";
import { generateCampaignTemplateVariants } from "../campaign-ai.js";

describe("generateCampaignTemplateVariants - fidelidade e fallback dinamico", () => {
  it("devolve variantes vazias se nenhum texto base for fornecido", async () => {
    const res = await generateCampaignTemplateVariants({ baseText: "" });
    expect(res.variants).toEqual([]);
    expect(res.rationale).toBe("Nenhum texto base fornecido.");
  });

  it("gera fallback dinamico fiel a mensagem base sem inventar assuntos quando Groq nao esta disponivel", async () => {
    const baseText = "Ola, estou testando novamente para ver se funciona";
    const res = await generateCampaignTemplateVariants({
      baseText,
      count: 6,
      availableVariables: ["nome"],
    });

    expect(res.variants.length).toBeGreaterThanOrEqual(2);
    // Cada variacao deve conter elementos essenciais da mensagem base
    for (const v of res.variants) {
      expect(v.toLowerCase()).toContain("funcion");
      expect(v.toLowerCase()).toContain("testando");
    }
  });

  it("inclui {{nome}} no fallback dinamico quando a variavel esta disponivel", async () => {
    const baseText = "Gostaria de agendar uma reuniao para apresentar nossa proposta";
    const res = await generateCampaignTemplateVariants({
      baseText,
      count: 6,
      availableVariables: ["nome"],
    });

    const hasName = res.variants.some((v) => v.includes("{{nome}}"));
    expect(hasName).toBe(true);
  });

  it("limpa o nucleo da mensagem e impede duplicacao de saudacoes e {{nome}}", async () => {
    const baseText = "Ola, {{nome}}! Estou precisando falar com voce urgente!";
    const res = await generateCampaignTemplateVariants({
      baseText,
      count: 6,
      availableVariables: ["nome"],
    });

    expect(res.variants.length).toBeGreaterThanOrEqual(2);
    for (const v of res.variants) {
      expect(v).not.toMatch(/oi!?\s*olá/i);
      expect(v).not.toMatch(/olá,?\s*ola/i);
      // Nao duplica {{nome}}
      const countNome = (v.match(/\{\{nome\}\}/g) || []).length;
      expect(countNome).toBeLessThanOrEqual(1);
    }
  });
});
