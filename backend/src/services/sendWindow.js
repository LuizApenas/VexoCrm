// backend/src/services/sendWindow.js
// Gestão centralizada da Janela de Horário Permitido para Envio por Tenant.
//
// Regras:
//  - Hora início (padrão 08:00) e hora fim (padrão 20:00)
//  - Dias da semana permitidos (padrão: seg-sex; 'sat'/'sun' opcionais)
//  - Timezone do tenant (padrão: 'America/Sao_Paulo')
//  - Toggle 'agent_replies_outside_window' (padrão: true)

export const DEFAULT_SEND_WINDOW = {
  enabled: true,
  start: "08:00",
  end: "20:00",
  days: ["mon", "tue", "wed", "thu", "fri"],
  timezone: "America/Sao_Paulo",
  agentRepliesOutsideWindow: true,
};

export const WEEKDAYS_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const WEEKDAY_LABELS = {
  sun: "Domingo",
  mon: "Segunda-feira",
  tue: "Terça-feira",
  wed: "Quarta-feira",
  thu: "Quinta-feira",
  fri: "Sexta-feira",
  sat: "Sábado",
};

/**
 * Decompõe a data nos componentes locais dentro do timezone do tenant.
 */
export function getPartsInTimezone(dateInput, timeZone = "America/Sao_Paulo") {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error("Data inválida informada para getPartsInTimezone");
  }

  const safeTimezone = timeZone && typeof timeZone === "string" ? timeZone.trim() : "America/Sao_Paulo";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;

  const weekday = String(map.weekday || "").toLowerCase().slice(0, 3);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);
  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    timeString: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/**
 * Constrói um objeto Date UTC exato correspondente a [year, month, day, hour, minute] no timezone fornecido.
 */
export function createDateInTimezone(year, month, day, hour, minute, second = 0, timeZone = "America/Sao_Paulo") {
  const safeTimezone = timeZone && typeof timeZone === "string" ? timeZone.trim() : "America/Sao_Paulo";
  const isoString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`;
  const utcGuess = new Date(isoString);

  const targetParts = getPartsInTimezone(utcGuess, safeTimezone);
  const targetAsUtc = new Date(Date.UTC(
    targetParts.year,
    targetParts.month - 1,
    targetParts.day,
    targetParts.hour,
    targetParts.minute,
    targetParts.second
  ));

  const offsetMs = targetAsUtc.getTime() - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

/**
 * Normaliza e resolve as configurações da janela com defaults seguros.
 */
export function resolveSendWindowConfig(settings = {}) {
  const rawStart = settings?.send_window_start ?? settings?.sendWindowStart ?? settings?.start;
  const start = typeof rawStart === "string" && /^\d{1,2}:\d{2}$/.test(rawStart.trim())
    ? rawStart.trim().padStart(5, "0")
    : DEFAULT_SEND_WINDOW.start;

  const rawEnd = settings?.send_window_end ?? settings?.sendWindowEnd ?? settings?.end;
  const end = typeof rawEnd === "string" && /^\d{1,2}:\d{2}$/.test(rawEnd.trim())
    ? rawEnd.trim().padStart(5, "0")
    : DEFAULT_SEND_WINDOW.end;

  const rawDays = settings?.send_window_days ?? settings?.sendWindowDays ?? settings?.days;
  let days = DEFAULT_SEND_WINDOW.days;
  if (Array.isArray(rawDays) && rawDays.length > 0) {
    const cleanDays = rawDays
      .map((d) => String(d).toLowerCase().slice(0, 3))
      .filter((d) => WEEKDAYS_ORDER.includes(d));
    if (cleanDays.length > 0) days = cleanDays;
  }

  const rawTz = settings?.send_window_timezone ?? settings?.sendWindowTimezone ?? settings?.timezone;
  let timezone = DEFAULT_SEND_WINDOW.timezone;
  if (typeof rawTz === "string" && rawTz.trim()) {
    try {
      // Valida se o timezone é reconhecido pela Intl
      Intl.DateTimeFormat(undefined, { timeZone: rawTz.trim() });
      timezone = rawTz.trim();
    } catch {
      timezone = DEFAULT_SEND_WINDOW.timezone;
    }
  }

  const rawEnabled = settings?.send_window_enabled ?? settings?.sendWindowEnabled ?? settings?.enabled;
  const enabled = rawEnabled !== undefined
    ? rawEnabled === true || rawEnabled === "true"
    : DEFAULT_SEND_WINDOW.enabled;

  const rawAgentOutbound = settings?.agent_replies_outside_window ?? settings?.agentRepliesOutsideWindow;
  const agentRepliesOutsideWindow = rawAgentOutbound !== undefined
    ? rawAgentOutbound !== false && rawAgentOutbound !== "false"
    : DEFAULT_SEND_WINDOW.agentRepliesOutsideWindow;

  return {
    enabled,
    start,
    end,
    days,
    timezone,
    agentRepliesOutsideWindow,
  };
}

/**
 * Checa se uma data/hora está dentro da janela de envio permitida do tenant.
 */
export function isWithinSendWindow(dateInput = new Date(), configInput = {}) {
  const config = resolveSendWindowConfig(configInput);
  if (!config.enabled) return true;

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return true;

  const parts = getPartsInTimezone(date, config.timezone);

  // 1. Checa dia da semana permitido
  if (!config.days.includes(parts.weekday)) {
    return false;
  }

  // 2. Checa faixa de minutos [start, end)
  const currentMinutes = parts.hour * 60 + parts.minute;
  const [startHour, startMin] = config.start.split(":").map(Number);
  const [endHour, endMin] = config.end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Calcula a data/hora UTC da próxima abertura de janela permitida.
 */
export function getNextSendWindowOpening(dateInput = new Date(), configInput = {}) {
  const config = resolveSendWindowConfig(configInput);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const [startHour, startMin] = config.start.split(":").map(Number);

  const currentParts = getPartsInTimezone(date, config.timezone);
  const currentMinutes = currentParts.hour * 60 + currentParts.minute;
  const startMinutes = startHour * 60 + startMin;

  // Se hoje for um dia permitido E ainda não passamos da hora de início (ex: 03h da manhã):
  // a próxima abertura é hoje mesmo às 08:00
  if (config.days.includes(currentParts.weekday) && currentMinutes < startMinutes) {
    return createDateInTimezone(
      currentParts.year,
      currentParts.month,
      currentParts.day,
      startHour,
      startMin,
      0,
      config.timezone
    );
  }

  // Caso contrário, busca a partir de amanhã o próximo dia permitido
  let checkDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  for (let offset = 1; offset <= 7; offset += 1) {
    const parts = getPartsInTimezone(checkDate, config.timezone);
    if (config.days.includes(parts.weekday)) {
      return createDateInTimezone(
        parts.year,
        parts.month,
        parts.day,
        startHour,
        startMin,
        0,
        config.timezone
      );
    }
    checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Ajusta a data para a janela permitida (se já estiver dentro, retorna a mesma data; se fora, calcula a próxima abertura).
 */
export function adjustDateToSendWindow(dateInput, configInput = {}) {
  const config = resolveSendWindowConfig(configInput);
  if (!config.enabled) return dateInput instanceof Date ? dateInput : new Date(dateInput);

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isWithinSendWindow(date, config)) {
    return date;
  }
  return getNextSendWindowOpening(date, config);
}

/**
 * Gera mensagem descritiva amigável para exibição na UI quando uma data/hora estiver fora da janela.
 */
export function formatSendWindowNotice(dateInput, configInput = {}) {
  const config = resolveSendWindowConfig(configInput);
  if (!config.enabled) return null;

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isWithinSendWindow(date, config)) return null;

  const nextOpening = getNextSendWindowOpening(date, config);
  const nextParts = getPartsInTimezone(nextOpening, config.timezone);
  const dataFormatada = `${String(nextParts.day).padStart(2, "0")}/${String(nextParts.month).padStart(2, "0")}`;
  const diaSemana = WEEKDAY_LABELS[nextParts.weekday] || nextParts.weekday;

  return {
    isOutside: true,
    start: config.start,
    end: config.end,
    nextOpening,
    nextOpeningFormatted: `${nextParts.timeString} de ${diaSemana} (${dataFormatada})`,
    message: `Fora da janela de envio (${config.start}–${config.end}). Será enviado às ${nextParts.timeString} de ${diaSemana} (${dataFormatada}).`,
  };
}
