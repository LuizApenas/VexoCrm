import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

export interface ConsultantSchedule {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  scheduling_link: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Erro da API de consultores preservando status e `error.code` do backend
// (backend/src/services/httpInfra.js -> sendError). Sem isso a tela nao consegue
// distinguir "sem permissao" de "falhou ao carregar" e acaba mostrando "nenhum
// consultor cadastrado" para os dois — mentira que a §4 das diretrizes proibe.
export class ConsultantSchedulesError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ConsultantSchedulesError";
    this.code = code;
    this.status = status;
  }
}

export function isConsultantPermissionError(error: unknown): boolean {
  return error instanceof ConsultantSchedulesError && error.status === 403;
}

async function throwConsultantApiError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
  const code = typeof data?.error?.code === "string" ? data.error.code : "";
  throw new ConsultantSchedulesError(data?.error?.message || fallback, code, res.status);
}

export function useConsultantSchedules(clientId: string) {
  const { isAuthenticated, getIdToken } = useAuth();
  return useQuery({
    queryKey: ["consultant-schedules", clientId],
    enabled: isAuthenticated && !!clientId,
    queryFn: async (): Promise<ConsultantSchedule[]> => {
      const token = await getIdToken();
      if (!token) throw new Error("Usuario nao autenticado.");
      const res = await fetch(`${API_BASE_URL}/api/campaigns/consultant-schedules?clientId=${encodeURIComponent(clientId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwConsultantApiError(res, "Falha ao buscar consultores.");
      const data = await res.json();
      return data.items || [];
    },
    // Sem permissao nao melhora com nova tentativa; so erro de carga merece retry.
    retry: (failureCount, error) => !isConsultantPermissionError(error) && failureCount < 1,
    staleTime: 30 * 1000,
  });
}

export function useCreateConsultantSchedule() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { clientId: string; name: string; scheduling_link: string; email?: string; phone?: string; active?: boolean }): Promise<ConsultantSchedule> => {
      const token = await getIdToken();
      if (!token) throw new Error("Usuario nao autenticado.");
      const res = await fetch(`${API_BASE_URL}/api/campaigns/consultant-schedules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Falha ao criar consultor.");
      }
      const data = await res.json();
      return data.item;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["consultant-schedules", variables.clientId] });
    },
  });
}

export function useUpdateConsultantSchedule() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId, ...payload }: { id: string; clientId: string; name?: string; scheduling_link?: string; email?: string; phone?: string; active?: boolean }): Promise<ConsultantSchedule> => {
      const token = await getIdToken();
      if (!token) throw new Error("Usuario nao autenticado.");
      const res = await fetch(`${API_BASE_URL}/api/campaigns/consultant-schedules/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao atualizar consultor.");
      const data = await res.json();
      return data.item;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["consultant-schedules", variables.clientId] });
    },
  });
}

export function useDeleteConsultantSchedule() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }): Promise<void> => {
      const token = await getIdToken();
      if (!token) throw new Error("Usuario nao autenticado.");
      const res = await fetch(`${API_BASE_URL}/api/campaigns/consultant-schedules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao deletar consultor.");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["consultant-schedules", variables.clientId] });
    },
  });
}
