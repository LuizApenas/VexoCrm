import { describe, it, expect } from "vitest";
import { sanitizePhone } from "../lib/phone";

describe("Frontend Phone Canonicalization (sanitizePhone)", () => {
  it("preserva celulares de 13 dígitos começando com 55 e 9", () => {
    expect(sanitizePhone("5534997817660")).toBe("5534997817660");
    expect(sanitizePhone("+5534997817660")).toBe("5534997817660");
  });

  it("converte celular de 11 dígitos local (DDD + 9 + 8 dígitos) para 13 dígitos", () => {
    expect(sanitizePhone("34997817660")).toBe("5534997817660");
    expect(sanitizePhone("(34) 99781-7660")).toBe("5534997817660");
  });

  it("adiciona 9 a celulares de 12 dígitos com DDI 55 cujo número começa com 6, 7, 8 ou 9", () => {
    expect(sanitizePhone("553497817660")).toBe("5534997817660");
    expect(sanitizePhone("553488112233")).toBe("5534988112233");
    expect(sanitizePhone("553477112233")).toBe("5534977112233");
    expect(sanitizePhone("553466112233")).toBe("5534966112233");
  });

  it("adiciona 9 a celulares de 10 dígitos local cujo número começa com 6, 7, 8 ou 9", () => {
    expect(sanitizePhone("3497817660")).toBe("5534997817660");
    expect(sanitizePhone("(34) 9781-7660")).toBe("5534997817660");
    expect(sanitizePhone("3488112233")).toBe("5534988112233");
  });

  it("NÃO adiciona 9 em telefone fixo (começando com 2, 3, 4 ou 5)", () => {
    expect(sanitizePhone("553432211234")).toBe("553432211234");
    expect(sanitizePhone("551123456789")).toBe("551123456789");
    expect(sanitizePhone("553440028922")).toBe("553440028922");
    expect(sanitizePhone("553455112233")).toBe("553455112233");
    expect(sanitizePhone("3432211234")).toBe("553432211234");
    expect(sanitizePhone("(34) 3221-1234")).toBe("553432211234");
  });

  it("preserva números internacionais sem aplicar regras brasileiras", () => {
    expect(sanitizePhone("+1 415 555 2671")).toBe("14155552671");
    expect(sanitizePhone("+351 912 345 678")).toBe("351912345678");
    expect(sanitizePhone("447911123456")).toBe("447911123456");
  });

  it("trata entrada vazia, nula e formatação", () => {
    expect(sanitizePhone("")).toBeNull();
    expect(sanitizePhone(null)).toBeNull();
    expect(sanitizePhone(undefined)).toBeNull();
    expect(sanitizePhone("   ")).toBeNull();
    expect(sanitizePhone("---")).toBeNull();
    expect(sanitizePhone("034997817660")).toBe("5534997817660");
  });

  it("garante que telefones distintos com mesmo final nunca colidem por igualdade estrita", () => {
    const phoneA = sanitizePhone("34997817660"); // 5534997817660 (DDD 34)
    const phoneB = sanitizePhone("11997817660"); // 5511997817660 (DDD 11)
    expect(phoneA).not.toBe(phoneB);
    expect(phoneA === phoneB).toBe(false);
  });
});
