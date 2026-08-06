import { useQuery } from "@tanstack/react-query";
import { fetchApi, readApiJson } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface GdDashboardStats {
  propostas: number;
  propostas_sem_assinatura: number;
  contratos: number;
  briefings: number;
  /** Fontes que nao responderam. Vazio = numeros completos. */
  partialFailures?: string[];
}

// Erro do dashboard GD preservando status e codigo. Sem isso, backend fora do ar
// vira "0 propostas, 0 contratos, 0 briefings" — indistinguivel de operacao sem
// dados, e o cliente le como perda de dados (§4 das diretrizes).
export class GdDashboardError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "GdDashboardError";
    this.code = code;
    this.status = status;
  }
}

export function isGdDashboardPermissionError(error: unknown): boolean {
  return error instanceof GdDashboardError && error.status === 403;
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

      // O fallback e resiliente de proposito: uma fonte fora do ar nao deve zerar as outras.
      // Mas silencio total mente. Se TODAS falharem, o dashboard nao tem numero nenhum e
      // precisa falhar alto; se algumas falharem, os numeros vao marcados como incompletos.
      const sources = [
        { label: "propostas", res: resProps },
        { label: "contratos", res: resContracts },
        { label: "briefings de captacao", res: resBriefingsCap },
        { label: "briefings de implantacao", res: resBriefingsImp },
      ];
      const failed = sources.filter((source) => !source.res || !source.res.ok);

      if (failed.length === sources.length) {
        const statuses = failed.map((source) => source.res?.status ?? 0);
        const allForbidden = statuses.every((status) => status === 403);
        throw new GdDashboardError(
          allForbidden
            ? "Voce nao tem permissao para ver os dados do modulo GD."
            : "Nao foi possivel carregar os dados do modulo GD.",
          allForbidden ? "FORBIDDEN" : "GD_DASHBOARD_LOAD_FAILED",
          allForbidden ? 403 : statuses.find((status) => status > 0) ?? 0
        );
      }

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
        partialFailures: failed.map((source) => source.label),
      };
    },
    // Sem permissao nao melhora com nova tentativa; so falha de carga merece retry.
    retry: (failureCount, error) => !isGdDashboardPermissionError(error) && failureCount < 1,
  });
}
