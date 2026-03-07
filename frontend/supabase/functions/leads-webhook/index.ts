// VexoCrm/supabase/functions/leads-webhook/index.ts
// Webhook for n8n HTTP Request node to insert/update leads. Uses Bearer secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getEnv = (primary: string, fallback?: string): string | null => {
  const value = Deno.env.get(primary);
  if (value) return value;
  if (!fallback) return null;
  return Deno.env.get(fallback);
};

function normStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function normBool(value: unknown): boolean {
  if (value === true || value === "true" || value === "TRUE" || value === "1") return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("LEADS_WEBHOOK_SECRET");
    if (
      !authHeader ||
      !expectedSecret ||
      authHeader !== `Bearer ${expectedSecret}`
    ) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Accept single lead or batch: { lead: {...} } or { leads: [...] }
    const leadsRaw = body.leads ?? (body.lead ? [body.lead] : []);
    const leads = Array.isArray(leadsRaw) ? leadsRaw : [leadsRaw];

    if (leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing lead or leads array in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = normStr(body.client_id) ?? "infinie";

    const supabaseUrl = getEnv("SUPABASE_URL", "URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rows = leads.map((l: Record<string, unknown>) => {
      const telefone = normStr(l.telefone ?? l.Telefone);
      if (!telefone) return null;

      const dataHora = normStr(l.data_hora ?? l["Data e Hora"]);
      return {
        client_id: clientId,
        telefone,
        nome: normStr(l.nome ?? l.Nome),
        tipo_cliente: normStr(l.tipo_cliente ?? l["Tipo de Cliente"]),
        faixa_consumo: normStr(l.faixa_consumo ?? l["Faixa de Consumo"]),
        cidade: normStr(l.cidade ?? l.Cidade),
        estado: normStr(l.estado ?? l.Estado),
        conta_energia: normStr(l.conta_energia ?? l["Conta de energia"]),
        status: normStr(l.status ?? l.Status),
        bot_ativo: normBool(l.bot_ativo ?? l["Bot Ativo"]),
        historico: normStr(l.historico ?? l.Historico),
        data_hora: dataHora ? new Date(dataHora).toISOString() : null,
        qualificacao: normStr(l.qualificacao ?? l.Qualificacao),
      };
    }).filter(Boolean) as Record<string, unknown>[];

    const { data, error } = await supabase
      .from("leads")
      .upsert(rows, {
        onConflict: "client_id,telefone",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error("leads-webhook upsert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save leads", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length, ids: data?.map((r) => r.id) ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("leads-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
