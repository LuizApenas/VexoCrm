import { describe, expect, it } from "vitest";
import {
  isWithinSendWindow,
  getNextSendWindowOpening,
  adjustDateToSendWindow,
  formatSendWindowNotice,
  createDateInTimezone,
  getPartsInTimezone,
  resolveSendWindowConfig,
} from "../lib/sendWindow";

describe("Frontend sendWindow.ts tests", () => {
  const sampleConfig = {
    send_window_start: "08:00",
    send_window_end: "20:00",
    send_window_days: ["mon", "tue", "wed", "thu", "fri"],
    send_window_timezone: "America/Sao_Paulo",
    send_window_enabled: true,
    agent_replies_outside_window: true,
  };

  it("identifica corretamente dentro e fora da janela", () => {
    // 14:30 em dia de semana
    const terca14h30 = createDateInTimezone(2026, 9, 1, 14, 30, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(terca14h30, sampleConfig)).toBe(true);

    // 21:30 em dia de semana
    const terca21h30 = createDateInTimezone(2026, 9, 1, 21, 30, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(terca21h30, sampleConfig)).toBe(false);

    // 10:00 no sábado (com apenas seg-sex permitidos)
    const sabado10h = createDateInTimezone(2026, 9, 5, 10, 0, 0, "America/Sao_Paulo");
    expect(isWithinSendWindow(sabado10h, sampleConfig)).toBe(false);
  });

  it("formata o aviso de agendamento fora da janela com dia e hora corretos", () => {
    const sabado = createDateInTimezone(2026, 9, 5, 15, 0, 0, "America/Sao_Paulo");
    const notice = formatSendWindowNotice(sabado, sampleConfig);

    expect(notice).not.toBeNull();
    expect(notice?.isOutside).toBe(true);
    expect(notice?.message).toContain("Fora da janela de envio (08:00–20:00)");
    expect(notice?.nextOpeningFormatted).toContain("08:00 de Segunda-feira (07/09)");
  });

  it("retorna null de formatSendWindowNotice quando a data estiver dentro da janela", () => {
    const quarta10h = createDateInTimezone(2026, 9, 2, 10, 0, 0, "America/Sao_Paulo");
    const notice = formatSendWindowNotice(quarta10h, sampleConfig);
    expect(notice).toBeNull();
  });
});
