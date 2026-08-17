// Recusa criacao de chip acima do limite do plano — no BACKEND.
//
// Ja esta provado neste sistema que bloqueio de frontend nao bloqueia nada: o
// Comercial Vexo abria com cadeado no menu, e o gate do plano modular existia so
// na sidebar. As duas rotas que criam instancia de WhatsApp
// (POST .../evolution-instances e .../evolution-instances/provision) tinham
// requireAnyInternalPageAccess(["conexoes","empresas"]) e nada sobre quantidade.
//
// O limite vem de DADO, em tres niveis, do mais especifico para o mais geral:
//   1. lead_client_n8n_settings.chip_limit  — override deste tenant
//   2. system_settings.chip_limits          — limite por plano, configuravel
//   3. CHIP_LIMIT_DEFAULTS                  — fallback de codigo

import { chipLimitFor, chipLimitExceeded, normalizeChipLimits } from "./chipLimit.js";
import { getLeadClientN8nSettings } from "../services/n8nSettings.js";
import { supabase } from "../services/database.js";
import { sendError } from "../services/httpInfra.js";

const TTL_MS = 60_000;
let configCache = { limites: null, em: 0 };

export function _resetChipLimitCache() {
  configCache = { limites: null, em: 0 };
}

/** Limites por plano, de system_settings.chip_limits. Falha cai no default. */
export async function getConfiguredChipLimits() {
  const agora = Date.now();
  if (configCache.limites && agora - configCache.em < TTL_MS) return configCache.limites;

  let bruto = null;
  try {
    if (supabase) {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("key", "chip_limits")
        .maybeSingle();
      const valor = data?.value;
      bruto = typeof valor === "string" ? JSON.parse(valor) : valor;
    }
  } catch (err) {
    // Config ausente ou ilegivel nao pode virar bloqueio: usa o default.
    console.warn("[chip-limit] system_settings.chip_limits indisponivel; usando default", {
      erro: err?.message || err,
    });
  }

  const limites = normalizeChipLimits(bruto);
  configCache = { limites, em: agora };
  return limites;
}

/**
 * Middleware para as rotas que CRIAM chip. `contarInstancias(tenantId)` devolve
 * quantas o tenant ja tem — injetado porque vive nas deps da rota.
 *
 * Admin e superadmin passam: sao a equipe Vexo provisionando para o cliente.
 *
 * Falha de leitura DEIXA PASSAR, ao contrario do gate do Comercial Vexo. Aqui a
 * duvida nao vaza dado de ninguem; negar por banco indisponivel impediria um
 * cliente pagante de conectar o chip dele, e sem chip nada funciona.
 */
export function makeChipLimitGuard(contarInstancias) {
  return async function chipLimitGuard(req, res, next) {
    const access = req.authAccess;
    if (access?.isAdmin || access?.role === "superadmin") {
      next();
      return;
    }

    const tenantId = req.params?.tenantId;
    if (!tenantId) {
      next();
      return;
    }

    let settings;
    let atual;
    try {
      [settings, atual] = await Promise.all([
        getLeadClientN8nSettings(tenantId),
        Promise.resolve(contarInstancias(tenantId)).then((lista) =>
          Array.isArray(lista) ? lista.length : Number(lista || 0)
        ),
      ]);
    } catch (err) {
      console.warn("[chip-limit] falha ao apurar limite; criacao liberada", {
        tenantId,
        erro: err?.message || err,
      });
      next();
      return;
    }

    const limites = await getConfiguredChipLimits();
    const limite = chipLimitFor(settings, limites);

    if (!chipLimitExceeded(atual, limite)) {
      next();
      return;
    }

    console.warn("[chip-limit] criacao de chip recusada por limite do plano", {
      tenantId,
      atual,
      limite,
      plano: settings?.plan_tier,
    });

    // Mensagem com os numeros reais: o frontend repassa o texto do backend, e
    // assim nunca inventa limite proprio.
    sendError(
      res,
      403,
      "CHIP_LIMIT_REACHED",
      limite === 0
        ? "Este plano não inclui canal de WhatsApp. Contrate o Disparador de Campanhas ou o Agente IA para conectar um número."
        : `Limite de chips atingido: ${atual} de ${limite}. O módulo "Múltiplos Chips WhatsApp" libera números adicionais.`,
      `chip_limit=${limite}; chips_atuais=${atual}`
    );
  };
}
