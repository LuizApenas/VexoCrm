import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });
import { initDatabase, pgDatabasePool } from "../src/services/database.js";

async function run() {
  initDatabase();
  if (pgDatabasePool) {
    try {
      console.log("Adding instance_name to lead_messages...");
      await pgDatabasePool.query("ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS instance_name text;");
      console.log("Migration successful!");
    } catch (e) {
      console.error("Migration error:", e);
    } finally {
      pgDatabasePool.end();
    }
  } else {
    console.log("No pg pool configured.");
  }
}
run();
