// Para quem vai a notificacao de SDR — e, quando nao vai, POR QUE.
//
// O log dizia "no SDR number configured" com o numero salvo na tela. Tres
// situacoes diferentes caiam na mesma frase: transferencia desligada de
// proposito, numero realmente ausente, e falha de LEITURA das settings
// (getLeadClientN8nSettings devolvia null por um catch que engolia o erro).
//
// Desde 06/08/2026 o destino e uma LISTA. A mesma configuracao do tenant serve
// aos dois agentes (disparo e atendimento) — nao existem duas listas.

export const SDR_MOTIVOS = {
  OK: "ok",
  TRANSFERENCIA_DESLIGADA: "transferencia_desligada",
  SEM_NUMERO: "sem_numero_configurado",
  LEITURA_FALHOU: "leitura_de_settings_falhou",
};

/**
 * Formato aceito: so digitos, 10 a 15 (E.164 sem o "+"). Numero invalido nao
 * entra na lista — no backend e na tela, para o mesmo criterio valer nos dois.
 */
export function isValidSdrNumber(value) {
  return /^\d{10,15}$/.test(String(value ?? "").replace(/\D/g, ""));
}

export function normalizeSdrNumber(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Lista de numeros do tenant, ja normalizada e sem repetido.
 *
 * Le a coluna nova e cai na antiga quando a linha ainda nao migrou: durante o
 * deploy as duas convivem, e ler so a nova deixaria o tenant sem notificacao.
 */
export function resolveTenantSdrNumbers(tenantSettings) {
  const daLista = Array.isArray(tenantSettings?.sdr_whatsapp_numbers)
    ? tenantSettings.sdr_whatsapp_numbers
    : [];
  const brutos = daLista.length > 0 ? daLista : [tenantSettings?.sdr_whatsapp_number];

  const vistos = new Set();
  const numeros = [];
  for (const bruto of brutos) {
    const numero = normalizeSdrNumber(bruto);
    if (!numero || !isValidSdrNumber(numero) || vistos.has(numero)) continue;
    vistos.add(numero);
    numeros.push(numero);
  }
  return numeros;
}

/**
 * Precedencia:
 *  1. agente inbound com transferencia DESLIGADA -> ninguem. Escolha explicita
 *     do usuario naquele numero, vence o padrao do tenant.
 *  2. agente inbound com numero proprio -> so ele.
 *  3. caso contrario -> a lista do tenant.
 *
 * Devolve `numbers` (lista) e `number` (o primeiro), este ultimo so para nao
 * quebrar chamador antigo.
 */
export function resolveSdrTarget({ inboundConfig, tenantSettings, tenantSettingsReadFailed = false }) {
  if (inboundConfig && !inboundConfig.sdrTransferEnabled) {
    return { numbers: [], number: null, reason: SDR_MOTIVOS.TRANSFERENCIA_DESLIGADA };
  }

  const doAgente = normalizeSdrNumber(inboundConfig?.sdrPhone);
  const numeros = doAgente && isValidSdrNumber(doAgente)
    ? [doAgente]
    : resolveTenantSdrNumbers(tenantSettings);

  if (numeros.length > 0) {
    return { numbers: numeros, number: numeros[0], reason: SDR_MOTIVOS.OK };
  }

  // Sem numero E a leitura falhou: nao afirmar "nao configurado". A lista pode
  // existir e a consulta ter caido.
  if (tenantSettingsReadFailed) {
    return { numbers: [], number: null, reason: SDR_MOTIVOS.LEITURA_FALHOU };
  }

  return { numbers: [], number: null, reason: SDR_MOTIVOS.SEM_NUMERO };
}
