import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api";

export interface LeadRow {
  id: string;
  client_id: string;
  telefone: string | null;
  nome: string | null;
  tipo_cliente: string | null;
  faixa_consumo: string | null;
  cidade: string | null;
  estado: string | null;
  status: string | null;
  data_hora: string | null;
  qualificacao: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeads(clientId = "infinie") {
  return useQuery({
    queryKey: ["leads", clientId],
    queryFn: async (): Promise<LeadRow[]> => {
      const url = `${API_BASE_URL}/api/leads?clientId=${encodeURIComponent(clientId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Leads fetch failed: ${res.status} ${errText}`);
      }
      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : [];
    },
    staleTime: 30 * 1000,
  });
}
