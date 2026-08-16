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
    // Falha de leitura NAO pode tirar acesso de quem tem: devolve null e o gate
    // deixa passar. Negar por indisponibilidade do banco derrubaria tenant pagante.
    console.warn("[modular-gate] falha ao ler settings do tenant; acesso mantido", {
      clientId,
      erro: err?.message || err,
    });
    return null;
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
  if (!settings || !isPlanoModular(settings)) return accessProfile;

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
