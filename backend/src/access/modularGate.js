// Gate do PLANO MODULAR no backend.
//
// Ate aqui o gating existia so no frontend (getInheritedPlanPages, usada por
// AppSidebar e ProtectedRoute). O menu escondia o item e a rota respondia
// normalmente — esconder botao nao e permissao.
//
// O backend ja tinha deriveTenantInternalPages em access/claims.js, com teste verde,
// mas `grep -rn deriveTenantInternalPages backend/src` so encontrava o proprio
// arquivo de teste: a funcao nunca foi ligada ao caminho das claims. Mesmo padrao
// dos dois runCampaignDispatch — funcao certa, teste verde, e o que roda e outra
// coisa. Este modulo e o fio que faltava.
//
// ADITIVO POR CONSTRUCAO: so restringe quando o tenant e "modular". Essencial,
// avancado e tenant sem plano saem daqui com as mesmas paginas que entraram. O
// projeto ja teve regressao de acesso por troca de lista, entao a restricao e uma
// INTERSECAO com o que o usuario ja tinha, nunca uma substituicao.

import { deriveTenantInternalPages } from "./claims.js";
import { getLeadClientN8nSettings } from "../services/n8nSettings.js";
import { sendError } from "../services/httpInfra.js";

const TTL_MS = 60_000;
const cache = new Map();

function planoDoTenant(settings) {
  return String(settings?.plan_tier || settings?.planTier || "").toLowerCase().trim();
}

export function isPlanoModular(settings) {
  const plano = planoDoTenant(settings);
  return plano.includes("modular") || plano.includes("avulso");
}

/**
 * Settings do tenant com cache curto. O gate roda em toda requisicao autenticada;
 * sem cache seria uma consulta por request. TTL de 1 minuto: mudanca de plano
 * demora no maximo isso para valer, e o admin ja recarrega a tela depois de salvar.
 */
async function settingsDoTenant(clientId) {
  const agora = Date.now();
  const emCache = cache.get(clientId);
  if (emCache && agora - emCache.em < TTL_MS) return emCache.settings;

  try {
    const settings = await getLeadClientN8nSettings(clientId);
    cache.set(clientId, { settings, em: agora });
    return settings;
  } catch (err) {
    // Em controle de acesso, falha de leitura NEGA acesso (fail-closed) e loga com erro.
    console.error("[modular-gate] falha ao ler settings do tenant; acesso negado por seguranca", {
      clientId,
      erro: err?.message || err,
    });
    return { readError: true, error: err };
  }
}

/** So para teste: zera o cache entre casos. */
export function _resetModularGateCache() {
  cache.clear();
}

/**
 * Aplica o plano modular ao perfil de acesso, no lugar por onde TODA rota passa
 * (requireFirebaseAuth). Devolve o proprio perfil quando nao ha o que restringir.
 */
export async function applyModularPlanGate(accessProfile) {
  if (!accessProfile) return accessProfile;

  // Admin e superadmin nao sao restringidos: sao a equipe Vexo, nao o tenant.
  if (accessProfile.isAdmin || accessProfile.role === "superadmin") return accessProfile;

  const clientId = accessProfile.clientId || accessProfile.clientIds?.[0] || null;
  if (!clientId) return accessProfile;

  const settings = await settingsDoTenant(clientId);
  if (!settings) return accessProfile;

  if (settings.readError) {
    return {
      ...accessProfile,
      internalPages: [],
      planTier: "error",
      error: "TENANT_SETTINGS_READ_FAILED",
    };
  }

  if (!isPlanoModular(settings)) return accessProfile;

  const permitidas = deriveTenantInternalPages({
    plan_tier: settings.plan_tier,
    modulos_avulsos: settings.modulos_avulsos,
  });
  const permitidasSet = new Set(permitidas);

  const antes = Array.isArray(accessProfile.internalPages) ? accessProfile.internalPages : [];
  // INTERSECAO: o modular nunca CONCEDE pagina que o usuario nao tinha; so tira o
  // que o tenant nao contratou.
  const depois = antes.filter((pagina) => permitidasSet.has(pagina));

  if (depois.length !== antes.length) {
    const removidas = antes.filter((p) => !permitidasSet.has(p));
    console.log("[modular-gate] paginas removidas por plano modular", {
      clientId,
      removidas,
      restantes: depois.length,
    });
  }

  return { ...accessProfile, internalPages: depois, planTier: "modular" };
}

/**
 * Exige que a pagina venha de um modulo CONTRATADO — mas so para tenant modular.
 *
 * Nao da para usar requireInternalPageAccess aqui: ele cobra a chave da claim, e
 * claim de usuario antigo nao tem "banco-de-dados" (a chave so entrou em
 * INTERNAL_PAGE_KEYS em a3fae32, e claim so e reescrita quando o acesso do
 * usuario e salvo). Cobrar a chave hoje derrubaria usuario de tenant pagante que
 * usa a tela todo dia.
 *
 * Entao o criterio e o unico que ja e verdade agora: para tenant modular,
 * applyModularPlanGate acabou de reduzir internalPages ao que o plano concede —
 * se a pagina nao sobreviveu ali, o modulo nao foi contratado. Para tenant
 * essencial e avancado o middleware nao faz nada, porque modulos_avulsos nunca
 * governou esses planos.
 */
export function requireContractedModulePage(page) {
  return (req, res, next) => {
    const access = req.authAccess;

    if (access?.isAdmin || access?.role === "superadmin") {
      next();
      return;
    }

    // planTier so vale "modular" quando applyModularPlanGate agiu de fato.
    if (access?.planTier !== "modular") {
      next();
      return;
    }

    if (Array.isArray(access.internalPages) && access.internalPages.includes(page)) {
      next();
      return;
    }

    console.warn("[modular-gate] modulo nao contratado", {
      page,
      clientId: access?.clientId,
    });
    sendError(res, 403, "FORBIDDEN", `Módulo não contratado no plano modular: ${page}`);
  };
}
