import { describe, expect, it } from "vitest";
import {
  isWithinSendWindow,
  getNextSendWindowOpening,
  adjustDateToSendWindow,
  formatSendWindowNotice,
  createDateInTimezone,
  getPartsInTimezone,
  resolveSendWindowConfig,
} from "../services/sendWindow.js";

describe("Janela de Horário Permitido para Envio (sendWindow)", () => {
  const standardConfig = {
    send_window_start: "08:00",
    send_window_end: "20:00",
    send_window_days: ["mon", "tue", "wed", "thu", "fri"],
    send_window_timezone: "America/Sao_Paulo",
    send_window_enabled: true,
    agent_replies_outside_window: true,
  };

  it("identifica corretamente quando uma data está DENTRO da janela (ex: quarta 14h)", () => {
    // Quarta-feira, 02 de Setembro de 2026 às 14:30 em São Paulo
    const quarta14h30 = createDateInTimezone(2026, 9, 2, 14, 30, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(quarta14h30, standardConfig)).toBe(true);
    expect(adjustDateToSendWindow(quarta14h30, standardConfig).getTime()).toBe(quarta14h30.getTime());
    expect(formatSendWindowNotice(quarta14h30, standardConfig)).toBeNull();
  });

  it("job agendado às 21h → executa às 08:00 do próximo dia permitido", () => {
    // Quarta-feira, 02 de Setembro de 2026 às 21:15 em São Paulo
    const quarta21h15 = createDateInTimezone(2026, 9, 2, 21, 15, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(quarta21h15, standardConfig)).toBe(false);

    const proximaAbertura = adjustDateToSendWindow(quarta21h15, standardConfig);
    const parts = getPartsInTimezone(proximaAbertura, "America/Sao_Paulo");

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(3); // Quinta-feira
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(0);
    expect(parts.weekday).toBe("thu");
  });

  it("job agendado às 03h → executa às 08:00 do mesmo dia", () => {
    // Quarta-feira, 02 de Setembro de 2026 às 03:45 da madrugada em São Paulo
    const quarta03h45 = createDateInTimezone(2026, 9, 2, 3, 45, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(quarta03h45, standardConfig)).toBe(false);

    const proximaAbertura = adjustDateToSendWindow(quarta03h45, standardConfig);
    const parts = getPartsInTimezone(proximaAbertura, "America/Sao_Paulo");

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(2); // Mesmo dia (Quarta)
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(0);
    expect(parts.weekday).toBe("wed");
  });

  it("domingo com dias = seg–sex → vai para segunda 08:00", () => {
    // Domingo, 06 de Setembro de 2026 às 15:00 em São Paulo
    const domingo15h = createDateInTimezone(2026, 9, 6, 15, 0, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(domingo15h, standardConfig)).toBe(false);

    const proximaAbertura = adjustDateToSendWindow(domingo15h, standardConfig);
    const parts = getPartsInTimezone(proximaAbertura, "America/Sao_Paulo");

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(7); // Segunda-feira
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(0);
    expect(parts.weekday).toBe("mon");
  });

  it("sexta-feira às 21h com dias = seg–sex → pula sábado/domingo e vai para segunda 08:00", () => {
    // Sexta-feira, 04 de Setembro de 2026 às 21:00 em São Paulo
    const sexta21h = createDateInTimezone(2026, 9, 4, 21, 0, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(sexta21h, standardConfig)).toBe(false);

    const proximaAbertura = adjustDateToSendWindow(sexta21h, standardConfig);
    const parts = getPartsInTimezone(proximaAbertura, "America/Sao_Paulo");

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(7); // Segunda-feira
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(0);
    expect(parts.weekday).toBe("mon");
  });

  it("sábado permitido quando configurado em send_window_days", () => {
    const configComSabado = {
      ...standardConfig,
      send_window_days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    };

    // Sexta-feira às 21h → próxima abertura é Sábado 08:00
    const sexta21h = createDateInTimezone(2026, 9, 4, 21, 0, 0, "America/Sao_Paulo");
    const proximaAbertura = adjustDateToSendWindow(sexta21h, configComSabado);
    const parts = getPartsInTimezone(proximaAbertura, "America/Sao_Paulo");

    expect(parts.day).toBe(5); // Sábado
    expect(parts.hour).toBe(8);
    expect(parts.weekday).toBe("sat");
  });

  it("respeita o fuso horário específico do tenant (ex: America/Manaus UTC-4)", () => {
    const manausConfig = {
      ...standardConfig,
      send_window_timezone: "America/Manaus", // UTC-4
    };

    // 08:30 em Manaus é 12:30 UTC e 09:30 em São Paulo
    const manaus08h30 = createDateInTimezone(2026, 9, 2, 8, 30, 0, "America/Manaus");
    expect(isWithinSendWindow(manaus08h30, manausConfig)).toBe(true);

    // 20:30 em Manaus está fora da janela de Manaus
    const manaus20h30 = createDateInTimezone(2026, 9, 2, 20, 30, 0, "America/Manaus");
    expect(isWithinSendWindow(manaus20h30, manausConfig)).toBe(false);

    const abertura = adjustDateToSendWindow(manaus20h30, manausConfig);
    const parts = getPartsInTimezone(abertura, "America/Manaus");
    expect(parts.day).toBe(3);
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(0);
  });

  it("gera aviso legível de agendamento fora da janela com formatSendWindowNotice", () => {
    // Domingo 14:00
    const domingo = createDateInTimezone(2026, 9, 6, 14, 0, 0, "America/Sao_Paulo");
    const notice = formatSendWindowNotice(domingo, standardConfig);

    expect(notice).not.toBeNull();
    expect(notice.isOutside).toBe(true);
    expect(notice.start).toBe("08:00");
    expect(notice.end).toBe("20:00");
    expect(notice.message).toContain("Fora da janela de envio (08:00–20:00)");
    expect(notice.message).toContain("08:00 de Segunda-feira");
  });

  it("quando send_window_enabled = false, tudo é liberado", () => {
    const disabledConfig = {
      ...standardConfig,
      send_window_enabled: false,
    };
    const domingoDeMadrugada = createDateInTimezone(2026, 9, 6, 3, 0, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(domingoDeMadrugada, disabledConfig)).toBe(true);
    expect(adjustDateToSendWindow(domingoDeMadrugada, disabledConfig).getTime()).toBe(domingoDeMadrugada.getTime());
  });

  it("resolveSendWindowConfig aplica defaults quando campos estão vazios ou nulos", () => {
    const resolved = resolveSendWindowConfig(null);
    expect(resolved.enabled).toBe(true);
    expect(resolved.start).toBe("08:00");
    expect(resolved.end).toBe("20:00");
    expect(resolved.days).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(resolved.timezone).toBe("America/Sao_Paulo");
    expect(resolved.agentRepliesOutsideWindow).toBe(true);
  });
});
