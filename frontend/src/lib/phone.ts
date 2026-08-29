/**
 * Canonicalização de telefone brasileiro / internacional (E.164 canônico)
 * Paridade exata com backend/src/services/leadImport.js (sanitizePhone)
 */
export function sanitizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const rawStr = String(value).trim();
  if (!rawStr) return null;

  let digits = rawStr.replace(/\D/g, "");
  if (!digits) return null;

  // Remove prefixo de longa distância 0
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  if (!digits) return null;

  // 1. Número local de 10 dígitos (DDD [2] + 8 dígitos)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const local = digits.slice(2);
    const firstDigit = local[0];
    // Celular que perdeu o 9: primeiro dígito é 6, 7, 8 ou 9 -> adiciona o 9 (13 dígitos)
    if (["6", "7", "8", "9"].includes(firstDigit)) {
      return `55${ddd}9${local}`;
    }
    // Fixo: primeiro dígito é 2, 3, 4 ou 5 -> mantém fixo de 8 dígitos (12 dígitos com DDI 55)
    return `55${digits}`;
  }

  // 2. Número local de 11 dígitos (DDD [2] + 9 dígitos)
  if (digits.length === 11) {
    // Se o 3º dígito for 9 (celular BR padrão), prefixa 55 -> 13 dígitos
    if (digits[2] === "9") {
      return `55${digits}`;
    }
    return digits;
  }

  // 3. Número de 12 dígitos começando com 55 (55 + DDD [2] + 8 dígitos)
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const local = digits.slice(4);
    const firstDigit = local[0];
    // Celular que perdeu o 9: primeiro dígito local é 6, 7, 8 ou 9 -> adiciona o 9 (13 dígitos)
    if (["6", "7", "8", "9"].includes(firstDigit)) {
      return `55${ddd}9${local}`;
    }
    return digits;
  }

  // 4. Número de 13 dígitos começando com 55 (55 + DDD [2] + 9 dígitos)
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }

  // 5. Números internacionais ou outros formatos -> passa intacto
  return digits;
}
