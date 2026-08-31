import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getMigrationStatus } from "../migrate.js";
import { AGENTE_CAMPANHA } from "../services/campaignAgentRouting.js";

describe("Cadeia de Migrations e Visibilidade de Saúde (/health)", () => {
  it("getMigrationStatus() retorna estrutura de estado com campos essenciais", () => {
    const status = getMigrationStatus();
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("totalFiles");
    expect(status).toHaveProperty("appliedCount");
    expect(status).toHaveProperty("pendingCount");
    expect(status).toHaveProperty("failedMigration");
    expect(status).toHaveProperty("error");
    expect(["idle", "running", "completed", "failed", "skipped"]).toContain(status.status);
  });

  it("migration 20260827180000_add_followup_jobs_custom_message.sql limpa registros órfãos antes da constraint", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20260827180000_add_followup_jobs_custom_message.sql"),
      "utf8"
    );

    const deleteIndex = sql.indexOf("DELETE FROM public.followup_jobs");
    const constraintIndex = sql.indexOf("ADD CONSTRAINT followup_jobs_content_check");

    expect(deleteIndex).toBeGreaterThan(-1);
    expect(constraintIndex).toBeGreaterThan(-1);
    // A deleção DEVE ocorrer ANTES da adição da constraint
    expect(deleteIndex).toBeLessThan(constraintIndex);
    expect(sql).toContain("template_id IS NULL");
    expect(sql).toContain("custom_message IS NULL");
  });

  it("AGENTE_CAMPANHA está devidamente importado no routes.js de chatbot", () => {
    const chatbotRoutesSource = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");
    expect(chatbotRoutesSource).toMatch(
      /import\s*\{[^}]*AGENTE_CAMPANHA[^}]*\}\s*from\s*["']\.\.\/\.\.\/services\/campaignAgentRouting\.js["']/
    );
    expect(AGENTE_CAMPANHA).toBe("campanha");
  });

  it("roteamento no GET /health inclui o bloco migrations", () => {
    const insightsRoutesSource = readFileSync(resolve("src/domains/insights/routes.js"), "utf8");
    expect(insightsRoutesSource).toContain("migrations: getMigrationStatus()");
  });
});
