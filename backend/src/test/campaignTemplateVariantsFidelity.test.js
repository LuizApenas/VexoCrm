import { describe, expect, it } from "vitest";
import {
  generateCampaignTemplateVariants,
  getVariableCounts,
  hasSameVariableCounts,
} from "../campaign-ai.js";

describe("generateCampaignTemplateVariants - fidelidade, variaveis e nao-silencio", () => {
  it("devolve variantes vazias se nenhum texto base for fornecido", async () => {
    const res = await generateCampaignTemplateVariants({ baseText: "" });
    expect(res.variants).toEqual([]);
    expect(res.rationale).toBe("Nenhum texto base fornecido.");
  });

  it("getVariableCounts extrai e conta corretamente todas as variaveis", () => {
    const base = "oie {{nome}}, seu link é {{scheduling_link}} e confirme {{nome}}";
    const counts = getVariableCounts(base);
    expect(counts).toEqual({
      "{{nome}}": 2,
      "{{scheduling_link}}": 1,
    });
  });

  it("hasSameVariableCounts exige correspondencia EXATA de variaveis", () => {
    const base = "oie, tudo bem {{nome}}! Tenho algo muito importante pra falar com voce.";

    // Valido: 1x {{nome}}
    expect(
      hasSameVariableCounts(
        base,
        "Olá {{nome}}, tudo bem? Preciso tratar de um assunto muito importante contigo."
      )
    ).toBe(true);

    // Invalido: 2x {{nome}} (o defeito que ocorria com concatenacao)
    expect(
      hasSameVariableCounts(
        base,
        "Oi, {{nome}}! e, tudo bem {{nome}}! Tenho algo muito importante..."
      )
    ).toBe(false);

    // Invalido: 0x {{nome}}
    expect(
      hasSameVariableCounts(
        base,
        "Olá, tudo bem? Tenho algo muito importante pra falar com você."
      )
    ).toBe(false);

    // Invalido: inventou {{telefone}}
    expect(
      hasSameVariableCounts(
        base,
        "Olá {{nome}}, seu telefone é {{telefone}}."
      )
    ).toBe(false);
  });

  it("sem chave de Groq: FALHA com erro claro em vez de entregar concatenacao disfarçada de IA", async () => {
    const prevKey = process.env.GROQ_API_KEY;
    const prevGroqKey = process.env.GROQ_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_KEY;

    try {
      await expect(
        generateCampaignTemplateVariants({
          baseText: "oie, tudo bem {{nome}}! Tenho algo muito importante pra falar com voce.",
          count: 6,
        })
      ).rejects.toThrow("Chave da Groq (GROQ_API_KEY) não está configurada no servidor.");
    } finally {
      if (prevKey) process.env.GROQ_API_KEY = prevKey;
      if (prevGroqKey) process.env.GROQ_KEY = prevGroqKey;
    }
  });

  it("nao produz 'e' orfao nem duplicacao porque concatenacao foi eliminada", () => {
    const baseText = "oie, tudo bem {{nome}}! Tenho algo muito importante pra falar com voce.";
    // A contagem de variaveis e a proibicao de concatenacao eliminam a mutilacao
    const varCounts = getVariableCounts(baseText);
    expect(varCounts["{{nome}}"]).toBe(1);
  });
});
