/**
 * tenantIsolation.ts
 *
 * Mecanismo compartilhado de isolamento de estado por tenant e trava anti-corrupção.
 * Impede que edições em uma tela sejam salvas em tenant diferente do selecionado.
 */

export interface TenantValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Valida se o tenant alvo de uma operação corresponde ao tenant atualmente ativo no CRM.
 * Recusa operações quando há divergência de tenant.
 */
export function validateTenantTarget(
  targetTenantId: string | undefined | null,
  currentSelectedTenantId: string | undefined | null
): TenantValidationResult {
  const normTarget = String(targetTenantId || "").trim();
  const normSelected = String(currentSelectedTenantId || "").trim();

  if (!normTarget) {
    return {
      ok: false,
      error: "Identificador da empresa de destino não informado.",
    };
  }

  // Se o seletor do CRM estiver setado (e não for 'global'), o target precisa bater exatamente
  if (normSelected && normSelected !== "global" && normTarget !== normSelected) {
    return {
      ok: false,
      error: `Divergência de empresa: tentando gravar para "${normTarget}", mas a empresa selecionada é "${normSelected}". Operação cancelada por segurança.`,
    };
  }

  return { ok: true };
}

/**
 * Lança exceção caso haja divergência entre o tenant da ação e o tenant ativo.
 */
export function assertTenantMatch(
  targetTenantId: string | undefined | null,
  currentSelectedTenantId: string | undefined | null
): void {
  const result = validateTenantTarget(targetTenantId, currentSelectedTenantId);
  if (!result.ok) {
    throw new Error(result.error);
  }
}
