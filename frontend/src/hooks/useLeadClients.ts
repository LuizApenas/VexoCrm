import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api";

export interface LeadClient {
  id: string;
  name: string;
  created_at?: string;
}

export function useLeadClients() {
  return useQuery({
    queryKey: ["lead-clients"],
    queryFn: async (): Promise<LeadClient[]> => {
      const res = await fetch(`${API_BASE_URL}/api/lead-clients`);
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
