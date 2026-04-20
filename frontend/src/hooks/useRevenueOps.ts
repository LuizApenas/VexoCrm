import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

export interface RevenueMetric {
  key: string;
  name: string;
  formula: string;
  source: string;
  frequency: string;
  display: string;
  kind: string;
  availability: "ready" | "partial" | "future";
  note: string | null;
  raw: number | null;
  displayValue: string;
}

export interface RankingEntry {
  id?: string;
  name: string;
  qualificationRate?: number;
  conversionRate?: number;
  avgCloseHours?: number | null;
  qualifiedLeads?: number;
  responseRate?: number;
  potentialRoi?: number;
  responseTimeHours?: number | null;
  conversionPerLead?: number;
  score: number;
  trend: "subindo" | "caindo" | "estavel";
}

export interface RevenueOpsPayload {
  client: {
    id: string;
    name: string;
  };
  generatedAt: string;
  essentialMetrics: RevenueMetric[];
  advancedMetrics: RevenueMetric[];
  rankings: {
    cities: { top5: RankingEntry[]; bottom5: RankingEntry[] };
    campaigns: { top5: RankingEntry[]; bottom5: RankingEntry[] };
    consultants: { top5: RankingEntry[]; bottom5: RankingEntry[]; availability: string };
  };
  distribution: {
    criteria: string[];
    models: Array<{ key: string; name: string; description: string; rules: string[] }>;
    activeRules: Array<{
      id: string;
      name: string;
      distribution_mode: string;
      prioritize_region: boolean;
      prioritize_contract_value: boolean;
      prioritize_lead_type: boolean;
      max_open_leads_per_consultant: number;
      reassign_after_minutes: number;
      fairness_floor: number;
      active: boolean;
      config: Record<string, unknown>;
    }>;
    consultantLoadSummary: {
      totalConsultants: number;
      availableConsultants: number;
      overloadedConsultants: number;
    };
    operationalRules: string[];
  };
  dataModel: {
    tables: Array<{
      name: string;
      purpose: string;
      fields: string[];
    }>;
  };
  dashboardBlueprint: {
    cards: string[];
    charts: string[];
    alerts: string[];
    filters: string[];
  };
  insights: Array<{
    title: string;
    message: string;
    severity: "info" | "warning" | "critical";
    scope: string;
  }>;
}

export function useRevenueOps(clientId: string) {
  const { isAuthenticated, getIdToken } = useAuth();

  return useQuery({
    queryKey: ["revenue-ops", clientId],
    enabled: isAuthenticated && !!clientId,
    queryFn: async (): Promise<RevenueOpsPayload> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/revenue-ops?clientId=${encodeURIComponent(clientId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Revenue Ops fetch failed: ${res.status} ${errText}`);
      }

      return res.json();
    },
    staleTime: 30 * 1000,
  });
}
