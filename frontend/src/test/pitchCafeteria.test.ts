import { describe, it, expect } from "vitest";
import {
  resolveSegmentGroup,
  buildPitch,
  estimateCafeteriaLoss,
  BENCHMARKS,
} from "@/lib/presentation/pitchContent";

describe("roteiro de cafeterias, bistrôs e cafés especiais", () => {
  it("resolve o grupo pelo nome ou id do segmento", () => {
    expect(resolveSegmentGroup("cafeteria").id).toBe("cafeteria");
    expect(resolveSegmentGroup("Cafeterias, Bistrôs & Cafés Especiais").id).toBe("cafeteria");
    expect(resolveSegmentGroup("Café Especial").id).toBe("cafeteria");
    expect(resolveSegmentGroup("Bistrô & Café").id).toBe("cafeteria");
    expect(resolveSegmentGroup("Coffee Shop").id).toBe("cafeteria");
  });

  it("monta 7 slides na ordem SPIN", () => {
    const { slides } = buildPitch({ companyName: "Grão Nobre", segmentId: "cafeteria" });
    expect(slides).toHaveLength(7);
    expect(slides.map((s) => s.kind)).toEqual([
      "impact",
      "pain",
      "implication",
      "solution",
      "partnership",
      "vision",
      "close",
    ]);
  });

  it("contém os 4 pilares estratégicos exigidos: novos grupos, sazonalidade manhãs/noites, recorrência e turnover de mesas", () => {
    const { slides } = buildPitch({ companyName: "Grão Nobre", segmentId: "cafeteria" });
    const fullText = JSON.stringify(slides).toLowerCase();

    // 1. Oportunidades de diferentes grupos de pessoas (corporativo, takeaway, social)
    expect(fullText).toMatch(/novos grupos|corporativo|takeaway|reuniões|social/);

    // 2. Sazonalidade (manhãs e noites)
    expect(fullText).toMatch(/manhãs/);
    expect(fullText).toMatch(/noites/);

    // 3. Recorrência & Fidelidade (clube, passaporte do café, recorrência)
    expect(fullText).toMatch(/recorrência|fidelidade|passaporte do café/);

    // 4. Turnover de mesas em horário de pico (giro de mesas, pico)
    expect(fullText).toMatch(/turnover|giro|pico|mesas travadas/);
  });

  it("calcula perda estimada de cafeterias coerente com o benchmark", () => {
    const b = BENCHMARKS.cafeteria;
    const { ociosidadeMensal, turnoverMensal, mensal, anual } = estimateCafeteriaLoss();
    expect(ociosidadeMensal).toBe(b.pedidosOciososDia * b.ticketMedio * b.diasMes);
    expect(turnoverMensal).toBe(b.mesasTravadasDia * b.perdaPorMesaTravada * b.diasMes);
    expect(mensal).toBe(ociosidadeMensal + turnoverMensal);
    expect(anual).toBe(mensal * 12);
  });
});
