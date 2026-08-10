// n8n / dispatch settings por cliente (movidos de server.js — grupo F do mapa,
// Onda 3 Run D). Movimento puro: corpos idênticos aos de server.js na revisão
// anterior a esta extração.
//
// isMaskedSecretPlaceholder NÃO está aqui: foi movida para ./httpInfra.js. Motivo:
// este módulo já precisa importar de ./evolution.js (getDefaultLeadClientEvolutionInstance,
// mergeEvolutionInstanceIntoSettings, getLeadClientEvolutionInstancesMap, maskEvolutionInstance
// — getLeadClientN8nSettingsStatus/Map fazem merge com a instância Evolution default). Se
// isMaskedSecretPlaceholder (usada também por evolution.js:upsertLeadClientEvolutionInstance)
// vivesse aqui, evolution.js precisaria importar deste módulo de volta, fechando um ciclo.
// Import de httpInfra.js (folha do grafo) evita isso: a direção real do grafo nesta dupla é
// n8nSettings.js -> evolution.js (nunca o contrário).
//
// validateN8nInboundBearer: pendência do Run A (ficou em server.js porque dependia de
// getLeadClientN8nSettings, que só agora foi extraída). Movida para cá; usa
// getRequestBearerToken/sendError de ./httpInfra.js.
//
// buildDefaultSegmentationConfig/sanitizeSegmentationConfig já vivem em ../segmentation.js
// (Onda 3 Run A) — importadas daqui.

import { supabase } from "./database.js";
import { normalizeString } from "../textNormalize.js";
import { normalizeHttpUrl } from "./tenant.js";
import { buildDefaultSegmentationConfig, sanitizeSegmentationConfig } from "../segmentation.js";
import { isMissingSchemaError } from "./analytics.js";
import {
  getDefaultLeadClientEvolutionInstance,
  mergeEvolutionInstanceIntoSettings,
  getLeadClientEvolutionInstancesMap,
  maskEvolutionInstance,
} from "./evolution.js";
import { isMaskedSecretPlaceholder, getRequestBearerToken, sendError } from "./httpInfra.js";

export function maskN8nSettings(row) {
  if (!row) {
    return {
      dispatch_webhook_url: null,
      has_dispatch_webhook_token: false,
      has_inbound_bearer_token: false,
      active: false,
      chatbot_enabled: false,
      chatbot_model: "outlier",
      chatbot_instances: [],
      chatbot_inbound_scope: "leads_only",
      sdr_whatsapp_numbers: [],
      segmentation_config: buildDefaultSegmentationConfig("outlier"),
      sdr_whatsapp_number: null,
      updated_at: null,
    };
  }

  return {
    client_id: row.client_id,
    dispatch_webhook_url: row.dispatch_webhook_url || null,
    has_dispatch_webhook_token: !!row.dispatch_webhook_token,
    has_inbound_bearer_token: !!row.inbound_bearer_token,
    active: row.active !== false,
    chatbot_enabled: row.chatbot_enabled === true,
    chatbot_model: row.chatbot_model || "outlier",
    // Chips que este chatbot atende. Vazio = qualquer chip sem agente inbound.
    chatbot_instances: Array.isArray(row.chatbot_instances) ? row.chatbot_instances : [],
    // Quem o chatbot atende. Default seguro: so lead conhecido. So o literal
    // "all" abre para qualquer inbound.
    chatbot_inbound_scope: row.chatbot_inbound_scope === "all" ? "all" : "leads_only",
    // Lista de destinos do briefing. Cai no numero antigo enquanto houver linha
    // nao migrada — durante o deploy as duas colunas convivem.
    sdr_whatsapp_numbers: Array.isArray(row.sdr_whatsapp_numbers) && row.sdr_whatsapp_numbers.length > 0
      ? row.sdr_whatsapp_numbers
      : (row.sdr_whatsapp_number ? [row.sdr_whatsapp_number] : []),
    segmentation_config: sanitizeSegmentationConfig(row.segmentation_config, row.chatbot_model || "outlier"),
    sdr_whatsapp_number: row.sdr_whatsapp_number || null,
    updated_at: row.updated_at || null,
    updated_by_email: row.updated_by_email || null,
    allowed_tabs: Array.isArray(row.allowed_tabs) ? row.allowed_tabs : null,
    // Preserva a lista de instâncias já mascarada por maskEvolutionInstance (server.js:1717).
    // Sem isso a whitelist cortava o campo e a UI mostrava "0 instâncias".
    evolution_instances: Array.isArray(row.evolution_instances) ? row.evolution_instances : [],
  };
}

export function getN8nOnboardingStatus(settings) {
  if (!settings || settings.active === false) return "pendente";
  if (!settings.dispatch_webhook_url) return "sem url evolution";
  if (!settings.inbound_bearer_token) return "sem token inbound legado";
  return "evolution + inbound legado";
}

export async function getLeadClientN8nSettingsStatus(clientId) {
  if (!supabase || !clientId) {
    return {
      settings: null,
      schemaAvailable: false,
      source: "database_unavailable",
    };
  }

  const { data, error } = await supabase
    .from("lead_client_n8n_settings")
    .select(
      "client_id, dispatch_webhook_url, dispatch_webhook_token, inbound_bearer_token, active, chatbot_enabled, chatbot_model, chatbot_llm_model, chatbot_instances, chatbot_inbound_scope, sdr_whatsapp_numbers, agent_name, segmentation_config, sdr_whatsapp_number, allowed_tabs, updated_at, updated_by_uid, updated_by_email"
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      // Silencioso ate 05/08/2026: uma coluna inexistente no SELECT (era
      // persona_template) derrubava a query inteira e esta funcao devolvia
      // settings: null. Como o upsert usa esse retorno como "existing", TODO
      // PATCH parcial passava a regravar os campos nao enviados com os
      // defaults — chatbot_model virava "outlier" e chatbot_enabled virava
      // false. O sintoma na tela era o template voltando sozinho e o chatbot
      // desligando ao trocar de template.
      console.error(
        `[n8n-settings] SELECT falhou por schema para "${clientId}" — as configuracoes serao lidas como inexistentes:`,
        error.message
      );
      return {
        settings: null,
        schemaAvailable: false,
        source: "schema_missing",
        error,
      };
    }
    throw error;
  }

  const defaultEvolutionInstance = await getDefaultLeadClientEvolutionInstance(clientId);

  return {
    settings: mergeEvolutionInstanceIntoSettings(data || null, defaultEvolutionInstance),
    schemaAvailable: true,
    source: defaultEvolutionInstance ? "evolution_instance_default" : data ? "client_settings" : "missing",
  };
}

export async function getLeadClientN8nSettings(clientId) {
  const { settings } = await getLeadClientN8nSettingsStatus(clientId);
  return settings;
}

export async function getLeadClientN8nSettingsMap(clientIds) {
  if (!supabase || clientIds.length === 0) return {};

  const { data, error } = await supabase
    .from("lead_client_n8n_settings")
    .select(
      // chatbot_instances FALTAVA aqui (existe no SELECT de getLeadClientN8nSettings).
      // Como maskN8nSettings faz `Array.isArray(row.chatbot_instances) ? ... : []`, a
      // coluna ausente virava [] e a tela do Agente IA relia "Todos sem agente inbound"
      // a cada visita — a marcacao de chip era gravada e depois lida como vazia.
      "client_id, dispatch_webhook_url, dispatch_webhook_token, inbound_bearer_token, active, chatbot_enabled, chatbot_model, chatbot_llm_model, chatbot_instances, chatbot_inbound_scope, sdr_whatsapp_numbers, segmentation_config, sdr_whatsapp_number, allowed_tabs, updated_at, updated_by_email"
    )
    .in("client_id", clientIds);

  if (error) {
    if (isMissingSchemaError(error)) return {};
    throw error;
  }

  const settingsMap = Object.fromEntries((data || []).map((row) => [row.client_id, row]));
  const evolutionInstancesMap = await getLeadClientEvolutionInstancesMap(clientIds);

  for (const clientId of clientIds) {
    const instances = evolutionInstancesMap[clientId] || [];
    const defaultInstance =
      instances.find((instance) => instance.active !== false && instance.is_default) ||
      instances.find((instance) => instance.active !== false) ||
      null;
    const mergedSettings = mergeEvolutionInstanceIntoSettings(settingsMap[clientId] || null, defaultInstance);

    if (mergedSettings || settingsMap[clientId] || instances.length) {
      settingsMap[clientId] = {
        ...(mergedSettings || settingsMap[clientId] || {}),
        evolution_instances: instances.map(maskEvolutionInstance),
      };
    }
  }

  return settingsMap;
}

export function buildN8nSettingsPayload(input, authAccess, existing = null) {
  const body = input && typeof input === "object" ? input : {};
  const dispatchWebhookUrlProvided = Object.prototype.hasOwnProperty.call(body, "dispatchWebhookUrl");
  const dispatchWebhookTokenProvided = Object.prototype.hasOwnProperty.call(body, "dispatchWebhookToken");
  const inboundBearerTokenProvided = Object.prototype.hasOwnProperty.call(body, "inboundBearerToken");
  const activeProvided = Object.prototype.hasOwnProperty.call(body, "active");
  const chatbotEnabledProvided = Object.prototype.hasOwnProperty.call(body, "chatbotEnabled");
  const chatbotModelProvided = Object.prototype.hasOwnProperty.call(body, "chatbotModel");
  const chatbotLlmModelProvided = Object.prototype.hasOwnProperty.call(body, "chatbotLlmModel") || Object.prototype.hasOwnProperty.call(body, "chatbot_llm_model");
  const agentNameProvided = Object.prototype.hasOwnProperty.call(body, "agentName") || Object.prototype.hasOwnProperty.call(body, "agent_name");
  const segmentationConfigProvided = Object.prototype.hasOwnProperty.call(body, "segmentationConfig");
  const chatbotInstancesProvided = Object.prototype.hasOwnProperty.call(body, "chatbotInstances");
  const sdrWhatsappNumberProvided = Object.prototype.hasOwnProperty.call(body, "sdrWhatsappNumber");
  const sdrWhatsappNumbersProvided = Object.prototype.hasOwnProperty.call(body, "sdrWhatsappNumbers");
  const allowedTabsProvided = Object.prototype.hasOwnProperty.call(body, "allowedTabs");

  const payload = {
    active: activeProvided ? body.active !== false : existing?.active ?? true,
    chatbot_enabled: chatbotEnabledProvided ? body.chatbotEnabled === true : existing?.chatbot_enabled ?? false,
    chatbot_model: chatbotModelProvided ? (body.chatbotModel || "outlier") : existing?.chatbot_model ?? "outlier",
    chatbot_llm_model: chatbotLlmModelProvided ? (body.chatbotLlmModel || body.chatbot_llm_model || "llama-3.3-70b-versatile") : existing?.chatbot_llm_model ?? "llama-3.3-70b-versatile",
    // Numero invalido nao entra na lista: o mesmo criterio do frontend, aqui
    // tambem, porque o backend nao pode confiar na tela.
    sdr_whatsapp_numbers: sdrWhatsappNumbersProvided
      ? [...new Set((Array.isArray(body.sdrWhatsappNumbers) ? body.sdrWhatsappNumbers : [])
          .map((v) => String(v ?? "").replace(/\D/g, ""))
          .filter((v) => /^[0-9]{10,15}$/.test(v)))]
      : existing?.sdr_whatsapp_numbers ?? [],
    chatbot_instances: chatbotInstancesProvided
      ? (Array.isArray(body.chatbotInstances)
          ? [...new Set(body.chatbotInstances.map((v) => String(v ?? "").trim()).filter(Boolean))]
          : [])
      : existing?.chatbot_instances ?? [],
    agent_name: agentNameProvided ? (normalizeString(body.agentName || body.agent_name) || null) : existing?.agent_name ?? null,
    segmentation_config: segmentationConfigProvided
      ? sanitizeSegmentationConfig(body.segmentationConfig, body.chatbotModel || existing?.chatbot_model || "generico")
      : sanitizeSegmentationConfig(existing?.segmentation_config, existing?.chatbot_model || body.chatbotModel || "generico"),
    sdr_whatsapp_number: sdrWhatsappNumberProvided ? (normalizeString(body.sdrWhatsappNumber) || null) : existing?.sdr_whatsapp_number ?? null,
    allowed_tabs: allowedTabsProvided
      ? (Array.isArray(body.allowedTabs) ? body.allowedTabs : null)
      : existing?.allowed_tabs ?? null,
    updated_at: new Date().toISOString(),
    updated_by_uid: authAccess?.uid || null,
    updated_by_email: authAccess?.email || null,
  };

  if (dispatchWebhookUrlProvided) {
    const url = normalizeHttpUrl(body.dispatchWebhookUrl);
    if (body.dispatchWebhookUrl !== null && normalizeString(body.dispatchWebhookUrl) && !url) {
      throw new Error("INVALID_DISPATCH_WEBHOOK_URL");
    }
    payload.dispatch_webhook_url = url;
  } else if (!existing) {
    payload.dispatch_webhook_url = null;
  }

  if (dispatchWebhookTokenProvided) {
    const token = normalizeString(body.dispatchWebhookToken);
    payload.dispatch_webhook_token =
      body.dispatchWebhookToken === null
        ? null
        : isMaskedSecretPlaceholder(token)
          ? existing?.dispatch_webhook_token || null
          : token || existing?.dispatch_webhook_token || null;
  } else if (!existing) {
    payload.dispatch_webhook_token = null;
  }

  if (inboundBearerTokenProvided) {
    const token = normalizeString(body.inboundBearerToken);
    payload.inbound_bearer_token =
      body.inboundBearerToken === null
        ? null
        : isMaskedSecretPlaceholder(token)
          ? existing?.inbound_bearer_token || null
          : token || existing?.inbound_bearer_token || null;
  } else if (!existing) {
    payload.inbound_bearer_token = null;
  }

  // Sem "existing", os campos nao enviados cairiam nos defaults e sobrescreveriam
  // o que ja estava gravado (foi assim que chatbot_model virou "outlier" e
  // chatbot_enabled virou false a cada PATCH parcial). Quando nao sabemos o
  // estado atual, o seguro e NAO tocar no que o cliente nao mandou: a coluna
  // omitida do upsert preserva o valor da linha existente.
  if (!existing) {
    const enviados = {
      active: activeProvided,
      chatbot_enabled: chatbotEnabledProvided,
      chatbot_model: chatbotModelProvided,
      chatbot_instances: chatbotInstancesProvided,
      chatbot_llm_model: chatbotLlmModelProvided,
      agent_name: agentNameProvided,
      segmentation_config: segmentationConfigProvided,
      sdr_whatsapp_number: sdrWhatsappNumberProvided,
      allowed_tabs: allowedTabsProvided,
    };
    for (const [coluna, foiEnviado] of Object.entries(enviados)) {
      if (!foiEnviado) delete payload[coluna];
    }
  }

  return payload;
}

export async function upsertLeadClientN8nSettings(clientId, input, authAccess, existing = null) {
  const payload = {
    client_id: clientId,
    ...buildN8nSettingsPayload(input, authAccess, existing),
  };

  const { data, error } = await supabase
    .from("lead_client_n8n_settings")
    .upsert(payload, { onConflict: "client_id" })
    .select(
      "client_id, dispatch_webhook_url, dispatch_webhook_token, inbound_bearer_token, active, chatbot_enabled, chatbot_model, chatbot_llm_model, segmentation_config, sdr_whatsapp_number, allowed_tabs, updated_at, updated_by_email"
    )
    .single();

  if (error) throw error;
  return data;
}

export async function validateN8nInboundBearer(req, res, clientId) {
  const settings = await getLeadClientN8nSettings(clientId);
  const token = getRequestBearerToken(req);

  if (!settings || settings.active === false || !settings.inbound_bearer_token) {
    sendError(res, 401, "UNAUTHORIZED", "n8n inbound token is not configured for this client");
    return null;
  }

  if (!token || token !== settings.inbound_bearer_token) {
    sendError(res, 401, "UNAUTHORIZED", "Unauthorized");
    return null;
  }

  return settings;
}
