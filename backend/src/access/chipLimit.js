// Quantos chips de WhatsApp este tenant pode ter.
//
// O modulo "multiplos_chips" vende chip A MAIS, nao vende a tela. Bloquear a
// pagina impedia o cliente Essencial de conectar os dois chips que ele ja pagou —
// e sem chip nenhuma outra parte do sistema funciona: nem disparo, nem inbound.
// Foi o que aconteceu com o tenant Sonhare (Essencial vendo "Modulo Nao
// Contratado no Plano Modular").
//
// Aqui o direito e NUMERO, nao booleano. `null` significa ilimitado.
//
// ESTE ARQUIVO E O ESPELHO de frontend/src/lib/chipLimit.ts. Os dois existem
// porque sao linguagens diferentes; chipLimitParity.test.js falha no dia em que
// um mudar sem o outro. A autoridade e este: o frontend so decide o que desenhar,
// quem recusa e a rota.

// Defaults usados quando system_settings.chip_limits nao existe ou vem
// incompleto. Sao FALLBACK, nao a regra: o numero e configuravel — por plano em
// system_settings, e por tenant na coluna lead_client_n8n_settings.chip_limit.
export const CHIP_LIMIT_DEFAULTS = {
  // Essencial: 1 chip de disparo + 1 de inbound.
  essencial: 2,
  // Modular que contratou disparador ou agente: mesma base do Essencial.
  modular_com_ferramenta: 2,
  // Modular sem nenhuma das duas: nao tem o que fazer com chip. Aqui — e so
  // aqui — a tela inteira bloqueia.
  modular_sem_ferramenta: 0,
};

export const ILIMITADO = null;

function texto(valor) {
  return String(valor ?? "").toLowerCase().trim();
}

/** Plano do tenant a partir do registro de settings. Espelha resolveTenantPlan. */
export function planoDoTenant(settings) {
  const bruto = texto(settings?.plan_tier ?? settings?.planTier);
  if (bruto.includes("avancad") || bruto.includes("advanced") || bruto === "pro") return "avancado";
  if (bruto.includes("modular") || bruto.includes("avulso") || bruto.includes("custom")) return "modular";
  return "essencial";
}

function modulosContratados(settings) {
  const bruto = settings?.modulos_avulsos ?? settings?.modulosAvulsos ?? [];
  const lista = Array.isArray(bruto)
    ? bruto
    : typeof bruto === "string"
      ? bruto.split(",")
      : [];
  return new Set(
    lista.map((item) => texto(item).replace(/^(mod_|modulo_)/, "")).filter(Boolean)
  );
}

/**
 * Contratou um modulo, por id ou por um dos apelidos que a tabela ja aceitava.
 * Nenhum apelido novo: sao os mesmos de MODULE_CATALOG.
 */
function contratou(settings, ids) {
  const contratados = modulosContratados(settings);
  if (contratados.has("all") || contratados.has("*")) return true;
  return ids.some((id) => contratados.has(texto(id)));
}

/** Normaliza a configuracao vinda de system_settings.chip_limits. */
export function normalizeChipLimits(bruto) {
  const limites = { ...CHIP_LIMIT_DEFAULTS };
  if (!bruto || typeof bruto !== "object") return limites;

  for (const chave of Object.keys(CHIP_LIMIT_DEFAULTS)) {
    const valor = bruto[chave];
    if (valor === null) {
      limites[chave] = null; // ilimitado, configurado de proposito
      continue;
    }
    const numero = Number(valor);
    if (Number.isInteger(numero) && numero >= 0) limites[chave] = numero;
  }
  return limites;
}

/** Override por tenant: coluna chip_limit. Ignora valor invalido. */
function overrideDoTenant(settings) {
  const bruto = settings?.chip_limit ?? settings?.chipLimit;
  if (bruto === null || bruto === undefined || bruto === "") return undefined;
  if (texto(bruto) === "ilimitado" || texto(bruto) === "unlimited") return null;
  const numero = Number(bruto);
  return Number.isInteger(numero) && numero >= 0 ? numero : undefined;
}

/**
 * Limite de chips do tenant. `null` = ilimitado.
 *
 *   Essencial ............................ base
 *   Essencial + multiplos_chips .......... ilimitado
 *   Avancado ............................. ilimitado
 *   Modular COM disparador OU agente ..... base
 *   Modular sem nenhum dos dois .......... 0
 *
 * Precedencia: override do tenant > modulo/plano > default.
 */
export function chipLimitFor(settings, limitesConfigurados) {
  const limites = normalizeChipLimits(limitesConfigurados);

  const override = overrideDoTenant(settings);
  if (override !== undefined) return override;

  // O modulo avulso vale em qualquer plano — e ele que vende chip a mais.
  if (contratou(settings, ["multiplos_chips", "conexoes", "chips-whatsapp", "chips"])) {
    return ILIMITADO;
  }

  const plano = planoDoTenant(settings);
  if (plano === "avancado") return ILIMITADO;

  if (plano === "modular") {
    const temFerramenta = contratou(settings, [
      "disparador_campanhas", "campanhas", "disparos", "planilhas",
      "agente_inbound", "agente", "agente-ia", "agente_rag", "rag",
    ]);
    return temFerramenta ? limites.modular_com_ferramenta : limites.modular_sem_ferramenta;
  }

  return limites.essencial;
}

/** Tem direito a pelo menos um chip? So o 0 fecha a tela inteira. */
export function canUseChipsPage(settings, limitesConfigurados) {
  return chipLimitFor(settings, limitesConfigurados) !== 0;
}

/** Cabe mais um chip? */
export function chipLimitExceeded(quantidadeAtual, limite) {
  if (limite === null) return false;
  return Number(quantidadeAtual || 0) >= Number(limite);
}
