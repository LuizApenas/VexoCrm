import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Database,
  MessageCircle,
  Wifi,
  Send,
  ListChecks,
  Bot,
  BarChart3,
  Briefcase,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Zap,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { fetchApi, readApiJson } from "@/lib/api";
import { hasFeatureUnlocked } from "@/lib/planTier";

// Vexo Academy dinâmico (objetivo 5). Conteúdo 100% data-driven: cada ferramenta do
// sistema tem um módulo com resumo prático, passo-a-passo detalhado, dicas de ouro /
// anti-ban e botão de ação. Os módulos aparecem APENAS se o usuário logado tem a
// permissão correspondente no PERMISSIONS_REGISTRY — ao adicionar uma ferramenta nova,
// basta registrar um módulo aqui com sua permissão que ele passa a aparecer sozinho.

interface ModuleSection {
  title: string;
  intro?: string;
  steps?: string[];
}

interface AcademyModule {
  value: string;
  label: string;
  icon: LucideIcon;
  permissions: string[]; // vazio = visível só para admin
  featureKey?: string; // se pertencer ao Plano Avançado (ex: "agente_rag", "followup_automations", "sdr_broadcast")
  title: string;
  summary: string;
  goal: string; // objetivo de vendas
  ctaHref: string;
  ctaLabel: string;
  sections: ModuleSection[];
  tips: string[];
}

const ACADEMY_MODULES: AcademyModule[] = [
  {
    value: "dashboard",
    label: "Dashboard & Métricas",
    icon: LayoutDashboard,
    permissions: ["dashboard.view"],
    title: "Dashboard & Métricas",
    summary:
      "A tela inicial do Vexo. Mostra em tempo real o funil de vendas, volume de leads, conversas em andamento e a saúde geral da operação.",
    goal: "Objetivo de vendas: enxergar rápido onde estão os gargalos (leads parados, sem resposta) e agir antes de perder negócio.",
    ctaHref: "/crm/dashboard",
    ctaLabel: "Abrir o Dashboard",
    sections: [
      {
        title: "O que você acompanha aqui",
        steps: [
          "Novos contatos, leads em atendimento e propostas abertas — o pipeline vivo.",
          "Volume de mensagens enviadas e respondidas no período.",
          "Taxa de resposta e evolução dos números ao longo dos dias.",
        ],
      },
      {
        title: "Como usar no dia a dia",
        intro: "Use o Dashboard como primeira tela da manhã.",
        steps: [
          "Filtre por empresa/tenant no topo (se você atende mais de uma).",
          "Ajuste o período (hoje, 7 dias, 30 dias) para comparar tendência.",
          "Clique nos cartões para ir direto à lista de leads daquele estágio.",
        ],
      },
    ],
    tips: [
      "Cheque o Dashboard todo início de turno: leads parados há muito tempo são dinheiro esfriando.",
      "Queda súbita no volume de envio costuma indicar chip desconectado — confira em Chips WhatsApp.",
    ],
  },
  {
    value: "banco-de-dados",
    label: "Banco de Dados Inteligente",
    icon: Database,
    permissions: ["banco_dados.view", "banco_dados.import", "banco_dados.extract_wa", "banco_dados.delete", "leads.view", "leads.export"],
    title: "Banco de Dados Inteligente",
    summary:
      "A base central de contatos e leads do tenant. Aqui você importa listas, organiza por tags, filtra segmentos e alimenta as campanhas de disparo.",
    goal: "Objetivo de vendas: transformar planilhas soltas e contatos avulsos numa base viva, segmentável e pronta para abordagem.",
    ctaHref: "/crm/banco-de-dados",
    ctaLabel: "Abrir Banco de Dados",
    sections: [
      {
        title: "Importar planilhas de leads",
        intro: "A forma mais rápida de encher a base.",
        steps: [
          "Prepare um arquivo Excel (.xlsx) ou CSV com no mínimo as colunas nome e telefone.",
          "Clique em Importar / Upload e selecione o arquivo.",
          "Faça o de-para das colunas (o Vexo tenta reconhecer sozinho nome, telefone, origem, e-mail).",
          "Defina a Origem da lista (ex.: 'Feira X', 'Tráfego Meta') — isso vira filtro depois.",
          "Confirme. Números repetidos são deduplicados automaticamente.",
        ],
      },
      {
        title: "Extração de contatos via WhatsApp",
        intro: "Puxa contatos direto de um chip conectado, sem planilha.",
        steps: [
          "Escolha o chip conectado de onde quer extrair.",
          "Rode a extração — o Vexo importa os contatos para a base do tenant.",
          "Depois, organize com tags e origem como qualquer outra lista.",
        ],
      },
      {
        title: "Organizar com tags e filtros",
        intro: "Tag é o coração da segmentação no Vexo.",
        steps: [
          "Selecione um ou vários leads e aplique tags (ex.: 'Quente', 'Sem resposta', 'Cliente').",
          "Use os filtros (origem, tag, status de qualificação) para isolar exatamente o público que quer atingir.",
          "Exporte o subconjunto filtrado, ou use-o direto como base de uma campanha.",
        ],
      },
      {
        title: "Exportar e excluir",
        steps: [
          "Exportar: gera Excel/CSV do que estiver filtrado na tela.",
          "Excluir: remove leads da base (ação destrutiva — só quem tem a permissão de exclusão).",
        ],
      },
    ],
    tips: [
      "Padronize o telefone com DDD e país (55) — número torto não recebe disparo.",
      "Crie tags curtas e consistentes; segmentação boa depende de tag limpa.",
      "Sempre defina a Origem ao importar: depois você mede qual fonte de lead converte mais.",
    ],
  },
  {
    value: "conversas",
    label: "Conversas (Inbox)",
    icon: MessageCircle,
    permissions: ["whatsapp.view", "whatsapp.reply"],
    title: "Conversas (Inbox de WhatsApp)",
    summary:
      "A caixa de entrada unificada de todos os WhatsApps conectados. É onde o time humano assume o atendimento depois que o lead responde ou a IA passa o bastão.",
    goal: "Objetivo de vendas: responder rápido e no lugar certo, sem perder o histórico da conversa nem misturar chips.",
    ctaHref: "/crm/whatsapp",
    ctaLabel: "Abrir Conversas",
    sections: [
      {
        title: "Entendendo a tela",
        steps: [
          "À esquerda: lista de conversas, com as mais recentes no topo.",
          "No centro: o histórico da conversa selecionada.",
          "Cada conversa mostra por qual chip está sendo atendida.",
        ],
      },
      {
        title: "Responder um lead",
        steps: [
          "Clique na conversa na lista à esquerda.",
          "Digite no campo inferior e envie.",
          "Assim que você (ou o lead) responde, qualquer follow-up automático programado para ele é cancelado na hora.",
        ],
      },
      {
        title: "Boas práticas de atendimento",
        steps: [
          "Priorize conversas sem resposta há mais tempo — SLA baixo fecha mais venda.",
          "Use as tags do lead (vindas do Banco de Dados) para saber o contexto antes de responder.",
        ],
      },
    ],
    tips: [
      "Responder lead qualificado em menos de 5 minutos aumenta muito a taxa de fechamento.",
      "Não apague conversas: o histórico é o que a IA e os relatórios usam para medir a operação.",
    ],
  },
  {
    value: "chips",
    label: "Chips WhatsApp & Aquecimento",
    icon: Wifi,
    permissions: ["whatsapp.chips_view", "whatsapp.chips_add", "whatsapp.chips_delete"],
    title: "Chips WhatsApp & Aquecimento",
    summary:
      "Onde você pluga os números de WhatsApp (chips) que disparam campanhas, fazem follow-up e atendem. Também é onde se aquece chip novo para não tomar ban.",
    goal: "Objetivo de vendas: ter linhas estáveis e com reputação para disparar em volume sem cair.",
    ctaHref: "/crm/chips-whatsapp?tab=conexoes",
    ctaLabel: "Abrir Chips WhatsApp",
    sections: [
      {
        title: "Conectar um chip (Pareamento QR Code)",
        steps: [
          "Na aba Conexões, clique em Adicionar Instância e dê um nome identificador ao chip.",
          "Aguarde o QR Code aparecer na tela.",
          "No celular, abra WhatsApp > Aparelhos Conectados > Conectar um Aparelho e escaneie o código.",
          "Aguarde o status ficar 'conectado'. Pronto: esse chip já pode disparar.",
        ],
      },
      {
        title: "Aquecimento (Warming) de chips novos",
        intro: "Chip novo que dispara muito rápido é banido. O aquecimento cria reputação antes.",
        steps: [
          "Cadastre e ative o aquecimento de vários chips na aba Aquecimento.",
          "O Vexo faz os chips conversarem entre si de forma simulada no background.",
          "Deixe aquecer alguns dias antes de usar em campanha fria de volume.",
        ],
      },
      {
        title: "Remover / desconectar chip",
        steps: [
          "Use a opção de remover para desconectar um chip banido ou trocado (requer permissão).",
          "Reconecte um novo no lugar e o rodízio de disparo se ajusta sozinho.",
        ],
      },
    ],
    tips: [
      "Anti-ban: mantenha a internet do celular sempre ativa e estável.",
      "Anti-ban: use vários chips por campanha. O Vexo faz rodízio automático e dilui a carga.",
      "Comece devagar em chip novo e aumente o volume aos poucos.",
    ],
  },
  {
    value: "campanhas",
    label: "Campanhas & Disparos",
    icon: Send,
    permissions: ["campaigns.view", "campaigns.create", "campaigns.delete", "dispatches.execute", "dispatches.pause", "dispatches.export_failed"],
    title: "Campanhas & Disparos (Envio em Massa)",
    summary:
      "O motor de abordagem ativa. Uma Campanha guarda a base, a mensagem com variações humanizadas e o roteiro de IA exclusivo para o lote.",
    goal: "Objetivo de vendas: abordar centenas de leads de forma personalizada e humanizada, controlando ritmo, volume e IA de resposta no lote.",
    ctaHref: "/crm/campanhas",
    ctaLabel: "Abrir Campanhas",
    sections: [
      {
        title: "1. Criar uma campanha e importar base",
        steps: [
          "Clique em Nova Campanha e dê um nome claro (ex.: 'Feira Set/26 - Frios').",
          "Escolha a base: importe uma planilha na hora ou puxe um segmento já filtrado no Banco de Dados.",
          "Selecione o chip / instância que vai enviar (ou deixe o rodízio automático entre os conectados).",
        ],
      },
      {
        title: "2. Mensagens, variáveis dinâmicas e variações humanizadas",
        intro: "Mensagem idêntica para todos é receita de ban. Personalize.",
        steps: [
          "Escreva o texto de abordagem usando variáveis como {{nome}} e {{scheduling_link}}.",
          "Gere variações humanizadas de texto no próprio formulário para alternar mensagens e evitar filtros de spam.",
          "Configure sequências de passos com intervalos seguros e gatilhos de espera por resposta.",
        ],
      },
      {
        title: "3. IA da Campanha (Roteiro no Lote)",
        intro: "A IA atende com o contexto exclusivo do produto disparado.",
        steps: [
          "Na etapa de agendamento/disparo, selecione 'Agente da campanha'.",
          "Defina a Persona, o Tom de Voz e o Objetivo Central do Atendimento.",
          "A IA responderá exclusivamente com as regras desse lote, congelando o roteiro para os leads que responderem.",
        ],
      },
      {
        title: "4. Disparar em lotes e agendamento",
        steps: [
          "Defina o tamanho do lote (quantos leads por rodada) e o intervalo aleatório de digitação.",
          "Agende para a data/hora ideal no horário comercial.",
          "Acompanhe o envio em tempo real e exporte leads com falhas de número para reprocessamento.",
        ],
      },
    ],
    tips: [
      "Anti-ban: sempre use variações de texto + variáveis {{nome}} para máxima entrega.",
      "Segmente antes no Banco de Dados: campanha para público certo converte mais e gera menos denúncia.",
    ],
  },
  {
    value: "followup",
    label: "Cadências de Follow-up",
    icon: ListChecks,
    permissions: ["whatsapp.view", "whatsapp.reply"],
    title: "Cadências de Follow-up",
    summary:
      "A régua de acompanhamento e cobrança. Se o lead não responde, o Vexo envia mensagens de retorno em datas programadas até ele reagir — e para sozinho quando ele responde.",
    goal: "Objetivo de vendas: nunca mais perder venda por esquecimento de dar retorno.",
    ctaHref: "/crm/followup",
    ctaLabel: "Abrir Follow-up",
    sections: [
      {
        title: "A Regra de Ouro: auto-pausa reativa",
        intro: "A garantia anti-robô do Vexo.",
        steps: [
          "Assim que o lead responde qualquer mensagem, toda a sequência de follow-up dele é cancelada na hora.",
          "Ou seja: você nunca cobra alguém que já respondeu ou já entrou em atendimento humano.",
        ],
      },
      {
        title: "Como configurar as jornadas",
        steps: [
          "Na aba Configurações, ative as jornadas que fazem sentido (ex.: 'Novo Lead', 'Proposta Enviada', 'Sem Contato').",
          "Defina o tempo de espera de cada etapa (ex.: 1º retorno em 1 dia, 2º em 3 dias).",
          "Escreva as mensagens com variáveis para personalizar a abordagem.",
          "Acompanhe a Fila de Follow-up para ver quem está agendado para receber.",
        ],
      },
    ],
    tips: [
      "3 a 4 toques bem espaçados costumam recuperar mais lead do que 1 cobrança agressiva.",
      "Varie o texto de cada etapa: cobrança copiada e colada parece robô e gera bloqueio.",
    ],
  },
  {
    value: "followup_automations",
    label: "Automações por Evento (Follow-up)",
    icon: Zap,
    permissions: ["whatsapp.view", "whatsapp.reply"],
    featureKey: "followup_automations",
    title: "Automações de Follow-up por Evento & Gatilhos Inteligentes",
    summary:
      "Dispare réguas de follow-up automáticas quando eventos externos acontecerem (ex.: proposta gerada, pagamento pendente, carrinho abandonado).",
    goal: "Objetivo de vendas: Reagir a comportamentos do lead no momento exato em que ele demonstra intenção de compra.",
    ctaHref: "/crm/followup",
    ctaLabel: "Abrir Automações de Follow-up",
    sections: [
      {
        title: "Configurar gatilhos automáticos",
        steps: [
          "No Módulo de Follow-up, crie cadências vinculadas a eventos do sistema ou webhooks.",
          "Defina o atraso (delay) ideal para a primeira abordagem (ex.: 15 minutos após gerar proposta).",
          "Acompanhe os disparos agendados e cancelamentos em tempo real na fila.",
        ],
      },
    ],
    tips: [
      "Gatilhos baseados em comportamento convertem até 3x mais do que réguas de tempo puras.",
    ],
  },
  {
    value: "agente",
    label: "Agente IA & Chatbot",
    icon: Bot,
    permissions: ["agente.view", "agente.toggle", "agente.edit_prompt", "agente.change_llm", "agente.change_identity"],
    title: "Agente IA & Chatbot (Iara)",
    summary:
      "A IA que conversa com seus leads de forma receptiva ou ativa, qualifica e coleta dados sozinha antes de passar para o time humano.",
    goal: "Objetivo de vendas: filtrar curioso de comprador e chegar no vendedor só o lead quente, com os dados já coletados.",
    ctaHref: "/crm/agente?tab=operacao",
    ctaLabel: "Abrir Agente IA",
    sections: [
      {
        title: "Ligar / desligar o atendimento por IA",
        steps: [
          "Use o switch na aba Configurações para ativar ou pausar a IA a qualquer momento.",
          "Com a IA desligada, as conversas caem direto para o time no Inbox.",
        ],
      },
      {
        title: "Operação: o Kanban",
        intro: "Aba Operação.",
        steps: [
          "Acompanhe em tempo real todas as conversas que a IA está conduzindo.",
          "Veja em qual estágio da qualificação cada lead está e os dados já extraídos.",
        ],
      },
      {
        title: "Template e Motor de IA (LLM)",
        intro: "Aba Configurações.",
        steps: [
          "Escolha o Template Base de Instruções e o Provedor/Motor de IA (Groq, ChatGPT, Claude, Gemini).",
          "Cadastre os números de SDR/Closer para receber os briefings automáticos.",
        ],
      },
      {
        title: "Inbound (Atendimento por Chip)",
        intro: "Aba Inbound.",
        steps: [
          "Configure as regras de triagem do número inbound principal da sua empresa.",
        ],
      },
    ],
    tips: [
      "Prompt específico > prompt genérico: quanto mais claras as regras e objeções, melhor a IA qualifica.",
      "Comece com poucos campos obrigatórios no SPIN; excesso de perguntas espanta o lead.",
    ],
  },
  {
    value: "rag",
    label: "Base de Conhecimento RAG",
    icon: Database,
    permissions: ["agente.view"],
    featureKey: "agente_rag",
    title: "Base de Conhecimento RAG (Upload de PDFs & Catálogos)",
    summary:
      "Faça upload de catálogos, tabelas de preços, políticas contratuais e manuais técnicos para o Agente IA consultar fatos exatos sem risco de alucinação.",
    goal: "Objetivo de vendas: Dar precisão cirúrgica às respostas da IA, respondendo dúvidas técnicas complexas e tirando dúvidas de produtos em tempo real.",
    ctaHref: "/crm/agente?tab=rag",
    ctaLabel: "Abrir Base RAG",
    sections: [
      {
        title: "1. Upload e Indexação de Documentos",
        steps: [
          "Acesse Agente IA > Base RAG (Arquivos) no menu lateral.",
          "Clique em Upload de Documentos e selecione PDFs, DOCX, TXT ou planilhas de produtos.",
          "O Vexo processa e fragmenta o documento em vetores semânticos no background.",
          "Assim que o status ficar 'Pronto', a IA já passa a consultar o conteúdo automaticamente nas conversas.",
        ],
      },
      {
        title: "2. Simulador de Busca Semântica",
        steps: [
          "Use a caixa de teste na própria aba Base RAG para digitar perguntas que seus clientes fariam.",
          "Veja exatamente os trechos dos PDFs que a IA encontrou com a pontuação de relevância (score).",
          "Ajuste os documentos se notar que faltou algum detalhe de política ou preço.",
        ],
      },
    ],
    tips: [
      "💡 Dica de Conteúdo: Suba documentos com textos claros e tabelas limpas para garantir o melhor índice de resposta.",
      "🔒 Segurança: O Agente IA só responde com base nos documentos enviados para a sua empresa, com isolamento multi-tenant total.",
    ],
  },
  {
    value: "sdr_broadcast",
    label: "Alertas SDR Broadcast",
    icon: Zap,
    permissions: ["dashboard.view"],
    featureKey: "sdr_broadcast",
    title: "Alertas SDR Broadcast & Distribuição de Leads Quentes",
    summary: "Como direcionar automaticamente os leads qualificados como QUENTES para múltiplos consultores da equipe de vendas em tempo real.",
    goal: "Objetivo: Garantir tempo de resposta imediato para leads prontas para fechar negócio com distribuição equilibrada.",
    ctaHref: "/crm/agente?tab=settings",
    ctaLabel: "Configurar Números de SDR",
    sections: [
      {
        title: "Como cadastrar múltiplos consultores",
        steps: [
          "1. Acesse Agente IA > Configurações no menu lateral.",
          "2. Na seção 'Números SDR/Closer', cadastre os números de WhatsApp dos consultores que devem receber o briefing.",
          "3. Assim que um cliente for qualificado pela IA ou solicitar atendimento humano, todos os números cadastrados receberão o briefing completo com nome, respostas SPIN e histórico resumido.",
        ],
      },
    ],
    tips: [
      "💡 Recontato: Se um cliente finalizado chamar de novo, a IA avisa o SDR e disponibiliza o botão 'Reabrir Atendimento' no Inbox.",
    ],
  },
  {
    value: "geracao-digital",
    label: "Geração Digital (Propostas)",
    icon: Briefcase,
    permissions: ["geracao_digital.proposals", "geracao_digital.prices"],
    title: "Geração Digital (Pitch & Propostas)",
    summary:
      "Módulo para conduzir a reunião de venda, montar o briefing/diagnóstico do cliente e gerar propostas comerciais formatadas.",
    goal: "Objetivo de vendas: sair da reunião com diagnóstico feito e proposta pronta para fechar.",
    ctaHref: "/crm/apresentacao-gd",
    ctaLabel: "Abrir Geração Digital",
    sections: [
      {
        title: "Apresentação (pitch interativo)",
        steps: [
          "Use a tela de Apresentação durante a reunião para guiar o cliente de forma visual.",
          "À medida que o cliente responde, o sistema monta um briefing técnico e diagnóstico automático.",
        ],
      },
      {
        title: "Briefings salvos e propostas",
        steps: [
          "Todos os briefings gerados ficam salvos para consulta vitalícia.",
          "Gere a proposta comercial a partir do briefing (requer permissão de propostas).",
          "Ajuste valores e condições da proposta quando tiver a permissão de preços.",
        ],
      },
    ],
    tips: [
      "Preencha o briefing na frente do cliente: diagnóstico ao vivo aumenta a percepção de valor.",
      "Só quem tem permissão de preços muda valores — evita desconto fora de política.",
    ],
  },
  {
    value: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    permissions: ["reports.commercial", "reports.dispatches", "reports.export_pdf"],
    title: "Relatórios de Vendas e Envios",
    summary:
      "Onde você mede resultado: relatórios comerciais (fechamento, funil) e de disparos de WhatsApp (entregues, respondidos, falhados).",
    goal: "Objetivo de vendas: saber o que está dando retorno e cortar o que não está.",
    ctaHref: "/crm/planilhas?tab=relatorios",
    ctaLabel: "Abrir Relatórios de Envios",
    sections: [
      {
        title: "Relatórios de disparos de WhatsApp",
        steps: [
          "Veja por campanha: quantos foram enviados, entregues, responderam e falharam.",
          "Cruze com a origem da lista para saber qual fonte de lead engaja mais.",
        ],
      },
      {
        title: "Relatórios comerciais",
        steps: [
          "Acompanhe funil, taxa de conversão e evolução do fechamento.",
          "Exporte em PDF para enviar ao gestor ou ao cliente (requer permissão de exportação).",
        ],
      },
    ],
    tips: [
      "Compare períodos: número solto não diz nada, tendência sim.",
      "Alta taxa de falha em disparo geralmente é base suja — volte ao Banco de Dados e limpe.",
    ],
  },
  {
    value: "livpub",
    label: "LivPub & Eventos",
    icon: Sparkles,
    permissions: [],
    title: "LivPub & Gestão de Eventos",
    summary:
      "Automação de relacionamento para público de eventos: esteiras de ingresso, cupons e segmentação por comportamento.",
    goal: "Objetivo de vendas: encher e reengajar eventos no automático.",
    ctaHref: "/crm/livpub?tab=eventos",
    ctaLabel: "Abrir Painel LivPub",
    sections: [
      {
        title: "Gestão de eventos (crítico)",
        intro: "A automação depende de um evento ativo cadastrado.",
        steps: [
          "Na aba Eventos, clique em Novo Evento e defina nome, data e local.",
          "Esteira pré-evento: dispara lembrete de emissão de ingresso dias antes.",
          "Esteira pós-evento: envia cupom de desconto exclusivo dias depois.",
        ],
      },
      {
        title: "Relacionamento & segmentação",
        steps: [
          "Filtre a base por comportamento: aniversariantes, inativos (60+ dias), novas assinaturas.",
          "Programe disparos só para o segmento escolhido.",
        ],
      },
    ],
    tips: [
      "Cadastre o evento com a data certa: as esteiras usam a data para calcular quando disparar.",
    ],
  },
  {
    value: "admin",
    label: "Administração & Usuários",
    icon: ShieldCheck,
    permissions: ["users.view", "users.manage", "tenants.manage"],
    title: "Administração (Empresas, Usuários e Permissões)",
    summary:
      "Onde o gestor cadastra a equipe, define exatamente o que cada pessoa acessa e gerencia as empresas/tenants.",
    goal: "Objetivo de vendas: dar a cada vendedor só as ferramentas que ele precisa, sem risco e sem confusão.",
    ctaHref: "/crm/admin?tab=usuarios",
    ctaLabel: "Abrir Administração",
    sections: [
      {
        title: "Criar um novo usuário (passo a passo)",
        steps: [
          "Na aba Usuários, clique em Novo Usuário e informe e-mail, nome e uma senha padrão.",
          "Escolha o Tipo de Acesso: 'Equipe Vexo' (interno) ou 'Cliente / Tenant' (usuário da empresa).",
          "Selecione a Empresa / Tenant vinculada (obrigatório para usuário do tipo cliente).",
          "Escolha o Plano (Essencial vs Avançado) e níveis de segurança.",
          "Marque enviar e-mail de acesso se quiser que o Vexo mande o convite automaticamente.",
          "Salve. No 1º login o usuário é obrigado a trocar a senha padrão antes de entrar.",
        ],
      },
      {
        title: "Editar permissões de quem já existe",
        steps: [
          "Abra o usuário na lista e selecione o Plano de Funcionalidades.",
          "Ligue/desligue restrições de segurança — a mudança vale no próximo login dele.",
          "Você pode desativar o acesso temporariamente sem apagar o cadastro.",
        ],
      },
      {
        title: "Empresas / Tenants",
        steps: [
          "Na aba Empresas, cadastre e configure as empresas parceiras que usam o CRM.",
          "Defina limites de envio e plano do tenant (requer permissão de tenants).",
        ],
      },
    ],
    tips: [
      "Dê o mínimo necessário: vendedor não precisa de permissão de excluir base nem de exportar dados sensíveis.",
      "A lista de permissões se atualiza sozinha quando uma ferramenta nova entra no sistema.",
      "Nunca compartilhe login: crie um usuário por pessoa para medir SLA e responsabilidade.",
    ],
  },
];

interface AccessContext {
  permissions: string[];
  isAdmin: boolean;
}

export default function OnboardingWizard() {
  const { getIdToken, isAdminUser } = useAuth();
  const crmClient = useOptionalCrmClient();
  const selectedClientId = crmClient?.selectedClientId || "";
  const [context, setContext] = useState<AccessContext | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetchApi("/api/access/context", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = await readApiJson<{ access?: { permissions?: string[]; isAdmin?: boolean; role?: string } }>(
          res,
          "access-context"
        );
        if (active && body.access) {
          setContext({
            permissions: body.access.permissions || [],
            isAdmin: Boolean(body.access.isAdmin) || body.access.role === "superadmin",
          });
        }
      } catch (error) {
        console.error("Failed to load access context for academy:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [getIdToken]);

  const [upsellWhatsappNumber, setUpsellWhatsappNumber] = useState("5511999999999");

  useEffect(() => {
    async function loadSettings() {
      try {
        const token = await getIdToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch("/api/system/settings", { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.upsellWhatsappNumber) {
            setUpsellWhatsappNumber(json.upsellWhatsappNumber);
          }
        }
      } catch (err) {
        console.warn("Could not load system settings in academy:", err);
      }
    }
    loadSettings();
  }, [getIdToken]);

  const canSee = useMemo(() => {
    return (module: AcademyModule) => {
      if (module.featureKey && !hasFeatureUnlocked(crmClient?.selectedClient, module.featureKey)) {
        return false;
      }
      if (!context) return module.permissions.length > 0;
      if (context.isAdmin) return true;
      if (module.permissions.length === 0) return false;
      return module.permissions.some((permission) => context.permissions.includes(permission));
    };
  }, [context, crmClient?.selectedClient]);

  const visibleModules = useMemo(() => {
    return ACADEMY_MODULES.filter((module) => {
      if (module.value === "geracao-digital" && selectedClientId !== "geracao-digital") {
        return false;
      }
      if (module.value === "livpub" && !isAdminUser && selectedClientId !== "livpub") {
        return false;
      }
      return true;
    });
  }, [selectedClientId, isAdminUser]);

  const [activeTab, setActiveTab] = useState<string>(visibleModules[0]?.value || "dashboard");

  useEffect(() => {
    if (visibleModules.length > 0 && !visibleModules.some((m) => m.value === activeTab)) {
      setActiveTab(visibleModules[0].value);
    }
  }, [visibleModules, activeTab]);

  return (
    <PageShell
      title="Vexo Academy"
      subtitle="Domine cada ferramenta — o que ela faz, o passo a passo para operar e as dicas de ouro (inclusive anti-ban) para escalar suas vendas."
    >
      <div className="flex flex-col lg:flex-row gap-6 animate-fade-in-up">
        {/* Menu lateral completo (vitrine) */}
        <div className="lg:w-1/4 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="w-full">
            <div className="sticky top-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Trilha de Aprendizado
                  </CardTitle>
                </CardHeader>
                <TabsList className="flex-col items-stretch h-auto bg-transparent p-0">
                  {visibleModules.map((module) => {
                    const ModuleIcon = module.icon;
                    const isUnlocked = canSee(module);
                    return (
                      <TabsTrigger
                        key={module.value}
                        value={module.value}
                        className="justify-between items-center gap-3 rounded-none border-b border-slate-100 dark:border-slate-800 px-4 py-3 data-[state=active]:bg-indigo-50 dark:data-[state=active]:bg-indigo-900/20 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400"
                      >
                        <div className="flex items-center gap-2 text-left">
                          <ModuleIcon className="h-4 w-4 shrink-0" />
                          <span className="font-semibold text-xs">{module.label}</span>
                        </div>
                        {!isUnlocked && <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Card>
            </div>
          </Tabs>
        </div>

        {/* Conteúdo do módulo ou Card de UPSELL */}
        <div className="lg:w-3/4">
          <Tabs value={activeTab}>
            {visibleModules.map((module) => {
              const ModuleIcon = module.icon;
              const isUnlocked = canSee(module);

              if (!isUnlocked) {
                const whatsappMsg = `Olá! Gostaria de fazer a cotação e solicitar o upgrade do módulo ${module.title} no Vexo OS.`;
                const whatsappUrl = `https://wa.me/${upsellWhatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}`;

                return (
                  <TabsContent key={module.value} value={module.value} className="m-0 animate-fade-in-up">
                    <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950 p-8 shadow-xl text-center space-y-6">
                      <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                        <Lock className="w-8 h-8" />
                      </div>
                      <div className="space-y-3 max-w-xl mx-auto">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-3 py-1 font-bold">
                            🔒 Módulo Não Contratado
                          </Badge>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs px-3 py-1 font-bold">
                            🟣 Disponível no Plano Avançado ou Avulso
                          </Badge>
                        </div>
                        <h3 className="text-2xl font-black text-amber-400">{module.title}</h3>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">
                          {module.summary}
                        </p>
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-200 text-left">
                          <strong>💡 Benefício Comercial: </strong>
                          <span>{module.goal}</span>
                        </div>
                      </div>
                      <div>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg hover:shadow-emerald-500/25 transition-all"
                        >
                          💬 Fazer Cotação pelo WhatsApp
                        </a>
                      </div>
                    </Card>
                  </TabsContent>
                );
              }

              return (
                <TabsContent key={module.value} value={module.value} className="m-0 space-y-6 animate-fade-in-up">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-bold px-2.5 py-0.5">
                          ✔ Aula Liberada
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                        <ModuleIcon className="h-6 w-6" />
                        {module.title}
                      </CardTitle>
                      <CardDescription className="text-base">{module.summary}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 text-slate-700 dark:text-slate-300">
                      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4 text-sm text-indigo-800 dark:text-indigo-300">
                        {module.goal}
                      </div>

                      {module.sections.map((section) => (
                        <div key={section.title} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-2">
                          <h4 className="font-bold text-base text-indigo-600 dark:text-indigo-400">{section.title}</h4>
                          {section.intro && <p className="text-sm">{section.intro}</p>}
                          {section.steps && (
                            <ol className="mt-1 space-y-2 list-decimal list-inside text-sm">
                              {section.steps.map((step, index) => (
                                <li key={index}>{step}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ))}

                      {module.tips.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-5 flex gap-4">
                          <Lightbulb className="h-6 w-6 text-amber-500 shrink-0" />
                          <div className="space-y-2">
                            <h4 className="font-bold text-amber-800 dark:text-amber-500">Dicas de Ouro</h4>
                            <ul className="space-y-1.5 text-sm text-amber-700 dark:text-amber-400">
                              {module.tips.map((tip, index) => (
                                <li key={index} className="flex gap-2">
                                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      <Button onClick={() => (window.location.href = module.ctaHref)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
                        {module.ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
    </PageShell>
  );
}
