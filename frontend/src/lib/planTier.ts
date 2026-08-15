export type PlanTier = "essencial" | "avancado" | "modular";

export const FEATURE_TIERS = {
  essencial: {
    name: "Plano Essencial",
    badge: "🟢 Base",
    description: "Operação comercial completa com 1 conexão de chip, IA de atendimento e disparos.",
    features: [
      "Dashboard comercial e KPIs em tempo real",
      "Leads & Banco de Dados Inteligente",
      "Conversas (Inbox WhatsApp centralizado)",
      "Disparos por Planilha com cadência segura",
      "IA de Atendimento Inbound (1 Conexão de Chip)",
      "Follow-up (2 cadências manuais por oportunidade)",
      "Treinamento Vexo (Academy com trilha prática)",
    ],
  },
  avancado: {
    name: "Plano Avançado",
    badge: "🟣 Completo",
    description: "Automação avançada com múltiplos chips, Base RAG, SDR Broadcast e Follow-up por evento.",
    features: [
      "Todos os recursos do Plano Essencial",
      "Base de Conhecimento RAG com upload de PDFs e catálogos (agente_rag)",
      "Automações por Evento no Follow-up (followup_automations)",
      "Alertas SDR Broadcast para múltiplos atendentes (sdr_broadcast)",
      "Conexão de Chips WhatsApp adicionais / ilimitados (multiplos_chips)",
      "Atribuição e Análise de Origem de Leads (origem_leads)",
    ],
  },
  modular: {
    name: "Plano Modular / Avulso",
    badge: "🧩 Modular",
    description: "Contratação flexível com ferramentas e módulos de software ativados sob demanda.",
    features: [
      "Recursos essenciais sob medida",
      "Módulos avulsos contratados e liberados individualmente",
      "Herança automática de permissões e controle granular",
      "Treinamento Vexo (Academy) liberado por módulo ativo",
    ],
  },
} as const;

export const AVAILABLE_MODULAR_FEATURES = [
  { id: "disparador_campanhas", featureKey: "disparador_campanhas", label: "Disparador & Campanhas em Massa", desc: "Envio em massa com intervalos humanizados e rotação de instâncias" },
  { id: "agente_inbound", featureKey: "agente_inbound", label: "Agente IA & Chatbot Inbound", desc: "Atendimento automático de clientes com inteligência artificial" },
  { id: "agente_rag", featureKey: "agente_rag", label: "Base de Conhecimento RAG (Upload de Arquivos & PDFs)", desc: "IA treinada nos documentos, manuais e tabelas de preço" },
  { id: "followup", featureKey: "followup", label: "Follow-up & Cadências de Retorno", desc: "Gestão e régua de recontato automático de oportunidades" },
  { id: "followup_automations", featureKey: "followup_automations", label: "Automações por Evento (Follow-up Inteligente)", desc: "Retomada inteligente de propostas e oportunidades paradas" },
  { id: "sdr_broadcast", featureKey: "sdr_broadcast", label: "Alertas SDR Broadcast (Multiatendentes & Distribuição)", desc: "Distribuição automática de leads quentes para consultores" },
  { id: "multiplos_chips", featureKey: "multiplos_chips", label: "Chips WhatsApp Adicionais / Múltiplos", desc: "Conexões extras de WhatsApp para múltiplos números" },
  { id: "origem_leads", featureKey: "origem_leads", label: "Rastreamento de Origem de Leads (Campanhas & Tráfego)", desc: "Atribuição precisa do canal de aquisição (Instagram/Google/TikTok)" },
  { id: "antiban_groq", featureKey: "antiban_groq", label: "Variações Antiban com IA Groq", desc: "Reescrita dinâmica de mensagens em tempo real para evitar bloqueios" },
  { id: "relatorios", featureKey: "relatorios", label: "Relatórios de Vendas & Envios", desc: "Métricas avançadas de disparos e performance operacional" },
] as const;

export function resolveTenantPlan(client?: any): PlanTier {
  if (!client) return "essencial";
  const rawTier = String(
    client.plan_tier ||
    client.planTier ||
    client.n8n_settings?.plan_tier ||
    client.n8n_settings?.planTier ||
    client.plan_type ||
    client.planType ||
    client.n8n_settings?.plan_type ||
    client.n8n_settings?.planType ||
    (client.model_type === "avancado" || client.modelType === "avancado" ? "avancado" : "") ||
    client.model_type ||
    client.modelType ||
    client.n8n_settings?.model_type ||
    client.n8n_settings?.modelType ||
    ""
  ).toLowerCase().trim();

  if (rawTier.includes("avancad") || rawTier.includes("advanced") || rawTier.includes("pro") || rawTier === "avancado") {
    return "avancado";
  }
  if (
    rawTier.includes("modular") ||
    rawTier.includes("avulso") ||
    rawTier.includes("custom") ||
    rawTier === "modular" ||
    (Array.isArray(client.modulos_avulsos) && client.modulos_avulsos.length > 0 && rawTier === "modular") ||
    (Array.isArray(client.n8n_settings?.modulos_avulsos) && client.n8n_settings?.modulos_avulsos.length > 0 && rawTier === "modular")
  ) {
    return "modular";
  }
  return "essencial";
}

export function isDegustacaoExpired(client: any): boolean {
  if (!client) return false;
  const expiraEm =
    client.degustacao_expira_em ||
    client.degustacaoExpiraEm ||
    client.n8n_settings?.degustacao_expira_em ||
    client.n8n_settings?.degustacaoExpiraEm;
  if (!expiraEm) return false;

  const expDate = new Date(expiraEm);
  if (isNaN(expDate.getTime())) return false;
  return expDate.getTime() < Date.now();
}

export function getDegustacaoRemainingDays(client: any): number | null {
  if (!client) return null;
  const expiraEm =
    client.degustacao_expira_em ||
    client.degustacaoExpiraEm ||
    client.n8n_settings?.degustacao_expira_em ||
    client.n8n_settings?.degustacaoExpiraEm;
  if (!expiraEm) return null;

  const expDate = new Date(expiraEm);
  if (isNaN(expDate.getTime())) return null;
  const diffMs = expDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function hasFeatureUnlocked(client: any, featureKey: string): boolean {
  if (!client) return true;
  const tier = resolveTenantPlan(client);
  if (tier === "avancado") return true;

  // Recursos base universais que sempre estão liberados para todo cliente
  const UNIVERSAL_BASE_FEATURES = new Set([
    "dashboard",
    "leads",
    "banco_dados",
    "banco-de-dados",
    "conversas",
    "inbox",
    "whatsapp",
    "onboarding",
    "onboarding-wizard",
    "admin",
    "empresas",
    "usuarios",
  ]);
  if (UNIVERSAL_BASE_FEATURES.has(featureKey)) return true;

  const modulosAvulsos =
    client.modulos_avulsos ||
    client.n8n_settings?.modulos_avulsos ||
    client.modulosAvulsos ||
    client.n8n_settings?.modulosAvulsos ||
    [];

  const isModuleInList = (list: any[], key: string) => {
    if (!Array.isArray(list)) return false;
    if (list.includes("all")) return true;
    if (list.includes(key)) return true;
    const cleanKey = key.toLowerCase().replace(/^mod_/, "");
    return list.some(
      (item: string) =>
        String(item).toLowerCase().trim() === key.toLowerCase().trim() ||
        String(item).toLowerCase().replace(/^mod_/, "").trim() === cleanKey
    );
  };

  // Se o plano é Modular/Avulso, APENAS os módulos contratados em modulos_avulsos estão liberados
  if (tier === "modular") {
    if (isModuleInList(modulosAvulsos, featureKey)) return true;

    // Resolução de sinônimos / telas agregadas
    if (["campanhas", "planilhas", "disparos", "disparador_campanhas"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "disparador_campanhas") || isModuleInList(modulosAvulsos, "campanhas");
    }
    if (["agente", "agente_inbound", "chatbot", "chatbot-kanban", "inbound-agents"].includes(featureKey)) {
      return (
        isModuleInList(modulosAvulsos, "agente_inbound") ||
        isModuleInList(modulosAvulsos, "agente") ||
        isModuleInList(modulosAvulsos, "agente_rag")
      );
    }
    if (["agente_rag", "rag", "chatbot-docs"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "agente_rag");
    }
    if (["followup", "fila-de-followup"].includes(featureKey)) {
      return (
        isModuleInList(modulosAvulsos, "followup") ||
        isModuleInList(modulosAvulsos, "followup_automations")
      );
    }
    if (["followup_automations"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "followup_automations");
    }
    if (["sdr_broadcast"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "sdr_broadcast");
    }
    if (["conexoes", "multiplos_chips", "chips", "chips-whatsapp", "aquecimento"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "multiplos_chips") || isModuleInList(modulosAvulsos, "conexoes");
    }
    if (["origem_leads"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "origem_leads");
    }
    if (["antiban_groq"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "antiban_groq");
    }
    if (["relatorios"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "relatorios");
    }
    if (["comercial-vexo", "apresentacao"].includes(featureKey)) {
      return isModuleInList(modulosAvulsos, "comercial-vexo");
    }

    return false;
  }

  // Se o plano é Essencial (não modular):
  // Módulos avançados requerem degustação ativa ou módulo avulso
  const ADVANCED_ONLY_FEATURES = new Set([
    "agente_rag",
    "followup_automations",
    "sdr_broadcast",
    "multiplos_chips",
    "origem_leads",
    "antiban_groq",
    "agente_campanha",
  ]);

  if (!ADVANCED_ONLY_FEATURES.has(featureKey)) {
    return true;
  }

  // Se a degustação expirou, módulos em degustação deixam de estar liberados
  if (isDegustacaoExpired(client)) {
    return false;
  }

  // Checar liberação avulsa / degustação ativa
  if (isModuleInList(modulosAvulsos, featureKey)) {
    return true;
  }

  return false;
}

export const isFeatureUnlocked = hasFeatureUnlocked;
