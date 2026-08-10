// Para quem vai a notificacao de SDR — e, quando nao vai, POR QUE.
//
// O log dizia "no SDR number configured" com o numero salvo na tela. Tres
// situacoes diferentes caiam na mesma frase: transferencia desligada de
// proposito, numero realmente ausente, e falha de LEITURA das settings
// (getLeadClientN8nSettings devolvia null por um catch que engolia o erro).
// Sem distinguir, nao dava para saber se era configuracao ou incidente.

export const SDR_MOTIVOS = {
  OK: "ok",
  TRANSFERENCIA_DESLIGADA: "transferencia_desligada",
  SEM_NUMERO: "sem_numero_configurado",
  LEITURA_FALHOU: "leitura_de_settings_falhou",
};

/**
 * Precedencia:
 *  1. agente inbound com transferencia DESLIGADA -> ninguem. Escolha explicita
 *     do usuario naquele numero, vence o padrao do tenant.
 *  2. agente inbound com transferencia ligada -> numero do agente; sem ele,
 *     o numero do tenant.
 *  3. sem agente inbound -> numero do tenant.
 */
export function resolveSdrTarget({ inboundConfig, tenantSettings, tenantSettingsReadFailed = false }) {
  const numeroDoTenant = String(tenantSettings?.sdr_whatsapp_number ?? "").trim() || null;

  if (inboundConfig && !inboundConfig.sdrTransferEnabled) {
    return { number: null, reason: SDR_MOTIVOS.TRANSFERENCIA_DESLIGADA };
  }

  const numeroDoAgente = String(inboundConfig?.sdrPhone ?? "").trim() || null;
  const numero = numeroDoAgente || numeroDoTenant;

  if (numero) return { number: numero, reason: SDR_MOTIVOS.OK };

  // Sem numero E a leitura falhou: nao afirmar "nao configurado". O numero pode
  // existir e a consulta ter caido.
  if (tenantSettingsReadFailed) {
    return { number: null, reason: SDR_MOTIVOS.LEITURA_FALHOU };
  }

  return { number: null, reason: SDR_MOTIVOS.SEM_NUMERO };
}
