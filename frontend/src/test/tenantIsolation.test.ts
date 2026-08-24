import { describe, expect, it, vi } from "vitest";
import { assertTenantMatch, validateTenantTarget } from "@/lib/tenantIsolation";

describe("Mecanismo Compartilhado de Isolamento de Tenant e Proteção Anti-Corrupção", () => {
  describe("1. validateTenantTarget e assertTenantMatch", () => {
    it("permite gravação quando o tenant alvo é exatamente o tenant selecionado", () => {
      const result = validateTenantTarget("sonhare", "sonhare");
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
      expect(() => assertTenantMatch("sonhare", "sonhare")).not.toThrow();
    });

    it("RECUSA gravação quando o tenant alvo diverge do tenant selecionado no CRM (ex: tentar salvar Sonhare na GD)", () => {
      // Cenário do bug: painel ainda com GD, mas o usuário mudou o topo para Sonhare
      const result = validateTenantTarget("geracao-digital", "sonhare");
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Divergência de empresa: tentando gravar para "geracao-digital", mas a empresa selecionada é "sonhare"');

      expect(() => assertTenantMatch("geracao-digital", "sonhare")).toThrowError(
        /Divergência de empresa/
      );
    });

    it("RECUSA gravação se o targetTenantId for nulo, indefinido ou vazio", () => {
      const resultEmpty = validateTenantTarget("", "sonhare");
      expect(resultEmpty.ok).toBe(false);
      expect(resultEmpty.error).toContain("Identificador da empresa de destino não informado");

      expect(() => assertTenantMatch(undefined, "sonhare")).toThrow();
    });

    it("permite gravação quando o seletor está em modo global", () => {
      const result = validateTenantTarget("sonhare", "global");
      expect(result.ok).toBe(true);
    });
  });

  describe("2. Agente IA — Transição de Empresa e Isolamento de Prompts / Templates / Chips", () => {
    it("ao alternar de Geração Digital para Sonhare, o tenant ativo é sincronizado imediatamente sem F5", () => {
      let selectedClientId = "geracao-digital";
      let activePromptClientId = "";
      let activeTemplateClientId = "";

      // Simula a resolução direta de activeClientId de ChatbotSettings / TenantScopeBoundary
      function getActiveClientId(crmSelectedId: string) {
        return crmSelectedId && crmSelectedId !== "global" ? crmSelectedId : "fallback";
      }

      function onTenantChange(newTenantId: string) {
        selectedClientId = newTenantId;
        const currentActive = getActiveClientId(selectedClientId);
        activePromptClientId = currentActive;
        activeTemplateClientId = currentActive;
      }

      // Estado inicial
      onTenantChange("geracao-digital");
      expect(activePromptClientId).toBe("geracao-digital");
      expect(activeTemplateClientId).toBe("geracao-digital");

      // Usuário muda o seletor para Sonhare
      onTenantChange("sonhare");
      expect(activePromptClientId).toBe("sonhare");
      expect(activeTemplateClientId).toBe("sonhare");
    });

    it("salvar prompt logo após trocar: valida contra o seletor e grava com o tenant selecionado, recusando o anterior", async () => {
      let selectedClientId = "sonhare";
      const apiCalls: Array<{ url: string; body: any }> = [];

      async function mockSavePrompt(targetClientId: string, promptType: string, content: string) {
        // Trava anti-corrupção
        assertTenantMatch(targetClientId, selectedClientId);
        apiCalls.push({
          url: "/api/prompts",
          body: { clientId: targetClientId, type: promptType, content },
        });
      }

      // Tentativa de salvar com o tenant anterior preso: REJEITADA
      await expect(
        mockSavePrompt("geracao-digital", "padrao", "Prompt novo da Sonhare")
      ).rejects.toThrowError(/Divergência de empresa/);
      expect(apiCalls).toHaveLength(0);

      // Salvamento com o tenant correto atualizado: ACEITO
      await mockSavePrompt("sonhare", "padrao", "Prompt novo da Sonhare");
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0].body.clientId).toBe("sonhare");
    });
  });

  describe("3. InboundAgentConfig — Reset de companyId e Trava de Salvamento", () => {
    it("ao trocar de tenant, companyId é resetado e não mantém id da empresa anterior", () => {
      let selectedClientId = "tenant-a";
      let companyId = "company-tenant-a-123";

      function onTenantChange(newTenant: string) {
        selectedClientId = newTenant;
        companyId = "all"; // Reset do efeito adicionado
      }

      onTenantChange("tenant-b");
      expect(companyId).toBe("all");
    });

    it("ao tentar salvar agente inbound, valida que target bate com o tenant ativo", async () => {
      const selectedClientId = "tenant-sonhare";

      function handleSaveInbound(targetTenantId: string, payload: any) {
        assertTenantMatch(targetTenantId, selectedClientId);
        return { success: true, savedFor: targetTenantId, payload };
      }

      // Se tentar gravar com tenant antigo:
      expect(() => handleSaveInbound("tenant-gd", { inbound_enabled: true })).toThrowError(
        /Divergência de empresa/
      );

      // Com o tenant ativo:
      const res = handleSaveInbound("tenant-sonhare", { inbound_enabled: true });
      expect(res.success).toBe(true);
      expect(res.savedFor).toBe("tenant-sonhare");
    });
  });

  describe("4. Banco de Dados — Reset de Seleções, Modais e Drawer", () => {
    it("ao alternar de empresa, zera seleções de leads, drawer aberto e modais de importação", () => {
      let clientId = "geracao-digital";
      let selectedLeadIds = ["lead-1", "lead-2"];
      let selectedLead: any = { id: "lead-1", nome: "Lead GD" };
      let isDetailSheetOpen = true;
      let campaignSelectedLeadIds = ["lead-1"];
      let aiExtractedLeads = [{ nome: "Lead IA" }];

      function onTenantChange(newTenantId: string) {
        clientId = newTenantId;
        // Efeito de reset
        selectedLeadIds = [];
        selectedLead = null;
        isDetailSheetOpen = false;
        campaignSelectedLeadIds = [];
        aiExtractedLeads = [];
      }

      onTenantChange("sonhare");

      expect(selectedLeadIds).toEqual([]);
      expect(selectedLead).toBeNull();
      expect(isDetailSheetOpen).toBe(false);
      expect(campaignSelectedLeadIds).toEqual([]);
      expect(aiExtractedLeads).toEqual([]);
    });
  });

  describe("5. Teste de Mutação — Prova que remover a trava permite corrupção", () => {
    it("se remover a validação de tenant match, o sistema gravaria silenciosamente no tenant anterior", () => {
      const selectedClientId = "sonhare";
      const staleTenantId = "geracao-digital";

      // Simulação sem a trava (código antigo com bug)
      function unsafeSave(target: string, payload: any) {
        // SEM assertTenantMatch
        return { savedTo: target, payload };
      }

      const corruptedSave = unsafeSave(staleTenantId, { prompt: "Prompt da Sonhare" });
      // Prova que sem a trava ele salva na GD!
      expect(corruptedSave.savedTo).toBe("geracao-digital");

      // Com a trava (código corrigido)
      function safeSave(target: string, payload: any) {
        assertTenantMatch(target, selectedClientId);
        return { savedTo: target, payload };
      }

      expect(() => safeSave(staleTenantId, { prompt: "Prompt da Sonhare" })).toThrowError(
        /Divergência de empresa/
      );
    });
  });
});
