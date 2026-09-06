import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const auth = admin.auth();

async function rollback() {
  const snapshotPath = "/Users/conradofinzi/Documents/vexo-sales-module/backend/scripts/snapshots/claims-backup-gabriel-priscila-step5-1788710653902.json";
  const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));

  console.log("Restaurando snapshot de segurança...");
  for (const item of raw) {
    console.log(`Restaurando ${item.email} (${item.uid})...`);
    await auth.setCustomUserClaims(item.uid, item.rawCustomClaims);
    const reloaded = await auth.getUser(item.uid);
    console.log(`Releitura pós-restauração:`, reloaded.customClaims);
  }
  console.log("✅ Restauração do snapshot concluída com sucesso!");
}

rollback().catch(console.error);
