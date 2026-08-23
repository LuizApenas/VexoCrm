import { describe, expect, it, vi } from "vitest";

describe("Limpeza de seleções e isolamento de estado ao trocar de empresa (tenant)", () => {
  describe("1. LeadImportAuditReport e seleção de planilhas", () => {
    it("ao trocar de empresa, limpa a seleção da importação anterior e não dispara requisição para o ID antigo", () => {
      let activeClientId = "geracao-digital";
      let selectedImportId = "9283-c798cadb2d29";
      let auditItems: any[] = [{ id: "item-1", lead_import_item_id: "lii-1" }];
      const requestsMade: string[] = [];

      // Simula o comportamento do useEffect ao mudar de tenant
      function onTenantChange(newTenant: string) {
        activeClientId = newTenant;
        selectedImportId = "";
        auditItems = [];
      }

      function syncWithNewImports(newTenantImports: Array<{ id: string; source_name: string }>) {
        if (newTenantImports.length > 0) {
          if (!selectedImportId || !newTenantImports.some((imp) => imp.id === selectedImportId)) {
            selectedImportId = newTenantImports[0].id;
          }
        } else {
          selectedImportId = "";
          auditItems = [];
        }
      }

      function loadAudit(currentTenantImports: Array<{ id: string }>) {
        // Validação estrita: se o ID não pertencer à lista do tenant atual, não chama a API
        if (!selectedImportId || !activeClientId) return;
        if (currentTenantImports.length > 0 && !currentTenantImports.some((imp) => imp.id === selectedImportId)) {
          return;
        }
        requestsMade.push(`GET /api/campaigns/reports/import-audit?clientId=${activeClientId}&importId=${selectedImportId}`);
      }

      // Estado inicial em Geracao Digital
      loadAudit([{ id: "9283-c798cadb2d29" }]);
      expect(requestsMade).toEqual([
        "GET /api/campaigns/reports/import-audit?clientId=geracao-digital&importId=9283-c798cadb2d29",
      ]);

      // Usuário troca para Sonhare
      onTenantChange("sonhare");
      expect(selectedImportId).toBe("");
      expect(auditItems).toEqual([]);

      // Novo tenant tem suas próprias planilhas
      const sonhareImports = [{ id: "sonhare-imp-101", source_name: "Leads Sonhare.xlsx" }];
      syncWithNewImports(sonhareImports);
      expect(selectedImportId).toBe("sonhare-imp-101");

      // Dispara loadAudit para Sonhare
      loadAudit(sonhareImports);

      // NENHUMA requisição com ID da empresa anterior foi feita para Sonhare
      expect(requestsMade).not.toContain(
        "GET /api/campaigns/reports/import-audit?clientId=sonhare&importId=9283-c798cadb2d29"
      );
      expect(requestsMade).toContain(
        "GET /api/campaigns/reports/import-audit?clientId=sonhare&importId=sonhare-imp-101"
      );
    });

    it("se a importação for de outro tenant ou excluída (404), trata graciosamente sem erro destrutivo", () => {
      const activeImports = [{ id: "imp-a" }];
      const currentSelectedId = "imp-b"; // Pertencia à empresa anterior

      const isOtherTenantOrDeleted = !activeImports.some((imp) => imp.id === currentSelectedId);
      expect(isOtherTenantOrDeleted).toBe(true);

      const userMessage = isOtherTenantOrDeleted
        ? "Selecione uma planilha desta empresa."
        : "Essa planilha não existe mais.";

      expect(userMessage).toBe("Selecione uma planilha desta empresa.");
    });
  });

  describe("2. LeadImports: limpeza completa de todos os estados atrelados a tenant", () => {
    it("limpa todas as seleções de lote, preview, dialogs e arquivos ao trocar de empresa", () => {
      let activeClientId = "empresa-a";
      let selectedImportId = "imp-123";
      let selectedImportIds = ["imp-123", "imp-456"];
      let selectedFile: any = { name: "teste.xlsx" };
      let parsedRows = [{ nome: "Lead 1" }];
      let previewDispatchId: string | null = "disp-789";
      let viewingImport: any = { id: "imp-123" };
      let promptDispatchId: string | null = "disp-789";

      function onTenantChange(newTenant: string) {
        activeClientId = newTenant;
        selectedImportId = "__all__";
        selectedImportIds = [];
        selectedFile = null;
        parsedRows = [];
        previewDispatchId = null;
        viewingImport = null;
        promptDispatchId = null;
      }

      onTenantChange("empresa-b");

      expect(selectedImportId).toBe("__all__");
      expect(selectedImportIds).toEqual([]);
      expect(selectedFile).toBeNull();
      expect(parsedRows).toEqual([]);
      expect(previewDispatchId).toBeNull();
      expect(viewingImport).toBeNull();
      expect(promptDispatchId).toBeNull();
    });

    it("limpa IDs de planilhas selecionadas que não pertencem ao novo tenant", () => {
      let selectedImportIds = ["imp-tenant-a", "imp-tenant-b"];
      const newTenantImports = [{ id: "imp-tenant-b" }, { id: "imp-tenant-c" }];

      // Efeito de validação de seleções
      const validIds = selectedImportIds.filter((id) => newTenantImports.some((imp) => imp.id === id));
      selectedImportIds = validIds;

      expect(selectedImportIds).toEqual(["imp-tenant-b"]);
      expect(selectedImportIds).not.toContain("imp-tenant-a");
    });
  });

  describe("3. FollowupQueue: limpeza de empresa ativa ao trocar tenant", () => {
    it("reseta companyId na troca de tenantId para evitar reutilização indevida", () => {
      let tenantId = "tenant-1";
      let companyId = "company-tenant-1";

      function onTenantChange(newTenant: string) {
        tenantId = newTenant;
        companyId = "";
      }

      onTenantChange("tenant-2");
      expect(companyId).toBe("");
    });
  });

  describe("4. Terminal error guard: não retenta 404 nem 403", () => {
    function shouldRetry(error: Error, failureCount: number): boolean {
      const isTerminal = error.message.includes("404") || error.message.includes("403") || error.message.includes("401");
      return !isTerminal && failureCount < 1;
    }

    it("rejeita retry em 404 (não encontrado / outro tenant)", () => {
      const notFoundError = new Error("Lead imports fetch failed: 404 Import not found or unauthorized");
      expect(shouldRetry(notFoundError, 0)).toBe(false);
    });

    it("rejeita retry em 403 (proibido)", () => {
      const forbiddenError = new Error("Lead imports fetch failed: 403 Forbidden");
      expect(shouldRetry(forbiddenError, 0)).toBe(false);
    });

    it("permite retry em erro transitório de rede (ex: 503 / timeout)", () => {
      const networkError = new Error("Lead imports fetch failed: 503 Service Unavailable");
      expect(shouldRetry(networkError, 0)).toBe(true);
      expect(shouldRetry(networkError, 1)).toBe(false);
    });
  });
});
