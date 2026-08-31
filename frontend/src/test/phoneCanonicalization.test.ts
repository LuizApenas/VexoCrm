import { describe, it, expect } from "vitest";
import testCases from "../../../shared/phoneTestCases.json";
import { sanitizePhone } from "../lib/phone";

describe("Phone Canonicalization — Frontend & Shared Table Parity", () => {
  describe("sanitizePhone (Frontend)", () => {
    testCases.forEach(({ description, input, defaultDdd, expected }: any) => {
      it(description, () => {
        expect(sanitizePhone(input, defaultDdd)).toBe(expected);
      });
    });

    it("Anti-colisão: dois números diferentes com os mesmos 8 dígitos finais NUNCA colidem", () => {
      const phoneUberlandia = sanitizePhone("34997817660"); // 5534997817660 (DDD 34)
      const phoneSaoPaulo = sanitizePhone("11997817660");   // 5511997817660 (DDD 11)
      expect(phoneUberlandia).not.toBe(phoneSaoPaulo);
      expect(phoneUberlandia === phoneSaoPaulo).toBe(false);
    });
  });
});
