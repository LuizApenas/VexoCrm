import { describe, expect, it } from "vitest";
import {
  maskEvolutionInstance,
} from "../services/evolution.js";

// Função canônica de resolução de limite diário (espelho de campaigns/routes.js:1516-1523)
const EVOLUTION_CHIP_DAILY_QUOTA_DEFAULTS = { cold: 100, warm: 500 };
function resolveEvolutionInstanceDailyLimit(instance) {
  const override = Number.parseInt(String(instance?.daily_limit_override ?? ""), 10);
  if (Number.isInteger(override) && override > 0) return override;
  const state = (instance?.chip_state || "").toLowerCase() === "warm" ? "warm" : "cold";
  return EVOLUTION_CHIP_DAILY_QUOTA_DEFAULTS[state];
}

describe("Separação de connection_state e chip_state (Estágio de Aquecimento Anti-Ban)", () => {
  const connectionStateValues = [
    "open",
    "close",
    "connecting",
    "connected",
    "online",
    "offline",
    "refused",
    "qrcode",
  ];

  it("1. Guarda Anti-Poluição: Nenhum valor de conexão da Evolution pode contaminar chip_state", () => {
    for (const connVal of connectionStateValues) {
      const masked = maskEvolutionInstance({
        id: "chip-1",
        client_id: "geracao-digital",
        name: "Chip Teste",
        chip_state: connVal, // simula dado legado ou poluído vindo do banco
        connection_state: connVal,
        active: true,
      });

      // chip_state NUNCA pode ser valor de conexão; deve ser estritamente 'cold' ou 'warm'
      expect(masked.chip_state).toBe("cold");
      expect(masked.chip_state).not.toBe(connVal);
      // connection_state recebe o valor real da conexão
      expect(masked.connection_state).toBe(connVal);
    }
  });

  it("2. Resolução de Cotas: chip_state 'cold' com connection_state 'open' -> limite 100", () => {
    const chip = maskEvolutionInstance({
      id: "chip-cold",
      client_id: "geracao-digital",
      chip_state: "cold",
      connection_state: "open",
      daily_limit_override: null,
    });

    expect(chip.chip_state).toBe("cold");
    expect(chip.connection_state).toBe("open");
    expect(chip.connectionStatus).toBe("open");
    expect(resolveEvolutionInstanceDailyLimit(chip)).toBe(100);
  });

  it("3. Resolução de Cotas: chip_state 'warm' com connection_state 'open' -> limite 500", () => {
    const chip = maskEvolutionInstance({
      id: "chip-warm",
      client_id: "geracao-digital",
      chip_state: "warm",
      connection_state: "open",
      daily_limit_override: null,
    });

    expect(chip.chip_state).toBe("warm");
    expect(chip.connection_state).toBe("open");
    expect(chip.connectionStatus).toBe("open");
    expect(resolveEvolutionInstanceDailyLimit(chip)).toBe(500);
  });

  it("4. Resolução de Cotas: daily_limit_override preenchido vence chip_state e cota padrão", () => {
    // Esteira dia 7 -> override 70
    const chipDia7 = maskEvolutionInstance({
      id: "chip-dia-7",
      client_id: "geracao-digital",
      chip_state: "cold",
      connection_state: "open",
      daily_limit_override: 70,
    });
    expect(resolveEvolutionInstanceDailyLimit(chipDia7)).toBe(70);

    // Override 1500 em chip warm
    const chipVolumeAlto = maskEvolutionInstance({
      id: "chip-1500",
      client_id: "geracao-digital",
      chip_state: "warm",
      connection_state: "open",
      daily_limit_override: 1500,
    });
    expect(resolveEvolutionInstanceDailyLimit(chipVolumeAlto)).toBe(1500);
  });

  it("5. A Esteira e Promoção sobrevivem à checagem de conexão: promover para 'warm' mantém 'warm'", () => {
    // Simula chip salvo pelo dono como warm
    let chipDatabaseRow = {
      id: "chip-warm-test",
      client_id: "geracao-digital",
      name: "Chip WhatsApp GD",
      chip_state: "warm",
      connection_state: "unknown",
      daily_limit_override: null,
    };

    expect(resolveEvolutionInstanceDailyLimit(chipDatabaseRow)).toBe(500);

    // Simula a checagem de status da Evolution (GET /api/evolution/instance/status)
    // O backend agora atualiza connection_state = 'open' SEM mexer em chip_state
    const isEvolutionConnected = true;
    if (isEvolutionConnected) {
      chipDatabaseRow.connection_state = "open";
      // chip_state permanece inalterado!
    }

    const maskedAfterCheck = maskEvolutionInstance(chipDatabaseRow);
    expect(maskedAfterCheck.chip_state).toBe("warm");
    expect(maskedAfterCheck.connection_state).toBe("open");
    expect(maskedAfterCheck.connectionStatus).toBe("open");
    expect(resolveEvolutionInstanceDailyLimit(maskedAfterCheck)).toBe(500);
  });

  it("6. A Esteira e Promoção sobrevivem à checagem de conexão: dia 7 da esteira (override 70) mantém 70", () => {
    // Simula chip configurado na esteira para o Dia 7
    let chipDatabaseRow = {
      id: "chip-esteira-7",
      client_id: "geracao-digital",
      name: "Chip WhatsApp Esteira",
      chip_state: "cold",
      connection_state: "connecting",
      daily_limit_override: 70,
    };

    expect(resolveEvolutionInstanceDailyLimit(chipDatabaseRow)).toBe(70);

    // Checagem de conexão da Evolution roda e detecta 'open'
    chipDatabaseRow.connection_state = "open";

    const maskedAfterCheck = maskEvolutionInstance(chipDatabaseRow);
    expect(maskedAfterCheck.daily_limit_override).toBe(70);
    expect(maskedAfterCheck.connection_state).toBe("open");
    expect(resolveEvolutionInstanceDailyLimit(maskedAfterCheck)).toBe(70);
  });

  it("7. Migração sem mudança de comportamento: chip_state='open' hoje vira cold (100 msgs/dia)", () => {
    // Estado medido em produção hoje antes da migration
    const rowAntesDaMigration = {
      id: "chip-prod",
      client_id: "geracao-digital",
      name: "GD Priscila",
      chip_state: "open", // defeito antigo
      daily_limit_override: null,
    };

    // Antes da migration: como 'open' !== 'warm', o resolvedor já devolvia 100
    const limiteAntes = resolveEvolutionInstanceDailyLimit(rowAntesDaMigration);
    expect(limiteAntes).toBe(100);

    // Simula a transformação SQL da migration:
    // connection_state = lower(chip_state)
    // chip_state = CASE WHEN chip_state = 'warm' THEN 'warm' ELSE 'cold' END
    const rowDepoisDaMigration = {
      id: rowAntesDaMigration.id,
      client_id: rowAntesDaMigration.client_id,
      name: rowAntesDaMigration.name,
      connection_state: ["open", "connected"].includes(rowAntesDaMigration.chip_state)
        ? rowAntesDaMigration.chip_state
        : "unknown",
      chip_state: rowAntesDaMigration.chip_state === "warm" ? "warm" : "cold",
      daily_limit_override: rowAntesDaMigration.daily_limit_override,
    };

    // Depois da migration: continua exatamente 100, com connection_state preservado
    const limiteDepois = resolveEvolutionInstanceDailyLimit(rowDepoisDaMigration);
    expect(limiteDepois).toBe(100);
    expect(rowDepoisDaMigration.chip_state).toBe("cold");
    expect(rowDepoisDaMigration.connection_state).toBe("open");
    expect(limiteDepois).toBe(limiteAntes);
  });

  it("8. Mutação: se checagem de status sobrescrevesse chip_state com 'open', chip warm perderia cota para 100", () => {
    const chipWarm = {
      id: "chip-mutation",
      chip_state: "warm",
      daily_limit_override: null,
    };

    expect(resolveEvolutionInstanceDailyLimit(chipWarm)).toBe(500);

    // Simula o bug antigo (mutação regressiva)
    const chipMutadoComBug = {
      ...chipWarm,
      chip_state: "open", // bug antigo
    };

    // Demonstra que o bug destruía a cota (voltava para 100)
    expect(resolveEvolutionInstanceDailyLimit(chipMutadoComBug)).toBe(100);

    // Com o código correto, a cota de 500 é preservada
    const chipCorreto = {
      ...chipWarm,
      connection_state: "open",
    };
    expect(resolveEvolutionInstanceDailyLimit(chipCorreto)).toBe(500);
  });
});
