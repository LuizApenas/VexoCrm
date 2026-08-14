export type PlanTier = "essencial" | "avancado";

export const FEATURE_TIERS = {
  essencial: {
    name: "Plano Essencial",
    badge: "🟢 Base",
    description: "Operação comercial completa com 1 conexão de chip, IA de atendimento e disparos.",
    features: [
      "Dashboard comercial e KPIs em tempo real",
      "Leads & Banco de Dados Inteligente",
      "Conversas (Inbox WhatsApp centralizado)",
      "Disparos por Planilha com cadência segura",
      "IA de Atendimento Inbound (1 Conexão de Chip)",
      "Follow-up (2 cadências manuais por oportunidade)",
      "Treinamento Vexo (Academy com trilha prática)",
    ],
  },
  avancado: {
    name: "Plano Avançado",
    badge: "🟣 Completo",
    description: "Automação avançada com múltiplos chips, Base RAG, SDR Broadcast e Follow-up por evento.",
    features: [
      "Todos os recursos do Plano Essencial",
      "Base de Conhecimento RAG com upload de PDFs e catálogos (agente_rag)",
      "Automações por Evento no Follow-up (followup_automations)",
      "Alertas SDR Broadcast para múltiplos atendentes (sdr_broadcast)",
      "Conexão de Chips WhatsApp adicionais / ilimitados (multiplos_chips)",
      "Atribuição e Análise de Origem de Leads (origem_leads)",
    ],
  },
} as const;

export function resolveTenantPlan(client?: any): PlanTier {
  if (!client) return "essencial";
  const rawTier = String(
    client.plan_tier ||
    client.planTier ||
    client.n8n_settings?.plan_tier ||
    client.n8n_settings?.planTier ||
    client.plan_type ||
    client.planType ||
    client.n8n_settings?.plan_type ||
    client.n8n_settings?.planType ||
    (client.model_type === "avancado" || client.modelType === "avancado" ? "avancado" : "") ||
    client.model_type ||
    client.modelType ||
    client.n8n_settings?.model_type ||
    client.n8n_settings?.modelType ||
    ""
  ).toLowerCase().trim();

  if (rawTier.includes("avancad") || rawTier.includes("advanced") || rawTier.includes("pro") || rawTier === "avancado") {
    return "avancado";
  }
  return "essencial";
}

export function isDegustacaoExpired(client: any): boolean {
  if (!client) return false;
  const expiraEm =
    client.degustacao_expira_em ||
    client.degustacaoExpiraEm ||
    client.n8n_settings?.degustacao_expira_em ||
    client.n8n_settings?.degustacaoExpiraEm;
  if (!expiraEm) return false;

  const expDate = new Date(expiraEm);
  if (isNaN(expDate.getTime())) return false;
  return expDate.getTime() < Date.now();
}

export function getDegustacaoRemainingDays(client: any): number | null {
  if (!client) return null;
  const expiraEm =
    client.degustacao_expira_em ||
    client.degustacaoExpiraEm ||
    client.n8n_settings?.degustacao_expira_em ||
    client.n8n_settings?.degustacaoExpiraEm;
  if (!expiraEm) return null;

  const expDate = new Date(expiraEm);
  if (isNaN(expDate.getTime())) return null;
  const diffMs = expDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function hasFeatureUnlocked(client: any, featureKey: string): boolean {
  if (!client) return true;
  const tier = resolveTenantPlan(client);
  if (tier === "avancado") return true;

  // Se a degustação expirou, os módulos avulsos deixam de estar liberados
  if (isDegustacaoExpired(client)) {
    return false;
  }

  // Checar liberação avulsa / degustação
  const modulosAvulsos = client.modulos_avulsos || client.n8n_settings?.modulos_avulsos || [];
  if (Array.isArray(modulosAvulsos) && (modulosAvulsos.includes(featureKey) || modulosAvulsos.includes("all"))) {
    return true;
  }
  return false;
}
