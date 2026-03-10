import { readFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { gunzipSync } from "zlib";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const app = express();
app.use(express.json({ limit: "1mb" }));
const isProduction = process.env.NODE_ENV === "production";
const MAX_CONVERSATION_BYTES = 1024 * 1024;

const rawCorsOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const hasWildcard = rawCorsOrigins.includes("*");
const allowAnyCorsOrigin = hasWildcard && !isProduction;

// In production, strip wildcard so only explicit origins are accepted.
const corsOrigins = isProduction
  ? rawCorsOrigins.filter((o) => o !== "*")
  : rawCorsOrigins;

if (isProduction && hasWildcard) {
  console.warn(
    "[security] CORS_ORIGINS contains '*' in production. Wildcard will be ignored; only explicit origins are allowed."
  );
}

function sendError(res, status, code, message, details) {
  const body = {
    error: {
      code,
      message,
    },
  };
  if (details) {
    body.error.details = details;
  }
  res.status(status).json(body);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAnyCorsOrigin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed: ${origin}`));
    },
  })
);

const supabaseUrl = process.env.SUPABASE_URL || process.env.URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

// Firebase: prefer env vars; fallback to service account JSON in backend dir
let firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
};

if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
  const backendDir = join(__dirname, "..");
  const candidates = readdirSync(backendDir).filter(
    (f) => f.includes("firebase-adminsdk") && f.endsWith(".json")
  );
  const jsonPath = candidates[0] ? join(backendDir, candidates[0]) : null;
  if (jsonPath && existsSync(jsonPath)) {
    const sa = JSON.parse(readFileSync(jsonPath, "utf8"));
    firebaseConfig = {
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    };
  }
}

const firebaseReady =
  !!firebaseConfig.projectId && !!firebaseConfig.clientEmail && !!firebaseConfig.privateKey;

if (firebaseReady && getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: firebaseConfig.projectId,
      clientEmail: firebaseConfig.clientEmail,
      privateKey: firebaseConfig.privateKey,
    }),
  });
}

function ensureSupabase(res) {
  if (!supabase) {
    sendError(
      res,
      500,
      "SUPABASE_NOT_CONFIGURED",
      "Missing Supabase configuration",
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
    return false;
  }
  return true;
}

async function requireFirebaseAuth(req, res, next) {
  if (!firebaseReady) {
    sendError(
      res,
      500,
      "FIREBASE_NOT_CONFIGURED",
      "Firebase auth not configured",
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend env"
    );
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.authUser = decoded;
    next();
  } catch (error) {
    console.error("Firebase token validation failed:", error);
    sendError(res, 401, "INVALID_TOKEN", "Invalid token");
  }
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.startsWith("=") ? str.slice(1).trim() : str;
}

function normalizeBool(value) {
  return value === true || value === "true" || value === "TRUE" || value === "1";
}

function sanitizePhone(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  return digits || null;
}

function isValidBase64(value) {
  if (!value || typeof value !== "string") return false;
  if (value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(value);
}

function requireN8nWebhookSecret(req, res, next) {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    sendError(res, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  next();
}

function validateConversationMemoryPayload(req, res, next) {
  const body = req.body || {};
  const telefone = sanitizePhone(body.telefone);
  const conversationCompressed = normalizeString(body.conversation_compressed);
  const tamanhoOriginal = body.tamanho_original;
  const timestamp = normalizeString(body.timestamp);

  if (!telefone || !conversationCompressed || tamanhoOriginal === undefined || !timestamp) {
    sendError(
      res,
      400,
      "INVALID_BODY",
      "Missing required fields: telefone, conversation_compressed, tamanho_original, timestamp"
    );
    return;
  }

  if (!Number.isInteger(tamanhoOriginal) || tamanhoOriginal <= 0) {
    sendError(res, 400, "INVALID_BODY", "tamanho_original must be a positive integer");
    return;
  }

  if (!isValidBase64(conversationCompressed)) {
    sendError(res, 400, "INVALID_BODY", "conversation_compressed must be valid base64");
    return;
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    sendError(res, 400, "INVALID_BODY", "timestamp must be a valid ISO date");
    return;
  }

  let compressedBuffer;
  let decompressedBuffer;

  try {
    compressedBuffer = Buffer.from(conversationCompressed, "base64");
    if (compressedBuffer.length === 0) {
      sendError(res, 400, "INVALID_BODY", "conversation_compressed must decode to non-empty bytes");
      return;
    }
    decompressedBuffer = gunzipSync(compressedBuffer);
  } catch (error) {
    console.error("conversation memory validation failed:", {
      event: "conversation_memory_validation_failed",
      reason: "invalid_gzip_or_base64",
      message: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 400, "INVALID_BODY", "conversation_compressed must be valid gzip+base64");
    return;
  }

  if (decompressedBuffer.length > MAX_CONVERSATION_BYTES) {
    sendError(
      res,
      413,
      "PAYLOAD_TOO_LARGE",
      "Decompressed conversation exceeds 1MB limit"
    );
    return;
  }

  if (decompressedBuffer.length !== tamanhoOriginal) {
    sendError(
      res,
      400,
      "INVALID_BODY",
      "tamanho_original does not match decompressed conversation size"
    );
    return;
  }

  req.conversationMemory = {
    telefone,
    conversationCompressed,
    tamanhoOriginal,
    timestamp: parsedTimestamp.toISOString(),
  };

  next();
}

function getZonedDateParts(date, timeZone = "America/Sao_Paulo") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function getDateKey(date, timeZone = "America/Sao_Paulo") {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDateLabel(date, timeZone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function humanizeStatus(value) {
  const normalized = normalizeString(value);
  if (!normalized) return "Sem status";

  const map = {
    em_qualificacao: "Em qualificacao",
    qualificado: "Qualificado",
    qualificados: "Qualificados",
    contatado: "Contatado",
    contatados: "Contatados",
    convertido: "Convertido",
    convertidos: "Convertidos",
    filtrado: "Filtrado",
    filtrados: "Filtrados",
    recebido: "Recebido",
    recebidos: "Recebidos",
    aguardando_sdr: "Aguardando SDR",
  };

  return map[normalized] || normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function detectTemperature(lead) {
  const source = [lead.qualificacao, lead.historico]
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (source.includes("quente")) return "hot";
  if (source.includes("morno")) return "warm";
  if (source.includes("frio")) return "cold";
  return "unknown";
}

function buildDashboardPayload(client, leads) {
  const now = new Date();
  const timeZone = "America/Sao_Paulo";
  const todayKey = getDateKey(now, timeZone);
  const recentDays = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (9 - index));
    const key = getDateKey(date, timeZone);
    return {
      key,
      day: getDateLabel(date, timeZone),
      leads: 0,
      emQualificacao: 0,
    };
  });

  const recentDaysMap = new Map(recentDays.map((item) => [item.key, item]));
  const statusCounts = new Map();
  const typeCounts = new Map();
  const temperatureCounts = {
    hot: 0,
    warm: 0,
    cold: 0,
    unknown: 0,
  };

  let leadsToday = 0;
  let emQualificacao = 0;
  let botAtivo = 0;

  for (const lead of leads) {
    const referenceDate = lead.data_hora ? new Date(lead.data_hora) : new Date(lead.created_at);
    const dateKey = getDateKey(referenceDate, timeZone);
    const statusKey = normalizeString(lead.status) || "sem_status";
    const typeKey = normalizeString(lead.tipo_cliente) || "nao_informado";
    const temperatureKey = detectTemperature(lead);

    if (dateKey === todayKey) {
      leadsToday += 1;
    }

    if (statusKey === "em_qualificacao") {
      emQualificacao += 1;
    }

    if (lead.bot_ativo) {
      botAtivo += 1;
    }

    temperatureCounts[temperatureKey] += 1;
    statusCounts.set(statusKey, (statusCounts.get(statusKey) || 0) + 1);
    typeCounts.set(typeKey, (typeCounts.get(typeKey) || 0) + 1);

    const dayEntry = recentDaysMap.get(dateKey);
    if (dayEntry) {
      dayEntry.leads += 1;
      if (statusKey === "em_qualificacao") {
        dayEntry.emQualificacao += 1;
      }
    }
  }

  const totalLeads = leads.length;
  const qualificationRate = totalLeads === 0 ? 0 : Math.round((emQualificacao / totalLeads) * 100);

  return {
    client,
    summary: {
      totalLeads,
      leadsToday,
      emQualificacao,
      qualificationRate,
      botAtivo,
      hotLeads: temperatureCounts.hot,
      warmLeads: temperatureCounts.warm,
      coldLeads: temperatureCounts.cold,
    },
    leadsByDay: recentDays,
    temperatureBreakdown: [
      { name: "Quente", value: temperatureCounts.hot, color: "hsl(0, 72%, 51%)" },
      { name: "Morno", value: temperatureCounts.warm, color: "hsl(32, 95%, 55%)" },
      { name: "Frio", value: temperatureCounts.cold, color: "hsl(217, 91%, 60%)" },
      { name: "Sem sinal", value: temperatureCounts.unknown, color: "hsl(220, 12%, 60%)" },
    ],
    statusBreakdown: Array.from(statusCounts.entries())
      .map(([status, value]) => ({
        name: humanizeStatus(status),
        value,
      }))
      .sort((a, b) => b.value - a.value),
    typeBreakdown: Array.from(typeCounts.entries())
      .map(([type, value]) => ({
        name: type === "nao_informado" ? "Nao informado" : humanizeStatus(type),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    recentLeads: leads.slice(0, 5).map((lead) => ({
      id: lead.id,
      nome: lead.nome || "Lead sem nome",
      tipo_cliente: lead.tipo_cliente,
      status: humanizeStatus(lead.status),
      temperature: detectTemperature(lead),
      data_hora: lead.data_hora || lead.created_at,
    })),
  };
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      const isEscapedQuote = inQuotes && line[i + 1] === '"';
      if (isEscapedQuote) {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && c === ",") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsvToRows(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!supabase,
      firebaseAuth: firebaseReady,
    },
  });
});

app.get("/api/sheets", async (req, res) => {
  const { sheetId, gid } = req.query;
  if (!sheetId || !gid) {
    sendError(res, 400, "INVALID_QUERY", "Missing sheetId or gid query params");
    return;
  }

  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      sheetId
    )}/export?format=csv&gid=${encodeURIComponent(gid)}`;

    const sheetResponse = await fetch(exportUrl);
    if (!sheetResponse.ok) {
      sendError(
        res,
        502,
        "SHEETS_FETCH_FAILED",
        "Failed to fetch sheet. Ensure it is 'Published to web' (File > Share > Publish to web).",
        `status=${sheetResponse.status}`
      );
      return;
    }

    const csv = await sheetResponse.text();
    if (csv.trim().toLowerCase().startsWith("<!") || csv.includes("Sign in")) {
      sendError(
        res,
        403,
        "SHEET_NOT_PUBLIC",
        "Sheet is not publicly accessible. Publish it: File > Share > Publish to web > Link > CSV."
      );
      return;
    }

    res.json({ rows: parseCsvToRows(csv) });
  } catch (error) {
    console.error("sheets api error:", error);
    sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
  }
});

app.get("/api/lead-clients", async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from("leads_clients")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ items: data || [] });
  } catch (error) {
    console.error("lead clients query error:", error);
    sendError(res, 500, "LEAD_CLIENTS_QUERY_FAILED", "Failed to query lead clients");
  }
});

app.get("/api/dashboard", async (req, res) => {
  if (!ensureSupabase(res)) return;

  const clientId = normalizeString(req.query.clientId) || "infinie";

  try {
    const { data: client, error: clientError } = await supabase
      .from("leads_clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      throw clientError;
    }

    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, nome, tipo_cliente, status, bot_ativo, historico, qualificacao, data_hora, created_at")
      .eq("client_id", clientId)
      .order("data_hora", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json(buildDashboardPayload(client || { id: clientId, name: clientId }, leads || []));
  } catch (error) {
    console.error("dashboard query error:", error);
    sendError(res, 500, "DASHBOARD_QUERY_FAILED", "Failed to query dashboard data");
  }
});

app.get("/api/leads", async (req, res) => {
  if (!ensureSupabase(res)) return;

  const clientId = normalizeString(req.query.clientId) || "infinie";

  try {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("client_id", clientId)
      .order("data_hora", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ items: data || [] });
  } catch (error) {
    console.error("leads query error:", error);
    sendError(res, 500, "LEADS_QUERY_FAILED", "Failed to query leads");
  }
});

app.get("/api/notifications", requireFirebaseAuth, async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const limit = Math.min(Number.parseInt(String(req.query.limit || "20"), 10), 50);
    const onlyUnread = String(req.query.onlyUnread || "false") === "true";

    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Number.isNaN(limit) ? 20 : limit);

    if (onlyUnread) {
      query = query.eq("read", false);
    }

    const { data: items, error: listError } = await query;
    if (listError) throw listError;

    const { count, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("read", false);

    if (countError) throw countError;

    res.json({ items: items || [], unreadCount: count || 0 });
  } catch (error) {
    console.error("notifications query error:", error);
    sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
  }
});

app.patch("/api/notifications", requireFirebaseAuth, async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { id, read, markAllRead } = req.body || {};

    if (markAllRead) {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
      if (error) throw error;
      res.json({ success: true });
      return;
    }

    if (!id) {
      sendError(res, 400, "INVALID_BODY", "Missing id or markAllRead");
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read: read ?? true })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error("notifications update error:", error);
    sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
  }
});

app.post("/api/leads-webhook", async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.LEADS_WEBHOOK_SECRET;

  if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    sendError(res, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const body = req.body || {};
    const leadsRaw = body.leads ?? (body.lead ? [body.lead] : []);
    const leads = Array.isArray(leadsRaw) ? leadsRaw : [leadsRaw];

    if (leads.length === 0) {
      sendError(res, 400, "INVALID_BODY", "Missing lead or leads array in body");
      return;
    }

    const clientId = normalizeString(body.client_id) || "infinie";

    const rows = leads
      .map((lead) => {
        const telefone = normalizeString(lead.telefone ?? lead.Telefone);
        if (!telefone) return null;

        const dataHora = normalizeString(lead.data_hora ?? lead["Data e Hora"]);
        return {
          client_id: clientId,
          telefone,
          nome: normalizeString(lead.nome ?? lead.Nome),
          tipo_cliente: normalizeString(lead.tipo_cliente ?? lead["Tipo de Cliente"]),
          faixa_consumo: normalizeString(lead.faixa_consumo ?? lead["Faixa de Consumo"]),
          cidade: normalizeString(lead.cidade ?? lead.Cidade),
          estado: normalizeString(lead.estado ?? lead.Estado),
          conta_energia: normalizeString(lead.conta_energia ?? lead["Conta de energia"]),
          status: normalizeString(lead.status ?? lead.Status),
          bot_ativo: normalizeBool(lead.bot_ativo ?? lead["Bot Ativo"]),
          historico: normalizeString(lead.historico ?? lead.Historico),
          data_hora: dataHora ? new Date(dataHora).toISOString() : null,
          qualificacao: normalizeString(lead.qualificacao ?? lead.Qualificacao),
        };
      })
      .filter(Boolean);

    const { data, error } = await supabase
      .from("leads")
      .upsert(rows, {
        onConflict: "client_id,telefone",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error("leads upsert error:", error);
      sendError(res, 500, "LEADS_SAVE_FAILED", "Failed to save leads", error.message);
      return;
    }

    res.json({ success: true, count: rows.length, ids: data?.map((item) => item.id) || [] });
  } catch (error) {
    console.error("leads webhook error:", error);
    sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
  }
});

app.post("/api/n8n-error-webhook", async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    sendError(res, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  if (!ensureSupabase(res)) return;

  try {
    const body = req.body || {};

    const workflowName = normalizeString(body.workflow?.name);
    const executionId = normalizeString(body.execution?.id);
    const executionUrl = normalizeString(body.execution?.url);
    const errorMessage = normalizeString(body.error?.message);
    const lastNode = normalizeString(body.error?.lastNodeExecuted);

    if (!workflowName || !executionId || !errorMessage) {
      sendError(
        res,
        400,
        "INVALID_BODY",
        "Missing required fields: workflow.name, execution.id, error.message"
      );
      return;
    }

    const truncatedMessage = errorMessage.slice(0, 1000);
    const truncatedNode = lastNode ? lastNode.slice(0, 200) : null;

    const { error: logError } = await supabase.from("n8n_error_logs").upsert(
      {
        execution_id: executionId,
        workflow_name: workflowName,
        message: truncatedMessage,
        node: truncatedNode,
        execution_url: executionUrl,
      },
      { onConflict: "execution_id" }
    );

    if (logError) {
      console.error("n8n log upsert error:", logError);
      sendError(res, 500, "N8N_LOG_SAVE_FAILED", "Failed to save error log", logError.message);
      return;
    }

    const descriptionText = `[${workflowName}] ${truncatedMessage}`.slice(0, 200);

    const { error: notifError } = await supabase.from("notifications").insert({
      type: "n8n_error",
      title: `Erro no workflow: ${workflowName}`.slice(0, 100),
      description: descriptionText,
      link: executionUrl,
      read: false,
    });

    if (notifError) {
      console.error("notification insert error:", notifError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("n8n webhook error:", error);
    sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
  }
});

app.post(
  "/api/conversation-memory",
  requireN8nWebhookSecret,
  validateConversationMemoryPayload,
  async (req, res) => {
    if (!ensureSupabase(res)) return;

    const { telefone, conversationCompressed, tamanhoOriginal, timestamp } = req.conversationMemory;

    try {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id")
        .eq("telefone", telefone)
        .limit(1)
        .maybeSingle();

      if (leadError) {
        throw leadError;
      }

      const unknownLead = !lead;

      const { error } = await supabase.from("lead_conversations").insert({
        telefone,
        conversation_compressed: conversationCompressed,
        tamanho_original: tamanhoOriginal,
        unknown_lead: unknownLead,
        created_at: timestamp,
      });

      if (error) {
        console.error("conversation memory insert error:", {
          event: "conversation_memory_insert_error",
          telefone,
          unknownLead,
          message: error.message,
          code: error.code,
        });
        sendError(
          res,
          500,
          "CONVERSATION_MEMORY_SAVE_FAILED",
          "Failed to save conversation memory",
          error.message
        );
        return;
      }

      console.info("conversation memory stored:", {
        event: "conversation_memory_stored",
        telefone,
        unknownLead,
        tamanhoOriginal,
        timestamp,
      });

      res.json({
        success: true,
        message: "Conversation stored",
        telefone,
      });
    } catch (error) {
      console.error("conversation memory route error:", {
        event: "conversation_memory_route_error",
        telefone,
        message: error instanceof Error ? error.message : String(error),
      });
      sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
    }
  }
);

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large" || error?.status === 413) {
    sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request payload exceeds 1MB limit");
    return;
  }

  if (error?.message?.startsWith("Origin not allowed:")) {
    sendError(res, 403, "CORS_FORBIDDEN_ORIGIN", "Origin not allowed", error.message);
    return;
  }

  console.error("unhandled express error:", error);
  sendError(res, 500, "INTERNAL_ERROR", "Internal server error");
});

const port = Number.parseInt(process.env.PORT || "3001", 10);
app.listen(port, () => {
  console.log(`VexoApi listening on port ${port}`);
});
