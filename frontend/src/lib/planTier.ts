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

export function hasFeatureUnlocked(client: any, featureKey: string): boolean {
  if (!client) return true;
  const tier = resolveTenantPlan(client);
  if (tier === "avancado") return true;

  // Checar liberação avulsa / degustação
  const modulosAvulsos = client.modulos_avulsos || client.n8n_settings?.modulos_avulsos || [];
  if (Array.isArray(modulosAvulsos) && (modulosAvulsos.includes(featureKey) || modulosAvulsos.includes("all"))) {
    return true;
  }
  return false;
}
