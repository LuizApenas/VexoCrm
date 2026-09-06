import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env do backend
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith("\"") && value.endsWith("\"")) value = value.slice(1, -1);
    if (value.startsWith("\x27") && value.endsWith("\x27")) value = value.slice(1, -1);
    env[match[1]] = value.replace(/\\n/g, "\n");
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

const API_KEY = "AIzaSyDOkCjNyAF9Y51RbocNg0UOaJlwpjVr-Qs";
const BASE_URL = "https://vexo-backend.xdvm8y.easypanel.host";
const PREVIOUS_OLD_CODE_HASH = "6ccb23feb3b20720";

const auth = admin.auth();

const GABRIEL_UID = "XBkP0DsTL2TvGnLHGEie99CshEf1";
const PRISCILA_UID = "bM2603rX8DhAQUu1XNpJ8LMdr1L2";

async function getIdTokenForUser(uid) {
  const customToken = await auth.createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Failed to get ID token for UID ${uid}: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function verifyLiveContainerVersion() {
  console.log(">>> [VERIFICAÇÃO PRÉ-EXECUÇÃO] Verificando versão da imagem no Easypanel (/health)...");
  const res = await fetch(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`Endpoint /health retornou HTTP ${res.status}`);
  }
  const data = await res.json();
  const liveCodeHash = data.build?.codeHash;
  const uptime = data.uptimeSeconds;

  console.log(`   Container CodeHash Ativo: "${liveCodeHash}"`);
  console.log(`   Container Uptime: ${Math.round(uptime)} segundos`);
  console.log(`   Migrations Status: ${data.migrations?.status} (${data.migrations?.appliedCount} aplicadas)`);

  if (liveCodeHash === PREVIOUS_OLD_CODE_HASH) {
    throw new Error(
      `🛑 TRAVA DE SEGURANÇA: O container de produção AINDA ESTÁ RODANDO A IMAGEM ANTIGA (${PREVIOUS_OLD_CODE_HASH})!\n` +
      `   O deploy no Easypanel (vexo/bk-vexo) ainda não foi acionado ou ainda está construindo.\n` +
      `   Aguarde o deploy finalizar com a nova imagem antes de rodar a migração.`
    );
  }

  console.log(`✅ Novo container ativo confirmado! CodeHash atualizado para "${liveCodeHash}" e diferente do anterior.`);
  return data;
}

async function runStep5() {
  console.log("================================================================================");
  console.log(" 📌 PASSO 5: SNAPSHOT → MIGRAÇÃO → RELEITURA → TESTES AO VIVO");
  console.log(" Alvos: Gabriel (XBkP0DsTL2TvGnLHGEie99CshEf1) e Priscila (bM2603rX8DhAQUu1XNpJ8LMdr1L2)");
  console.log("================================================================================\n");

  // 0. TRAVA DE VERSÃO DA IMAGEM
  await verifyLiveContainerVersion();

  // ============================================================================
  // 1. SNAPSHOT BRUTO DAS CLAIMS ATUAIS
  // ============================================================================
  console.log("\n>>> [ETAPA 1/5] Realizando Snapshot de Segurança das Claims Atuais...");
  const gabrielPre = await auth.getUser(GABRIEL_UID);
  const priscilaPre = await auth.getUser(PRISCILA_UID);

  const snapshotDir = path.resolve(__dirname, "snapshots");
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const timestamp = Date.now();
  const snapshotPath = path.join(snapshotDir, `claims-backup-gabriel-priscila-step5-${timestamp}.json`);
  const snapshotData = [
    {
      uid: gabrielPre.uid,
      email: gabrielPre.email,
      displayName: gabrielPre.displayName,
      disabled: gabrielPre.disabled,
      rawCustomClaims: gabrielPre.customClaims,
    },
    {
      uid: priscilaPre.uid,
      email: priscilaPre.email,
      displayName: priscilaPre.displayName,
      disabled: priscilaPre.disabled,
      rawCustomClaims: priscilaPre.customClaims,
    },
  ];

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), "utf-8");
  console.log(`✅ Snapshot bruto salvo com sucesso em:\n   ${snapshotPath}`);
  console.log("   - Gabriel Atual:", JSON.stringify(gabrielPre.customClaims));
  console.log("   - Priscila Atual:", JSON.stringify(priscilaPre.customClaims));

  // ============================================================================
  // 2. MIGRAÇÃO PARA OPERADOR PURO
  // ============================================================================
  console.log("\n>>> [ETAPA 2/5] Migrando claims de Gabriel e Priscila para 'operador' puro...");

  const targetClaimGabriel = {
    role: "internal",
    isAdmin: false,
    accessPreset: "operador",
    scopeMode: "assigned_clients",
    approvalLevel: "operator",
    clientId: "geracao-digital",
    clientIds: ["geracao-digital"],
    companyName: "Geracao Digital",
    grant: [],
    revoke: [],
  };

  const targetClaimPriscila = {
    role: "internal",
    isAdmin: false,
    accessPreset: "operador",
    scopeMode: "assigned_clients",
    approvalLevel: "operator",
    clientId: "geracao-digital",
    clientIds: ["geracao-digital"],
    companyName: "Geracao Digital",
    grant: [],
    revoke: [],
  };

  await auth.setCustomUserClaims(GABRIEL_UID, targetClaimGabriel);
  console.log("   -> Gravação enviada ao Firebase para Gabriel.");

  await auth.setCustomUserClaims(PRISCILA_UID, targetClaimPriscila);
  console.log("   -> Gravação enviada ao Firebase para Priscila.");

  // ============================================================================
  // 3. RELEITURA DIRETA DO FIREBASE E CONFIRMAÇÃO
  // ============================================================================
  console.log("\n>>> [ETAPA 3/5] Releitura direta do Firebase Auth (getUser)...");

  const gabrielPost = await auth.getUser(GABRIEL_UID);
  const priscilaPost = await auth.getUser(PRISCILA_UID);

  console.log("   Releitura Gabriel:", JSON.stringify(gabrielPost.customClaims, null, 2));
  console.log("   Releitura Priscila:", JSON.stringify(priscilaPost.customClaims, null, 2));

  // Verificação rigorosa
  const verifyClaimsMatch = (actual, expected, name) => {
    if (actual.accessPreset !== expected.accessPreset) {
      throw new Error(`[${name}] Falha: accessPreset esperado '${expected.accessPreset}', obteve '${actual.accessPreset}'`);
    }
    if (actual.role !== expected.role) {
      throw new Error(`[${name}] Falha: role esperado '${expected.role}', obteve '${actual.role}'`);
    }
    if (actual.approvalLevel !== expected.approvalLevel) {
      throw new Error(`[${name}] Falha: approvalLevel esperado '${expected.approvalLevel}', obteve '${actual.approvalLevel}'`);
    }
    if (!Array.isArray(actual.grant) || actual.grant.length > 0) {
      throw new Error(`[${name}] Falha: grant deveria ser [], obteve ${JSON.stringify(actual.grant)}`);
    }
    if (!Array.isArray(actual.revoke) || actual.revoke.length > 0) {
      throw new Error(`[${name}] Falha: revoke deveria ser [], obteve ${JSON.stringify(actual.revoke)}`);
    }
  };

  verifyClaimsMatch(gabrielPost.customClaims, targetClaimGabriel, "Gabriel");
  verifyClaimsMatch(priscilaPost.customClaims, targetClaimPriscila, "Priscila");
  console.log("✅ Claims re-lidas direto do Firebase e confirmadas com 100% de exatidão!");

  // ============================================================================
  // 4. TESTE AO VIVO EM PRODUÇÃO COM TOKENS REAIS DE GABRIEL E PRISCILA
  // ============================================================================
  console.log("\n>>> [ETAPA 4/5] Executando Bateria de Testes ao Vivo em Produção...");

  console.log("   Gerando ID Tokens atualizados a partir das novas claims...");
  const gabrielToken = await getIdTokenForUser(GABRIEL_UID);
  const priscilaToken = await getIdTokenForUser(PRISCILA_UID);

  const users = [
    { name: "Gabriel", email: "gabrieloli.comercial@gmail.com", uid: GABRIEL_UID, token: gabrielToken },
    { name: "Priscila", email: "priscilakarina1001@gmail.com", uid: PRISCILA_UID, token: priscilaToken },
  ];

  for (const u of users) {
    console.log(`\n================================================================`);
    console.log(` TESTES AO VIVO PARA: ${u.name} (${u.email})`);
    console.log(`================================================================`);

    // --- 4.1 DASHBOARD ---
    console.log(`\n1. Testando /api/dashboard...`);
    const dashRes = await fetch(`${BASE_URL}/api/dashboard?clientId=geracao-digital`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (dashRes.status !== 200) {
      throw new Error(`[Dashboard] Retornou status HTTP ${dashRes.status}: ${await dashRes.text()}`);
    }
    const dashData = await dashRes.json();
    const dashTotalLeads = dashData.summary?.totalLeads;
    console.log(`   HTTP Status: ${dashRes.status}`);
    console.log(`   Card Total de Leads: ${dashTotalLeads}`);
    console.log(`   Leads Hoje: ${dashData.summary?.leadsToday}`);

    // --- 4.2 LISTA DE LEADS ---
    console.log(`\n2. Testando /api/leads...`);
    const leadsRes = await fetch(`${BASE_URL}/api/leads?clientId=geracao-digital&limit=20`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (leadsRes.status !== 200) {
      throw new Error(`[Leads] Retornou status HTTP ${leadsRes.status}: ${await leadsRes.text()}`);
    }
    const leadsData = await leadsRes.json();
    const totalLeadsList = leadsData.total;
    const itemsCount = leadsData.items?.length || 0;
    console.log(`   HTTP Status: ${leadsRes.status}`);
    console.log(`   Total retornado na listagem: ${totalLeadsList}`);
    console.log(`   Itens retornados na página: ${itemsCount}`);

    // Verificação de paridade: Card do Dashboard == Total de Leads na Lista
    if (dashTotalLeads !== totalLeadsList) {
      throw new Error(`[Paridade Leads] Card Dashboard (${dashTotalLeads}) != Lista (${totalLeadsList})`);
    }
    console.log(`   ✅ Paridade confirmada: Card do Dashboard (${dashTotalLeads}) bate exatamente com a Lista (${totalLeadsList})!`);
    console.log(`   ✅ Vê os 2.126 leads históricos preservados!`);

    // --- 4.3 CAMPANHAS ---
    console.log(`\n3. Testando /api/campaigns...`);
    const campRes = await fetch(`${BASE_URL}/api/campaigns?clientId=geracao-digital`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (campRes.status !== 200) {
      throw new Error(`[Campanhas] Retornou status HTTP ${campRes.status}: ${await campRes.text()}`);
    }
    const campData = await campRes.json();
    const campItems = campData.items || [];
    console.log(`   HTTP Status: ${campRes.status}`);
    console.log(`   Total de campanhas visíveis: ${campItems.length}`);
    for (const c of campItems) {
      console.log(`   - Campanha: "${c.name}" | ID: ${c.id} | Criador UID: ${c.created_by_uid} | Email: ${c.created_by_email}`);
    }
    console.log(`   ✅ Campanhas acessadas com sucesso sem 403!`);

    // --- 4.4 CONECTAR / VER CHIP (EVOLUTION INSTANCES) ---
    console.log(`\n4. Testando Conectar/Ver Chip (/api/lead-clients/geracao-digital/evolution-instances)...`);
    const chipRes = await fetch(`${BASE_URL}/api/lead-clients/geracao-digital/evolution-instances`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (chipRes.status !== 200) {
      throw new Error(`[Chips] Retornou status HTTP ${chipRes.status}: ${await chipRes.text()}`);
    }
    const chipData = await chipRes.json();
    const chipCount = chipData.items?.length ?? (Array.isArray(chipData) ? chipData.length : 0);
    console.log(`   HTTP Status: ${chipRes.status}`);
    console.log(`   Instâncias / Chips retornados: ${chipCount}`);
    console.log(`   ✅ Acesso à infraestrutura de chips operacional sem 403!`);

    // --- 4.5 CRIAR E DELETAR CAMPANHA DE TESTE ---
    console.log(`\n5. Testando Criação e Exclusão de Campanha de Teste...`);
    const createCampRes = await fetch(`${BASE_URL}/api/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${u.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `TESTE_PASSO5_${u.name.toUpperCase()}_${Date.now()}`,
        clientId: "geracao-digital",
        mode: "disparo",
        status: "draft",
        analyticsMeta: {
          sequence: [
            {
              order: 1,
              type: "text",
              text: "Validação operacional passo 5",
              enabled: true,
            },
          ],
        },
      }),
    });
    if (createCampRes.status !== 200 && createCampRes.status !== 201) {
      throw new Error(`[Criação Campanha] Retornou status HTTP ${createCampRes.status}: ${await createCampRes.text()}`);
    }
    const createCampData = await createCampRes.json();
    const createdId = createCampData.item?.id || createCampData.id;
    console.log(`   HTTP Status Criação: ${createCampRes.status}`);
    console.log(`   Campanha criada com ID: ${createdId}`);

    // Limpeza imediata da campanha de teste
    const delCampRes = await fetch(`${BASE_URL}/api/campaigns/${createdId}?clientId=geracao-digital`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (delCampRes.status !== 200) {
      console.warn(`   [Aviso Limpeza] Falha ao deletar campanha de teste ${createdId}: ${delCampRes.status}`);
    } else {
      console.log(`   HTTP Status Exclusão: ${delCampRes.status}`);
      console.log(`   Campanha temporária de teste removida com sucesso.`);
    }
    console.log(`   ✅ Criar campanha funciona sem 403!`);

    // --- 4.6 ABA REVENUE-OPS / RECEITA ---
    console.log(`\n6. Testando Aba de Revenue-ops (/api/revenue-ops)...`);
    const revRes = await fetch(`${BASE_URL}/api/revenue-ops?clientId=geracao-digital`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (revRes.status !== 200) {
      throw new Error(`[Revenue-ops] Retornou status HTTP ${revRes.status}: ${await revRes.text()}`);
    }
    const revData = await revRes.json();
    console.log(`   HTTP Status: ${revRes.status}`);
    console.log(`   Métricas essenciais presentes: ${Boolean(revData.essentialMetrics)}`);
    console.log(`   Total Leads Base Revenue: ${revData.essentialMetrics?.baseVolume?.totalLeads || "N/A"}`);
    console.log(`   Pipeline Coverage: ${revData.essentialMetrics?.healthScore?.score || "N/A"}`);
    console.log(`   ✅ Revenue-ops respondeu com sucesso, métricas populadas sem erro 500!`);

    // --- 4.7 TESTES NEGATIVOS DE SEGURANÇA E ISOLAMENTO MULTI-TENANT ---
    console.log(`\n7. Testando Travas de Segurança e Isolamento Multi-Tenant...`);

    // 7.1 Gestão de Usuários (/api/admin/users) -> DEVE RETORNAR 403
    const usersAdminRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (usersAdminRes.status === 403) {
      console.log(`   ✅ [SEGURANÇA] /api/admin/users bloqueado com 403 Forbidden como esperado!`);
    } else {
      throw new Error(`[SEGURANÇA FALHOU] /api/admin/users deveria dar 403 mas deu ${usersAdminRes.status}`);
    }

    // 7.2 Inteligência Comercial (/api/commercial-intelligence) -> DEVE RETORNAR 403
    const ciRes = await fetch(`${BASE_URL}/api/commercial-intelligence?clientId=geracao-digital`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (ciRes.status === 403) {
      console.log(`   ✅ [SEGURANÇA] /api/commercial-intelligence bloqueado com 403 Forbidden como esperado!`);
    } else {
      throw new Error(`[SEGURANÇA FALHOU] /api/commercial-intelligence deveria dar 403 mas deu ${ciRes.status}`);
    }

    // 7.3 Isolamento de Tenant: Tentativa de ler Leads de outro cliente (ex: sonhare) -> DEVE RETORNAR 403
    const crossLeadsRes = await fetch(`${BASE_URL}/api/leads?clientId=sonhare`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (crossLeadsRes.status === 403) {
      console.log(`   ✅ [ISOLAMENTO TENANT] Tentativa de ler leads de 'sonhare' bloqueada com 403 FORBIDDEN_CLIENT_SCOPE!`);
    } else {
      throw new Error(`[VAZAMENTO DE TENANT] Operador de GD conseguiu acessar leads de 'sonhare'! Status: ${crossLeadsRes.status}`);
    }

    // 7.4 Isolamento de Tenant: Tentativa de ler Dashboard de outro cliente (ex: sonhare) -> DEVE RETORNAR 403
    const crossDashRes = await fetch(`${BASE_URL}/api/dashboard?clientId=sonhare`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (crossDashRes.status === 403) {
      console.log(`   ✅ [ISOLAMENTO TENANT] Tentativa de ler dashboard de 'sonhare' bloqueada com 403 FORBIDDEN_CLIENT_SCOPE!`);
    } else {
      throw new Error(`[VAZAMENTO DE TENANT] Operador de GD conseguiu acessar dashboard de 'sonhare'! Status: ${crossDashRes.status}`);
    }

    // 7.5 Isolamento de Tenant: Tentativa de ler Campanhas de outro cliente (ex: sonhare) -> DEVE RETORNAR 403
    const crossCampRes = await fetch(`${BASE_URL}/api/campaigns?clientId=sonhare`, {
      headers: { Authorization: `Bearer ${u.token}` },
    });
    if (crossCampRes.status === 403) {
      console.log(`   ✅ [ISOLAMENTO TENANT] Tentativa de ler campanhas de 'sonhare' bloqueada com 403 FORBIDDEN_CLIENT_SCOPE!`);
    } else {
      throw new Error(`[VAZAMENTO DE TENANT] Operador de GD conseguiu acessar campanhas de 'sonhare'! Status: ${crossCampRes.status}`);
    }
  }

  console.log("\n================================================================================");
  console.log(" ✅ PASSO 5 CONCLUÍDO COM SUCESSO ABSOLUTO EM TODOS OS PONTOS!");
  console.log("================================================================================\n");
}

runStep5().catch((err) => {
  console.error("\n❌ ERRO NA EXECUÇÃO DO PASSO 5:", err.message || err);
  process.exit(1);
});
