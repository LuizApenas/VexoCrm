import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { sanitizePhone, buildPhoneLookupVariants } from "../services/leadImport.js";

const sharedCasesPath = resolve(__dirname, "../../../shared/phoneTestCases.json");
const testCases = JSON.parse(readFileSync(sharedCasesPath, "utf-8"));

describe("Phone Canonicalization — Backend & Shared Table Parity", () => {
  describe("sanitizePhone (Backend)", () => {
    testCases.forEach(({ description, input, expected }) => {
      it(description, () => {
        expect(sanitizePhone(input)).toBe(expected);
      });
    });

    it("Anti-colisão: dois números diferentes com os mesmos 8 dígitos finais NUNCA colidem", () => {
      const phoneUberlandia = sanitizePhone("34997817660"); // 5534997817660 (DDD 34)
      const phoneSaoPaulo = sanitizePhone("11997817660");   // 5511997817660 (DDD 11)
      expect(phoneUberlandia).not.toBe(phoneSaoPaulo);
      expect(phoneUberlandia === phoneSaoPaulo).toBe(false);
    });
  });

  describe("buildPhoneLookupVariants", () => {
    it("devolve array vazio para entrada nula ou sem dígitos", () => {
      expect(buildPhoneLookupVariants(null)).toEqual([]);
      expect(buildPhoneLookupVariants("")).toEqual([]);
      expect(buildPhoneLookupVariants("---")).toEqual([]);
    });

    it("gera variantes com e sem nono dígito para celular BR", () => {
      const variants = buildPhoneLookupVariants("34997817660");
      expect(variants).toContain("5534997817660");
      expect(variants).toContain("+5534997817660");
      expect(variants).toContain("553497817660");
      expect(variants).toContain("+553497817660");
    });
  });
});
