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
  LineChart,
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
      "O motor de abordagem ativa. Uma Campanha guarda a base e a mensagem; os Disparos são os lotes de envio que você executa a partir dela — agora, agendado, em partes.",
    goal: "Objetivo de vendas: abordar centenas de leads de forma personalizada e humanizada, controlando ritmo e volume para não queimar chip.",
    ctaHref: "/crm/campanhas",
    ctaLabel: "Abrir Campanhas",
    sections: [
      {
        title: "1. Criar uma campanha",
        steps: [
          "Clique em Nova Campanha e dê um nome claro (ex.: 'Feira Set/26 - Frios').",
          "Escolha a base: importe uma planilha na hora ou puxe um segmento já filtrado no Banco de Dados.",
          "Selecione o chip / instância que vai enviar (ou deixe o rodízio automático entre os conectados).",
        ],
      },
      {
        title: "2. Montar a mensagem e usar modelos com variáveis",
        intro: "Mensagem idêntica para todos é receita de ban. Personalize.",
        steps: [
          "Escreva o texto de abordagem usando variáveis como {{nome}} — cada lead recebe a mensagem com o próprio nome.",
          "Monte variações do texto (modelos): o Vexo alterna entre elas para não repetir a mesma mensagem em massa.",
          "Se disponível, use a geração de cópia por IA para criar variações humanizadas rápido.",
          "Você pode montar uma sequência de passos (mensagem 1, 2, 3) com intervalos entre elas.",
        ],
      },
      {
        title: "3. Disparar em lotes (controle de volume)",
        intro: "Não precisa mandar tudo de uma vez. Lote existe para proteger o chip.",
        steps: [
          "Ao criar o disparo, defina o tamanho do lote (quantos leads por rodada) e o ponto de início (offset).",
          "Ex.: base de 2.000 → dispare 300 hoje, 300 amanhã, seguindo o offset de onde parou.",
          "Antes de disparar, use a prévia de alvo (preview) para ver quantos e quais leads aquele lote vai atingir.",
          "O envio sai com intervalos aleatórios entre mensagens, simulando digitação humana.",
        ],
      },
      {
        title: "4. Agendar disparos",
        steps: [
          "Ao criar o disparo, escolha o tipo Agendado e informe data e hora.",
          "O Vexo executa sozinho no horário marcado — bom para pegar horário comercial ou evitar madrugada.",
          "Disparos agendados ficam com status 'agendado' até a hora; você pode editar ou cancelar antes.",
        ],
      },
      {
        title: "5. Acompanhar, pausar e exportar falhados",
        steps: [
          "Enquanto roda, o disparo mostra status 'em execução' e o total enviado.",
          "Precisou parar? Use Pausar para interromper um disparo em andamento (requer permissão).",
          "No fim, exporte o relatório de leads falhados (número inválido, sem WhatsApp) para tratar e reenviar.",
        ],
      },
    ],
    tips: [
      "Anti-ban: sempre use variações de texto + variáveis {{nome}}. Texto único em massa é o que mais gera bloqueio.",
      "Anti-ban: prefira lotes menores e mais frequentes a um disparo gigante de uma vez.",
      "Segmente antes no Banco de Dados: campanha para público certo converte mais e gera menos denúncia.",
      "Reaproveite os leads falhados exportados: corrija o telefone e crie um novo lote só com eles.",
    ],
  },
  {
    value: "followup",
    label: "Cadências de Follow-up",
    icon: ListChecks,
    permissions: ["whatsapp.view", "whatsapp.reply"],
    title: "Cadências de Follow-up",
    summary:
      "A régua de cobrança automática. Se o lead não responde, o Vexo envia mensagens de retorno em datas programadas até ele reagir — e para sozinho quando ele responde.",
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
          "Escreva as mensagens; use IA para gerar variações humanizadas e evitar repetição.",
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
          "Use o botão de liga/desliga do agente para ativar ou pausar a IA a qualquer momento (requer permissão).",
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
        title: "Coleta SPIN (o que a IA precisa descobrir)",
        intro: "Aba Configurações.",
        steps: [
          "Defina quais dados a IA é obrigada a coletar (ex.: orçamento, volume, prazo, decisor).",
          "A IA conduz a conversa dinamicamente até obter essas respostas antes de concluir.",
        ],
      },
      {
        title: "Prompt, provedor de IA e identidade",
        steps: [
          "Edite o Prompt / instruções para definir o tom, as regras e como contornar objeções (requer permissão).",
          "Troque o provedor/modelo de LLM (OpenAI, Groq, Anthropic) conforme custo e qualidade (requer permissão).",
          "Ajuste nome e foto do agente para dar identidade à IA (requer permissão).",
        ],
      },
      {
        title: "Webhook de finalização",
        steps: [
          "Ao concluir a qualificação, a IA dispara um webhook (JSON) com os dados capturados.",
          "Conecte esse webhook ao seu CRM, planilha ou n8n/Zapier para automatizar o próximo passo.",
        ],
      },
    ],
    tips: [
      "Prompt específico > prompt genérico: quanto mais claras as regras e objeções, melhor a IA qualifica.",
      "Comece com poucos campos obrigatórios no SPIN; excesso de perguntas espanta o lead.",
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
    ctaHref: "/crm/relatorios",
    ctaLabel: "Abrir Relatórios",
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
    value: "inteligencia",
    label: "Inteligência Comercial",
    icon: LineChart,
    permissions: ["reports.commercial"],
    title: "Inteligência Comercial & Distribuição",
    summary:
      "Inteligência ativa sobre a eficiência da venda: tempo de resposta (SLA) e distribuição automática de leads entre vendedores.",
    goal: "Objetivo de vendas: leads quentes atendidos rápido e divididos com justiça, sem lead esquecido.",
    ctaHref: "/crm/inteligencia-comercial",
    ctaLabel: "Abrir Int. Comercial",
    sections: [
      {
        title: "Controle de SLA (tempo de resposta)",
        steps: [
          "Meça quanto tempo o vendedor leva para responder após a IA passar o bastão.",
          "Cobrança de SLA baixo (< 5 min) puxa a taxa de fechamento para cima.",
        ],
      },
      {
        title: "Roteamento Round-Robin (roleta comercial)",
        steps: [
          "Defina as regras de distribuição automática de leads qualificados entre os vendedores.",
          "Garante divisão justa e ordenada, sem disputa nem lead esquecido.",
        ],
      },
    ],
    tips: [
      "Round-robin só funciona se todos os vendedores estiverem cadastrados e ativos.",
      "Acompanhe o SLA por vendedor: gargalo quase sempre é uma pessoa, não o sistema.",
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
          "Na Matriz de Permissões, ligue apenas as ferramentas que essa pessoa pode usar (por categoria).",
          "Marque enviar e-mail de acesso se quiser que o Vexo mande o convite automaticamente.",
          "Salve. No 1º login o usuário é obrigado a trocar a senha padrão antes de entrar.",
        ],
      },
      {
        title: "Editar permissões de quem já existe",
        steps: [
          "Abra o usuário na lista e vá na Matriz de Permissões.",
          "Ligue/desligue ferramentas — a mudança vale no próximo login dele.",
          "Você pode desativar o acesso temporariamente sem apagar o cadastro.",
        ],
      },
      {
        title: "Empresas / Tenants",
        steps: [
          "Na aba Empresas, cadastre e configure as empresas parceiras que usam o CRM.",
          "Defina limites de envio e dados básicos de cada tenant (requer permissão de tenants).",
        ],
      },
    ],
    tips: [
      "Dê o mínimo necessário: vendedor não precisa de permissão de excluir base nem de trocar LLM.",
      "A lista de permissões se atualiza sozinha quando uma ferramenta nova entra no sistema.",
      "Nunca compartilhe login: crie um usuário por pessoa para medir SLA e responsabilidade.",
    ],
  },
  {
    value: "planilhas_antiban",
    label: "Envios & Variações Antiban",
    icon: Send,
    permissions: ["planilhas.view"],
    title: "Envios em Massa & Variações Humanizadas (Groq AI)",
    summary: "Como criar sequências de mensagens em massa protegidas contra bloqueios do WhatsApp utilizando rotação inteligente de texto.",
    goal: "Objetivo: Alcançar 100% da base com taxa de entrega máxima e zero bloqueios de chip.",
    ctaHref: "/crm/planilhas",
    ctaLabel: "Abrir Envios por Planilha",
    sections: [
      {
        title: "Passo a passo do envio seguro",
        steps: [
          "1. Carregue a planilha de contatos em formato CSV ou XLSX no Passo 1.",
          "2. Redija a mensagem base utilizando as variáveis {{nome}}, {{telefone}} e {{scheduling_link}}.",
          "3. Clique em 'Gerar Variações Humanizadas' e escolha a quantidade (de 2 a 30 variações).",
          "4. Selecione a frequência de disparo adequada (10 min ou 20 min para chips em aquecimento).",
          "5. Revise a prévia no Simulador de WhatsApp ao lado antes de disparar.",
        ],
      },
    ],
    tips: [
      "💡 Dica Antiban: Para bases com mais de 200 contatos, utilize sempre pelo menos 15 variações de texto.",
      "⚠️ Frequência: Chips novos (frios) devem utilizar a frequência de 20 minutos por envio.",
    ],
  },
  {
    value: "agente_campanha",
    label: "Agente IA de Campanha",
    icon: Bot,
    permissions: ["whatsapp.reply"],
    title: "Agente IA com Roteiro Personalizado por Campanha",
    summary: "Como criar uma campanha onde o chatbot de IA qualifica o lead usando uma proposta de vendas exclusiva daquele produto.",
    goal: "Objetivo: Automatizar a negociação sem perder o tom de conversa nem errar o preço da oferta.",
    ctaHref: "/crm/planilhas",
    ctaLabel: "Criar Campanha com Agente",
    sections: [
      {
        title: "Como configurar a IA no disparo",
        steps: [
          "1. Na Timeline de Envio, altere a opção para 'Com Agente IA'.",
          "2. Escreva o Roteiro do Agente especificando o produto, preço, benefícios e objeções comuns.",
          "3. Ao disparar, o sistema congela uma cópia estática deste roteiro para este lote.",
          "4. Quando o cliente responder à mensagem, a IA responderá utilizando exatamente estas regras.",
        ],
      },
    ],
    tips: [
      "💡 Dica de Roteiro: Seja específico no preço e nas opções de resposta rápida (ex: 1. Quero agendar | 2. Prefiro orçamento).",
    ],
  },
  {
    value: "sdr_broadcast",
    label: "Alertas SDR & Recontato",
    icon: Zap,
    permissions: ["dashboard.view"],
    title: "Lista de SDRs & Alerta Simultâneo (Broadcast)",
    summary: "Como direcionar automaticamente os leads qualificados como QUENTES para a equipe de consultores humanos.",
    goal: "Objetivo: Garantir tempo de resposta imediato para leads prontas para fechar negócio.",
    ctaHref: "/crm/agente?tab=inbound",
    ctaLabel: "Configurar Números de SDR",
    sections: [
      {
        title: "Como cadastrar a equipe de vendas",
        steps: [
          "1. Acesse Agente IA no menu lateral e vá na aba Configurações/Inbound.",
          "2. No campo 'WhatsApp dos SDRs', insira os números de celular dos consultores (com DDD, separados por vírgula).",
          "3. Assim que um cliente for classificado como QUENTE ou solicitar atendente humano, todos os números cadastrados receberão o alerta de WhatsApp na mesma hora.",
        ],
      },
    ],
    tips: [
      "💡 Recontato: Se um cliente finalizado chamar de novo, a IA avisa o SDR e disponibiliza o botão 'Reabrir Atendimento' no Inbox.",
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
      if (!context) return module.permissions.length > 0;
      if (context.isAdmin) return true;
      if (module.permissions.length === 0) return false;
      return module.permissions.some((permission) => context.permissions.includes(permission));
    };
  }, [context]);

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
                            🔒 Recurso do Plano Avançado
                          </Badge>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs px-3 py-1 font-bold">
                            🟣 Plano Avançado
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
