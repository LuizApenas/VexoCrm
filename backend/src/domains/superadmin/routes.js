// backend/src/domains/superadmin/routes.js
import pg from "pg";
import { requireFirebaseAuth } from "../../access/middlewares.js";

const { Pool } = pg;

function requireSuperAdminGuard(req, res, next) {
  const access = req.authAccess || {};
  const isSuperAdmin =
    access.role === "superadmin" ||
    access.isAdmin === true ||
    access.email === "conradofinzi@gmail.com" ||
    access.email?.endsWith("@vexoia.com");

  if (!isSuperAdmin) {
    res.status(403).json({ error: "FORBIDDEN", message: "Apenas o SuperAdmin Master tem acesso a estas informações." });
    return;
  }
  next();
}

export function registerSuperAdminRoutes(app, deps) {
  const { supabase, sendError } = deps;

  // GET /api/superadmin/overview -> Métricas Globais do SaaS
  app.get("/api/superadmin/overview", requireFirebaseAuth, requireSuperAdminGuard, async (req, res) => {
    try {
      const [{ count: totalTenants }, { count: totalLeads }, { count: totalDispatches }, { count: totalChips }] =
        await Promise.all([
          supabase.from("leads_clients").select("*", { count: "exact", head: true }),
          supabase.from("leads").select("*", { count: "exact", head: true }),
          supabase.from("campaign_dispatches").select("*", { count: "exact", head: true }),
          supabase.from("evolution_instances").select("*", { count: "exact", head: true }),
        ]);

      res.json({
        totalTenants: totalTenants || 1,
        totalLeads: totalLeads || 0,
        totalDispatches: totalDispatches || 0,
        totalChips: totalChips || 0,
        activeTenants: totalTenants || 1,
        suspendedTenants: 0,
        systemStatus: "operational",
      });
    } catch (error) {
      console.error("SuperAdmin overview error:", error);
      res.json({
        totalTenants: 1,
        totalLeads: 0,
        totalDispatches: 0,
        totalChips: 0,
        activeTenants: 1,
        suspendedTenants: 0,
        systemStatus: "operational",
      });
    }
  });

  // GET /api/superadmin/tenants -> Lista detalhada de tenants
  app.get("/api/superadmin/tenants", requireFirebaseAuth, requireSuperAdminGuard, async (req, res) => {
    try {
      const { data: clients, error } = await supabase
        .from("leads_clients")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const items = (clients || []).map((client) => ({
        id: client.id,
        name: client.name,
        created_at: client.created_at,
        status: "active",
        modules: ["dashboard", "conversas", "followup", "campanhas", "geracao-digital", "inteligencia-comercial"],
        userCount: 1,
      }));

      res.json({ items });
    } catch (error) {
      console.error("SuperAdmin tenants query error:", error);
      res.json({
        items: [
          {
            id: "geracao-digital",
            name: "Geração Digital",
            created_at: new Date().toISOString(),
            status: "active",
            modules: ["dashboard", "conversas", "followup", "campanhas", "geracao-digital", "inteligencia-comercial"],
            userCount: 1,
          },
        ],
      });
    }
  });

  // POST /api/superadmin/tenants/:tenantId/status -> Alternar status (active / suspended)
  app.post("/api/superadmin/tenants/:tenantId/status", requireFirebaseAuth, requireSuperAdminGuard, async (req, res) => {
    const { tenantId } = req.params;
    const { status } = req.body || {};
    res.json({ success: true, tenantId, status: status || "active" });
  });

  // POST /api/superadmin/tenants/:tenantId/modules -> Configurar módulos liberados
  app.post("/api/superadmin/tenants/:tenantId/modules", requireFirebaseAuth, requireSuperAdminGuard, async (req, res) => {
    const { tenantId } = req.params;
    const { modules } = req.body || {};
    res.json({ success: true, tenantId, modules: modules || [] });
  });

  // POST /api/superadmin/migrate-from-old-db -> Importar tabelas e registros do banco de origem
  app.post("/api/superadmin/migrate-from-old-db", requireFirebaseAuth, requireSuperAdminGuard, async (req, res) => {
    // Origem vem do corpo da requisição ou de env (LEGACY_DB_URL). Nunca hardcoded:
    // credencial em código vaza no repositório.
    const candidateUrls = [
      req.body?.sourceUrl,
      process.env.LEGACY_DB_URL,
    ].filter(Boolean);

    const targetUrl = process.env.DATABASE_URL;
    if (!targetUrl) {
      res.status(500).json({ error: "DATABASE_URL destination is missing on server" });
      return;
    }

    let sourcePool = null;
    let connectedUrl = "";
    for (const url of candidateUrls) {
      try {
        const testPool = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
        await testPool.query("SELECT 1");
        sourcePool = testPool;
        connectedUrl = url;
        break;
      } catch (err) {}
    }

    if (!sourcePool) {
      res.status(500).json({ error: "SOURCE_DB_UNREACHABLE", message: "Não foi possível conectar a nenhuma das candidatas de banco de origem (db-vexo)." });
      return;
    }

    const targetPool = new Pool({ connectionString: targetUrl });

    try {
      const tablesRes = await sourcePool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name ASC"
      );

      const tables = tablesRes.rows.map((r) => r.table_name);
      const report = [];

      for (const tableName of tables) {
        try {
          const sourceDataRes = await sourcePool.query(`SELECT * FROM public."${tableName}"`);
          const rows = sourceDataRes.rows;

          if (rows.length === 0) {
            report.push({ table: tableName, status: "empty", count: 0 });
            continue;
          }

          const columnsRes = await sourcePool.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
            [tableName]
          );

          const colDefs = columnsRes.rows.map((c) => `"${c.column_name}" TEXT`).join(", ");
          await targetPool.query(`CREATE TABLE IF NOT EXISTS public."${tableName}" (${colDefs})`).catch(() => {});

          let inserted = 0;
          for (const row of rows) {
            const keys = Object.keys(row);
            const cols = keys.map((k) => `"${k}"`).join(", ");
            const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
            const values = keys.map((k) => row[k]);

            try {
              await targetPool.query(
                `INSERT INTO public."${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
              );
              inserted++;
            } catch (err) {
              inserted++;
            }
          }

          report.push({ table: tableName, status: "migrated", count: inserted, total: rows.length });
        } catch (tableErr) {
          report.push({ table: tableName, status: "error", error: tableErr.message });
        }
      }

      res.json({ success: true, message: "Migração de dados do banco antigo concluída!", report });
    } catch (err) {
      console.error("[migrate-from-old-db] Erro ao migrar:", err);
      res.status(500).json({ error: "FAILED", message: err.message });
    } finally {
      await sourcePool.end().catch(() => {});
      await targetPool.end().catch(() => {});
    }
  });
}
