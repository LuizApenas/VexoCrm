import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  ACCESS_PRESET_ORDER,
  getDefaultPresetForRole,
  normalizeAccessPreset,
  type AccessRole,
} from "@/lib/access";

const ACCEPTED_BACKEND_PRESETS = [
  "admin_vexo",
  "gestor",
  "operador",
  "parceiro",
  "client_manager",
  "client_operator",
  "client_viewer",
  "pending",
] as const;

describe("criação de usuário e perfis de acesso aceitos pelo backend", () => {
  it("a lista de presets aceitos pelo frontend é idêntica à lista aceita pelo backend", () => {
    expect([...ACCESS_PRESET_ORDER].sort()).toEqual([...ACCEPTED_BACKEND_PRESETS].sort());
  });

  it("para cada tipo de acesso (role) disponível, o preset padrão é aceito pelo backend", () => {
    const availableRoles: AccessRole[] = ["internal", "client", "pending"];
    for (const role of availableRoles) {
      const defaultPreset = getDefaultPresetForRole(role);
      expect(ACCEPTED_BACKEND_PRESETS).toContain(defaultPreset);
    }
  });

  it("mapeamento de plano Essencial e Avançado para internal produz valores da lista aceita", () => {
    // Para usuário interno:
    // Essencial -> operador
    // Avançado -> gestor
    const essencialInternal = normalizeAccessPreset("operador", "internal");
    const avancadoInternal = normalizeAccessPreset("gestor", "internal");
    expect(ACCEPTED_BACKEND_PRESETS).toContain(essencialInternal);
    expect(ACCEPTED_BACKEND_PRESETS).toContain(avancadoInternal);
    expect(essencialInternal).toBe("operador");
    expect(avancadoInternal).toBe("gestor");
  });

  it("mapeamento de plano Essencial e Avançado para client produz valores da lista aceita", () => {
    // Para usuário client:
    // Essencial -> client_operator
    // Avançado -> client_manager
    const essencialClient = normalizeAccessPreset("client_operator", "client");
    const avancadoClient = normalizeAccessPreset("client_manager", "client");
    expect(ACCEPTED_BACKEND_PRESETS).toContain(essencialClient);
    expect(ACCEPTED_BACKEND_PRESETS).toContain(avancadoClient);
    expect(essencialClient).toBe("client_operator");
    expect(avancadoClient).toBe("client_manager");
  });

  it("qualquer tentativa de enviar 'admin' ou 'commercial' é interceptada e normalizada", () => {
    expect(ACCEPTED_BACKEND_PRESETS).not.toContain("admin");
    expect(ACCEPTED_BACKEND_PRESETS).not.toContain("commercial");

    expect(ACCEPTED_BACKEND_PRESETS).toContain(normalizeAccessPreset("admin", "internal"));
    expect(ACCEPTED_BACKEND_PRESETS).toContain(normalizeAccessPreset("commercial", "internal"));
    expect(ACCEPTED_BACKEND_PRESETS).toContain(normalizeAccessPreset("admin", "client"));
    expect(ACCEPTED_BACKEND_PRESETS).toContain(normalizeAccessPreset("commercial", "client"));
  });

  it("UserAccessManagement.tsx NÃO possui atribuições hardcoded de accessPreset para 'admin' ou 'commercial'", () => {
    const source = readFileSync(resolve(__dirname, "../pages/UserAccessManagement.tsx"), "utf8");

    // Verifica que nenhum updateCreateDraft ou onChange passa 'accessPreset: "admin"' ou 'accessPreset: "commercial"'
    expect(source).not.toMatch(/accessPreset:\s*["']admin["']/);
    expect(source).not.toMatch(/accessPreset:\s*["']commercial["']/);
  });
});
