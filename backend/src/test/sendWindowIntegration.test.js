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

describe("Integração e Regras da Janela de Horário Permitido (Send Window)", () => {
  const tenantConfig = {
    send_window_start: "08:00",
    send_window_end: "20:00",
    send_window_days: ["mon", "tue", "wed", "thu", "fri"],
    send_window_timezone: "America/Sao_Paulo",
    send_window_enabled: true,
    agent_replies_outside_window: true,
  };

  describe("Regra 1: Follow-up / Lembrete às 21h", () => {
    it("job agendado às 21h em dia de semana é ajustado para as 08:00 do dia seguinte", () => {
      // Terça-feira 01/09/2026 às 21:00 em SP
      const terca21h = createDateInTimezone(2026, 9, 1, 21, 0, 0, "America/Sao_Paulo");
      expect(isWithinSendWindow(terca21h, tenantConfig)).toBe(false);

      const dataAjustada = adjustDateToSendWindow(terca21h, tenantConfig);
      const parts = getPartsInTimezone(dataAjustada, "America/Sao_Paulo");

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(9);
      expect(parts.day).toBe(2); // Quarta-feira
      expect(parts.hour).toBe(8);
      expect(parts.minute).toBe(0);
      expect(parts.weekday).toBe("wed");
    });
  });

  describe("Regra 2: Follow-up / Lembrete às 03h", () => {
    it("job agendado às 03h da madrugada em dia de semana é ajustado para as 08:00 do mesmo dia", () => {
      // Quinta-feira 03/09/2026 às 03:30 em SP
      const quinta03h30 = createDateInTimezone(2026, 9, 3, 3, 30, 0, "America/Sao_Paulo");
      expect(isWithinSendWindow(quinta03h30, tenantConfig)).toBe(false);

      const dataAjustada = adjustDateToSendWindow(quinta03h30, tenantConfig);
      const parts = getPartsInTimezone(dataAjustada, "America/Sao_Paulo");

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(9);
      expect(parts.day).toBe(3); // Quinta-feira (mesmo dia)
      expect(parts.hour).toBe(8);
      expect(parts.minute).toBe(0);
      expect(parts.weekday).toBe("thu");
    });
  });

  describe("Regra 3: Fim de semana (Domingo) com janela seg–sex", () => {
    it("job agendado no domingo é ajustado para segunda-feira às 08:00", () => {
      // Domingo 06/09/2026 às 16:00 em SP
      const domingo16h = createDateInTimezone(2026, 9, 6, 16, 0, 0, "America/Sao_Paulo");
      expect(isWithinSendWindow(domingo16h, tenantConfig)).toBe(false);

      const dataAjustada = adjustDateToSendWindow(domingo16h, tenantConfig);
      const parts = getPartsInTimezone(dataAjustada, "America/Sao_Paulo");

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(9);
      expect(parts.day).toBe(7); // Segunda-feira
      expect(parts.hour).toBe(8);
      expect(parts.minute).toBe(0);
      expect(parts.weekday).toBe("mon");
    });
  });

  describe("Regra 4: Lote de Campanha que atravessa as 20h", () => {
    it("detecta que o horário passou de 20:00 e formata mensagem informativa de pausa", () => {
      // Quarta-feira às 20:01 (janela encerrou às 20:00)
      const quarta20h01 = createDateInTimezone(2026, 9, 2, 20, 1, 0, "America/Sao_Paulo");
      const dentro = isWithinSendWindow(quarta20h01, tenantConfig);
      expect(dentro).toBe(false);

      const resolved = resolveSendWindowConfig(tenantConfig);
      const pauseMsg = `Pausado — fora da janela de envio (${resolved.start}–${resolved.end}). Retomará automaticamente na próxima janela.`;
      expect(pauseMsg).toBe("Pausado — fora da janela de envio (08:00–20:00). Retomará automaticamente na próxima janela.");
    });
  });

  describe("Regra 5: Resposta Inbound às 22h", () => {
    it("NÃO bloqueia resposta inbound por padrão quando agent_replies_outside_window é true", () => {
      const configPadrao = resolveSendWindowConfig({
        ...tenantConfig,
        agent_replies_outside_window: true,
      });
      expect(configPadrao.agentRepliesOutsideWindow).toBe(true);

      // Quarta-feira às 22:00
      const quarta22h = createDateInTimezone(2026, 9, 2, 22, 0, 0, "America/Sao_Paulo");
      const foraDaJanelaGeral = !isWithinSendWindow(quarta22h, configPadrao);
      expect(foraDaJanelaGeral).toBe(true);

      // Decisão no webhook do chatbot:
      const deveBloquearInbound = !configPadrao.agentRepliesOutsideWindow && foraDaJanelaGeral;
      expect(deveBloquearInbound).toBe(false); // Responde normalmente!
    });

    it("bloqueia resposta inbound SE o tenant explicitamente desligar o toggle (agent_replies_outside_window = false)", () => {
      const configComToggleDesligado = resolveSendWindowConfig({
        ...tenantConfig,
        agent_replies_outside_window: false,
      });
      expect(configComToggleDesligado.agentRepliesOutsideWindow).toBe(false);

      const quarta22h = createDateInTimezone(2026, 9, 2, 22, 0, 0, "America/Sao_Paulo");
      const foraDaJanelaGeral = !isWithinSendWindow(quarta22h, configComToggleDesligado);
      expect(foraDaJanelaGeral).toBe(true);

      const deveBloquearInbound = !configComToggleDesligado.agentRepliesOutsideWindow && foraDaJanelaGeral;
      expect(deveBloquearInbound).toBe(true); // Bloqueia conforme opção do cliente
    });
  });

  describe("Regra 6: Visibilidade e aviso para a UI (formatSendWindowNotice)", () => {
    it("retorna aviso detalhado quando a data estiver fora da janela permitida", () => {
      const domingo = createDateInTimezone(2026, 9, 6, 10, 0, 0, "America/Sao_Paulo");
      const notice = formatSendWindowNotice(domingo, tenantConfig);

      expect(notice).not.toBeNull();
      expect(notice.isOutside).toBe(true);
      expect(notice.start).toBe("08:00");
      expect(notice.end).toBe("20:00");
      expect(notice.nextOpeningFormatted).toContain("08:00 de Segunda-feira (07/09)");
      expect(notice.message).toContain("Fora da janela de envio (08:00–20:00)");
    });

    it("retorna null quando a data estiver dentro da janela", () => {
      const quarta11h = createDateInTimezone(2026, 9, 2, 11, 0, 0, "America/Sao_Paulo");
      const notice = formatSendWindowNotice(quarta11h, tenantConfig);
      expect(notice).toBeNull();
    });
  });
});
