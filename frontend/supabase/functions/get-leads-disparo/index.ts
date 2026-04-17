import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getEnv = (primary: string, fallback?: string): string | null => {
  const value = Deno.env.get(primary);
  if (value) return value;
  if (!fallback) return null;
  return Deno.env.get(fallback);
};

const getExpectedBearerToken = (): string | null =>
  getEnv("EDGE_FUNCTION_BEARER_TOKEN", "BEARER_TOKEN");

const getBearerTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const errorResponse = (status: number, error: string, details?: string) =>
  jsonResponse(
    details ? { success: false, error, details } : { success: false, error },
    status,
  );

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return errorResponse(405, "Method not allowed");
  }

  const expectedBearerToken = getExpectedBearerToken();
  if (!expectedBearerToken) {
    return errorResponse(
      500,
      "Missing bearer token",
      "Configure EDGE_FUNCTION_BEARER_TOKEN",
    );
  }

  const token = getBearerTokenFromRequest(req);
  if (token !== expectedBearerToken) {
    return errorResponse(401, "Unauthorized");
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

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Busca apenas leads ainda não disparados
    const { data, error: selectError } = await supabase
      .from("lead_import_items")
      .select("id, normalized_data, row_number, import_id")
      .is("skip_reason", null);

    if (selectError) {
      console.error("get-leads-disparo select error:", selectError);
      return errorResponse(500, "Failed to fetch leads", selectError.message);
    }

    if (!data || data.length === 0) {
      return jsonResponse({ success: true, total: 0, leads: [] });
    }

    const leads = data.map((item) => ({
      id: item.id,
      import_id: item.import_id,
      row_number: item.row_number,
      nome: item.normalized_data?.nome ?? null,
      telefone: item.normalized_data?.telefone ?? null,
    }));

    return jsonResponse({ success: true, total: leads.length, leads });
  } catch (err) {
    console.error("get-leads-disparo error:", err);
    return errorResponse(500, "Internal server error");
  }
});
