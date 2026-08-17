// Menu e tela precisam responder A MESMA COISA.
//
// Evidência (2026-08-17): tenant "Sonhare", Plano Essencial. O menu mostrava
// "Chips WhatsApp" sem cadeado e a tela mostrava "🔒 Módulo Não Contratado no
// Plano Modular". Duas implementações da mesma regra, com chaves diferentes:
// o menu perguntava pela chave da página, a tela pela do módulo pago.

import { describe, expect, it } from "vitest";
import { canUseModule, isModuleLocked, UNIVERSAL_SIDEBAR_KEYS } from "@/lib/moduleAccess";
import { canUseChipsPage, chipLimitFor } from "@/lib/chipLimit";
import { hasFeatureUnlocked } from "@/lib/planTier";

const SONHARE = { id: "sonhare", plan_tier: "essencial", modulos_avulsos: [] };
const AVANCADO = { id: "t", plan_tier: "avancado", modulos_avulsos: [] };
const MODULAR_COM_DISPARADOR = { id: "t", plan_tier: "modular", modulos_avulsos: ["disparador_campanhas"] };
const MODULAR_PELADO = { id: "t", plan_tier: "modular", modulos_avulsos: ["relatorios"] };

// Exatamente as chaves de lib/appSidebar/constants.ts.
const CHAVES_DA_SIDEBAR = [
  "dashboard", "leads", "banco-de-dados", "conversas", "followup", "campanhas",
  "relatorios", "agente-ia", "chips-whatsapp", "geracao-digital", "livpub", "onboarding",
];

describe("o defeito do print: menu e tela discordavam", () => {
  it("as duas chaves de chip dão a MESMA resposta agora", () => {
    // Era isto que quebrava: página liberada, módulo pago negado.
    expect(canUseModule(SONHARE, "chips-whatsapp")).toBe(canUseModule(SONHARE, "multiplos_chips"));
    expect(canUseModule(SONHARE, "chips-whatsapp")).toBe(true);
  });

  it("a tela de Chips e o menu partem da mesma função", () => {
    expect(canUseModule(SONHARE, "chips-whatsapp")).toBe(canUseChipsPage(SONHARE));
    expect(canUseModule(MODULAR_PELADO, "chips-whatsapp")).toBe(canUseChipsPage(MODULAR_PELADO));
  });

  it("hasFeatureUnlocked sozinho AINDA nega — por isso a tela não pode usá-lo direto", () => {
    // Documenta a causa: quem perguntar assim volta a ter o bug.
    expect(hasFeatureUnlocked(SONHARE, "multiplos_chips")).toBe(false);
    expect(canUseModule(SONHARE, "multiplos_chips")).toBe(true);
  });
});

describe("tenant essencial não é alcançado pelo bloqueio do plano modular", () => {
  it("nenhuma chave da sidebar aparece bloqueada para o Essencial", () => {
    const bloqueadas = CHAVES_DA_SIDEBAR.filter((chave) => isModuleLocked(SONHARE, chave));
    expect(bloqueadas, `Essencial não pode ter cadeado em: ${bloqueadas.join(", ")}`).toEqual([]);
  });

  it("nem para o Avançado", () => {
    const bloqueadas = CHAVES_DA_SIDEBAR.filter((chave) => isModuleLocked(AVANCADO, chave));
    expect(bloqueadas).toEqual([]);
  });

  it("sem tenant selecionado nada é bloqueado", () => {
    for (const chave of CHAVES_DA_SIDEBAR) {
      expect(canUseModule(null, chave)).toBe(true);
    }
  });
});

describe("o plano modular continua sendo bloqueado — não afrouxei nada", () => {
  it("modular só com disparador tem cadeado no que não contratou", () => {
    expect(isModuleLocked(MODULAR_COM_DISPARADOR, "campanhas")).toBe(false);
    expect(isModuleLocked(MODULAR_COM_DISPARADOR, "relatorios")).toBe(true);
    expect(isModuleLocked(MODULAR_COM_DISPARADOR, "agente-ia")).toBe(true);
    expect(isModuleLocked(MODULAR_COM_DISPARADOR, "banco-de-dados")).toBe(true);
  });

  it("modular com disparador tem direito a chip, mesmo sem o módulo de chips", () => {
    expect(isModuleLocked(MODULAR_COM_DISPARADOR, "chips-whatsapp")).toBe(false);
    expect(chipLimitFor(MODULAR_COM_DISPARADOR)).toBe(2);
  });

  it("modular sem disparador nem agente é o ÚNICO caso de tela de chips fechada", () => {
    expect(isModuleLocked(MODULAR_PELADO, "chips-whatsapp")).toBe(true);
    expect(chipLimitFor(MODULAR_PELADO)).toBe(0);
  });

  it("a base universal segue universal, e sem banco-de-dados", () => {
    for (const chave of ["dashboard", "leads", "conversas", "whatsapp"]) {
      expect(UNIVERSAL_SIDEBAR_KEYS.has(chave)).toBe(true);
    }
    expect(UNIVERSAL_SIDEBAR_KEYS.has("banco-de-dados")).toBe(false);
  });
});
