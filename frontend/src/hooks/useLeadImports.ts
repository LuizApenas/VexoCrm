import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

export interface LeadImportItem {
  id: string;
  client_id: string;
  source_name: string;
  source_type: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  uploaded_by_uid: string | null;
  uploaded_by_email: string | null;
  created_at: string;
}

export interface LeadImportPreviewItem {
  rowNumber: number;
  telefone: string | null;
  nome: string | null;
  cidade: string | null;
  status: string | null;
  imported: boolean;
  skipReason: string | null;
}

interface CreateLeadImportPayload {
  clientId: string;
  sourceName: string;
  sourceType: string;
  rows: Record<string, unknown>[];
}

interface CreateLeadImportResponse {
  item: LeadImportItem;
  preview: LeadImportPreviewItem[];
}

export function useLeadImports(clientId?: string) {
  const { isAuthenticated, canAccessView, getIdToken } = useAuth();

  return useQuery({
    queryKey: ["lead-imports", clientId],
    enabled: isAuthenticated && !!clientId && canAccessView("planilhas"),
    queryFn: async (): Promise<LeadImportItem[]> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(
        `${API_BASE_URL}/api/lead-imports?clientId=${encodeURIComponent(clientId || "")}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lead imports fetch failed: ${res.status} ${errText}`);
      }

      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : [];
    },
    staleTime: 30 * 1000,
  });
}

export interface LeadImportItemDetail {
  id: string;
  import_id: string;
  client_id: string;
  row_number: number;
  telefone: string | null;
  normalized_data: Record<string, unknown> | null;
  imported: boolean;
  skip_reason: string | null;
  created_at: string;
  dispatched: boolean;
}

interface LeadImportItemsResponse {
  items: LeadImportItemDetail[];
  total: number;
  pendingCount: number;
}

export function useLeadImportItems(clientId?: string, importId?: string, dispatched?: string) {
  const { isAuthenticated, canAccessView, getIdToken } = useAuth();

  return useQuery({
    queryKey: ["lead-import-items", clientId, importId, dispatched],
    enabled: isAuthenticated && !!clientId && canAccessView("planilhas"),
    queryFn: async (): Promise<LeadImportItemsResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error("Usuario nao autenticado.");

      const params = new URLSearchParams();
      if (clientId) params.set("clientId", clientId);
      if (importId) params.set("importId", importId);
      if (dispatched !== undefined) params.set("dispatched", dispatched);

      const res = await fetch(`${API_BASE_URL}/api/lead-import-items?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lead import items fetch failed: ${res.status} ${errText}`);
      }

      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

export function useDeleteLeadImport() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importId: string): Promise<{ success: boolean; deletedId: string }> => {
      const token = await getIdToken();
      if (!token) throw new Error("Usuario nao autenticado.");

      const res = await fetch(`${API_BASE_URL}/api/lead-imports/${importId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Delete failed: ${res.status} ${errText}`);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-imports"] });
      queryClient.invalidateQueries({ queryKey: ["lead-import-items"] });
    },
  });
}

export function useCreateLeadImport() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLeadImportPayload): Promise<CreateLeadImportResponse> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/lead-imports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lead import failed: ${res.status} ${errText}`);
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead-imports", variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ["leads", variables.clientId] });
    },
  });
}
