import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPECTED_BEARER_TOKEN = "[REDACTED]";

const getEnv = (primary: string, fallback?: string): string | null => {
  const value = Deno.env.get(primary);
  if (value) return value;
  if (!fallback) return null;
  return Deno.env.get(fallback);
};

const normalizeString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.startsWith("=") ? str.slice(1).trim() : str;
};

const sanitizePhone = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  return digits || null;
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });

const errorResponse = (status: number, error: string, details?: string) =>
  jsonResponse(
    details ? { success: false, error, details } : { success: false, error },
    status,
  );

console.info("conversation-memory-latest started");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${EXPECTED_BEARER_TOKEN}`) {
      return errorResponse(401, "Unauthorized");
    }

    const url = new URL(req.url);
    const telefone = sanitizePhone(url.searchParams.get("telefone"));
    if (!telefone) {
      return errorResponse(400, "Missing required query param: telefone");
    }

    const supabaseUrl = getEnv("SUPABASE_URL", "URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse(
        500,
        "Missing Supabase secrets",
        "Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("lead_conversations")
      .select(
        "id, telefone, conversation_compressed, tamanho_original, unknown_lead, created_at",
      )
      .eq("telefone", telefone)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("conversation-memory-latest select error:", {
        telefone,
        message: error.message,
        code: error.code ?? null,
      });
      return jsonResponse(
        {
          success: false,
          error: "Failed to load conversation",
          details: error.message,
          code: error.code ?? null,
        },
        500,
      );
    }

    const latest = data?.[0] ?? null;

    return jsonResponse(
      latest
        ? {
            success: true,
            found: true,
            telefone,
            conversation: latest,
            latestConversation: latest,
            id: latest.id,
            conversation_compressed: latest.conversation_compressed,
            tamanho_original: latest.tamanho_original,
            unknown_lead: latest.unknown_lead,
            created_at: latest.created_at,
          }
        : {
            success: true,
            found: false,
            telefone,
            conversation: null,
            latestConversation: null,
          },
    );
  } catch (err) {
    console.error("conversation-memory-latest error:", err);
    return errorResponse(500, "Internal server error");
  }
});
