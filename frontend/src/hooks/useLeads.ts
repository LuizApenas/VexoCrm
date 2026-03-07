// VexoCrm/src/hooks/useLeads.ts
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api";

export function useLeads(clientId = "infinie") {
  return useQuery({
    queryKey: ["leads", clientId],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/leads?clientId=${encodeURIComponent(clientId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Leads fetch failed: ${res.status} ${errText}`);
      }
      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : [];
    },
    staleTime: 30 * 1000, // 30s
  });
}
