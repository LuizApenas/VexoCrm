// frontend/src/lib/sendWindow.ts
// Utilitários de Janela de Horário Permitido para Envio no Frontend.

export interface SendWindowConfig {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  days: string[]; // ['mon', 'tue', 'wed', 'thu', 'fri']
  timezone: string;
  agentRepliesOutsideWindow: boolean;
}

export const DEFAULT_SEND_WINDOW: SendWindowConfig = {
  enabled: true,
  start: "08:00",
  end: "20:00",
  days: ["mon", "tue", "wed", "thu", "fri"],
  timezone: "America/Sao_Paulo",
  agentRepliesOutsideWindow: true,
};

export const WEEKDAYS_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const WEEKDAY_LABELS: Record<string, { label: string; short: string }> = {
  sun: { label: "Domingo", short: "Dom" },
  mon: { label: "Segunda-feira", short: "Seg" },
  tue: { label: "Terça-feira", short: "Ter" },
  wed: { label: "Quarta-feira", short: "Qua" },
  thu: { label: "Quinta-feira", short: "Qui" },
  fri: { label: "Sexta-feira", short: "Sex" },
  sat: { label: "Sábado", short: "Sáb" },
};

export const BRAZIL_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Horário de Brasília (São Paulo, Rio, Sul, Sudeste, Nordeste) — UTC-3" },
  { value: "America/Manaus", label: "Horário do Amazonas (Manaus) — UTC-4" },
  { value: "America/Cuiaba", label: "Horário do Centro-Oeste (Cuiabá, Campo Grande) — UTC-4" },
  { value: "America/Porto_Velho", label: "Horário de Rondônia (Porto Velho) — UTC-4" },
  { value: "America/Boa_Vista", label: "Horário de Roraima (Boa Vista) — UTC-4" },
  { value: "America/Rio_Branco", label: "Horário do Acre (Rio Branco) — UTC-5" },
  { value: "America/Noronha", label: "Fernando de Noronha — UTC-2" },
];

export function getPartsInTimezone(dateInput: Date | string | number, timeZone = "America/Sao_Paulo") {
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
  const map: Record<string, string> = {};
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

export function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone = "America/Sao_Paulo"
): Date {
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

export function resolveSendWindowConfig(settings: any = {}): SendWindowConfig {
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
      .map((d: any) => String(d).toLowerCase().slice(0, 3))
      .filter((d: string) => WEEKDAYS_ORDER.includes(d));
    if (cleanDays.length > 0) days = cleanDays;
  }

  const rawTz = settings?.send_window_timezone ?? settings?.sendWindowTimezone ?? settings?.timezone;
  let timezone = DEFAULT_SEND_WINDOW.timezone;
  if (typeof rawTz === "string" && rawTz.trim()) {
    try {
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

export function isWithinSendWindow(dateInput: Date | string | number = new Date(), configInput: any = {}): boolean {
  const config = resolveSendWindowConfig(configInput);
  if (!config.enabled) return true;

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return true;

  const parts = getPartsInTimezone(date, config.timezone);

  if (!config.days.includes(parts.weekday)) {
    return false;
  }

  const currentMinutes = parts.hour * 60 + parts.minute;
  const [startHour, startMin] = config.start.split(":").map(Number);
  const [endHour, endMin] = config.end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function getNextSendWindowOpening(dateInput: Date | string | number = new Date(), configInput: any = {}): Date {
  const config = resolveSendWindowConfig(configInput);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const [startHour, startMin] = config.start.split(":").map(Number);

  const currentParts = getPartsInTimezone(date, config.timezone);
  const currentMinutes = currentParts.hour * 60 + currentParts.minute;
  const startMinutes = startHour * 60 + startMin;

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

export function adjustDateToSendWindow(dateInput: Date | string | number, configInput: any = {}): Date {
  const config = resolveSendWindowConfig(configInput);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!config.enabled) return date;

  if (isWithinSendWindow(date, config)) {
    return date;
  }
  return getNextSendWindowOpening(date, config);
}

export function formatSendWindowNotice(dateInput: Date | string | number, configInput: any = {}) {
  const config = resolveSendWindowConfig(configInput);
  if (!config.enabled) return null;

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isWithinSendWindow(date, config)) return null;

  const nextOpening = getNextSendWindowOpening(date, config);
  const nextParts = getPartsInTimezone(nextOpening, config.timezone);
  const dataFormatada = `${String(nextParts.day).padStart(2, "0")}/${String(nextParts.month).padStart(2, "0")}`;
  const diaSemana = WEEKDAY_LABELS[nextParts.weekday]?.label || nextParts.weekday;

  return {
    isOutside: true,
    start: config.start,
    end: config.end,
    nextOpening,
    nextOpeningFormatted: `${nextParts.timeString} de ${diaSemana} (${dataFormatada})`,
    message: `Fora da janela de envio (${config.start}–${config.end}). Será enviado às ${nextParts.timeString} de ${diaSemana} (${dataFormatada}).`,
  };
}
