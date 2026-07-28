import { useQuery } from "@tanstack/react-query";
import { fetchApi, readApiJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface GdDashboardStats {
  propostas: number;
  propostas_sem_assinatura: number;
  contratos: number;
  briefings: number;
}

export function useGdDashboard() {
  const { isAuthenticated, getIdToken, clientId } = useAuth();
  return useQuery({
    queryKey: ["gdDashboard", clientId],
    enabled: isAuthenticated,
    queryFn: async (): Promise<GdDashboardStats> => {
      const token = await getIdToken();
      if (!token) throw new Error("Usuário não autenticado.");
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Tenta buscar os contadores via API dedicada
      try {
        const params = new URLSearchParams();
        if (clientId) params.set("client_id", clientId);
        const url = `/api/gd/dashboard-stats${params.toString() ? `?${params}` : ""}`;
        const res = await fetchApi(url, { headers });
        if (res.ok) {
          const stats = await readApiJson<GdDashboardStats>(res, "dashboard-stats");
          if (stats && (Number(stats.propostas || 0) > 0 || Number(stats.briefings || 0) > 0 || Number(stats.contratos || 0) > 0)) {
            return stats;
          }
        }
      } catch (err) {
        console.warn("[Dashboard GD] Aviso ao consultar /api/gd/dashboard-stats, usando fallback:", err);
      }

      // 2. Fallback resiliente: calcula diretamente a partir das listas de propostas, contratos e briefings do módulo
      const [resProps, resContracts, resBriefingsCap, resBriefingsImp] = await Promise.all([
        fetchApi("/api/gd/proposals", { headers }).catch(() => null),
        fetchApi("/api/gd/contracts", { headers }).catch(() => null),
        fetchApi("/api/geracao-digital/briefings", { headers }).catch(() => null),
        fetchApi("/api/gd/implementation-briefings", { headers }).catch(() => null),
      ]);

      let propostas = 0;
      let propostas_sem_assinatura = 0;
      let contratos = 0;
      let briefings = 0;

      if (resProps && resProps.ok) {
        const jsonP = await readApiJson<any>(resProps, "gd-proposals");
        const listP = Array.isArray(jsonP) ? jsonP : jsonP?.data || [];
        propostas = listP.length;
        for (const p of listP) {
          const isAceita = p.status === "aceita" || p.status === "fechado" || p.status === "assinado" || Boolean(p.signed_at);
          if (!isAceita) {
            propostas_sem_assinatura++;
          } else {
            contratos++;
          }
        }
      }

      if (resContracts && resContracts.ok) {
        const jsonC = await readApiJson<any>(resContracts, "gd-contracts");
        const listC = Array.isArray(jsonC) ? jsonC : jsonC?.data || [];
        contratos += listC.length;
      }

      if (resBriefingsCap && resBriefingsCap.ok) {
        const jsonBC = await readApiJson<any>(resBriefingsCap, "geracao-digital-briefings");
        const listBC = Array.isArray(jsonBC) ? jsonBC : jsonBC?.data || [];
        briefings += listBC.length;
      }

      if (resBriefingsImp && resBriefingsImp.ok) {
        const jsonBI = await readApiJson<any>(resBriefingsImp, "gd-implementation-briefings");
        const listBI = Array.isArray(jsonBI) ? jsonBI : jsonBI?.data || jsonBI?.tenants || [];
        briefings += listBI.length;
      }

      return {
        propostas,
        propostas_sem_assinatura,
        contratos,
        briefings,
      };
    },
  });
}
