// Classificador determinístico de mensagens de WhatsApp (Automações, URAs e Mudanças de Número)
// Baseado em regras e expressões regulares sem custo de IA.

export const NUMBER_CHANGE_PATTERNS = [
  /estamos\s+desativando\s+esse\s+n[úu]mero/i,
  /chama\s+meu\s+vendedor/i,
  /nos\s+chame\s+no\s+(contato|n[úu]mero|link)/i,
  /novo\s+n[úu]mero/i,
  /troca\s+de\s+n[úu]mero/i,
  /agradecemos\s+(a\s+)?sua\s+mensagem.*(?:https:\/\/wa\.me|34\s*9\d{4})/is,
];

export const AUTOMATION_PATTERNS = [
  {
    name: "Menu numerado / Opção de autoatendimento",
    regex: /digite\s+(apenas\s+)?(o\s+)?n[úu]mero|selecione\s+(uma\s+)?(das\s+)?opç[õo]|opç[ãa]o\s+(desejada|inv[áa]lida)|\bmenu\b/i,
  },
  {
    name: "Atendimento automático / Protocolo de robô",
    regex: /atendimento\s+autom[áa]tico|protocolo\s+de\s+atendimento|resposta\s+autom[áa]tica|\[mensagem\s+autom[áa]tica\]/i,
  },
  {
    name: "Mensagem institucional / Boas-vindas de empresa",
    regex: /seja\s+bem[- ]vindo\(a\)|hor[áa]rios?\s+de\s+atendimento|nosso\s+(showroom|card[áa]pio|cat[áa]logo|site)/i,
  },
  {
    name: "Encerramento automático por inatividade",
    regex: /finalizarei\s+nossa\s+intera[çc][ãa]o|n[ãa]o\s+consegui\s+identificar\s+nenhuma\s+resposta/i,
  },
];

/**
 * Classifica uma mensagem/conversa.
 * 
 * @param {string} text - Texto da última mensagem (ou histórico)
 * @param {Object} [context] - Metadados adicionais da conversa
 * @param {boolean} [context.hasHumanReply] - Se o consultor já respondeu (sender_type 'agent' ou 'device')
 * @param {boolean} [context.hasLeadInCrm] - Se já é lead cadastrado
 * @returns {{ state: 'ativa' | 'automacao', isNumberChange: boolean, isAutomation: boolean, reason: string | null }}
 */
export function classifyConversation(text, context = {}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    return { state: "ativa", isNumberChange: false, isAutomation: false, reason: null };
  }

  // 1. EXCEÇÃO PRIORITÁRIA: Mudança de número informada pelo contato
  // NÃO pode ser escondida em automação! Fica ativa e destacada.
  const isNumberChange = NUMBER_CHANGE_PATTERNS.some((p) => p.test(cleanText));
  if (isNumberChange) {
    return {
      state: "ativa",
      isNumberChange: true,
      isAutomation: false,
      reason: "Mudança de número informada pelo contato",
    };
  }

  // 2. Se já houve interação humana livre ou lead qualificado no CRM, não joga para automação
  if (context.hasHumanReply === true || context.hasLeadInCrm === true) {
    return {
      state: "ativa",
      isNumberChange: false,
      isAutomation: false,
      reason: null,
    };
  }

  // 3. Verifica padrões de robô / URA / autoatendimento
  const matched = AUTOMATION_PATTERNS.find((p) => p.regex.test(cleanText));
  if (matched) {
    return {
      state: "automacao",
      isNumberChange: false,
      isAutomation: true,
      reason: matched.name,
    };
  }

  return {
    state: "ativa",
    isNumberChange: false,
    isAutomation: false,
    reason: null,
  };
}
