/**
 * Canonicalização de telefone brasileiro / internacional (E.164 canônico)
 * Paridade exata com backend/src/services/leadImport.js (sanitizePhone)
 */
export function sanitizePhone(value: unknown, defaultDdd: string | null = null): string | null {
  if (value === null || value === undefined) return null;
  const rawStr = String(value).trim();
  if (!rawStr) return null;

  // 0. Barrar IDs e JIDs de grupo do WhatsApp (@g.us, @broadcast, -group)
  const low = rawStr.toLowerCase();
  if (low.includes("@g.us") || low.includes("@broadcast") || low.includes("-group")) {
    return null;
  }

  let digits = rawStr.replace(/\D/g, "");
  if (!digits) return null;

  // Identificador de grupo: números com 15 ou mais dígitos (ex: IDs de grupo de 18 dígitos: 120363049633060243)
  if (digits.length >= 15) {
    return null;
  }

  // Remove prefixo de longa distância 0
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  if (!digits) return null;

  const cleanDdd = defaultDdd ? String(defaultDdd).replace(/\D/g, "").slice(0, 2) : null;
  const hasValidDefaultDdd = cleanDdd && cleanDdd.length === 2;

  // 1. Números curtos de 8 ou 9 dígitos (sem DDD e sem DDI)
  if (digits.length === 8 || digits.length === 9) {
    if (hasValidDefaultDdd) {
      const local = digits;
      if (digits.length === 8) {
        const firstDigit = local[0];
        // Celular que perdeu o 9: primeiro dígito é 6, 7, 8 ou 9 -> adiciona o 9 (13 dígitos com DDI 55)
        if (["6", "7", "8", "9"].includes(firstDigit)) {
          return `55${cleanDdd}9${local}`;
        }
        // Fixo: primeiro dígito é 2, 3, 4 ou 5 -> mantém fixo de 8 dígitos (12 dígitos com DDI 55)
        return `55${cleanDdd}${local}`;
      }
      if (digits.length === 9) {
        // Celular de 9 dígitos -> adiciona DDI 55 + DDD -> 13 dígitos
        return `55${cleanDdd}${local}`;
      }
    }
    // Sem DDD informado, NÃO tenta adivinhar. Retorna null para marcar como incompleto
    return null;
  }

  // 2. Número local de 10 dígitos (DDD [2] + 8 dígitos)
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

  // 3. Número local de 11 dígitos (DDD [2] + 9 dígitos)
  if (digits.length === 11) {
    // Se o 3º dígito for 9 (celular BR padrão), prefixa 55 -> 13 dígitos
    if (digits[2] === "9") {
      return `55${digits}`;
    }
    return digits;
  }

  // 4. Número de 12 dígitos começando com 55 (55 + DDD [2] + 8 dígitos)
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

  // 5. Número de 13 dígitos começando com 55 (55 + DDD [2] + 9 dígitos)
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }

  // 6. Formatos internacionais válidos (10 a 14 dígitos) -> passa intacto
  if (digits.length >= 10 && digits.length < 15) {
    return digits;
  }

  return null;
}
