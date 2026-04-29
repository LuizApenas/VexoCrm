import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

export interface LeadClient {
  id: string;
  name: string;
  created_at?: string;
}

export interface CreateLeadClientPayload {
  id: string;
  name: string;
}

export function useLeadClients() {
  const { isAuthenticated, getIdToken } = useAuth();

  return useQuery({
    queryKey: ["lead-clients"],
    enabled: isAuthenticated,
    queryFn: async (): Promise<LeadClient[]> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/lead-clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lead clients fetch failed: ${res.status} ${errText}`);
      }

      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateLeadClient() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLeadClientPayload): Promise<LeadClient> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/lead-clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await res.json().catch(() => null);

      if (!res.ok) {
        const apiMessage =
          responsePayload?.error?.message ||
          responsePayload?.error?.details ||
          `Lead client create failed: ${res.status}`;
        throw new Error(apiMessage);
      }

      if (!responsePayload?.item) {
        throw new Error("Lead client create failed: missing response payload");
      }

      return responsePayload.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-clients"] });
    },
  });
}

export function useDeleteLeadClient() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string): Promise<{ id: string; name?: string }> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const deleteUrl = `${API_BASE_URL}/api/lead-clients/${encodeURIComponent(tenantId)}`;
      let res = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let responsePayload = await res.json().catch(() => null);

      if (res.status === 404) {
        res = await fetch(`${API_BASE_URL}/api/lead-clients/delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tenantId }),
        });

        responsePayload = await res.json().catch(() => null);
      }

      if (!res.ok) {
        const apiMessage =
          responsePayload?.error?.message ||
          responsePayload?.error?.details ||
          `Lead client delete failed: ${res.status}`;
        throw new Error(apiMessage);
      }

      return responsePayload?.item || { id: tenantId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-clients"] });
    },
  });
}
