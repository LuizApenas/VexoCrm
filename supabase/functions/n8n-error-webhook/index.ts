import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
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

    // Extract fields from n8n error trigger payload
    const workflowName = body.workflow?.name;
    const executionId = body.execution?.id;
    const executionUrl = body.execution?.url || null;
    const errorMessage = body.error?.message;
    const lastNode = body.error?.lastNodeExecuted || null;

    if (!workflowName || !executionId || !errorMessage) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: workflow.name, execution.id, error.message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Truncate
    const truncatedMessage = errorMessage.substring(0, 1000);
    const truncatedNode = lastNode ? lastNode.substring(0, 200) : null;

    const supabase = createClient(
      Deno.env.get("URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Upsert error log
    const { error: logError } = await supabase
      .from("n8n_error_logs")
      .upsert(
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
      console.error("Error upserting log:", logError);
      return new Response(JSON.stringify({ error: "Failed to save error log" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert notification
    const descriptionText = `[${workflowName}] ${truncatedMessage}`.substring(0, 200);
    const { error: notifError } = await supabase.from("notifications").insert({
      type: "n8n_error",
      title: `Erro no workflow: ${workflowName}`.substring(0, 100),
      description: descriptionText,
      link: executionUrl,
      read: false,
    });

    if (notifError) {
      console.error("Error inserting notification:", notifError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
