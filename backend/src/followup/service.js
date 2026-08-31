// Lógica de negócio do módulo de follow-up.
// Processa webhooks, calcula scheduled_for, enfileira jobs no BullMQ.
import crypto from "crypto";
import { query, getSupabase } from "./db.js";
import { getFollowupQueue } from "./queue.js";
import { sanitizePhone } from "../services/leadImport.js";
import { adjustDateToSendWindow, resolveSendWindowConfig } from "../services/sendWindow.js";
import { getLeadClientN8nSettings } from "../services/n8nSettings.js";

// ─── Utilitários ─────────────────────────────────────────────────────────────

export function generateSecret() {
  return crypto.randomBytes(24).toString("hex");
}

export function generateWebhookUrl(campaignId) {
  const base =
    process.env.WEBHOOK_BASE_URL ||
    process.env.FRONTEND_ORIGIN?.replace(/\/$/, "") ||
    "";
  return `${base}/webhooks/followup/${campaignId}`;
}

export function verifyHmac(secret, rawBody, sigHeader) {
  if (!secret || !sigHeader) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(`sha256=${expected}`),
      Buffer.from(sigHeader)
    );
  } catch {
    return false;
  }
}

function normalizePhone(raw) {
  const sanitized = sanitizePhone(raw);
  if (!sanitized) return null;
  return sanitized.startsWith("+") ? sanitized : `+${sanitized}`;
}

function toMs(value, unit) {
  const v = Number(value);
  if (unit === "minutes") return v * 60 * 1000;
  if (unit === "hours") return v * 60 * 60 * 1000;
  return v * 24 * 60 * 60 * 1000;
}

function calcScheduledFor(template, triggerAt, meetingDatetime) {
  const now = triggerAt.getTime();
  const meeting = meetingDatetime ? new Date(meetingDatetime).getTime() : null;
  const delta = toMs(template.trigger_value, template.trigger_unit);

  switch (template.trigger_type) {
    case "on_schedule":
      return new Date(now);
    case "after_enrollment":
      return new Date(now + delta);
    case "before_meeting":
      if (!meeting) return null;
      return new Date(meeting - delta);
    case "after_meeting":
      if (!meeting) return null;
      return new Date(meeting + delta);
    case "no_reply":
      return new Date(now + delta);
    default:
      return null;
  }
}

// ─── Parsing de webhooks ──────────────────────────────────────────────────────

function extractUtms(obj) {
  return {
    utm_source: obj.utm_source || null,
    utm_medium: obj.utm_medium || null,
    utm_campaign: obj.utm_campaign || null,
    utm_content: obj.utm_content || null,
    utm_term: obj.utm_term || null,
  };
}

function hasUtms(utms) {
  return Object.values(utms).some(Boolean);
}

export function parseWebhookPayload(body) {
  // Formato Calendly: event = "invitee.created"
  if (body.event === "invitee.created") {
    const inv = body.payload?.invitee || body.payload || {};
    const questions = body.payload?.questions_and_answers || [];

    let phone = inv.text_reminder_number || null;
    if (!phone) {
      const phoneQ = questions.find(
        (q) =>
          /telefone|phone|whatsapp|cel|fone/i.test(q.question || "")
      );
      if (phoneQ) phone = phoneQ.answer;
    }

    const utmObj = {};
    for (const q of questions) {
      const key = String(q.question || "").toLowerCase().replace(/[^a-z_]/g, "_");
      if (/utm_/.test(key)) utmObj[key] = q.answer;
    }
    const utms = extractUtms({ ...utmObj, ...extractUtms(inv) });

    return {
      lead_name: inv.name || "Lead",
      phone,
      meeting_datetime: body.payload?.event?.start_time || null,
      calendly_event_uri: body.payload?.event?.uri || null,
      utms,
    };
  }

  // Formato genérico
  const utms = extractUtms(body);
  return {
    lead_name: body.lead_name || body.name || "Lead",
    phone: body.phone || body.telefone || null,
    meeting_datetime: body.meeting_datetime || null,
    calendly_event_uri: null,
    utms,
  };
}

// ─── Processamento principal do webhook de entrada ───────────────────────────

const EMPTY_UTMS = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
};

// Enrola UM lead numa cadência: cria o followup_schedule e enfileira os followup_jobs
// conforme os templates (passos) ativos da campanha. Reutilizado pelo webhook de entrada
// e pelo enrolamento manual a partir do Banco de Dados. `campaign` é a linha já carregada
// de followup_campaigns; `originOverride` marca a origem (ex.: "banco_dados") no manual.
export async function enrollLead(
  campaign,
  { lead_name, phone: rawPhone, meeting_datetime = null, calendly_event_uri = null, utms = EMPTY_UTMS, originOverride = null }
) {
  const phone = normalizePhone(rawPhone);

  const utmPresent = hasUtms(utms);
  const origin_type = originOverride ? "manual" : utmPresent ? "utm" : "default";
  const origin = originOverride
    ? originOverride
    : utmPresent
      ? utms.utm_source || "utm"
      : campaign.default_origin || null;

  // Inserir schedule
  const { rows: schedRows } = await query(
    `INSERT INTO followup_schedules
       (campaign_id, company_id, lead_name, phone, meeting_datetime,
        calendly_event_uri, status,
        origin, origin_source, origin_medium, origin_campaign,
        origin_content, origin_term, origin_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      campaign.id,
      campaign.company_id,
      lead_name,
      phone,
      meeting_datetime || null,
      calendly_event_uri,
      phone ? "active" : "missing_phone",
      origin,
      utms.utm_source,
      utms.utm_medium,
      utms.utm_campaign,
      utms.utm_content,
      utms.utm_term,
      origin_type,
    ]
  );

  const scheduleId = schedRows[0].id;

  if (!phone) {
    return {
      scheduleId,
      enqueued: 0,
      reason: "missing_phone",
      message: "Lead sem telefone válido.",
      skippedSteps: [],
    };
  }

  // Buscar templates ativos (os passos da cadência)
  const supabase = getSupabase();
  const { data: templates } = await supabase
    .from("followup_templates")
    .select("id, name, message, trigger_type, trigger_value, trigger_unit, trigger_direction, order_index")
    .eq("campaign_id", campaign.id)
    .eq("is_active", true)
    .order("order_index", { ascending: true });

  let tenantId = "geracao-digital";
  if (campaign.company_id) {
    const { rows: compRows } = await query(
      `SELECT tenant_id FROM followup_companies WHERE id = $1 LIMIT 1`,
      [campaign.company_id]
    );
    if (compRows.length && compRows[0].tenant_id) {
      tenantId = compRows[0].tenant_id;
    }
  }
  const tenantSettings = await getLeadClientN8nSettings(tenantId);
  const sendWindowConfig = resolveSendWindowConfig(tenantSettings);

  const now = new Date();
  const queue = getFollowupQueue();
  let enqueued = 0;
  let skippedNoDate = 0;
  let skippedPastDate = 0;
  const skippedSteps = [];

  for (const tpl of templates || []) {
    const scheduledFor = calcScheduledFor(tpl, now, meeting_datetime);
    if (!scheduledFor) {
      // Passo depende de data-alvo (ex.: antes/depois da reunião) e ela não foi informada.
      skippedNoDate++;
      skippedSteps.push({
        stepId: tpl.id,
        stepName: tpl.name || `Passo ${tpl.order_index + 1}`,
        triggerType: tpl.trigger_type,
        reason: "no_date",
        message: `O passo "${tpl.name || 'Passo ' + (tpl.order_index + 1)}" exige data-alvo, e nenhuma foi informada.`,
      });
      continue;
    }

    // Passo com horário que já caiu no passado (apenas para gatilhos baseados em evento passado, ex: before_meeting)
    if (scheduledFor.getTime() <= now.getTime() && tpl.trigger_type !== "on_schedule" && tpl.trigger_type !== "after_enrollment") {
      skippedPastDate++;
      const timeStr = scheduledFor.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = scheduledFor.toLocaleDateString("pt-BR");
      skippedSteps.push({
        stepId: tpl.id,
        stepName: tpl.name || `Passo ${tpl.order_index + 1}`,
        triggerType: tpl.trigger_type,
        scheduledFor: scheduledFor.toISOString(),
        reason: "past_date",
        message: `O lembrete "${tpl.name || 'Passo ' + (tpl.order_index + 1)}" cairia em ${dateStr} às ${timeStr}, que já passou. Nenhuma mensagem foi agendada.`,
      });
      continue;
    }

    // Aplica a janela de envio permitida do tenant (ex: se cair às 21h ou fim de semana, move para a próxima abertura)
    const effectiveScheduledFor = adjustDateToSendWindow(scheduledFor, sendWindowConfig);

    const delay = Math.max(0, effectiveScheduledFor.getTime() - Date.now());

    // Inserir job no banco
    const { rows: jobRows } = await query(
      `INSERT INTO followup_jobs (schedule_id, template_id, status, scheduled_for)
       VALUES ($1,$2,'pending',$3) RETURNING id`,
      [scheduleId, tpl.id, effectiveScheduledFor.toISOString()]
    );
    const jobDbId = jobRows[0].id;

    // Enfileirar no BullMQ
    const bullJob = await queue.add(
      "send-followup",
      { jobId: jobDbId },
      { delay, jobId: `fup-${jobDbId}` }
    );

    // Salvar bull_job_id
    await query("UPDATE followup_jobs SET bull_job_id=$1 WHERE id=$2", [
      bullJob.id,
      jobDbId,
    ]);

    enqueued++;
  }

  return { scheduleId, enqueued, skippedNoDate, skippedPastDate, skippedSteps };
}

export async function processInboundWebhook(campaignId, parsedPayload) {
  const supabase = getSupabase();

  const { data: campaign, error: campErr } = await supabase
    .from("followup_campaigns")
    .select(
      "id, company_id, status, default_origin, webhook_secret"
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (campErr || !campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status !== "active") {
    return { skipped: true, reason: "campaign_not_active" };
  }

  const { lead_name, phone, meeting_datetime, calendly_event_uri, utms } = parsedPayload;

  return enrollLead(campaign, {
    lead_name,
    phone,
    meeting_datetime,
    calendly_event_uri,
    utms,
  });
}

// ─── Cancelar jobs quando campanha for arquivada ──────────────────────────────

export async function cancelPendingJobsForCampaign(campaignId) {
  await query(
    `UPDATE followup_jobs fj
        SET status = 'cancelled'
       FROM followup_schedules fs
      WHERE fj.schedule_id = fs.id
        AND fs.campaign_id = $1
        AND fj.status = 'pending'`,
    [campaignId]
  );
}
