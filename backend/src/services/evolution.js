// Evolution API: instâncias por cliente, provisionamento, health-check (movidos de
// server.js — grupo E do mapa, Onda 3 Run D). Movimento puro: corpos idênticos aos
// de server.js na revisão anterior a esta extração.
//
// _evolutionInstancesSchemaEnsured (antes `let` isolado em server.js) vira estado
// privado deste módulo — só ensureLeadClientEvolutionInstancesTable o toca.
//
// logCampaignDispatch: movida para cá (não estava no grupo E do mapa) porque
// checkEvolutionInstanceHealth depende dela e o grafo de imports não permite que
// evolution.js importe de server.js. server.js (grupo D, hub) reimporta esta função
// daqui para os usos que permanecem em resolveCampaignDispatchSettings/dispatch
// (settings_resolved) — consistente com "D importa de E".
//
// isMaskedSecretPlaceholder (usada por upsertLeadClientEvolutionInstance) foi movida
// para ./httpInfra.js em vez de ./n8nSettings.js: n8nSettings.js já importa deste
// módulo (getDefaultLeadClientEvolutionInstance, mergeEvolutionInstanceIntoSettings,
// getLeadClientEvolutionInstancesMap, maskEvolutionInstance) — se isMaskedSecretPlaceholder
// vivesse em n8nSettings.js, este módulo precisaria importar de lá também, fechando um
// ciclo evolution.js <-> n8nSettings.js. Import de httpInfra.js (folha do grafo) evita isso.

import { randomUUID } from "crypto";
import { pgDatabasePool } from "./database.js";
import { normalizeString } from "../textNormalize.js";
import { normalizeTenantKey, normalizeHttpUrl } from "./tenant.js";
import { isMaskedSecretPlaceholder } from "./httpInfra.js";
import { upsertLeadByPhone } from "./leadUpsert.js";

/** Timeout padrão para chamadas HTTP de saída (Evolution health-check e webhooks de campanha). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export function logCampaignDispatch(level, event, details = {}) {
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  logger("[campaign-dispatch]", event, details);
}

export function maskEvolutionInstance(row) {
  if (!row) return null;
  const chipState = (row.chip_state || "").toLowerCase() === "warm" ? "warm" : "cold";
  const connState = (row.connection_state || "unknown").toLowerCase();

  return {
    id: row.id,
    client_id: row.client_id,
    name: row.name || "Evolution",
    dispatch_webhook_url: row.dispatch_webhook_url || null,
    has_dispatch_webhook_token: !!row.dispatch_webhook_token,
    inbound_bearer_token_label: row.inbound_bearer_token ? "definido" : null,
    active: row.active !== false,
    is_default: row.is_default === true,
    chip_state: chipState,
    connection_state: connState,
    connectionStatus: ["open", "connected", "online"].includes(connState)
      ? "open"
      : row.active !== false
      ? "active"
      : "disconnected",
    daily_limit_override: row.daily_limit_override != null ? Number(row.daily_limit_override) : null,
    sent_count_today: row.sent_count_today != null ? Number(row.sent_count_today) : 0,
    webhook_enabled: row.webhook_enabled === true,
    // Preenchido quando a configuracao remota do webhook falhou no salvamento.
    webhook_error: row.webhook_error || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    updated_by_email: row.updated_by_email || null,
  };
}

export function mergeEvolutionInstanceIntoSettings(settings, instance) {
  if (!instance) return settings || null;
  return {
    ...(settings || {}),
    client_id: instance.client_id,
    dispatch_webhook_url: instance.dispatch_webhook_url || null,
    dispatch_webhook_token: instance.dispatch_webhook_token || null,
    inbound_bearer_token: instance.inbound_bearer_token || settings?.inbound_bearer_token || null,
    active: instance.active !== false,
    updated_at: instance.updated_at || settings?.updated_at || null,
    updated_by_email: instance.updated_by_email || settings?.updated_by_email || null,
    evolution_instance_id: instance.id,
    evolution_instance_name: instance.name || "Evolution",
  };
}

let _evolutionInstancesSchemaEnsured = false;

export async function ensureLeadClientEvolutionInstancesTable() {
  if (!pgDatabasePool) return false;
  if (_evolutionInstancesSchemaEnsured) return true;

  try {
    await pgDatabasePool.query(`
      CREATE TABLE IF NOT EXISTS public.leads_clients (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `).catch(() => {});

    await pgDatabasePool.query(`
      CREATE TABLE IF NOT EXISTS public.lead_client_evolution_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Evolution',
        dispatch_webhook_url TEXT NOT NULL,
        dispatch_webhook_token TEXT,
        inbound_bearer_token TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        is_default BOOLEAN NOT NULL DEFAULT false,
        webhook_enabled BOOLEAN NOT NULL DEFAULT false,
        chip_state TEXT NOT NULL DEFAULT 'cold',
        connection_state TEXT NOT NULL DEFAULT 'unknown',
        daily_limit_override INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by_uid TEXT,
        updated_by_email TEXT
      )
    `);

    await pgDatabasePool.query(`
      ALTER TABLE public.lead_client_evolution_instances
        ADD COLUMN IF NOT EXISTS connection_state TEXT NOT NULL DEFAULT 'unknown'
    `).catch(() => {});

    await pgDatabasePool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_client_evolution_default
        ON public.lead_client_evolution_instances (client_id)
        WHERE is_default = true
    `).catch(() => {});

    await pgDatabasePool.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_client_evolution_client
        ON public.lead_client_evolution_instances (client_id, active)
    `).catch(() => {});

    await pgDatabasePool.query(`
      CREATE TABLE IF NOT EXISTS public.evolution_instance_daily_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        sent_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(instance_id, date)
      )
    `).catch(() => {});

    _evolutionInstancesSchemaEnsured = true;
    return true;
  } catch (err) {
    console.warn("[evolution-instances] Table initialization warning:", err.message);
    _evolutionInstancesSchemaEnsured = true;
    return true;
  }
}

export function selectDefaultEvolutionInstance(instances = []) {
  if (!Array.isArray(instances)) return null;
  const active = instances.filter((i) => i && i.active !== false);
  if (active.length === 0) return null;
  return active.find((i) => i.is_default === true) || active[0] || null;
}

export async function getLeadClientEvolutionInstances(clientId) {
  if (!clientId) return [];
  if (!pgDatabasePool) return [];
  try {
    await ensureLeadClientEvolutionInstancesTable();
    const { rows } = await pgDatabasePool.query(
      `
        SELECT i.id, i.client_id, i.name, i.dispatch_webhook_url, i.dispatch_webhook_token,
               i.inbound_bearer_token, i.active, i.is_default, i.chip_state, i.connection_state, i.daily_limit_override,
               i.webhook_enabled,
               i.created_at, i.updated_at, i.updated_by_email,
               COALESCE(u.sent_count, 0) AS sent_count_today
        FROM public.lead_client_evolution_instances i
        LEFT JOIN public.evolution_instance_daily_usage u
          ON u.instance_id = i.id AND u.date = CURRENT_DATE
        WHERE i.client_id = $1
        ORDER BY i.active DESC, i.is_default DESC, i.created_at ASC
      `,
      [clientId]
    );

    return rows;
  } catch (err) {
    console.error("[evolution-instances] Erro ao buscar instâncias Evolution para client:", {
      clientId,
      error: err?.message || err,
    });
    throw err;
  }
}

export async function getLeadClientEvolutionInstancesMap(clientIds) {
  if (!clientIds?.length) return {};
  if (!pgDatabasePool) return {};
  try {
    await ensureLeadClientEvolutionInstancesTable();

    const { rows } = await pgDatabasePool.query(
      `
        SELECT i.id, i.client_id, i.name, i.dispatch_webhook_url, i.dispatch_webhook_token,
               i.inbound_bearer_token, i.active, i.is_default, i.chip_state, i.connection_state, i.daily_limit_override,
               i.webhook_enabled,
               i.created_at, i.updated_at, i.updated_by_email,
               COALESCE(u.sent_count, 0) AS sent_count_today
        FROM public.lead_client_evolution_instances i
        LEFT JOIN public.evolution_instance_daily_usage u
          ON u.instance_id = i.id AND u.date = CURRENT_DATE
        WHERE i.client_id = ANY($1::text[])
        ORDER BY i.active DESC, i.is_default DESC, i.created_at ASC
      `,
      [clientIds]
    );

    return rows.reduce((acc, row) => {
      if (!acc[row.client_id]) acc[row.client_id] = [];
      acc[row.client_id].push(row);
      return acc;
    }, {});
  } catch (err) {
    console.error("[evolution-instances] Erro ao buscar mapa de instâncias Evolution:", {
      clientIds,
      error: err?.message || err,
    });
    throw err;
  }
}

export async function getDefaultLeadClientEvolutionInstance(clientId) {
  const instances = await getLeadClientEvolutionInstances(clientId);
  return selectDefaultEvolutionInstance(instances);
}

export async function syncEvolutionInstanceChatsAndMessages(clientId, dispatchWebhookUrl, dispatchWebhookToken) {
  try {
    if (!dispatchWebhookUrl) return;

    const urlObj = new URL(dispatchWebhookUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const parts = urlObj.pathname.split("/");
    const instanceName = parts[parts.length - 1];

    if (!instanceName) return;

    const apiKey = dispatchWebhookToken || getEvolutionAdminConfig().apiKey;

    console.info(`[sync-evolution] Starting background sync for instance ${instanceName}...`);

    // 1. Fetch chats from Evolution API.
    // Evolution v2: /chat/findChats/{instance} é POST (com body), não GET. Como
    // GET dava HTTP 404, o backfill de conversas nunca acontecia.
    const chatsResponse = await fetch(`${baseUrl}/chat/findChats/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({}),
    });

    if (!chatsResponse.ok) {
      console.warn(`[sync-evolution] Failed to fetch chats for ${instanceName}: HTTP ${chatsResponse.status}`);
      return { instanceName, chats: 0, synced: 0, messages: 0, error: `HTTP ${chatsResponse.status}` };
    }

    const rawChats = await chatsResponse.json();
    // v2 pode devolver array direto ou paginado ({ records: [...] }).
    const chats = Array.isArray(rawChats) ? rawChats : (rawChats?.records || rawChats?.chats || []);
    if (!Array.isArray(chats)) {
      console.warn(`[sync-evolution] Evolution API did not return an array of chats:`, rawChats);
      return { instanceName, chats: 0, synced: 0, messages: 0, error: "resposta inválida da Evolution" };
    }
    // Contadores para dar feedback real ao usuário (o botão "Sincronizar agora"
    // mostra quantas conversas/mensagens entraram, em vez de "não aconteceu nada").
    let syncedChats = 0;
    let insertedMessages = 0;

    console.info(`[sync-evolution] Found ${chats.length} chats. Syncing messages for the top 200 chats...`);

    // Catálogo de contatos da instância: resolve o NOME (pushName que a pessoa
    // configurou no WhatsApp dela) e, quando disponível, o TELEFONE real de um
    // contato LID. Sem isso a conversa aparece como "224777281249297@lid" e sem
    // nome, porque o findChats de contatos LID nem sempre traz remoteJidAlt.
    const contactNameByKey = new Map(); // dígitos do jid -> nome
    const phoneByLid = new Map();       // dígitos do LID  -> telefone real
    try {
      const ctRes = await fetch(`${baseUrl}/chat/findContacts/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({}),
      });
      if (ctRes.ok) {
        const ctData = await ctRes.json();
        const ctList = Array.isArray(ctData) ? ctData : (ctData?.records || ctData?.contacts || []);
        for (const ct of ctList) {
          const jid = String(ct?.remoteJid || ct?.id || "");
          const digits = jid.split("@")[0].replace(/\D/g, "");
          const nm = String(ct?.pushName || ct?.name || ct?.verifiedName || "").trim();
          if (digits && nm && !/^(você|voce)$/i.test(nm)) contactNameByKey.set(digits, nm);
          // alguns registros trazem o telefone correspondente ao LID
          const alt = String(ct?.remoteJidAlt || ct?.jid || "");
          if (jid.includes("@lid") && alt.includes("@s.whatsapp.net")) {
            phoneByLid.set(digits, alt.split("@")[0].replace(/\D/g, ""));
          }
        }
      }
    } catch (e) {
      console.warn("[sync-evolution] findContacts indisponível:", e.message);
    }

    // Mapa persistente LID -> telefone: o mesmo contato tem o mesmo LID em
    // qualquer chip, então um vínculo descoberto por um chip serve para todos.
    // (Verificado: o LID 60640710402218 traz remoteJidAlt num chip e não noutro.)
    const lidMap = new Map();
    try {
      await pgDatabasePool.query(`
        CREATE TABLE IF NOT EXISTS public.whatsapp_lid_map (
          lid TEXT PRIMARY KEY,
          phone TEXT,
          contact_name TEXT,
          first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`).catch(() => {});
      // Perfil público (fetchProfile): unica identificacao disponivel para
      // contatos LID sem telefone/pushName — foto, descricao do negocio, site.
      await pgDatabasePool.query(`ALTER TABLE public.whatsapp_lid_map ALTER COLUMN phone DROP NOT NULL`).catch(() => {});
      await pgDatabasePool.query(`ALTER TABLE public.whatsapp_lid_map ADD COLUMN IF NOT EXISTS profile_pic TEXT`).catch(() => {});
      await pgDatabasePool.query(`ALTER TABLE public.whatsapp_lid_map ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => {});
      await pgDatabasePool.query(`ALTER TABLE public.whatsapp_lid_map ADD COLUMN IF NOT EXISTS website TEXT`).catch(() => {});
      await pgDatabasePool.query(`ALTER TABLE public.whatsapp_lid_map ADD COLUMN IF NOT EXISTS profile_checked BOOLEAN DEFAULT false`).catch(() => {});
      const { rows: lidRows } = await pgDatabasePool.query(
        "SELECT lid, phone, contact_name, profile_pic, profile_checked FROM public.whatsapp_lid_map"
      );
      for (const r of lidRows) lidMap.set(r.lid, {
        phone: r.phone, name: r.contact_name, pic: r.profile_pic, checked: r.profile_checked === true,
      });
    } catch (e) {
      console.warn("[sync-evolution] lid_map indisponível:", e.message);
    }
    const rememberLid = async (lid, ph, nm) => {
      if (!lid || !ph) return;
      lidMap.set(lid, { phone: ph, name: nm || lidMap.get(lid)?.name || null });
      await pgDatabasePool.query(
        `INSERT INTO public.whatsapp_lid_map (lid, phone, contact_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (lid) DO UPDATE SET
           phone = EXCLUDED.phone,
           contact_name = COALESCE(NULLIF(EXCLUDED.contact_name, ''), public.whatsapp_lid_map.contact_name),
           updated_at = now()`,
        [lid, ph, nm || null]
      ).catch(() => {});
    };

    // Sincroniza até 200 chats (número comercial tem muitas conversas por dia).
    const topChats = chats.slice(0, 200);

    for (const chat of topChats) {
      // A aba Conversas mostra TUDO que existe no WhatsApp do chip: contato
      // individual, grupo e LID sem telefone conhecido. Filtrar grupo/LID aqui
      // (regra que só faz sentido para EXTRAIR LEAD, onde é preciso um telefone
      // discável) zerava a sincronização de chips cujas conversas são grupos —
      // era por isso que o segundo chip nunca aparecia.
      const remoteJid = chat.remoteJid || chat.id;
      if (!remoteJid || remoteJid.includes("@broadcast")) continue;

      const isGroup = remoteJid.includes("@g.us");
      const jidDigits = remoteJid.split("@")[0].replace(/\D/g, "");

      // FONTE PRIMÁRIA: o próprio objeto do chat. Em contatos LID o telefone real
      // vem em lastMessage.key.remoteJidAlt e o nome em pushName — os dois já
      // chegam no findChats. Só se faltar aqui é que vamos procurar nas mensagens.
      let phone = "";
      let chatName = "";

      if (!isGroup) {
        const altCandidates = [
          chat?.lastMessage?.key?.remoteJidAlt,
          chat?.lastMessage?.key?.participantAlt,
          chat?.lastMessage?.key?.senderPn,
          remoteJid.includes("@s.whatsapp.net") ? remoteJid : null,
        ];
        for (const c of altCandidates) {
          const v = String(c || "");
          if (v.includes("@s.whatsapp.net")) { phone = v.split("@")[0]; break; }
        }
      }
      {
        const nm = String(chat?.pushName || chat?.name || "").trim();
        if (nm && !/^(você|voce)$/i.test(nm) && !/^\+?\d[\d\s\-()]*$/.test(nm)) chatName = nm;
      }

      // Vínculo já descoberto antes (por este ou por outro chip).
      let knownEntry = null;
      if (!isGroup) {
        knownEntry = lidMap.get(remoteJid) || lidMap.get(jidDigits) || null;
        if (knownEntry) {
          if (!phone && knownEntry.phone) phone = knownEntry.phone;
          if (!chatName && knownEntry.name) chatName = knownEntry.name;
        }
      }

      // Sem nome e sem telefone: o perfil público é a única identificação que a
      // API oferece para contatos LID (fetchProfile traz foto, descrição do
      // negócio e site — não traz nome nem número). Consulta uma vez por LID.
      if (!isGroup && !chatName && remoteJid.includes("@lid") && !knownEntry?.checked) {
        try {
          const pf = await fetch(`${baseUrl}/chat/fetchProfile/${encodeURIComponent(instanceName)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: remoteJid }),
          });
          if (pf.ok) {
            const prof = await pf.json();
            const desc = String(prof?.description || "").trim();
            const site = String(prof?.website || "").trim();
            // Nome legível a partir do que existe: descrição do negócio ou o
            // domínio do site. Não inventa: são dados do próprio perfil.
            let derived = desc;
            if (!derived && site) {
              try {
                const host = new URL(site.startsWith("http") ? site : `https://${site}`).hostname;
                derived = host.replace(/^www\./, "").split(".")[0];
              } catch { /* site inválido */ }
            }
            if (derived) chatName = derived;
            await pgDatabasePool.query(
              `INSERT INTO public.whatsapp_lid_map (lid, contact_name, profile_pic, description, website, profile_checked)
               VALUES ($1, $2, $3, $4, $5, true)
               ON CONFLICT (lid) DO UPDATE SET
                 contact_name = COALESCE(NULLIF(public.whatsapp_lid_map.contact_name, ''), EXCLUDED.contact_name),
                 profile_pic = COALESCE(EXCLUDED.profile_pic, public.whatsapp_lid_map.profile_pic),
                 description = COALESCE(EXCLUDED.description, public.whatsapp_lid_map.description),
                 website = COALESCE(EXCLUDED.website, public.whatsapp_lid_map.website),
                 profile_checked = true,
                 updated_at = now()`,
              [remoteJid, derived || null, prof?.picture || null, desc || null, site || null]
            ).catch(() => {});
            lidMap.set(remoteJid, { ...(knownEntry || {}), name: derived || knownEntry?.name || null, checked: true });
          }
        } catch (e) { /* perfil indisponível: segue sem nome */ }
      }
      // Descobriu agora -> memoriza para os outros chips/conversas.
      if (!isGroup && phone && remoteJid.includes("@lid")) {
        await rememberLid(remoteJid, phone, chatName);
      }


      // 2. Fetch last 15 messages for each of the top chats
      try {
        const msgsResponse = await fetch(`${baseUrl}/chat/findMessages/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: remoteJid
              }
            },
            // Janela maior: em contatos LID o telefone real (key.remoteJidAlt) e o
            // nome (pushName) podem estar em qualquer mensagem, nao so nas ultimas.
            limit: 60
          })
        });

        if (!msgsResponse.ok) {
          console.warn(`[sync-evolution] Failed to fetch messages for chat ${remoteJid}: HTTP ${msgsResponse.status}`);
          continue;
        }

        const msgsData = await msgsResponse.json();
        // Evolution v2: findMessages devolve { messages: { records: [...] } }.
        // O acesso antigo (msgsData?.messages) pegava o OBJETO paginado, não o
        // array, e o `if (!Array.isArray) continue` pulava tudo (0 inseridas).
        const messages = Array.isArray(msgsData)
          ? msgsData
          : Array.isArray(msgsData?.messages?.records)
            ? msgsData.messages.records
            : Array.isArray(msgsData?.records)
              ? msgsData.records
              : Array.isArray(msgsData?.messages)
                ? msgsData.messages
                : [];

        // Telefone e nome REAIS vêm das mensagens: em contatos LID o número
        // aparece em key.remoteJidAlt e o nome (pushName que a pessoa configurou
        // no WhatsApp dela) nas mensagens recebidas. O objeto do chat costuma vir
        // sem esses dados, e era por isso que a lista mostrava o LID cru e sem nome.
        for (const m of messages) {
          if (!phone) {
            // O telefone aparece em campos diferentes conforme o tipo de mensagem
            // e a versao da Evolution; tenta todos os conhecidos.
            const candidates = [
              m?.key?.remoteJidAlt,
              m?.key?.participantAlt,
              m?.key?.senderPn,
              m?.participant,
              m?.key?.participant,
              m?.contextInfo?.participant,
            ];
            for (const c of candidates) {
              const v = String(c || "");
              if (v.includes("@s.whatsapp.net")) { phone = v.split("@")[0]; break; }
            }
          }
          if (!chatName && m?.key?.fromMe === false) {
            const nm = String(m?.pushName || "").trim();
            if (nm && !/^(você|voce)$/i.test(nm) && !/^\+?\d[\d\s\-()]*$/.test(nm)) chatName = nm;
          }
          if (phone && chatName) break;
        }

        // Fallbacks: catálogo de contatos e o próprio objeto do chat.
        if (!phone && !isGroup) phone = phoneByLid.get(jidDigits) || "";
        if (!phone) phone = remoteJid.includes("@s.whatsapp.net") ? remoteJid.split("@")[0] : remoteJid;
        if (!chatName) {
          const cands = [
            String(chat.pushName || "").trim(),
            String(chat.name || "").trim(),
            contactNameByKey.get(jidDigits),
            contactNameByKey.get(String(phone).replace(/\D/g, "")),
          ];
          chatName = cands.find(
            (n) => n && !/^(você|voce)$/i.test(n) && !/^\+?\d[\d\s\-()]*$/.test(n)
          ) || "";
        }
        // Telefone descoberto nas mensagens -> memoriza o vínculo do LID.
        if (phone && remoteJid.includes("@lid")) {
          await rememberLid(remoteJid, phone, chatName);
        }
        if (!phone) continue;

        // Sem mensagens não há o que inserir, mas o chat já foi resolvido acima
        // (telefone/nome do objeto do chat) — não descarta a conversa por isso.
        if (!Array.isArray(messages)) continue;

        // Resolve lead details once per chat
        const leadRes = await pgDatabasePool.query(
          `
            SELECT id, source_campaign_id 
            FROM public.leads 
            WHERE client_id = $1 AND (telefone = $2 OR telefone = $3 OR telefone = $4)
            ORDER BY created_at DESC 
            LIMIT 1
          `,
          [
            clientId,
            phone,
            phone.replace(/^55/, ""),
            phone.startsWith("55") ? phone : `55${phone}`
          ]
        );
        const leadId = leadRes.rows[0]?.id || null;
        const campaignId = leadRes.rows[0]?.source_campaign_id || null;

        for (const msg of messages) {
          const fromMe = msg.key?.fromMe === true;
          const messageText = 
            msg.message?.conversation || 
            msg.message?.extendedTextMessage?.text || 
            msg.messageText || 
            "";

          if (!messageText) continue;

          const timestamp = msg.messageTimestamp 
            ? new Date(msg.messageTimestamp * 1000) 
            : new Date();

          // Check if message already exists
          const checkRes = await pgDatabasePool.query(
            `
              SELECT id 
              FROM public.lead_messages
              WHERE client_id = $1 AND phone = $2 AND message_text = $3
                AND created_at >= $4 AND created_at <= $5
              LIMIT 1
            `,
            [
              clientId,
              phone,
              messageText,
              new Date(timestamp.getTime() - 5000),
              new Date(timestamp.getTime() + 5000)
            ]
          );

          if (checkRes.rows.length === 0) {
            await pgDatabasePool.query(
              `
                INSERT INTO public.lead_messages 
                  (client_id, lead_id, campaign_id, phone, sender_type, direction, message_text, created_at, delivered_at, meta, instance_name, contact_name, is_group)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              `,
              [
                clientId,
                leadId,
                campaignId,
                phone,
                fromMe ? "user" : "lead",
                fromMe ? "outbound" : "inbound",
                messageText,
                timestamp,
                timestamp,
                JSON.stringify({}),
                instanceName,
                chatName || null,
                isGroup
              ]
            );
            insertedMessages++;
          }
        }
        syncedChats++;
      } catch (chatErr) {
        console.error(`[sync-evolution] Error syncing messages for chat ${remoteJid}:`, chatErr.message || chatErr);
      }
    }
    console.info(`[sync-evolution] Instance ${instanceName}: ${syncedChats} conversas processadas, ${insertedMessages} mensagens novas.`);
    return { instanceName, chats: chats.length, synced: syncedChats, messages: insertedMessages, error: null };
  } catch (err) {
    console.error(`[sync-evolution] Background sync error:`, err.message || err);
    return { instanceName: null, chats: 0, synced: 0, messages: 0, error: err?.message || "erro no sync" };
  }
}

export async function configureEvolutionInstanceWebhook(clientId, dispatchWebhookUrl, dispatchWebhookToken, enabled) {
  if (!dispatchWebhookUrl) {
    throw new Error("INVALID_DISPATCH_WEBHOOK_URL");
  }

  const urlObj = new URL(dispatchWebhookUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const parts = urlObj.pathname.split("/");
  const instanceName = parts[parts.length - 1];

  if (!instanceName) {
    throw new Error("COULD_NOT_PARSE_INSTANCE_NAME");
  }

  const apiKey = dispatchWebhookToken || getEvolutionAdminConfig().apiKey;

  const base =
    process.env.WEBHOOK_BASE_URL ||
    process.env.FRONTEND_ORIGIN?.replace(/\/$/, "") ||
    "";
  
  if (!base) {
    throw new Error("WEBHOOK_BASE_URL_UNDEFINED");
  }

  // instanceName vai na URL: assim o backend sabe QUAL chip recebeu a mensagem
  // sem depender do campo "instance" vir dentro do payload da Evolution. Quando
  // ele nao vinha, o nome do chip ficava vazio e o agente inbound acabava
  // respondendo por qualquer numero.
  const webhookUrl =
    `${base}/api/hardcoded-chat-webhook` +
    `?clientId=${encodeURIComponent(clientId)}` +
    `&instanceName=${encodeURIComponent(instanceName)}`;

  // Evolution API v2 exige o payload ANINHADO em { webhook: {...} } e usa
  // webhookByEvents (não byEvents). No formato antigo (plano) a v2 responde
  // HTTP 400: instance requires property "webhook".
  const payload = {
    webhook: {
      enabled: Boolean(enabled),
      url: webhookUrl,
      webhookByEvents: false,
      events: enabled ? ["MESSAGES_UPSERT", "SEND_MESSAGE"] : [],
    },
  };

  const response = await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Evolution Webhook set returned HTTP ${response.status}: ${text}`);
  }

  // Trigger background sync of chats/messages when webhook is enabled
  if (enabled) {
    syncEvolutionInstanceChatsAndMessages(clientId, dispatchWebhookUrl, dispatchWebhookToken).catch((err) => {
      console.error(`[sync-evolution] Background sync initiation failed:`, err.message);
    });
  }

  return true;
}

export async function upsertLeadClientEvolutionInstance(clientId, input, authAccess, existing = null) {
  if (!(await ensureLeadClientEvolutionInstancesTable())) {
    throw new Error("EVOLUTION_INSTANCES_UNAVAILABLE");
  }

  const body = input && typeof input === "object" ? input : {};
  const name = normalizeString(body.name) || existing?.name || "Evolution";
  const rawUrl = Object.prototype.hasOwnProperty.call(body, "dispatchWebhookUrl")
    ? body.dispatchWebhookUrl
    : existing?.dispatch_webhook_url;
  const dispatchWebhookUrl = normalizeHttpUrl(rawUrl);

  if (!dispatchWebhookUrl) {
    throw new Error("INVALID_DISPATCH_WEBHOOK_URL");
  }

  const dispatchTokenInput = normalizeString(body.dispatchWebhookToken);
  const inboundTokenInput = normalizeString(body.inboundBearerToken);
  const isDefault = body.isDefault === true || existing?.is_default === true;
  const active = Object.prototype.hasOwnProperty.call(body, "active")
    ? body.active !== false
    : existing?.active !== false;
  const chipState = Object.prototype.hasOwnProperty.call(body, "chipState")
    ? normalizeString(body.chipState) === "warm" ? "warm" : "cold"
    : existing?.chip_state === "warm" ? "warm" : "cold";
  const connectionState = Object.prototype.hasOwnProperty.call(body, "connectionState")
    ? normalizeString(body.connectionState) || "unknown"
    : existing?.connection_state || "unknown";
  const rawLimit = Object.prototype.hasOwnProperty.call(body, "dailyLimitOverride")
    ? body.dailyLimitOverride
    : existing?.daily_limit_override ?? null;
  const dailyLimitOverride =
    rawLimit == null ? null : Number.isInteger(Number(rawLimit)) && Number(rawLimit) > 0 ? Number(rawLimit) : null;

  const webhookEnabled = Object.prototype.hasOwnProperty.call(body, "webhookEnabled")
    ? body.webhookEnabled === true
    : existing?.webhook_enabled === true;

  const payload = {
    client_id: clientId,
    name,
    dispatch_webhook_url: dispatchWebhookUrl,
    chip_state: chipState,
    connection_state: connectionState,
    daily_limit_override: dailyLimitOverride,
    dispatch_webhook_token:
      Object.prototype.hasOwnProperty.call(body, "dispatchWebhookToken")
        ? body.dispatchWebhookToken === null
          ? null
          : isMaskedSecretPlaceholder(dispatchTokenInput)
            ? existing?.dispatch_webhook_token || null
            : dispatchTokenInput || existing?.dispatch_webhook_token || null
        : existing?.dispatch_webhook_token || null,
    inbound_bearer_token:
      Object.prototype.hasOwnProperty.call(body, "inboundBearerToken")
        ? body.inboundBearerToken === null
          ? null
          : isMaskedSecretPlaceholder(inboundTokenInput)
            ? existing?.inbound_bearer_token || null
            : inboundTokenInput || existing?.inbound_bearer_token || null
        : existing?.inbound_bearer_token || null,
    active,
    is_default: isDefault,
    webhook_enabled: webhookEnabled,
    updated_by_uid: authAccess?.uid || null,
    updated_by_email: authAccess?.email || null,
  };

  const client = await pgDatabasePool.connect();
  try {
    await client.query("BEGIN");

    if (payload.is_default) {
      await client.query(
        `UPDATE public.lead_client_evolution_instances SET is_default = false, updated_at = now() WHERE client_id = $1`,
        [clientId]
      );
    }

    let result;
    if (existing?.id) {
      result = await client.query(
        `
          UPDATE public.lead_client_evolution_instances
          SET name = $1,
              dispatch_webhook_url = $2,
              dispatch_webhook_token = $3,
              inbound_bearer_token = $4,
              active = $5,
              is_default = $6,
              chip_state = $7,
              daily_limit_override = $8,
              webhook_enabled = $9,
              updated_at = now(),
              updated_by_uid = $10,
              updated_by_email = $11,
              connection_state = $12
          WHERE id = $13 AND client_id = $14
          RETURNING id, client_id, name, dispatch_webhook_url, dispatch_webhook_token,
                    inbound_bearer_token, active, is_default, chip_state, connection_state, daily_limit_override,
                    webhook_enabled,
                    created_at, updated_at, updated_by_email
        `,
        [
          payload.name,
          payload.dispatch_webhook_url,
          payload.dispatch_webhook_token,
          payload.inbound_bearer_token,
          payload.active,
          payload.is_default,
          payload.chip_state,
          payload.daily_limit_override,
          payload.webhook_enabled,
          payload.updated_by_uid,
          payload.updated_by_email,
          payload.connection_state,
          existing.id,
          clientId,
        ]
      );
    } else {
      const existingInstances = await client.query(
        `SELECT 1 FROM public.lead_client_evolution_instances WHERE client_id = $1 LIMIT 1`,
        [clientId]
      );
      const shouldDefault = payload.is_default || existingInstances.rowCount === 0;

      if (shouldDefault && !payload.is_default) {
        await client.query(
          `UPDATE public.lead_client_evolution_instances SET is_default = false, updated_at = now() WHERE client_id = $1`,
          [clientId]
        );
      }

      result = await client.query(
        `
          INSERT INTO public.lead_client_evolution_instances
            (client_id, name, dispatch_webhook_url, dispatch_webhook_token, inbound_bearer_token,
             active, is_default, chip_state, connection_state, daily_limit_override, webhook_enabled, updated_by_uid, updated_by_email)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id, client_id, name, dispatch_webhook_url, dispatch_webhook_token,
                    inbound_bearer_token, active, is_default, chip_state, connection_state, daily_limit_override,
                    webhook_enabled,
                    created_at, updated_at, updated_by_email
        `,
        [
          clientId,
          payload.name,
          payload.dispatch_webhook_url,
          payload.dispatch_webhook_token,
          payload.inbound_bearer_token,
          payload.active,
          shouldDefault,
          payload.chip_state,
          payload.connection_state,
          payload.daily_limit_override,
          payload.webhook_enabled,
          payload.updated_by_uid,
          payload.updated_by_email,
        ]
      );
    }

    await client.query("COMMIT");

    // Configure the webhook remotely on Evolution API.
    // A assinatura é (clientId, dispatchWebhookUrl, dispatchWebhookToken, enabled) e a
    // função deriva o instanceName da própria URL. A chamada anterior passava
    // (clientId, instanceName, webhookEnabled) — argumentos trocados: o nome da
    // instância caía no lugar da URL e `new URL("<nome>")` estourava "Invalid URL".
    if (result.rows[0]?.dispatch_webhook_url) {
      const parts = result.rows[0].dispatch_webhook_url.split("/");
      const instanceName = parts[parts.length - 1];
      if (instanceName) {
        // Antes era fire-and-forget com catch que so logava: quando o webhook
        // nao era configurado (ex.: WEBHOOK_BASE_URL ausente), a tela dizia que
        // salvou e o numero ficava sem receber mensagem, sem nenhum aviso.
        // O salvamento do chip continua valendo — o erro vai junto na resposta.
        try {
          await configureEvolutionInstanceWebhook(
            clientId,
            result.rows[0].dispatch_webhook_url,
            result.rows[0].dispatch_webhook_token,
            result.rows[0].webhook_enabled
          );
          result.rows[0].webhook_error = null;
        } catch (err) {
          const message = err?.message || String(err);
          console.error(`[evolution-webhook] Failed to configure remote webhook for ${instanceName}:`, message);
          result.rows[0].webhook_error =
            message === "WEBHOOK_BASE_URL_UNDEFINED"
              ? "WEBHOOK_BASE_URL nao esta configurada no servidor: o numero nao vai receber mensagens."
              : `Nao foi possivel configurar o webhook na Evolution: ${message}`;
        }
      }
    }

    return result.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function getEvolutionAdminConfig() {
  const baseUrl = (
    normalizeString(process.env.EVOLUTION_API_URL) ||
    normalizeString(process.env.EVOLUTION_API_ENDPOINT) ||
    "https://vexo-evolution-api.xdvm8y.easypanel.host"
  ).replace(/\/+$/, "");

  const apiKey =
    normalizeString(process.env.EVOLUTION_API_KEY) ||
    normalizeString(process.env.EVOLUTION_GLOBAL_KEY) ||
    "429683C4C977415CAAFCCE10F7D57E11";

  return {
    baseUrl,
    apiKey,
    configured: Boolean(baseUrl && apiKey),
  };
}

export function buildEvolutionManagedInstanceName(clientId, inputName) {
  const source = normalizeString(inputName) || clientId || "vexo";
  const normalized = normalizeTenantKey(source) || normalizeTenantKey(clientId) || `vexo-${randomUUID().slice(0, 8)}`;
  const withClientPrefix = normalized.startsWith(`${clientId}-`) ? normalized : `${clientId}-${normalized}`;
  return withClientPrefix.slice(0, 64).replace(/-+$/g, "");
}

export function buildEvolutionDispatchWebhookUrl(baseUrl, instanceName) {
  return `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
}

export function maskEvolutionProvisionResponse(data) {
  if (!data || typeof data !== "object") return null;

  const instance = data.instance && typeof data.instance === "object" ? data.instance : {};
  const qrcode = data.qrcode && typeof data.qrcode === "object" ? data.qrcode : null;

  return {
    instanceName:
      normalizeString(data.instanceName) ||
      normalizeString(data.instance?.instanceName) ||
      normalizeString(instance.instanceName) ||
      null,
    status: normalizeString(data.status) || normalizeString(instance.status) || null,
    qrcode: qrcode
      ? {
          code: normalizeString(qrcode.code) || null,
          base64: normalizeString(qrcode.base64) || null,
        }
      : null,
  };
}

export async function provisionLeadClientEvolutionInstance(clientId, input, authAccess) {
  const config = getEvolutionAdminConfig();
  if (!config.configured) {
    const error = new Error("EVOLUTION_ADMIN_UNCONFIGURED");
    error.statusCode = 503;
    throw error;
  }

  const body = input && typeof input === "object" ? input : {};
  const displayName = normalizeString(body.name) || "Evolution";
  const instanceName = buildEvolutionManagedInstanceName(clientId, body.instanceName || displayName);
  const instanceToken =
    normalizeString(body.dispatchWebhookToken) ||
    `vexo_${randomUUID().replace(/-/g, "")}`;
  const createPayload = {
    instanceName,
    integration: normalizeString(body.integration) || "WHATSAPP-BAILEYS",
    token: instanceToken,
    qrcode: body.qrcode !== false,
  };

  const response = await fetch(`${config.baseUrl}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey,
    },
    body: JSON.stringify(createPayload),
  });

  let responsePayload = null;
  const responseText = await response.text();
  if (responseText) {
    try {
      responsePayload = JSON.parse(responseText);
    } catch {
      responsePayload = { message: responseText.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const errorMsg =
      normalizeString(responsePayload?.message) ||
      normalizeString(responsePayload?.error) ||
      (Array.isArray(responsePayload?.response?.message) ? responsePayload.response.message.join(", ") : "");

    // Tentar fallback para /instance/connect se a instância já existir ou estiver criada
    try {
      const connectResponse = await fetch(`${config.baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
        method: "GET",
        headers: {
          apikey: config.apiKey,
        },
      });
      if (connectResponse.ok) {
        const connectText = await connectResponse.text();
        if (connectText) {
          const connectPayload = JSON.parse(connectText);
          if (connectPayload && (connectPayload.code || connectPayload.base64 || connectPayload.instance || connectPayload.count != null)) {
            responsePayload = {
              instance: { instanceName, status: connectPayload.status || "connecting" },
              qrcode: connectPayload.base64 || connectPayload.code ? { code: connectPayload.code, base64: connectPayload.base64 } : connectPayload.qrcode || null,
            };
          }
        }
      }
    } catch (fallbackErr) {
      console.warn(`[evolution] Fallback /instance/connect for ${instanceName} failed:`, fallbackErr.message);
    }

    if (!responsePayload || (!responsePayload.qrcode && !responsePayload.instance && !responsePayload.instanceName)) {
      const error = new Error(
        errorMsg || `Evolution API HTTP ${response.status}`
      );
      error.statusCode = response.status;
      error.code = "EVOLUTION_INSTANCE_PROVISION_FAILED";
      throw error;
    }
  }

  const saved = await upsertLeadClientEvolutionInstance(
    clientId,
    {
      name: displayName,
      dispatchWebhookUrl: buildEvolutionDispatchWebhookUrl(config.baseUrl, instanceName),
      dispatchWebhookToken: instanceToken,
      active: body.active !== false,
      isDefault: body.isDefault === true,
      webhookEnabled: body.webhookEnabled !== false,
    },
    authAccess,
    null
  );

  return {
    instance: saved,
    evolution: {
      ...maskEvolutionProvisionResponse(responsePayload),
      instanceName,
    },
  };
}

export async function deleteLeadClientEvolutionInstance(clientId, instanceId) {
  if (!(await ensureLeadClientEvolutionInstancesTable())) return null;

  const client = await pgDatabasePool.connect();
  try {
    const instanceRes = await client.query(
      `SELECT dispatch_webhook_url, name FROM public.lead_client_evolution_instances WHERE id = $1 AND client_id = $2`,
      [instanceId, clientId]
    );
    const instanceRow = instanceRes.rows[0];

    await client.query("BEGIN");
    const removed = await client.query(
      `
        DELETE FROM public.lead_client_evolution_instances
        WHERE id = $1 AND client_id = $2
        RETURNING id, client_id, is_default
      `,
      [instanceId, clientId]
    );

    if (removed.rows[0]?.is_default) {
      await client.query(
        `
          UPDATE public.lead_client_evolution_instances
          SET is_default = true, updated_at = now()
          WHERE id = (
            SELECT id
            FROM public.lead_client_evolution_instances
            WHERE client_id = $1 AND active = true
            ORDER BY created_at ASC
            LIMIT 1
          )
        `,
        [clientId]
      );
    }

    await client.query("COMMIT");

    if (instanceRow?.dispatch_webhook_url) {
      const parts = instanceRow.dispatch_webhook_url.split("/");
      const instanceName = parts[parts.length - 1];
      if (instanceName) {
        const config = getEvolutionAdminConfig();
        if (config.configured) {
          try {
            const response = await fetch(`${config.baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
              method: "DELETE",
              headers: {
                apikey: config.apiKey,
              },
            });
            if (!response.ok) {
              console.warn(`[database] Evolution API returned HTTP ${response.status} when deleting instance ${instanceName}`);
            } else {
              console.info(`[database] Evolution API successfully deleted instance ${instanceName}`);
            }
          } catch (apiErr) {
            console.error(`[database] Failed to delete Evolution instance ${instanceName} on API:`, apiErr?.message || apiErr);
          }
        }
      }
    }

    return removed.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function parseEvolutionWebhookEndpoint(webhookUrl) {
  const rawUrl = normalizeString(webhookUrl);
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const messageIndex = pathParts.findIndex((part) => part === "message");
    const action = messageIndex >= 0 ? pathParts[messageIndex + 1] : null;
    const instance = messageIndex >= 0 ? decodeURIComponent(pathParts[messageIndex + 2] || "") : "";

    if (!url.origin || !instance || !action) {
      return null;
    }

    return {
      origin: url.origin,
      path: url.pathname,
      action,
      instance,
      healthUrl: `${url.origin}/instance/connectionState/${encodeURIComponent(instance)}`,
    };
  } catch {
    return null;
  }
}

export function getSafeEvolutionEndpointLog(webhookUrl) {
  const endpoint = parseEvolutionWebhookEndpoint(webhookUrl);
  if (!endpoint) {
    return {
      endpointOrigin: null,
      endpointPath: null,
      endpointAction: null,
      instance: null,
    };
  }

  return {
    endpointOrigin: endpoint.origin,
    endpointPath: endpoint.path,
    endpointAction: endpoint.action,
    instance: endpoint.instance,
  };
}

export function buildEvolutionAuthHeaders(token) {
  const headers = { Accept: "application/json" };
  const normalizedToken = normalizeString(token);
  if (normalizedToken) {
    headers.apikey = normalizedToken;
    headers.Authorization = `Bearer ${normalizedToken}`;
  }
  return headers;
}

export function extractEvolutionConnectionState(payload) {
  if (!payload || typeof payload !== "object") return null;

  const candidates = [
    payload.instance?.state,
    payload.instance?.connectionStatus,
    payload.instance?.status,
    payload.state,
    payload.status,
    payload.connectionStatus,
    payload.response?.instance?.state,
    payload.response?.state,
    payload.response?.status,
    payload.response?.connectionStatus,
  ];

  return candidates.map((value) => {
    const normalized = normalizeString(value);
    return normalized ? normalized.toLowerCase() : null;
  }).find(Boolean) || null;
}

export function isEvolutionOpenState(state) {
  return ["open", "connected", "online"].includes(normalizeString(state).toLowerCase());
}

export async function checkEvolutionInstanceHealth({ webhookUrl, webhookToken, context = {} }) {
  const endpoint = parseEvolutionWebhookEndpoint(webhookUrl);
  if (!endpoint) {
    logCampaignDispatch("warn", "health_check_skipped_invalid_endpoint", {
      ...context,
      ...getSafeEvolutionEndpointLog(webhookUrl),
    });
    const error = new Error(
      "URL Evolution invalida. Configure no formato https://host/message/sendText/NOME_DA_INSTANCIA."
    );
    error.statusCode = 400;
    error.code = "EVOLUTION_ENDPOINT_INVALID";
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint.healthUrl, {
      method: "GET",
      headers: buildEvolutionAuthHeaders(webhookToken),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }
    const state = extractEvolutionConnectionState(payload);

    logCampaignDispatch(response.ok ? "info" : "warn", "evolution_health_checked", {
      ...context,
      ...getSafeEvolutionEndpointLog(webhookUrl),
      status: response.status,
      state: state || "unknown",
    });

    if (!response.ok) {
      const error = new Error(
        responseText
          ? `Falha ao verificar instancia Evolution: HTTP ${response.status}: ${responseText.slice(0, 300)}`
          : `Falha ao verificar instancia Evolution: HTTP ${response.status}`
      );
      error.statusCode = 502;
      error.code = "EVOLUTION_HEALTH_CHECK_FAILED";
      throw error;
    }

    // Some Evolution builds return a very small response body. Do not block a configured instance
    // just because the state field is not present, but do block explicit closed states.
    if (state && !isEvolutionOpenState(state)) {
      const error = new Error(`Instancia Evolution "${endpoint.instance}" nao esta conectada (${state}).`);
      error.statusCode = 409;
      error.code = "EVOLUTION_INSTANCE_NOT_OPEN";
      throw error;
    }

    return { checked: true, state: state || "unknown" };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Timeout ao verificar conexao da instancia Evolution.");
      timeoutError.statusCode = 504;
      timeoutError.code = "EVOLUTION_HEALTH_CHECK_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
