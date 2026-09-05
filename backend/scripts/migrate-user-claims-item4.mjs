import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "../node_modules/firebase-admin/lib/index.js";
import {
  ACCESS_PRESET_DEFAULTS,
  extractManagedAccessClaims,
  buildPresetDefaults,
  INTERNAL_PAGE_KEYS,
} from "../src/access/claims.js";
import {
  deriveEffectivePermissions,
  isValidPermissionKey,
} from "../src/access/permissionsRegistry.js";

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

const isApply = process.argv.includes("--apply");

console.log(`\n===============================================================`);
console.log(` MIGRACAO DE CLAIMS DO FIREBASE - ITEM 4`);
console.log(` MODO: ${isApply ? ">>> APLICACAO REAL (ESCRITA NO FIREBASE) <<<" : ">>> DRY-RUN (SOMENTE LEITURA E VALIDACAO) <<<"}`);
console.log(`===============================================================\n`);

// Ordem rigorosa de execução (1 a 10)
const TARGET_ORDER = [
  "tinturariadocarlos@gmail.com",
  "mrkgeracaodigital@gmail.com",
  "comercial@hosterytech.com",
  "conrado.cfl@gmail.com",
  "gabrieloli.comercial@gmail.com",
  "priscilakarina1001@gmail.com",
  "sonhareviagens.udi@gmail.com",
  "raquelborgesaugusto@gmail.com",
  "beatrizsignorelli@outlook.com",
  "conradofl@gmail.com", // #10: master, só é tocado se os 9 anteriores passarem 100%
];

async function migrate() {
  const auth = admin.auth();
  const list = await auth.listUsers(100);

  // Mapeia os usuários ativos correspondentes à lista ordenada
  const userMap = new Map();
  for (const user of list.users) {
    if (!user.email || !TARGET_ORDER.includes(user.email)) continue;
    const claims = user.customClaims || {};
    // Ignora registros pending duplicados se houver (ex.: conradofl@gmail.com pending)
    if (claims.role === "pending") continue;
    userMap.set(user.email, user);
  }

  // 1. Snapshot pré-migração
  const snapshotDir = path.resolve(__dirname, "snapshots");
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const snapshotPath = path.join(snapshotDir, `claims-backup-pre-item4-${Date.now()}.json`);
  const snapshotData = [];

  for (const email of TARGET_ORDER) {
    const user = userMap.get(email);
    if (!user) {
      throw new Error(`Usuário obrigatório não encontrado: ${email}`);
    }
    snapshotData.push({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      disabled: user.disabled,
      metadata: user.metadata,
      rawCustomClaims: user.customClaims,
    });
  }

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), "utf-8");
  console.log(`✅ Snapshot de segurança pré-migração salvo em:\n   ${snapshotPath}\n`);

  // 2. Execução ordenada 1 a 10 com verificação pós-gravação
  let successCount = 0;

  for (let i = 0; i < TARGET_ORDER.length; i++) {
    const email = TARGET_ORDER[i];
    const user = userMap.get(email);
    const itemNum = i + 1;

    // Trava do Master: #10 só roda se 1 a 9 completaram
    if (itemNum === 10 && successCount !== 9) {
      console.error(`🛑 TRAVA DE SEGURANÇA ACIONADA!`);
      console.error(`   Apenas ${successCount} de 9 usuários foram confirmados. O master (#10 ${email}) NÃO SERÁ TOCADO.`);
      process.exit(1);
    }

    console.log(`---------------------------------------------------------------`);
    console.log(`[${itemNum}/10] Processando: ${email} (UID: ${user.uid})`);

    const claims = user.customClaims || {};

    // 1. Estado Atual
    const beforeExtracted = extractManagedAccessClaims(claims, { uid: user.uid, email: user.email });
    const beforePerms = beforeExtracted.permissions;
    const beforeJsonLen = JSON.stringify(claims).length;

    let preset = claims.accessPreset || "operador";
    if (preset === "internal_admin") preset = "admin_vexo";

    // Para o Arthur (Sonhare), preset base normalizado para gestor
    if (user.email === "sonhareviagens.udi@gmail.com") {
      preset = "gestor";
    }

    const presetDefaults = ACCESS_PRESET_DEFAULTS[preset] || { permissions: [], internalPages: [] };
    const presetBasePerms = deriveEffectivePermissions({
      isAdmin: claims.isAdmin || preset === "admin_vexo",
      role: claims.role,
      storedPermissions: presetDefaults.permissions,
      internalPages: presetDefaults.internalPages,
    });

    const grant = beforePerms.filter((p) => !presetBasePerms.includes(p));
    const revoke = presetBasePerms.filter((p) => !beforePerms.includes(p));

    // 2. Novo Formato Compacto
    const newClaims = {
      role: claims.role,
      isAdmin: claims.isAdmin || preset === "admin_vexo",
      accessPreset: preset,
      scopeMode: claims.scopeMode || "assigned_clients",
      approvalLevel: claims.approvalLevel || "none",
      clientId: claims.clientId || claims.clientIds?.[0] || null,
      clientIds: claims.clientIds || (claims.clientId ? [claims.clientId] : []),
      companyName: claims.companyName || null,
      grant,
      revoke,
    };

    if (claims.must_change_password) {
      newClaims.must_change_password = true;
    }

    const afterJsonLen = JSON.stringify(newClaims).length;

    // 3. Validação Prévia Automática
    const preSimulated = extractManagedAccessClaims(newClaims, { uid: user.uid, email: user.email });
    const missingPre = beforePerms.filter((p) => !preSimulated.permissions.includes(p));
    const extraPre = preSimulated.permissions.filter((p) => !beforePerms.includes(p));

    if (missingPre.length > 0 || extraPre.length > 0) {
      console.error(`❌ ERRO NA VALIDAÇÃO PRÉVIA para ${email}!`);
      console.error(`   Faltando:`, missingPre);
      console.error(`   Extras:`, extraPre);
      throw new Error(`Validação de equivalência falhou para ${email}`);
    }

    console.log(`   Preset: ${claims.accessPreset} -> ${preset}`);
    console.log(`   Grant (${grant.length}):`, grant.length ? grant : "[]");
    console.log(`   Revoke (${revoke.length}):`, revoke.length ? revoke : "[]");
    console.log(`   Permissões Efetivas: ${beforePerms.length} antes -> ${preSimulated.permissions.length} depois (100% IDÊNTICAS ✅)`);
    console.log(`   Tamanho JSON: ${beforeJsonLen} bytes -> ${afterJsonLen} bytes (Redução: -${Math.round((1 - afterJsonLen / beforeJsonLen) * 100)}%)`);

    // 4. Aplicação e Releitura Direta do Firebase
    if (isApply) {
      // Escreve
      await auth.setCustomUserClaims(user.uid, newClaims);

      // Releitura direta do Firebase
      const reloadedUser = await auth.getUser(user.uid);
      const reloadedClaims = reloadedUser.customClaims || {};

      // Validação pós-gravação
      if (reloadedClaims.accessPreset !== newClaims.accessPreset) {
        throw new Error(`Falha de consistência pós-gravação para ${email}: preset gravado não confere!`);
      }

      const postExtracted = extractManagedAccessClaims(reloadedClaims, { uid: user.uid, email: user.email });
      const postMissing = beforePerms.filter((p) => !postExtracted.permissions.includes(p));
      const postExtra = postExtracted.permissions.filter((p) => !beforePerms.includes(p));

      if (postMissing.length > 0 || postExtra.length > 0) {
        throw new Error(`Falha de integridade de permissões pós-gravação para ${email}!`);
      }

      console.log(`   Status: GRAVADO E RE-CONFIRMADO DIRETO DO FIREBASE ✅`);
    } else {
      console.log(`   Status: SIMULADO COM SUCESSO (DRY-RUN) 🔍`);
    }

    successCount++;
  }

  console.log(`\n===============================================================`);
  console.log(` FINALIZADO: Todos os ${successCount} usuários foram processados e verificados com sucesso!`);
  console.log(`===============================================================\n`);
}

migrate().catch((err) => {
  console.error(`\n🚨 FALHA CRÍTICA NA MIGRAÇÃO:`, err.message);
  process.exit(1);
});
