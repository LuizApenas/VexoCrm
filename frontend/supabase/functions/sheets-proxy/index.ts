// VexoCrm/supabase/functions/sheets-proxy/index.ts
// Proxies Google Sheets CSV export to avoid CORS. Sheet must be "Published to web".

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sheetId = url.searchParams.get("sheetId");
    const gid = url.searchParams.get("gid");

    if (!sheetId || !gid) {
      return new Response(
        JSON.stringify({ error: "Missing sheetId or gid query params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const sheetRes = await fetch(exportUrl);

    if (!sheetRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch sheet. Ensure it is 'Published to web' (File > Share > Publish to web).",
          status: sheetRes.status,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csv = await sheetRes.text();

    // Check if we got HTML (login page) instead of CSV
    if (csv.trim().toLowerCase().startsWith("<!") || csv.includes("Sign in")) {
      return new Response(
        JSON.stringify({
          error:
            "Sheet is not publicly accessible. Publish it: File > Share > Publish to web > Link > CSV.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = parseCsvToRows(csv);

    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sheets-proxy error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseCsvToRows(csv: string): Record<string, string>[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === ",") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}
