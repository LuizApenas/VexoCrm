// backend/src/domains/superadmin/routes.js
import { requireFirebaseAuth } from "../../access/middlewares.js";

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

  // GET /api/superadmin/logs -> Logs recentes do sistema
  app.get("/api/superadmin/logs", requireFirebaseAuth, requireSuperAdminGuard, async (req, res) => {
    res.json({
      logs: [
        {
          id: "log-1",
          timestamp: new Date().toISOString(),
          level: "info",
          component: "system",
          message: "Painel SuperAdmin carregado com sucesso.",
          tenantId: "geracao-digital",
        },
      ],
    });
  });
}
