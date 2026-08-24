// backend/src/domains/chatbot/routes.js
// Movimento puro (extraído de registerAllDomainRoutes.js): rotas de import de leads
// outlier (n8n), viewer de conversas WhatsApp (chats/messages), prompts customizados,
// chatbot-templates, chatbot hardcoded (Outlier Qualification) e seu webhook/teste/
// kanban/extração de briefing. Corpo dos handlers idêntico ao original — só muda de
// onde vêm as dependências (deps em vez de routeDeps destructure inline).
//
// appendLeadMessage e isGroupJid vêm de createLeadMessaging/shared/leadMessaging.js —
// mesmo mecanismo usado hoje em registerAllDomainRoutes.js (que continua com sua própria
// invocação da factory para as rotas de campaigns que ficam lá) — sem duplicar a função.

import { createLeadMessaging, isGroupJid } from "../shared/leadMessaging.js";
import { summarizeChatWithAI } from "../leads/chatInsight.js";
import { applyCorsHeaders } from "../../services/corsPolicy.js";
import { upsertLeadByPhone } from "../../services/leadUpsert.js";
import { OutlierQualificationBot } from "../../hardcoded-chatbot-outlier.js";
import { getChatMemory } from "../../hardcoded-chatbot.js";
import {
  bufferMessage,
  resolveMessageContent,
  processBatch,
  isFirstCampaignReply,
  extractBriefingWithAI,
  LLM_MODELS,
  getLlmProviderStatus,
} from "../../chatbot-ai-engine.js";
import {
  persistChatbotProgress,
  determineSPINPhase,
  qualifyLead,
  trackInvalidResponse,
} from "../../hardcoded-chatbot-persistence.js";
import { parseStoredHistorico } from "../../leads-outlier-schema.js";
import { resolveInboundAgentConfig, buildSpinInstruction, fireInboundCompletionWebhook } from "../../services/inboundAgent.js";
import {
  shouldIgnoreInboundEvent,
  resolveInboundEventName,
  isFromMe,
  resolveMessageId,
} from "../../services/inboundGuard.js";
import {
  resolveInboundScope,
  shouldEngageInbound,
  INBOUND_SCOPE_ALL,
} from "../../services/inboundEngagementPolicy.js";
import { resolveSdrTarget, resolveTenantSdrNumbers, normalizeSdrNumber } from "../../services/sdrTarget.js";
import { resolveCampaignAgent } from "../../services/campaignAgentRouting.js";

export function registerChatbotRoutes(app, deps) {
  const {
    ensureDb,
    getLeadClientEvolutionInstances,
    getLeadClientN8nSettings,
    internalErrorPayloadDetails,
    isMissingSchemaError,
    leadsTableName,
    maskPhoneForLog,
    MAX_LEADS_OUTLIER_BATCH,
    continueCampaignLeadFromReply,
    findCampaignReplyMatches,
    normalizeString,
    normalizeTenantKey,
    pgDatabasePool,
    requireAppViewAccess,
    requireFirebaseAuth,
    resolveAuthorizedClientId,
    resolveDispatchWebhookSettings,
    resolveInboundDispatchSettings,
    sanitizePhone,
    sendError,
    supabase,
    validateLeadsOutlierRecord,
    validateN8nInboundBearer,
  } = deps;

  const { appendLeadMessage } = createLeadMessaging({
    supabase,
    normalizeString,
    leadsTableName,
    isMissingSchemaError,
  });

  // Aceita um chip ou VÁRIOS separados por vírgula ("Chip A,Chip B") — o inbox
  // permite selecionar mais de um chip ao mesmo tempo. Devolve todos os aliases
  // (nome amigável, id e nome extraído da URL da Evolution) de cada um.
  async function resolveInstanceNameAliases(clientId, rawInstanceName) {
    if (!rawInstanceName || rawInstanceName === "all") return null;

    const requested = String(rawInstanceName)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (requested.length === 0) return null;

    let allInstances;
    try {
      allInstances = await getLeadClientEvolutionInstances(clientId);
    } catch (err) {
      console.error("[chatbot-aliases] falha de leitura no banco ao buscar instâncias Evolution para aliases", {
        clientId,
        rawInstanceName,
        error: err?.message || String(err),
      });
      // Degradação com log: como é rota de listagem/filtro visual de tela (inbox),
      // degrada utilizando os próprios nomes literais requisitados em vez de silenciar ou retornar vazio.
      return requested;
    }
    const aliases = new Set();

    for (const wanted of requested) {
      aliases.add(wanted);
      const matched = allInstances.find((inst) => {
        const urlName = inst.dispatch_webhook_url
          ? inst.dispatch_webhook_url.split("/").filter(Boolean).pop()
          : null;
        return inst.name === wanted || inst.id === wanted || urlName === wanted;
      });
      if (matched) {
        if (matched.name) aliases.add(matched.name);
        if (matched.id) aliases.add(matched.id);
        if (matched.dispatch_webhook_url) {
          const urlName = matched.dispatch_webhook_url.split("/").filter(Boolean).pop();
          if (urlName) aliases.add(urlName);
        }
      }
    }

    return Array.from(aliases);
  }

  /**
   * Esta conversa ja teve briefing enviado?
   *
   * Dedup por CONVERSA, sem TTL. A guarda de mensagem duplicada
   * (services/inboundGuard.js) expira em 10 min e nao segura um ciclo mais
   * lento — foi assim que qualificacoes ANTIGAS voltaram a ser reenviadas.
   *
   * Erro de leitura devolve TRUE: na duvida, NAO reenviar. Alerta repetido em
   * loop custa mais que alerta perdido, e o SDR ainda ve a conversa na tela.
   */
  async function briefingJaEnviado(clientId, phone) {
    if (!supabase || !clientId || !phone) return false;
    try {
      const { data, error } = await supabase
        .from(leadsTableName(clientId))
        .select("dados")
        .eq("client_id", clientId)
        .eq("telefone", phone)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        console.warn("[chatbot-webhook] falha ao checar briefing ja enviado:", error.message);
        return true;
      }
      return Boolean(data?.[0]?.dados?.briefing_enviado_em);
    } catch (err) {
      console.warn("[chatbot-webhook] falha ao checar briefing ja enviado:", err?.message || err);
      return true;
    }
  }

  /** Marca a conversa como notificada, para o proximo evento nao reenviar. */
  async function marcarBriefingEnviado(clientId, phone) {
    if (!supabase || !clientId || !phone) return;
    try {
      const { data } = await supabase
        .from(leadsTableName(clientId))
        .select("id, dados")
        .eq("client_id", clientId)
        .eq("telefone", phone)
        .order("created_at", { ascending: false })
        .limit(1);
      const lead = data?.[0];
      if (!lead?.id) return;
      await supabase
        .from(leadsTableName(clientId))
        .update({ dados: { ...(lead.dados || {}), briefing_enviado_em: new Date().toISOString() } })
        .eq("id", lead.id)
        .eq("client_id", clientId);
    } catch (err) {
      console.warn("[chatbot-webhook] falha ao marcar briefing enviado:", err?.message || err);
    }
  }

  /**
   * Manda a mesma mensagem para TODOS os numeros de SDR do tenant.
   *
   * Um numero que falha nao pode levar os outros junto: cada envio tem o proprio
   * try/catch e a falha e logada com o numero MASCARADO. Antes era um numero so
   * e um await solto — bastava a Evolution recusar para ninguem ser avisado.
   */
  async function enviarParaSdrs({ numeros, texto, evolutionUrl, evolutionHeaders, contexto = {} }) {
    const falhas = [];
    let enviados = 0;

    for (const numero of numeros) {
      try {
        const resposta = await fetch(evolutionUrl, {
          method: "POST",
          headers: evolutionHeaders,
          body: JSON.stringify({ number: numero, text: texto, message: texto }),
        });
        if (!resposta.ok) {
          const corpo = await resposta.text().catch(() => "");
          throw new Error(`HTTP ${resposta.status} ${corpo.slice(0, 120)}`);
        }
        enviados += 1;
      } catch (err) {
        falhas.push({ numero: maskPhoneForLog(numero), erro: err?.message || String(err) });
        console.error("[chatbot-webhook] falha ao notificar SDR", {
          ...contexto,
          sdr: maskPhoneForLog(numero),
          erro: err?.message || String(err),
        });
      }
    }

    return { enviados, falhas };
  }

  /**
   * Ja existe registro de lead com este telefone neste tenant?
   *
   * Em caso de erro devolve TRUE de proposito: falha de leitura nao pode
   * silenciar lead legitimo. Errar para o lado permissivo custa uma resposta
   * indevida; para o lado restritivo custa perder cliente que respondeu.
   */
  async function telefoneEhLeadConhecido(clientId, phone) {
    if (!supabase || !clientId || !phone) return false;
    try {
      const { data, error } = await supabase
        .from(leadsTableName(clientId))
        .select("id")
        .eq("client_id", clientId)
        .eq("telefone", phone)
        .limit(1);

      if (error) {
        console.warn("[chatbot-webhook] falha ao checar lead conhecido:", error.message);
        return true;
      }
      return Array.isArray(data) && data.length > 0;
    } catch (err) {
      console.warn("[chatbot-webhook] falha ao checar lead conhecido:", err?.message || err);
      return true;
    }
  }

  // n8n / automação: insere leads no formato do chat outlier em `leads_outlier` (Bearer inbound por tenant).
  // O payload espelha colunas de `leads` (exceto tipo_cliente, faixa_consumo, cidade, estado) mais campos do chat.
  // Obrigatório: telefone, mensagem, finalizado, status_conversa. Temperatura: JSON `status` ou `lead_temperature` → BD `lead_temperature`; texto do pipeline CRM → `pipeline_status` → coluna `status`.
  app.post("/api/import-leads-outlier", async (req, res) => {
    if (!ensureDb(res)) return;

    try {
      const body = req.body || {};
      const rawList =
        body.leads ??
        body.records ??
        (body.lead != null ? [body.lead] : null) ??
        (body.record != null ? [body.record] : null);
      const items = Array.isArray(rawList) ? rawList : rawList != null ? [rawList] : [];

      if (items.length === 0) {
        sendError(res, 400, "INVALID_BODY", "Missing leads, records, lead, or record in body");
        return;
      }

      if (items.length > MAX_LEADS_OUTLIER_BATCH) {
        sendError(
          res,
          413,
          "PAYLOAD_TOO_LARGE",
          `Maximum ${MAX_LEADS_OUTLIER_BATCH} records per request`
        );
        return;
      }

      const clientId = normalizeTenantKey(body.client_id ?? body.clientId);
      if (!clientId) {
        sendError(res, 400, "INVALID_BODY", "Missing client_id");
        return;
      }

      if (!(await validateN8nInboundBearer(req, res, clientId))) {
        return;
      }

      const rows = [];
      for (let i = 0; i < items.length; i++) {
        const parsed = validateLeadsOutlierRecord(items[i], `items[${i}]`);
        if (parsed.error) {
          sendError(res, 400, "INVALID_BODY", parsed.error);
          return;
        }
        rows.push({ client_id: clientId, ...parsed.row });
      }

      const { data, error } = await supabase.from(leadsTableName(clientId)).insert(rows).select("id");

      if (error) {
        console.error("leads import insert error:", error);
        sendError(res, 500, "LEADS_OUTLIER_SAVE_FAILED", "Failed to save records", error.message);
        return;
      }

      res.status(201).json({
        success: true,
        count: rows.length,
        ids: data?.map((r) => r.id) || [],
      });
    } catch (error) {
      console.error("import-leads-outlier error:", error);
      sendError(res, 500, "INTERNAL_ERROR", "Internal server error", internalErrorPayloadDetails(error));
    }
  });
  // Entrada n8n: insert em `leads_outlier` (mesmo Bearer que outros imports; validação em validateLeadsOutlierRecord — ver import-leads-outlier).
  app.post("/api/import-lead-outlier-n8n", async (req, res) => {
    if (!ensureDb(res)) return;

    try {
      const body = req.body || {};
      const leadsRaw = body.leads ?? (body.lead ? [body.lead] : []);
      const leads = Array.isArray(leadsRaw) ? leadsRaw : [leadsRaw];

      if (leads.length === 0) {
        sendError(res, 400, "INVALID_BODY", "Missing lead or leads array in body");
        return;
      }

      if (leads.length > MAX_LEADS_OUTLIER_BATCH) {
        sendError(
          res,
          413,
          "PAYLOAD_TOO_LARGE",
          `Maximum ${MAX_LEADS_OUTLIER_BATCH} records per request`
        );
        return;
      }

      const clientId = normalizeTenantKey(body.client_id ?? body.clientId);
      if (!clientId) {
        sendError(res, 400, "INVALID_BODY", "Missing client_id");
        return;
      }

      if (!(await validateN8nInboundBearer(req, res, clientId))) {
        return;
      }

      const rows = [];
      for (let i = 0; i < leads.length; i++) {
        const parsed = validateLeadsOutlierRecord(leads[i], `leads[${i}]`);
        if (parsed.error) {
          sendError(res, 400, "INVALID_BODY", parsed.error);
          return;
        }
        rows.push({ client_id: clientId, ...parsed.row });
      }

      const { data, error } = await supabase.from(leadsTableName(clientId)).insert(rows).select("id");

      if (error) {
        console.error("leads import n8n insert error:", error);
        sendError(res, 500, "LEADS_OUTLIER_SAVE_FAILED", "Failed to save records", error.message);
        return;
      }

      res.json({ success: true, count: rows.length, ids: data?.map((item) => item.id) || [] });
    } catch (error) {
      console.error("import-lead-outlier-n8n error:", error);
      sendError(res, 500, "INTERNAL_ERROR", "Internal server error", internalErrorPayloadDetails(error));
    }
  });
  app.get("/api/whatsapp/chats", requireFirebaseAuth, requireAppViewAccess("whatsapp"), async (_req, res) => {
    if (!ensureDb(res)) return;
    try { await pgDatabasePool.query("ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS instance_name VARCHAR(150);").catch(() => {}); } catch(e) {}
    // contact_name/is_group: nome exibido e flag de grupo vivem na mensagem para o
    // inbox nao depender da tabela de leads (mostrar nome nao pode criar lead).
    try { await pgDatabasePool.query("ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS contact_name TEXT;").catch(() => {}); } catch(e) {}
    try { await pgDatabasePool.query("ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;").catch(() => {}); } catch(e) {}

    try {
      const search = normalizeString(_req.query.search)?.toLowerCase() || "";
      const rawLimit = Number.parseInt(String(_req.query.limit || "100"), 10);
      const rawOffset = Number.parseInt(String(_req.query.offset || "0"), 10);
      const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 200);
      const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

      const requestedClientId = normalizeString(_req.query.clientId);
      const clientId = resolveAuthorizedClientId(_req, res, requestedClientId);
      if (!clientId) return;

      const rawInstanceName = normalizeString(_req.query.instanceName) || null;
      const instanceAliases = await resolveInstanceNameAliases(clientId, rawInstanceName);
      const leadsTable = leadsTableName(clientId);

      const queryParams = [clientId];
      let searchFilter = "";
      if (search) {
        queryParams.push(`%${search}%`);
        searchFilter = `AND (LOWER(l.nome) LIKE $2 OR m.phone LIKE $2 OR LOWER(m.message_text) LIKE $2)`;
      }

      let instanceFilter = "";
      if (instanceAliases && instanceAliases.length > 0) {
        queryParams.push(instanceAliases);
        const idx = queryParams.length;
        instanceFilter = `AND instance_name = ANY($${idx})`;
      }

      let total = 0;
      let items = [];

      try {
        const countQueryText = `
          WITH latest_messages AS (
            SELECT DISTINCT ON (phone)
              phone
            FROM public.lead_messages
            WHERE client_id = $1 ${instanceFilter}
            ORDER BY phone, delivered_at DESC
          )
          SELECT COUNT(*)::integer as total
          FROM latest_messages m
          LEFT JOIN public."${leadsTable}" l ON l.telefone = m.phone AND l.client_id = $1
          WHERE 1=1
          ${searchFilter}
        `;

        const countRes = await pgDatabasePool.query(countQueryText, queryParams);
        total = countRes.rows[0]?.total || 0;

        const queryParamsWithPaging = [...queryParams, limit, offset];
        const queryText = `
          WITH latest_messages AS (
            SELECT DISTINCT ON (phone)
              phone,
              message_text,
              direction,
              delivered_at,
              campaign_id,
              contact_name,
              is_group
            FROM public.lead_messages
            WHERE client_id = $1 ${instanceFilter}
            ORDER BY phone, delivered_at DESC
          )
          SELECT
            m.phone as phone_number,
            m.message_text,
            m.direction,
            m.delivered_at,
            m.campaign_id,
            m.contact_name,
            m.is_group,
            lm.profile_pic,
            lm.contact_name as profile_name,
            l.nome as lead_name,
            l.lead_origin,
            l.source_campaign_id
          FROM latest_messages m
          LEFT JOIN public."${leadsTable}" l ON l.telefone = m.phone AND l.client_id = $1
          LEFT JOIN public.whatsapp_lid_map lm ON lm.lid = m.phone
          WHERE 1=1
          ${searchFilter}
          ORDER BY m.delivered_at DESC
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const result = await pgDatabasePool.query(queryText, queryParamsWithPaging);
        items = result.rows.map((row) => {
          const timestampVal = row.delivered_at ? Math.floor(new Date(row.delivered_at).getTime() / 1000) : null;
          return {
            id: row.phone_number,
            // contact_name (pushName do WhatsApp) tem prioridade: existe para
            // grupos e para contatos que nao viraram lead no Banco de Dados.
            name: row.contact_name || row.profile_name || row.lead_name || row.phone_number,
            profilePic: row.profile_pic || null,
            isGroup: row.is_group === true,
            unreadCount: 0,
            timestamp: timestampVal,
            archived: false,
            pinned: false,
            muted: false,
            lastMessage: {
              id: null,
              body: row.message_text || "",
              fromMe: row.direction === "outbound",
              timestamp: timestampVal,
              type: "chat",
            },
            leadOrigin: row.lead_origin || null,
            sourceCampaignId: row.source_campaign_id || null,
          };
        });
      } catch (pgErr) {
        console.warn("[whatsapp/chats] Postgres query warning/fallback:", pgErr?.message);
      }


      res.json({
        items,
        total: total || items.length,
        nextOffset: offset + items.length,
        hasMore: offset + items.length < (total || items.length),
      });
    } catch (error) {
      console.warn("whatsapp chats endpoint warning:", error?.message || error);
      res.json({ items: [], total: 0, nextOffset: 0, hasMore: false });
    }
  });
  app.post("/api/whatsapp/chats/read", requireFirebaseAuth, requireAppViewAccess("whatsapp"), async (req, res) => {
    const chatId = normalizeString(req.body?.chatId);
    if (!chatId) {
      sendError(res, 400, "INVALID_BODY", "Missing chatId");
      return;
    }
    res.json({ success: true, chatId });
  });

  app.post("/api/whatsapp/chats/:chatId/summarize", requireFirebaseAuth, async (req, res) => {
    try {
      const { chatId } = req.params;
      const { messages, contactName, clientId: requestedClientId } = req.body || {};
      const clientId = resolveAuthorizedClientId(req, res, requestedClientId) || requestedClientId;

      let messageTexts = Array.isArray(messages)
        ? messages.map((m) => (typeof m === "string" ? m : m?.body || "")).filter(Boolean)
        : [];

      const cleanPhone = String(chatId).replace(/\D/g, "");

      // Se o payload não tiver mensagens ou tiver poucas, busca as mensagens reais do banco
      if (messageTexts.length < 2 && cleanPhone && clientId && pgDatabasePool) {
        const phoneVariants = [cleanPhone, `+${cleanPhone}`, `${cleanPhone}@s.whatsapp.net`];
        const dbMsgs = await pgDatabasePool
          .query(
            `SELECT direction, message_text, sender_type, delivered_at
             FROM public.lead_messages
             WHERE client_id = $1 AND (phone = ANY($2) OR remote_jid = ANY($2))
             ORDER BY delivered_at ASC
             LIMIT 50`,
            [clientId, phoneVariants]
          )
          .catch(() => ({ rows: [] }));

        if (Array.isArray(dbMsgs?.rows) && dbMsgs.rows.length > 0) {
          const dbTexts = dbMsgs.rows
            .map((r) => {
              const who = r.direction === "outbound" ? "Empresa/Consultor" : (contactName || "Lead");
              const txt = (r.message_text || "").trim();
              return txt ? `${who}: ${txt}` : null;
            })
            .filter(Boolean);
          if (dbTexts.length > messageTexts.length) {
            messageTexts = dbTexts;
          }
        }
      }

      console.log(`[summarize-chat] Resumindo chat ${chatId} (${messageTexts.length} msgs) para client ${clientId}`);
      const insight = await summarizeChatWithAI(messageTexts, contactName || "Contato", {
        clientId,
        supabase,
        pool: pgDatabasePool,
      });

      if (!insight?.summary) {
        const errorReason = insight?.error || "A IA não retornou um resumo válido para o histórico fornecido.";
        console.warn(`[summarize-chat] Falha na IA para o chat ${chatId} (client: ${clientId}): ${errorReason}`);
        // CORS aqui e responsabilidade do middleware cors(), que roda antes de
        // toda rota (server.js:427), com reforco em sendError/applyCorsHeaders.
        // Copia local numa rota so nao escala e refletia origem nao validada.
        applyCorsHeaders(res, req.headers?.origin);
        return res.status(502).json({
          success: false,
          error: "Não foi possível gerar o resumo com IA no momento. Tente novamente.",
          reason: errorReason,
        });
      }

      const summaryText = insight.summary;

      // Atualiza no banco de dados SOMENTE quando o resumo REAL da IA foi gerado com sucesso
      if (cleanPhone && clientId && pgDatabasePool) {
        const last8 = cleanPhone.slice(-8);
        const updRes = await pgDatabasePool
          .query(
            `UPDATE public.leads 
             SET dados = jsonb_set(COALESCE(dados, '{}'::jsonb), '{resumo_chat}', to_jsonb($1::text)),
                 raw_chat_summary = $1,
                 updated_at = NOW()
             WHERE client_id = $2 AND (
               telefone = $3 OR phone = $3 OR 
               telefone = $4 OR phone = $4 OR
               telefone LIKE $5 OR phone LIKE $5
             )`,
            [summaryText, clientId, cleanPhone, `+${cleanPhone}`, `%${last8}`]
          )
          .catch((e) => {
            console.warn("[summarize-chat] DB update warning:", e.message);
            return null;
          });

        if (!updRes || updRes.rowCount === 0) {
          await upsertLeadByPhone(pgDatabasePool, clientId, cleanPhone, {
            nome: contactName && contactName !== "não informado" ? contactName : null,
            phone: cleanPhone,
            raw_chat_summary: summaryText,
            extracted_from_wa: true,
          }).catch((e) => console.warn("[summarize-chat] DB upsert warning:", e.message));
        }
      }

      res.json({
        success: true,
        summary: summaryText,
        priority: insight?.prioridade || "media",
        suggestedChannel: insight?.canalSugerido || "followup",
      });
    } catch (error) {
      console.error("[summarize-chat] Erro ao resumir conversa:", error);
      res.status(500).json({ error: "Falha ao gerar resumo com IA.", reason: error?.message });
    }
  });

  app.delete("/api/whatsapp/chats/clear", requireFirebaseAuth, requireAppViewAccess("whatsapp"), async (req, res) => {
    if (!ensureDb(res)) return;
    try { await pgDatabasePool.query("ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS instance_name VARCHAR(150);").catch(() => {}); } catch(e) {}
    // contact_name/is_group: nome exibido e flag de grupo vivem na mensagem para o
    // inbox nao depender da tabela de leads (mostrar nome nao pode criar lead).
    try { await pgDatabasePool.query("ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS contact_name TEXT;").catch(() => {}); } catch(e) {}
    try { await pgDatabasePool.query("ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;").catch(() => {}); } catch(e) {}

    try {
      const requestedClientId = normalizeString(req.query.clientId || req.body.clientId);
      const clientId = resolveAuthorizedClientId(req, res, requestedClientId);
      if (!clientId) return;

      const rawInstanceName = normalizeString(req.query.instanceName || req.body.instanceName) || null;
      const instanceAliases = await resolveInstanceNameAliases(clientId, rawInstanceName);

      let queryText = `DELETE FROM public.lead_messages WHERE client_id = $1`;
      let queryParams = [clientId];

      if (instanceAliases && instanceAliases.length > 0) {
        queryText += ` AND instance_name = ANY($2)`;
        queryParams.push(instanceAliases);
      }

      const result = await pgDatabasePool.query(queryText, queryParams);
      res.json({ success: true, deletedCount: result.rowCount });
    } catch (error) {
      console.error("[whatsapp/chats] clear error:", error);
      sendError(res, 500, "CLEAR_FAILED", "Failed to clear chats");
    }
  });
  app.get("/api/whatsapp/messages", requireFirebaseAuth, requireAppViewAccess("whatsapp"), async (req, res) => {
    if (!ensureDb(res)) return;

    try {
      const chatId = normalizeString(req.query.chatId);
      const rawLimit = Number.parseInt(String(req.query.limit || "50"), 10);
      const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 200);

      const requestedClientId = normalizeString(req.query.clientId);
      const clientId = resolveAuthorizedClientId(req, res, requestedClientId);
      if (!clientId) return;

      const rawInstanceName = normalizeString(req.query.instanceName) || null;
      const instanceAliases = await resolveInstanceNameAliases(clientId, rawInstanceName);

      if (!chatId) {
        sendError(res, 400, "INVALID_QUERY", "Missing chatId");
        return;
      }

      // Conversas de grupo/LID são gravadas com o jid inteiro em phone
      // (ex.: "120363...@g.us"). sanitizePhone removeria o sufixo e a busca não
      // casaria — era por isso que clicar num grupo mostrava "Sem mensagens
      // carregadas". Aceita as duas formas: o chatId como veio e só os dígitos.
      const isJidChat = chatId.includes("@");
      const cleanPhone = isJidChat ? chatId : sanitizePhone(chatId);
      const phoneVariants = Array.from(
        new Set([chatId, cleanPhone, sanitizePhone(chatId)].filter(Boolean))
      );
      const queryParams = [clientId, phoneVariants, limit];

      let instanceFilter = "";
      if (instanceAliases && instanceAliases.length > 0) {
        queryParams.push(instanceAliases);
        const idx = queryParams.length;
        instanceFilter = `AND instance_name = ANY($${idx})`;
      }

      const queryText = `
        SELECT
          id,
          message_text,
          direction,
          delivered_at,
          sender_type
        FROM public.lead_messages
        WHERE client_id = $1 AND phone = ANY($2) ${instanceFilter}
        ORDER BY delivered_at DESC
        LIMIT $3
      `;
      const result = await pgDatabasePool.query(queryText, queryParams);

      let items = result.rows.map((row) => {
        const timestampVal = row.delivered_at ? Math.floor(new Date(row.delivered_at).getTime() / 1000) : null;
        return {
          id: String(row.id),
          body: row.message_text || "",
          from: row.direction === "inbound" ? cleanPhone : "me",
          to: row.direction === "outbound" ? cleanPhone : "me",
          author: null,
          fromMe: row.direction === "outbound",
          timestamp: timestampVal,
          type: "chat",
          hasMedia: false,
        };
      });


      res.json({ items: items.reverse() });
    } catch (error) {
      console.error("whatsapp database messages query error:", error);
      sendError(res, 500, "WHATSAPP_MESSAGES_FAILED", error instanceof Error ? error.message : "Failed to fetch messages from database");
    }
  });
  app.post("/api/whatsapp/messages", requireFirebaseAuth, requireAppViewAccess("whatsapp"), async (req, res) => {
    if (!ensureDb(res)) return;

    try {
      const chatId = normalizeString(req.body?.chatId);
      const body = normalizeString(req.body?.body);
      const requestedClientId = normalizeString(req.body?.clientId);

      const clientId = resolveAuthorizedClientId(req, res, requestedClientId);
      if (!clientId) return;

      if (!chatId || !body) {
        sendError(res, 400, "INVALID_BODY", "Missing chatId or body");
        return;
      }

      const cleanPhone = sanitizePhone(chatId);

      // Locate active/default Evolution instance for this client
      const instances = await getLeadClientEvolutionInstances(clientId);
      const activeInstance = instances.find(inst => inst.active && inst.is_default) || instances.find(inst => inst.active);

      if (!activeInstance) {
        sendError(res, 400, "NO_ACTIVE_WHATSAPP_CHIP", "Nao ha nenhum chip WhatsApp ativo configurado para esta empresa.");
        return;
      }

      const webhookUrl = activeInstance.dispatch_webhook_url;
      const webhookToken = activeInstance.dispatch_webhook_token;

      // Construct and send message payload to Evolution API
      const payload = {
        source: "vexocrm",
        provider: "evolution",
        type: "text",
        stepType: "text",
        number: cleanPhone,
        text: body,
        message: body,
      };

      const headers = { "Content-Type": "application/json" };
      if (webhookToken) {
        headers.apikey = webhookToken;
        headers.Authorization = `Bearer ${webhookToken}`;
      }

      console.info("[manual-chat] dispatching manual response to Evolution API", {
        phone: cleanPhone,
        webhookUrl,
      });

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(responseText || `HTTP ${response.status}`);
      }

      // Log sent message in the database
      // instanceName must be the Evolution API name (last URL path segment) to match
      // what the sync and webhook store in lead_messages.instance_name.
      const evoInstanceName = webhookUrl
        ? new URL(webhookUrl).pathname.split("/").filter(Boolean).pop() || activeInstance.name
        : activeInstance.name;

      await appendLeadMessage({
        clientId,
        phone: cleanPhone,
        senderType: "agent",
        direction: "outbound",
        messageText: body,
        deliveredAt: new Date().toISOString(),
        instanceName: evoInstanceName,
        meta: {
          source: "manual-inbox-reply",
          instanceId: activeInstance.id,
        },
      });

      const timestampVal = Math.floor(Date.now() / 1000);
      res.status(201).json({
        item: {
          id: `msg-${Date.now()}`,
          body,
          from: "me",
          to: cleanPhone,
          author: null,
          fromMe: true,
          timestamp: timestampVal,
          type: "chat",
          hasMedia: false,
        }
      });
    } catch (error) {
      console.error("whatsapp database send message error:", error);
      sendError(res, 500, "WHATSAPP_SEND_FAILED", error instanceof Error ? error.message : "Failed to send message via Evolution API");
    }
  });
  // GET /api/prompts — lê prompt customizado de uma empresa por tipo
  app.get("/api/prompts", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;
    const clientId = normalizeTenantKey(req.query?.clientId);
    const type = normalizeString(req.query?.type);
    if (!clientId) return sendError(res, 400, "INVALID_QUERY", "Missing clientId");
    if (!type || !["padrao", "extrato", "resumo"].includes(type)) {
      return sendError(res, 400, "INVALID_QUERY", "type must be padrao, extrato or resumo");
    }
    try {
      const { data, error } = await supabase
        .from("chatbot_prompts")
        .select("client_id, type, content, updated_at, updated_by_email")
        .eq("client_id", clientId)
        .eq("type", type)
        .maybeSingle();
      if (error) {
        if (isMissingSchemaError(error)) return sendError(res, 404, "NOT_FOUND", "Prompt not found");
        throw error;
      }
      if (!data) return res.json({ success: true, item: null });
      return res.json({
        success: true,
        item: {
          clientId: data.client_id,
          type: data.type,
          content: data.content,
          updatedAt: data.updated_at,
          updatedByEmail: data.updated_by_email,
        },
      });
    } catch (err) {
      sendError(res, 500, "PROMPT_FETCH_FAILED", err instanceof Error ? err.message : "Failed to fetch prompt");
    }
  });

  // PUT /api/prompts — salva/atualiza prompt customizado de uma empresa
  app.put("/api/prompts", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const clientId = normalizeTenantKey(body.clientId);
    const type = normalizeString(body.type);
    const content = typeof body.content === "string" ? body.content.trim() : null;
    if (!clientId) return sendError(res, 400, "INVALID_BODY", "Missing clientId");
    if (!type || !["padrao", "extrato", "resumo"].includes(type)) {
      return sendError(res, 400, "INVALID_BODY", "type must be padrao, extrato or resumo");
    }
    if (!content) return sendError(res, 400, "INVALID_BODY", "Missing content");
    try {
      const userEmail = normalizeString(req.authAccess?.email || req.authUser?.email) || null;
      const { data, error } = await supabase
        .from("chatbot_prompts")
        .upsert(
          { client_id: clientId, type, content, updated_at: new Date().toISOString(), updated_by_email: userEmail },
          { onConflict: "client_id,type" }
        )
        .select("client_id, type, content, updated_at, updated_by_email")
        .maybeSingle();
      if (error) throw error;
      return res.json({
        success: true,
        item: {
          clientId: data.client_id,
          type: data.type,
          content: data.content,
          updatedAt: data.updated_at,
          updatedByEmail: data.updated_by_email,
        },
      });
    } catch (err) {
      sendError(res, 500, "PROMPT_SAVE_FAILED", err instanceof Error ? err.message : "Failed to save prompt");
    }
  });
  // GET /api/chatbot-templates/builtins — templates built-in visíveis ao tenant.
  //
  // Antes filtrava client_id IS NULL e, quando nada voltava, devolvia uma lista
  // ESCRITA NO CÓDIGO com Áureo (Outlier) e Lara (Infinie). Como nenhum template
  // tem client_id nulo — outlier pertence a "outlier", infinie a "infinie" — a
  // consulta voltava vazia sempre e essas duas personas apareciam para todos os
  // tenants, mesmo depois de aqueles clientes saírem da carteira. Nada de
  // fallback fabricado: se não há built-in visível, a lista volta vazia.
  app.get("/api/chatbot-templates/builtins", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;
    const clientId = normalizeTenantKey(req.query?.clientId);
    try {
      let query = supabase
        .from("chatbot_templates")
        .select("template_key, display_name, agent_name, client_id")
        .eq("is_builtin", true);

      // Built-in global (sem dono) ou built-in do próprio tenant.
      query = clientId
        ? query.or(`client_id.is.null,client_id.eq.${clientId}`)
        : query.is("client_id", null);

      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return res.json({ templates: data || [] });
    } catch (err) {
      console.error("[chatbot-templates] falha ao listar built-ins:", err?.message || err);
      return sendError(res, 500, "BUILTINS_FETCH_FAILED", err?.message || "Falha ao listar templates");
    }
  });

  // GET /api/chatbot-llm-models — lista modelos de LLM registrados e status dos provedores (API keys no servidor)
  app.get("/api/chatbot-llm-models", requireFirebaseAuth, async (req, res) => {
    return res.json({
      models: LLM_MODELS,
      providerStatus: getLlmProviderStatus(),
    });
  });

  // GET /api/chatbot-templates — lista templates (built-ins globais + do cliente)
  app.get("/api/chatbot-templates", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;
    const clientId = normalizeTenantKey(req.query?.clientId);
    if (!clientId) return sendError(res, 400, "MISSING_CLIENT_ID", "clientId is required");
    try {
      const { data, error } = await supabase
        .from("chatbot_templates")
        .select("*")
        .or(`client_id.is.null,client_id.eq.${clientId}`)
        .order("is_builtin", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return res.json({ templates: data || [] });
    } catch (err) {
      sendError(res, 500, "TEMPLATES_FETCH_FAILED", err instanceof Error ? err.message : "Failed to fetch templates");
    }
  });

  // PUT /api/chatbot-templates — cria ou atualiza template de cliente
  app.put("/api/chatbot-templates", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const clientId = normalizeTenantKey(body.clientId ?? body.client_id);
    const templateKey = normalizeString(body.templateKey ?? body.template_key);
    const displayName = normalizeString(body.displayName ?? body.display_name);
    const agentName = normalizeString(body.agentName ?? body.agent_name) ?? "";
    const agentRole = normalizeString(body.agentRole ?? body.agent_role) ?? "";
    const dataFields = Array.isArray(body.dataFields ?? body.data_fields) ? (body.dataFields ?? body.data_fields) : [];
    const requiredFields = Array.isArray(body.requiredFields ?? body.required_fields) ? (body.requiredFields ?? body.required_fields) : [];
    const classification = body.classification && typeof body.classification === "object" ? body.classification : { quente: "", morno: "", frio: "" };

    if (!clientId || !templateKey || !displayName) {
      return sendError(res, 400, "INVALID_BODY", "clientId, templateKey and displayName are required");
    }
    try {
      const { data, error } = await supabase
        .from("chatbot_templates")
        .upsert(
          {
            template_key: templateKey,
            client_id: clientId,
            display_name: displayName,
            agent_name: agentName,
            agent_role: agentRole,
            data_fields: dataFields,
            required_fields: requiredFields,
            classification,
            is_builtin: false,
            updated_at: new Date().toISOString(),
            updated_by_email: req.authAccess?.email ?? null,
          },
          { onConflict: "template_key,client_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return res.json({ template: data });
    } catch (err) {
      sendError(res, 500, "TEMPLATE_SAVE_FAILED", err?.message || JSON.stringify(err) || "Failed to save template");
    }
  });

  // DELETE /api/chatbot-templates/:id — remove template (não permite deletar built-ins)
  app.delete("/api/chatbot-templates/:id", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;
    const id = normalizeString(req.params?.id);
    if (!id) return sendError(res, 400, "INVALID_PARAM", "Missing id");
    try {
      const { data: tmpl, error: fetchErr } = await supabase
        .from("chatbot_templates")
        .select("id, is_builtin")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!tmpl) return sendError(res, 404, "NOT_FOUND", "Template not found");
      if (tmpl.is_builtin) return sendError(res, 403, "FORBIDDEN", "Cannot delete built-in templates");
      const { error } = await supabase.from("chatbot_templates").delete().eq("id", id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (err) {
      sendError(res, 500, "TEMPLATE_DELETE_FAILED", err instanceof Error ? err.message : "Failed to delete template");
    }
  });
  /**
   * POST /api/hardcoded-chat
   * Processa mensagens para o chatbot hardcoded (ex: Outlier Qualification)
   * Body: { clientId, phone, message }
   */
  app.post("/api/hardcoded-chat", async (req, res) => {
    if (!ensureDb(res)) return;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const clientId = normalizeTenantKey(body.clientId ?? body.client_id);
    const phone = sanitizePhone(body.phone ?? body.telefone ?? body.number);
    const userMessage = normalizeString(body.message ?? body.text) || null;

    console.log("[hardcoded-chat] Request:", { clientId, phone: maskPhoneForLog(phone), hasMessage: !!userMessage });

    if (!clientId || !phone) {
      sendError(res, 400, "INVALID_BODY", "Missing clientId or phone");
      return;
    }

    try {
      console.log("[hardcoded-chat] Initializing chatbot");
      // Instanciar chatbot (atualmente suporta apenas Outlier)
      const chatbot = new OutlierQualificationBot(clientId);

      // Processar mensagem
      let response;
      if (!userMessage) {
        // Iniciar conversa
        console.log("[hardcoded-chat] Initializing conversation");
        response = await chatbot.initializeChat(phone);
      } else {
        // Processar resposta
        console.log("[hardcoded-chat] Processing response");
        response = await chatbot.processResponse(phone, userMessage);
      }

      if (userMessage) {
        await appendLeadMessage({
          clientId,
          phone,
          senderType: "lead",
          direction: "inbound",
          messageText: userMessage,
          meta: { source: "hardcoded-chat-api" },
        });
      }

      console.log("[hardcoded-chat] Response status:", response.status);

      // Se houver erro na resposta, rastrear tentativa inválida
      if (response.status === "invalid_response" && userMessage) {
        await trackInvalidResponse({
          supabase,
          clientId,
          phone,
          stepId: response.retryStepId,
          response: userMessage,
          errorMessage: response.message,
        });
      }

      // Salvar progresso incrementalmente se conversa está ativa
      if (response.status !== "failed") {
        console.log("[hardcoded-chat] Getting chat memory");
        const memory = await getChatMemory(phone, clientId);
        console.log("[hardcoded-chat] Memory found:", !!memory);

        if (memory) {
          const spinPhase = determineSPINPhase(memory.currentStepId);
          const qualification = qualifyLead(memory.collectedData);
          const metrics = chatbot.generateMetrics(memory);

          console.log("[hardcoded-chat] Persisting progress");
          const persistResult = await persistChatbotProgress({
            supabase,
            clientId,
            phone,
            telefone: phone,
            currentStepId: memory.currentStepId,
            collectedData: memory.collectedData,
            conversationStatus: memory.status,
            spinFase: spinPhase,
            qualificationStatus: qualification,
            mensagem: response.message,
            isFinalized: response.status === "completed",
          });

          console.log("[hardcoded-chat] Persist result:", persistResult.success);

          if (!persistResult.success) {
            console.warn(
              "[hardcoded-chat] Failed to persist progress:",
              persistResult.error
            );
          }

          // Adicionar métricas à resposta
          response.metrics = metrics;
          response.leadId = persistResult.leadId || null;

          if (response.message) {
            await appendLeadMessage({
              clientId,
              phone,
              senderType: "bot",
              direction: "outbound",
              messageText: response.message,
              leadId: persistResult.leadId || null,
              engagementSignal: qualification,
              meta: {
                source: "hardcoded-chat-api",
                conversationStatus: memory.status || null,
                stepId: memory.currentStepId || null,
              },
            });
          }
        }
      }

      console.log("[hardcoded-chat] Sending response");
      res.json({
        success: response.status !== "failed",
        clientId,
        phone: maskPhoneForLog(phone),
        ...response,
      });
    } catch (error) {
      console.error("[hardcoded-chat] Error:", error);
      sendError(res, 500, "INTERNAL_ERROR", "Internal server error", internalErrorPayloadDetails(error));
    }
  });

  /**
   * POST /api/hardcoded-chat-webhook
   * Webhook para receber mensagens do WhatsApp via Evolution API
   * Integração com chatbot hardcoded
   */
  app.post("/api/hardcoded-chat-webhook", async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    // Guarda de loop. Roda ANTES de qualquer buffering, chamada de LLM ou envio.
    // Cobre tres casos: mensagem que nos mesmos enviamos (fromMe), eco de evento
    // que nao e mensagem de lead (o webhook e assinado tambem em SEND_MESSAGE) e
    // reprocessamento do mesmo id. Incidente real: o alerta de recontato do SDR
    // voltou como entrada e disparou outro alerta, 8 vezes.
    // Instrumentacao do caminho de entrada. Toda saida daqui para baixo LOGA o
    // motivo: tres rodadas de depuracao se perderam porque a mensagem do lead
    // sumia em silencio e nao dava para saber em qual descarte.
    const descartar = (motivo, extra = {}) => {
      console.log("[chatbot-webhook] descartado", { motivo, ...extra });
      res.json({ success: true, ignored: motivo });
    };

    const eventoBruto = body?.event ?? body?.Event ?? body?.eventName ?? null;
    const guarda = shouldIgnoreInboundEvent(body);
    console.log("[chatbot-webhook] entrada", {
      evento: eventoBruto,
      eventoNormalizado: resolveInboundEventName(body) || null,
      fromMe: isFromMe(body),
      messageId: resolveMessageId(body) || null,
      passou: !guarda.ignore,
      motivo: guarda.reason,
    });
    if (guarda.ignore) {
      res.json({ success: true, ignored: guarda.reason });
      return;
    }

    // Descarta mensagem de GRUPO/broadcast antes de qualquer lookup no banco ou chatbot.
    const rawRemoteJid = body.data?.key?.remoteJid ?? body.remoteJid ?? body.senderJid ?? null;
    if (isGroupJid(rawRemoteJid)) {
      descartar("group", { remoteJid: rawRemoteJid });
      return;
    }

    const clientId = normalizeTenantKey(
      body.clientId ?? body.client_id ?? req.query.clientId ?? req.query.client_id
    ) || "outlier";

    // Verificar se chatbot está habilitado para este tenant.
    //
    // `catch (() => null)` engolia o erro e a falha de LEITURA ficava
    // indistinguivel de "nao configurado": o numero do SDR sumia e o log dizia
    // "no SDR number configured" com o numero salvo na tela. Falha de leitura
    // agora aparece no log e e sinalizada, como manda a §4 das diretrizes.
    let tenantSettingsReadFailed = false;
    const tenantSettings = await getLeadClientN8nSettings(clientId).catch((err) => {
      tenantSettingsReadFailed = true;
      console.error("[chatbot-webhook] falha ao ler settings do tenant", {
        clientId,
        error: err?.message || String(err),
      });
      return null;
    });
    if (tenantSettings && tenantSettings.chatbot_enabled === false) {
      descartar("chatbot_disabled", { clientId });
      return;
    }

    const phone = sanitizePhone(
      body.phone || body.telefone || body.remoteJid ||
      body.data?.key?.remoteJid || body.senderJid
    );

    if (!phone) {
      console.log("[chatbot-webhook] descartado", { motivo: "missing_phone", clientId, remoteJid: rawRemoteJid });
      res.json({ success: false, error: "Missing phone" });
      return;
    }

    const instanceName = body.instance || body.instanceName || req.query.instanceName || req.query.instance || null;

    // Agente inbound configurado na tela "Agente IA → Inbound", por NUMERO.
    // Sem linha configurada, inboundConfig e null e o comportamento antigo
    // (prompt e modelo do tenant) segue valendo — nada muda para quem ja usa.
    const inboundConfig = await resolveInboundAgentConfig({ supabase, clientId, instanceName }).catch((err) => {
      console.warn("[chatbot-webhook] falha ao resolver agente inbound:", err?.message || err);
      return null;
    });

    if (inboundConfig && !inboundConfig.enabled) {
      descartar("inbound_disabled", { clientId, instanceName });
      return;
    }

    // Chips explicitamente vinculados ao chatbot do tenant (aba Configuracoes).
    // Lista vazia = comportamento antigo (atende qualquer chip sem agente
    // inbound). Com a lista preenchida, chip de fora nao e atendido — o vinculo
    // deixa de ser "o que sobrou" e passa a ser o que o usuario marcou.
    if (!inboundConfig) {
      const chipsDoChatbot = Array.isArray(tenantSettings?.chatbot_instances)
        ? tenantSettings.chatbot_instances.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [];
      const chipAtual = String(instanceName || "").trim();
      if (chipsDoChatbot.length > 0) {
        // O mesmo chip tem TRES nomes: o amigavel, o id, e o ultimo segmento da URL
        // de disparo. A tela grava o da URL (TabGeral: nomeInstancia), e o webhook
        // manda body.instance. Comparar string crua descartava resposta legitima de
        // lead assim que o usuario marcasse um chip — o filtro so parecia funcionar
        // enquanto a lista estava vazia. resolveInstanceNameAliases ja existe neste
        // arquivo exatamente para reconciliar os tres.
        const aliasesDoChip = (await resolveInstanceNameAliases(clientId, chipAtual).catch(() => null)) || [];
        const nomesDoChipAtual = new Set([chipAtual, ...aliasesDoChip].filter(Boolean));
        const vinculado = chipsDoChatbot.some((marcado) => nomesDoChipAtual.has(marcado));
        if (!chipAtual || !vinculado) {
          descartar("chip_nao_vinculado", {
            clientId,
            chipAtual: chipAtual || null,
            aliasesDoChipAtual: Array.from(nomesDoChipAtual),
            chipsMarcados: chipsDoChatbot,
          });
          return;
        }
      }
    }

    // ── Campaign routing ─────────────────────────────────────────────────
    let chatbotPromptTypeOverride = null; // "campanha" | "padrao" | null
    let activeCampaignForLead = null;
    let campaignPromptIdOverride = null;
    let temCampanhaParaEsteTelefone = false;

    try {
      const campaignReplyContext = await findCampaignReplyMatches({ clientId, phone });
      const activeWaitCampaign = campaignReplyContext.processingWaitForReplyMatches[0] || null;
      activeCampaignForLead = campaignReplyContext.activePeriodCampaign;
      temCampanhaParaEsteTelefone = (campaignReplyContext.matches?.length ?? 0) > 0;

      // Por que este lead caiu (ou nao) no fluxo de resposta. Sem isto, "nao
      // disparou" e indistinguivel de "progresso sem waitForReply" e de "lead
      // nao encontrado em nenhuma campanha".
      // O progresso tem de sair do MATCH, nao de activeWaitCampaign: activeWaitCampaign
      // e processingWaitForReplyMatches[0], que so existe quando o progresso ja esta
      // pendente. Ler dali era circular — quando emProcessamento e 0 o log dizia null
      // sem distinguir "item nao encontrado" de "item sem progresso gravado".
      const candidato = campaignReplyContext.waitForReplyMatches[0] || campaignReplyContext.matches[0] || null;
      const progressoConsultado = candidato?.leadImportItem?.progress ?? null;
      console.log("[campaign-routing] contexto", {
        clientId,
        phone: maskPhoneForLog(phone),
        campanhasCasadas: campaignReplyContext.matches.length,
        comWaitForReply: campaignReplyContext.waitForReplyMatches.length,
        emProcessamento: campaignReplyContext.processingWaitForReplyMatches.length,
        campanhaCandidata: candidato?.id ?? null,
        matchSource: candidato?.matchSource ?? null,
        // null aqui = a linha de lead_import_items nao foi encontrada para este
        // telefone; preenchido = achou o item, o progresso e que nao tem a campanha.
        leadImportItemId: candidato?.leadImportItem?.id ?? null,
        temProgresso: progressoConsultado !== null,
        progressWaitForReply: progressoConsultado?.waitForReply ?? null,
        progressStatus: progressoConsultado?.status ?? null,
        progressNextStepIndex: progressoConsultado?.nextStepIndex ?? null,
        periodoAtivo: activeCampaignForLead?.id ?? null,
      });

      if (activeWaitCampaign) {
        // Lead aguardando resposta de disparo com waitForReply → avança sequência, silencia chatbot
        const itemId = activeWaitCampaign.leadImportItem?.id;
        const { isFirst } = await isFirstCampaignReply({ itemId, campaignId: activeWaitCampaign.id, supabase });

        if (isFirst) {
          console.log("[campaign-routing] wait_for_reply_step_first", {
            clientId, phone: maskPhoneForLog(phone),
            campaignId: activeWaitCampaign.id, campaignName: activeWaitCampaign.name,
          });

          supabase.from(leadsTableName(clientId))
            .update({ lead_origin: "campaign", source_campaign_id: activeWaitCampaign.id, source_campaign_name: activeWaitCampaign.name || null, lead_source: "campanha" })
            .eq("client_id", clientId).eq("telefone", phone)
            .then(({ error }) => { if (error) console.warn("[chatbot-webhook] campaign lead_origin update failed:", error.message); });
        } else {
          console.log("[campaign-routing] wait_for_reply_step subsequent", {
            clientId, phone: maskPhoneForLog(phone),
            campaignId: activeWaitCampaign.id, campaignName: activeWaitCampaign.name,
          });
        }

        // Tenta avançar a sequência de disparos da campanha (enviando a próxima mensagem configurada)
        let progression = { continued: false };
        try {
          progression = await continueCampaignLeadFromReply({
            clientId, phone, repliedAt: new Date().toISOString(),
            campaignMatch: activeWaitCampaign, replyPayload: {},
          });
          console.log("[campaign-routing] campaign_progression", {
            clientId, campaignId: activeWaitCampaign.id, phone: maskPhoneForLog(phone),
            continued: progression.continued, finalized: progression.finalized,
            campaignFinalized: progression.campaignFinalized,
            reason: progression.reason,
          });
        } catch (err) {
          console.warn("[campaign-routing] campaign_progression_failed:", err.message);
        }

        // Se o próximo passo da campanha foi disparado com sucesso, interrompe aqui (NÃO chama a IA)
        if (progression.continued) {
          res.json({ success: true, status: "campaign_step_dispatched" });
          return;
        }

        // Se a sequência de disparos acabou e a campanha possui modo "agente", aciona o prompt da campanha
        const waitCampaignIsAgente = activeWaitCampaign.mode === "agente";
        if (waitCampaignIsAgente && activeCampaignForLead) {
          campaignPromptIdOverride = activeCampaignForLead.campaignPromptId || null;
          if (!campaignPromptIdOverride) {
            console.error("[campaign-routing] campanha agente sem campaignPromptId — silenciando", {
              clientId, campaignId: activeWaitCampaign.id,
            });
            res.json({ success: true, status: "skipped_no_campaign_prompt" });
            return;
          }
          console.log("[campaign-routing] wait_for_reply_agente_prompt", {
            clientId, phone: maskPhoneForLog(phone),
            campaignId: activeWaitCampaign.id, campaignPromptId: campaignPromptIdOverride,
          });
        } else {
          res.json({ success: true, status: "skipped_disparo_only" });
          return;
        }
      } else if (activeCampaignForLead) {
        // Lead dentro do periodo de uma campanha ativa.
        //
        // DOIS CEREBROS NO MESMO NUMERO, escolhidos pelo CONTEXTO:
        //   campanha ativa COM roteiro proprio -> agente da campanha
        //   qualquer outro caso               -> agente de atendimento (inbound)
        //
        // O gatilho e o roteiro existir (campaignPromptId), nao o `mode`. Assim
        // uma campanha antiga — que tem campaign_prompt_id nulo — continua
        // EXATAMENTE como hoje, e o lead que respondeu a um disparo para de ser
        // atendido com o roteiro de quem procurou a empresa.
        const escolha = resolveCampaignAgent(activeCampaignForLead);
        campaignPromptIdOverride = escolha.campaignPromptId;
        if (escolha.configuracaoIncompleta) {
          console.error("[campaign-routing] campanha marcada como agente SEM roteiro — caindo no atendimento", {
            clientId, campaignId: activeCampaignForLead.id,
          });
        }
        console.log("[campaign-routing] agente escolhido", {
          clientId, phone: maskPhoneForLog(phone),
          agente: escolha.agente,
          porque: escolha.porque,
          campaignId: activeCampaignForLead.id,
          campaignName: activeCampaignForLead.name,
          campaignPromptId: escolha.campaignPromptId,
          mode: activeCampaignForLead.mode || null,
          endsAt: activeCampaignForLead.endsAt,
        });
      } else {
        // Sem campanha ativa no período → agente de atendimento (inbound)
        console.log("[campaign-routing] agente escolhido", {
          clientId, phone: maskPhoneForLog(phone),
          agente: "atendimento",
          porque: "nenhuma campanha ativa para este telefone",
        });
      }
    } catch (err) {
      console.warn("[chatbot-webhook] campaign routing check failed, continuing normal flow:", err.message);
    }
    // ─────────────────────────────────────────────────────────────────────

    // Quem o chatbot pode atender. Sem isto, QUALQUER pessoa que escreva para o
    // numero da empresa recebe atendimento de robo — aconteceu com contato
    // pessoal do dono. Escopo padrao ('leads_only') so engaja lead conhecido do
    // tenant ou telefone vindo de campanha; desconhecido fica em silencio, para
    // atendimento humano.
    const escopoInbound = resolveInboundScope(tenantSettings);
    // O numero do SDR e barrado SEMPRE, inclusive no escopo "all": o briefing
    // que chega nele nao pode virar conversa de lead.
    const telefoneEhSdr = resolveTenantSdrNumbers(tenantSettings).includes(normalizeSdrNumber(phone));
    if (escopoInbound !== INBOUND_SCOPE_ALL || telefoneEhSdr) {
      const leadConhecido = telefoneEhSdr ? false : await telefoneEhLeadConhecido(clientId, phone);
      const decisao = shouldEngageInbound({
        scope: escopoInbound,
        isKnownLead: leadConhecido,
        hasCampaignMatch: temCampanhaParaEsteTelefone,
        isSdrNumber: telefoneEhSdr,
      });
      if (!decisao.engage) {
        descartar(decisao.reason, { clientId, phone: maskPhoneForLog(phone), escopo: escopoInbound });
        return;
      }
    }

    // Responde imediatamente ao Evolution (evita timeout)
    res.json({ success: true, status: "buffering" });

    // Detectar tipo e extrair conteúdo da mensagem (async, sem bloquear resposta)
    resolveMessageContent(body).then((messageData) => {
      if (!messageData.text) {
        console.log("[chatbot-webhook] Empty message, skipping", { type: messageData.type, phone: maskPhoneForLog(phone) });
        return;
      }

      console.log("[chatbot-webhook] Buffering", {
        clientId,
        type: messageData.type,
        phone: maskPhoneForLog(phone),
        preview: messageData.text.slice(0, 60),
      });

      bufferMessage(clientId, phone, messageData, async (messages) => {
        try {
          for (const item of messages) {
            if (item?.text) {
              await appendLeadMessage({
                clientId,
                phone,
                senderType: "lead",
                direction: "inbound",
                messageText: item.text,
                meta: {
                  source: "hardcoded-chat-webhook",
                  messageType: item.type || null,
                  transcribed: item.transcribed === true,
                  described: item.described === true,
                },
                instanceName,
              });
            }
          }

          const chatbotModel = body.modelOverride || tenantSettings?.chatbot_model;
          const promptType = chatbotPromptTypeOverride || "padrao";
          const aiResponse = await processBatch({
            clientId,
            phone,
            messages,
            supabase,
            model: chatbotModel,
            promptType,
            campaignPromptId: campaignPromptIdOverride,
            llmModel: inboundConfig?.model || null,
            inboundPrompt: inboundConfig?.prompt || null,
            inboundSpinInstruction: inboundConfig ? buildSpinInstruction(inboundConfig.spinFields) : "",
            instanceName,
          });

          if (!aiResponse?.mensagem) return;

          // Enviar resposta via Evolution
          // Resolve pelo chip que RECEBEU a mensagem; sem identificar, cai no default
          // do tenant. Antes usava so o default (resolveDispatchWebhookSettings), que
          // ignora de qual numero veio a conversa — a IA gerava a resposta e o envio
          // abortava, com lead real em silencio.
          const dispatchSettings = await resolveInboundDispatchSettings({ clientId, instanceName });
          const { webhookUrl: evolutionUrl, webhookToken: evolutionToken } = dispatchSettings;

          if (!evolutionUrl) {
            // Nunca falhar em silencio: o log diz QUAIS fontes foram consultadas e o
            // que veio vazio em cada uma.
            console.error("[chatbot-webhook] resposta NAO enviada: sem URL da Evolution", {
              clientId,
              instanceName: instanceName || null,
              phone: maskPhoneForLog(phone),
              source: dispatchSettings.source,
              tentativas: dispatchSettings.tentativas,
            });
            return;
          }

          console.log("[chatbot-webhook] enviando resposta", {
            clientId,
            source: dispatchSettings.source,
            instanceName: dispatchSettings.instanceName || null,
          });

          const evolutionHeaders = { "Content-Type": "application/json" };
          if (evolutionToken) {
            evolutionHeaders.apikey = evolutionToken;
            evolutionHeaders.Authorization = `Bearer ${evolutionToken}`;
          }

          const evolutionResponse = await fetch(evolutionUrl, {
            method: "POST",
            headers: evolutionHeaders,
            body: JSON.stringify({
              number: phone,
              text: aiResponse.mensagem,
              message: aiResponse.mensagem,
              options: {
                delay: 2500,
                presence: "composing",
              },
            }),
          });

          if (evolutionResponse.ok) {
            console.log("[chatbot-webhook] Sent to WhatsApp", {
              phone: maskPhoneForLog(phone),
              status: aiResponse.status_conversa,
              classificacao: aiResponse.classificacao,
            });

            await appendLeadMessage({
              clientId,
              phone,
              senderType: "bot",
              direction: "outbound",
              messageText: aiResponse.mensagem,
              engagementSignal: aiResponse.classificacao || null,
              meta: {
                source: "hardcoded-chat-webhook",
                model: chatbotModel,
                conversationStatus: aiResponse.status_conversa || null,
                finalized: aiResponse.finalizado === true,
                recontact: aiResponse._recontato === true,
              },
              instanceName,
            });
          } else {
            const errText = await evolutionResponse.text();
            console.error("[chatbot-webhook] Evolution send failed:", evolutionResponse.status, errText.slice(0, 200));
          }

          // PRECEDENCIA DO SDR, documentada porque ja gerou confusao:
          //
          // 1. Agente inbound com "Permitir Transferencia" DESLIGADO -> ninguem
          //    e notificado. E escolha explicita do usuario naquele numero e
          //    vence o padrao do tenant. Nao e falta de configuracao.
          // 2. Agente inbound com transferencia ligada -> numero do proprio
          //    agente; sem ele, cai no numero do tenant.
          // 3. Sem agente inbound -> numero do tenant.
          //
          // O motivo entra no log separado do numero: antes, transferencia
          // desligada e leitura falha apareciam as duas como "no SDR number
          // configured", com o numero salvo na tela.
          // excludeNumbers fecha o ciclo pelo outro lado: o alerta nunca vai
          // para o telefone da propria conversa.
          const sdr = resolveSdrTarget({
            inboundConfig,
            tenantSettings,
            tenantSettingsReadFailed,
            excludeNumbers: [phone],
          });
          if (sdr.excluded?.length > 0) {
            console.warn("[chatbot-webhook] destino de SDR excluido para nao fechar loop", {
              clientId,
              excluidos: sdr.excluded.map(maskPhoneForLog),
            });
          }
          // Lista, nao numero unico: a mesma configuracao do tenant serve aos
          // dois agentes.
          const temSdr = sdr.numbers.length > 0;

          // Recontato: lead finalizado voltou a falar — avisa SDR sem gerar novo briefing
          if (aiResponse._recontato) {
            if (temSdr && evolutionUrl) {
              try {
                const dados = aiResponse.dados || {};
                const interesse = dados.interesse || "consórcio";
                const horario = dados.melhor_horario ? ` (preferência: ${dados.melhor_horario})` : "";
                const recontatoMsg = [
                  `🔔 *Lead recontato — já qualificado anteriormente*`,
                  `📱 Número: ${phone}`,
                  `🏠 Interesse: ${interesse}`,
                  `🌡️ Temperatura: ${aiResponse.classificacao || "não classificada"}${horario}`,
                  `\nLead entrou em contato novamente após ter sido qualificado. Mensagem de reconhecimento enviada.`,
                  `Recomendado: entrar em contato ativo agora.`,
                ].join("\n");

                const entrega = await enviarParaSdrs({
                  numeros: sdr.numbers,
                  texto: recontatoMsg,
                  evolutionUrl,
                  evolutionHeaders,
                  contexto: { clientId, tipo: "recontato" },
                });
                console.log("[chatbot-webhook] alerta de recontato enviado ao SDR", {
                  clientId, phone: maskPhoneForLog(phone),
                  enviados: entrega.enviados, falhas: entrega.falhas.length,
                });
              } catch (err) {
                console.error("[chatbot-webhook] SDR recontact alert error:", err.message);
              }
            }
          }

          // Webhook de finalizacao da tela do Inbound: dispara com os dados
          // coletados quando o atendimento fecha. Era um campo salvo e nunca usado.
          if (aiResponse.finalizado && !aiResponse._recontato && inboundConfig?.webhookUrl) {
            fireInboundCompletionWebhook({
              webhookUrl: inboundConfig.webhookUrl,
              clientId,
              phone,
              instanceName,
              dados: aiResponse.dados || {},
              classificacao: aiResponse.classificacao,
            }).catch(() => {});
          }

          // Finalizado pela primeira vez: gerar briefing completo e notificar SDR
          // Dedup do ALERTA por CONVERSA, nao por id de mensagem: a guarda do
          // inboundGuard tem TTL de 10 min e um loop mais lento que isso passa
          // por baixo dela. A marca fica no lead e nao expira — briefing sai uma
          // vez por qualificacao, e conversa ja notificada nao gera outro.
          if (aiResponse.finalizado && !aiResponse._recontato && !(await briefingJaEnviado(clientId, phone))) {
            if (temSdr && evolutionUrl) {
              try {
                // Tenta briefing via IA com prompt "extrato" do banco; fallback para determinístico
                const aiBriefing = await extractBriefingWithAI({
                  supabase,
                  clientId,
                  phone,
                  history: aiResponse._history || [],
                  collectedData: aiResponse._dados || aiResponse.dados || {},
                  classificacao: aiResponse.classificacao,
                });

                if (!aiBriefing) {
                  console.error("[chatbot-webhook] Briefing IA falhou — prompt 'extrato' não configurado para clientId:", clientId);
                }
                const briefingMsg = aiBriefing;

                if (briefingMsg) {
                  const entrega = await enviarParaSdrs({
                    numeros: sdr.numbers,
                    texto: briefingMsg,
                    evolutionUrl,
                    evolutionHeaders,
                    contexto: { clientId, tipo: "briefing" },
                  });
                  // Marca assim que ao menos um destino recebeu. Marcar mesmo
                  // com falha total esconderia a qualificacao para sempre.
                  if (entrega.enviados > 0) await marcarBriefingEnviado(clientId, phone);
                  console.log("[chatbot-webhook] briefing enviado ao SDR", {
                    clientId,
                    enviados: entrega.enviados,
                    falhas: entrega.falhas.length,
                    source: aiBriefing ? "ai" : "deterministic",
                  });
                }
              } catch (briefErr) {
                console.error("[chatbot-webhook] SDR briefing send error:", briefErr.message);
              }
            } else {
              console.log("[chatbot-webhook] conversa finalizada sem notificar SDR", {
                clientId,
                motivo: sdr.reason,
                // leitura_falhou NAO e "nao configurado": o numero pode existir
                // e a consulta ter falhado. Confundir os dois custou uma
                // investigacao inteira.
                temNumeroNoTenant: Boolean(tenantSettings?.sdr_whatsapp_number),
              });
            }
          }
        } catch (err) {
          console.error("[chatbot-webhook] processBatch error:", err.message);
        }
      });
    }).catch((err) => {
      console.error("[chatbot-webhook] resolveMessageContent error:", err.message);
    });
  });
  /**
   * POST /api/chatbot-test — endpoint síncrono para simulador de conversa no painel
   * Processa a mensagem diretamente (sem buffer, sem Evolution) e retorna a resposta da IA.
   */
  /**
   * POST /api/chatbot-leads/reabrir  { clientId, phone }
   *
   * Destrava um lead preso em "finalizado". Ate aqui nao existia jeito nenhum
   * de reverter pela tela: um lead finalizado num teste ficava com o numero
   * inutilizado, recebendo a mesma frase de recontato para sempre.
   *
   * Escopo de tenant por resolveAuthorizedClientId — um tenant nao reabre lead
   * de outro. O filtro client_id vai TAMBEM no UPDATE, nao so na autorizacao.
   */
  app.post("/api/chatbot-leads/reabrir", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;

    try {
      const requestedClientId = normalizeString(req.body?.clientId);
      const clientId = resolveAuthorizedClientId(req, res, requestedClientId);
      if (!clientId) return;

      const phone = sanitizePhone(req.body?.phone || req.body?.telefone);
      if (!phone) {
        sendError(res, 400, "INVALID_BODY", "Missing phone");
        return;
      }

      const leadsTable = leadsTableName(clientId);
      const { data: encontrados, error: readError } = await supabase
        .from(leadsTable)
        .select("id, dados, finalizado")
        .eq("client_id", clientId)
        .eq("telefone", phone)
        .order("created_at", { ascending: false })
        .limit(1);

      if (readError) {
        console.error("[chatbot-leads] reabrir: falha ao ler lead:", readError.message);
        sendError(res, 500, "LEAD_READ_FAILED", "Falha ao ler o lead", readError.message);
        return;
      }

      const lead = encontrados?.[0] || null;
      if (!lead) {
        sendError(res, 404, "LEAD_NOT_FOUND", "Lead nao encontrado neste tenant");
        return;
      }

      const dados = lead.dados || {};
      const { error: updateError } = await supabase
        .from(leadsTable)
        .update({
          finalizado: false,
          status_conversa: "em_atendimento",
          dados: {
            ...dados,
            recontato_avisado_em: null,
            recontato_reaberto_em: new Date().toISOString(),
          },
        })
        .eq("id", lead.id)
        .eq("client_id", clientId);

      if (updateError) {
        console.error("[chatbot-leads] reabrir: falha ao gravar:", updateError.message);
        sendError(res, 500, "LEAD_REOPEN_FAILED", "Falha ao reabrir o lead", updateError.message);
        return;
      }

      console.log("[chatbot-leads] lead reaberto", {
        clientId,
        phone: maskPhoneForLog(phone),
        estavaFinalizado: lead.finalizado === true,
      });

      res.json({ success: true, reopened: true, wasFinalized: lead.finalizado === true });
    } catch (error) {
      console.error("[chatbot-leads] reabrir error:", error);
      sendError(res, 500, "INTERNAL_ERROR", "Internal server error", internalErrorPayloadDetails(error));
    }
  });

  app.post("/api/chatbot-test", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const clientId = normalizeTenantKey(body.clientId ?? body.client_id);
    const phone = sanitizePhone(body.phone) || "5500000000000";
    const message = normalizeString(body.message);

    if (!clientId) return sendError(res, 400, "MISSING_CLIENT_ID", "clientId obrigatório");
    if (!message) return sendError(res, 400, "MISSING_MESSAGE", "message obrigatório");

    // instanceName opcional: com ele o simulador testa o AGENTE INBOUND daquele
    // numero (prompt, modelo e SPIN da tela Inbound). Sem ele, testa o chatbot
    // do tenant, como antes.
    const instanceName = normalizeString(body.instanceName ?? body.instance) || null;

    try {
      const tenantSettings = await getLeadClientN8nSettings(clientId).catch(() => null);
      const chatbotModel = tenantSettings?.chatbot_model;

      const inboundConfig = instanceName
        ? await resolveInboundAgentConfig({ supabase, clientId, instanceName }).catch(() => null)
        : null;

      const aiResponse = await processBatch({
        clientId,
        phone,
        messages: [{ text: message, type: "text" }],
        supabase,
        model: chatbotModel,
        promptType: "padrao",
        campaignPromptId: null,
        llmModel: inboundConfig?.model || null,
        inboundPrompt: inboundConfig?.prompt || null,
        inboundSpinInstruction: inboundConfig ? buildSpinInstruction(inboundConfig.spinFields) : "",
        instanceName,
      });

      if (!aiResponse?.mensagem) {
        // Dois motivos MUITO diferentes cabiam nesta mesma frase. Sem separar, o
        // dono lia "prompt nao configurado" quando o prompt estava certo e quem
        // falhou foi o modelo — e ia mexer no lugar errado.
        const motivo = aiResponse?.mensagemAusente
          ? "O modelo respondeu, mas sem texto na chave \"mensagem\". O prompt está configurado; a resposta é que veio fora do contrato."
          : "Prompt não configurado ou chatbot silenciado para este cliente.";
        return res.status(502).json({
          success: false,
          error: "Não foi possível gerar a resposta.",
          reason: motivo,
          code: aiResponse?.mensagemAusente ? "MODEL_EMPTY_MESSAGE" : "CHATBOT_NOT_CONFIGURED",
        });
      }

      // A resposta saiu, mas pode nao ter sido GRAVADA. Sem este aviso, o dono ve
      // uma conversa aparentemente saudavel que reinicia sozinha no turno seguinte.
      const avisos = [];
      if (aiResponse._persistErro) {
        avisos.push(
          `A resposta foi gerada mas NÃO foi salva (${aiResponse._persistErro}). O histórico se perdeu: o próximo turno vai começar sem memória.`
        );
      }
      if (aiResponse._repetiuUltimaFala) {
        avisos.push(
          "Esta resposta é idêntica à anterior — sinal de que o histórico não chegou ao modelo."
        );
      }

      res.json({
        success: true,
        response: aiResponse.mensagem,
        ...(avisos.length > 0 ? { avisos } : {}),
        meta: {
          classificacao: aiResponse.classificacao,
          spin_fase: aiResponse.spin_fase,
          finalizado: aiResponse.finalizado,
          agente: inboundConfig ? "inbound" : "tenant",
          dados: aiResponse.dados || {},
          contratoQuebrado: aiResponse.contratoQuebrado === true,
        },
      });
    } catch (err) {
      console.error("[chatbot-test] Erro no simulador:", {
        clientId,
        phone,
        instanceName,
        error: err?.message || err,
      });
      const detail = err instanceof Error ? err.message : "Erro desconhecido ao simular resposta do modelo";
      res.status(502).json({
        success: false,
        error: `Falha ao processar resposta do modelo: ${detail}`,
        code: "CHATBOT_TEST_FAILED",
      });
    }
  });
  /**
   * GET /api/hardcoded-chat-leads
   * Lista leads do chatbot hardcoded para o Kanban
   * Retorna por status_conversa e step atual
   */
  app.get("/api/hardcoded-chat-leads", requireFirebaseAuth, async (req, res) => {
    if (!ensureDb(res)) return;

    const clientId = normalizeTenantKey(req.query.clientId ?? req.query.client_id);
    const statusFilter = req.query.status || null; // em_atendimento | finalizado | all
    const limitRaw = Number.parseInt(String(req.query.limit || "100"), 10);
    const limit = Math.min(Number.isNaN(limitRaw) ? 100 : limitRaw, 500);

    if (!clientId) {
      sendError(res, 400, "INVALID_QUERY", "Missing clientId");
      return;
    }

    try {
      let query = supabase
        .from(leadsTableName(clientId))
        .select("id, telefone, nome, status_conversa, finalizado, dados, mensagem, lead_temperature, spin_fase, qualificacao, lead_score, created_at, updated_at, lead_origin, source_campaign_id, source_campaign_name, lead_source")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status_conversa", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[hardcoded-chat-leads] Query error:", error);
        sendError(res, 500, "DB_ERROR", error.message);
        return;
      }

      const leads = (data || []).map((row) => {
        const dados = row.dados || {};
        const { _currentStepId, ...collectedData } = dados;
        return {
          id: row.id,
          telefone: row.telefone,
          nome: row.nome || null,
          statusConversa: row.status_conversa || "em_atendimento",
          finalizado: row.finalizado || false,
          currentStepId: _currentStepId || null,
          collectedData,
          mensagem: row.mensagem || null,
          leadTemperature: row.lead_temperature || null,
          spinFase: row.spin_fase || null,
          qualificacao: row.qualificacao || null,
          leadScore: row.lead_score || null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          leadOrigin: row.lead_origin || null,
          sourceCampaignId: row.source_campaign_id || null,
          sourceCampaignName: row.source_campaign_name || null,
          leadSource: row.lead_source || null,
        };
      });

      // Agrupar por status para facilitar o Kanban
      const kanban = {
        em_atendimento: leads.filter((l) => l.statusConversa === "em_atendimento"),
        finalizado: leads.filter((l) => l.statusConversa === "finalizado"),
        total: leads.length,
      };

      res.json({ success: true, leads, kanban });
    } catch (err) {
      console.error("[hardcoded-chat-leads] Error:", err);
      sendError(res, 500, "SERVER_ERROR", err.message);
    }
  });
  /**
   * POST /api/hardcoded-chat-extract
   * Extrai briefing de uma conversa finalizada
   * Útil para recuperar briefing de leads antigos
   */
  app.post("/api/hardcoded-chat-extract", async (req, res) => {
    if (!ensureDb(res)) return;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const clientId = normalizeTenantKey(body.clientId ?? body.client_id);
    const phone = sanitizePhone(body.phone ?? body.telefone);

    if (!clientId || !phone) {
      sendError(res, 400, "INVALID_BODY", "Missing clientId or phone");
      return;
    }

    try {
      // Buscar conversa mais recente
      const { data: conversation, error } = await supabase
        .from(leadsTableName(clientId))
        .select("*")
        .eq("client_id", clientId)
        .eq("telefone", phone)
        .eq("finalizado", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !conversation) {
        sendError(res, 404, "NOT_FOUND", "No completed conversation found");
        return;
      }

      const parsedHistory = parseStoredHistorico(conversation.historico);
      const aiBriefing = await extractBriefingWithAI({
        supabase,
        clientId,
        phone,
        history: parsedHistory || [],
        collectedData: conversation.dados,
        classificacao: conversation.status,
      });

      if (!aiBriefing) {
        return sendError(res, 500, "BRIEFING_UNAVAILABLE", "Prompt 'extrato' não configurado ou IA indisponível");
      }

      res.json({ success: true, conversationId: conversation.id, briefing: aiBriefing, source: "ai" });
    } catch (error) {
      console.error("[hardcoded-extract] Error:", error);
      sendError(res, 500, "INTERNAL_ERROR", "Internal server error", internalErrorPayloadDetails(error));
    }
  });
}
