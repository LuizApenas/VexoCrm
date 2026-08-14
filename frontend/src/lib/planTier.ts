export type PlanTier = "essencial" | "avancado";

export function resolveTenantPlan(client?: any): PlanTier {
  if (!client) return "essencial";
  const rawTier = String(
    client.plan_tier ||
    client.plan_type ||
    client.model_type ||
    client.n8n_settings?.plan_tier ||
    client.n8n_settings?.plan_type ||
    client.n8n_settings?.model_type ||
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
