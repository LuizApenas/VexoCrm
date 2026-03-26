import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Cpu,
  LayoutPanelTop,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";

const highlights = [
  "Atendimento com IA conectado ao comercial",
  "CRM para operar leads com previsibilidade",
  "Dashboards e automacoes para escalar",
];

const capabilities = [
  {
    title: "Atendimento automatizado",
    description:
      "Capte, responda e qualifique contatos em tempo real com fluxos integrados ao processo comercial.",
    icon: MessageSquareText,
    tone: "from-[#1A5CFF]/18 via-[#1A5CFF]/6 to-transparent",
  },
  {
    title: "CRM de execucao",
    description:
      "Centralize pipeline, responsaveis, status e historico para transformar operacao em rotina controlada.",
    icon: LayoutPanelTop,
    tone: "from-white/12 via-white/4 to-transparent",
  },
  {
    title: "Motor de automacao",
    description:
      "Acione tarefas, follow-ups e acoes inteligentes para reduzir atraso operacional e perder menos oportunidades.",
    icon: Workflow,
    tone: "from-[#1A5CFF]/14 via-[#2E6FFF]/6 to-transparent",
  },
];

const metrics = [
  { value: "24/7", label: "resposta ativa", detail: "Chatbots operando sem janela morta." },
  { value: "1 hub", label: "operacao central", detail: "Leads, atendimento e CRM no mesmo fluxo." },
  { value: "+visao", label: "decisao rapida", detail: "Dados claros para acompanhar gargalos e conversao." },
];

const modules = [
  {
    eyebrow: "CAPTURA",
    title: "Entrada estruturada de leads",
    description:
      "WhatsApp, formularios e canais de contato entram com contexto, dono e proximo passo definido.",
    icon: Bot,
  },
  {
    eyebrow: "GESTAO",
    title: "Operacao orientada por processo",
    description:
      "Seu time acompanha funil, pendencias e ritmo comercial sem depender de planilhas soltas.",
    icon: ShieldCheck,
  },
  {
    eyebrow: "ANALISE",
    title: "Monitoramento em tempo real",
    description:
      "Dashboards e sinais operacionais mostram o que travou, o que converteu e onde agir primeiro.",
    icon: ChartNoAxesCombined,
  },
];

const plans = [
  {
    name: "Start",
    price: "Estrutura inicial",
    description: "Para operacoes que querem sair do improviso e ganhar cadencia.",
    features: ["Fluxo de atendimento", "Organizacao de leads", "Entrada no CRM"],
    featured: false,
  },
  {
    name: "Scale",
    price: "Operacao completa",
    description: "Para times que precisam integrar atendimento, CRM e automacoes em um unico stack.",
    features: ["Automacoes comerciais", "Visao gerencial", "Acompanhamento de performance", "Mais controle operacional"],
    featured: true,
  },
  {
    name: "Custom",
    price: "Projeto sob medida",
    description: "Para empresas com operacao mais sofisticada e necessidade de desenho especifico.",
    features: ["Mapeamento de processo", "Ajustes por canal", "Evolucao assistida"],
    featured: false,
  },
];

export default function LandingPage() {
  const { isAuthenticated, isClientUser, defaultRoute } = useAuth();
  const crmHref = isAuthenticated ? defaultRoute : "/login";
  const primaryLabel = isAuthenticated ? (isClientUser ? "Abrir portal" : "Abrir CRM") : "Entrar no CRM";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030308] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(26,92,255,0.14),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(26,92,255,0.08),transparent_22%),linear-gradient(180deg,#030308_0%,#050818_38%,#030308_100%)]" />
        <div className="absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-[#1A5CFF]/20 blur-[140px]" />
        <div className="absolute right-[-10rem] top-12 h-96 w-96 rounded-full bg-[#1A5CFF]/10 blur-[160px]" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-[#1A5CFF]/6 blur-[180px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        {/* ── Header ── */}
        <header className="sticky top-0 z-30 mb-8 animate-fade-in-up">
          <nav className="glass-panel mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1A5CFF]/30 bg-[#1A5CFF]/15 shadow-[0_0_30px_rgba(26,92,255,0.25)]">
                <span className="text-lg font-bold text-[#1A5CFF]">V</span>
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.28em] text-white/60">VEXO</p>
                <p className="text-xs font-light text-white/50">CRM, IA e automacao comercial</p>
              </div>
            </div>

            <div className="hidden items-center gap-8 text-sm font-medium text-white/50 md:flex">
              <a href="#solucao" className="shiny-sm rounded-full px-3 py-1.5 transition-colors hover:text-white">
                Solucao
              </a>
              <a href="#modulos" className="shiny-sm rounded-full px-3 py-1.5 transition-colors hover:text-white">
                Modulos
              </a>
              <a href="#planos" className="shiny-sm rounded-full px-3 py-1.5 transition-colors hover:text-white">
                Estrutura
              </a>
            </div>

            <Link
              to={crmHref}
              className="shiny-cta inline-flex items-center gap-2 rounded-full bg-[#1A5CFF] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-[#2E6FFF]"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        {/* ── Hero ── */}
        <section className="grid flex-1 items-center gap-14 pb-20 pt-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-12">
          <div className="max-w-4xl animate-fade-in-up">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#1A5CFF]/20 bg-[#1A5CFF]/8 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-[#3A75FF]">
              <Sparkles className="h-3.5 w-3.5" />
              tecnologia para atendimento, crm e escala comercial
            </div>

            <h1 className="max-w-5xl text-5xl font-extrabold leading-[0.92] tracking-[-0.06em] text-white sm:text-6xl lg:text-[5.5rem]">
              CRM com IA para operar atendimento, leads e vendas com mais controle.
            </h1>

            <p className="mt-8 max-w-2xl text-base font-light leading-8 text-white/55 sm:text-lg sm:leading-9">
              A Vexo une chatbot, CRM e automacoes em uma camada unica de execucao. Seu time responde mais rapido,
              organiza o funil e acompanha a operacao com clareza real.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <Link
                to={crmHref}
                className="shiny-cta group inline-flex items-center justify-center gap-2 rounded-full bg-[#1A5CFF] px-8 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_50px_rgba(26,92,255,0.30)] transition-all hover:translate-y-[-1px] hover:bg-[#2E6FFF]"
              >
                {isAuthenticated ? (isClientUser ? "Abrir portal agora" : "Abrir CRM agora") : "Acessar CRM"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#solucao"
                className="shiny-cta inline-flex items-center justify-center gap-2 rounded-full bg-white/[0.03] px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-white/[0.06]"
              >
                Ver estrutura
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item} className="glass-panel rounded-2xl px-4 py-4 text-sm font-light text-white/60">
                  <div className="mb-3 h-1 w-14 rounded-full bg-[#1A5CFF]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* ── Control Layer card ── */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-[#1A5CFF]/20 to-transparent blur-3xl" />
            <div className="glass-panel relative overflow-hidden rounded-[2rem] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.5)] sm:p-7">
              <div className="mb-6 flex items-center justify-between border-b border-white/6 pb-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#3A75FF]">CONTROL LAYER</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Operacao visivel em tempo real</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1A5CFF]/20 bg-[#1A5CFF]/10">
                  <Cpu className="h-5 w-5 text-[#1A5CFF]" />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.75rem] border border-white/6 bg-white/[0.02] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Pipeline vivo</p>
                      <p className="mt-3 max-w-sm text-lg font-medium text-white/85">
                        Leads entram, sao qualificados e caminham com proximo passo definido.
                      </p>
                    </div>
                    <div className="rounded-full border border-[#1A5CFF]/20 bg-[#1A5CFF]/8 px-3 py-1 font-mono text-[10px] text-[#3A75FF]">ativo</div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {[
                      ["Novos contatos", "124"],
                      ["Em atendimento", "37"],
                      ["Propostas abertas", "19"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#030308]/60 px-4 py-3">
                        <span className="text-sm font-light text-white/50">{label}</span>
                        <span className="text-base font-bold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-4">
                      <p className="text-2xl font-extrabold tracking-[-0.06em] text-[#1A5CFF]">{metric.value}</p>
                      <p className="mt-2 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-white/40">{metric.label}</p>
                      <p className="mt-3 text-xs font-light leading-5 text-white/50">{metric.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Solucao ── */}
        <section id="solucao" className="pb-24 pt-2">
          <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#3A75FF]">SOLUCAO VEXO</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-white sm:text-5xl">
                Uma camada unica para capturar, operar e escalar.
              </h2>
            </div>
            <p className="max-w-xl text-base font-light leading-8 text-white/50">
              A referencia visual pede impacto. Aqui isso vira uma pagina que comunica estrutura operacional, nao so
              software bonito.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
            {capabilities.map((item, index) => (
              <div
                key={item.title}
                className={`group relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#040612] p-7 transition-all duration-300 hover:border-[#1A5CFF]/20 ${
                  index === 0 ? "lg:min-h-[24rem]" : "lg:min-h-[18rem]"
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.tone} opacity-100 transition-opacity`} />
                <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,rgba(26,92,255,0.15),transparent_45%)]" />
                </div>
                <div className="relative flex h-full flex-col">
                  <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1A5CFF]/15 bg-[#1A5CFF]/6">
                    <item.icon className="h-6 w-6 text-[#1A5CFF]" />
                  </div>
                  <h3 className="max-w-xs text-2xl font-bold tracking-[-0.04em] text-white">{item.title}</h3>
                  <p className="mt-4 max-w-md text-sm font-light leading-7 text-white/50">{item.description}</p>
                  <div className="mt-auto pt-8 font-mono text-[9px] uppercase tracking-[0.24em] text-[#3A75FF]">VEXO SYSTEM</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Modulos ── */}
        <section id="modulos" className="grid gap-4 border-y border-white/5 py-24 lg:grid-cols-3">
          {modules.map((item) => (
            <div key={item.title} className="glass-panel group rounded-[1.75rem] p-6 transition-all duration-300 hover:border-[#1A5CFF]/15">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/35">{item.eyebrow}</p>
                <item.icon className="h-5 w-5 text-[#1A5CFF]" />
              </div>
              <h3 className="mt-8 text-2xl font-bold tracking-[-0.04em] text-white">{item.title}</h3>
              <p className="mt-4 text-sm font-light leading-7 text-white/50">{item.description}</p>
            </div>
          ))}
        </section>

        {/* ── Planos ── */}
        <section id="planos" className="py-24">
          <div className="mb-12 max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#3A75FF]">ESTRUTURA</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-white sm:text-5xl">
              Modelos de entrada para cada estagio de operacao.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex h-full flex-col rounded-[2rem] border p-7 transition-all duration-300 ${
                  plan.featured
                    ? "border-[#1A5CFF]/30 bg-[#060A2A] shadow-[0_0_80px_rgba(26,92,255,0.12)]"
                    : "border-white/5 bg-[#040612] hover:border-[#1A5CFF]/15"
                }`}
              >
                {plan.featured ? (
                  <div className="absolute -top-3 left-6 rounded-full border border-[#1A5CFF]/30 bg-[#1A5CFF] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                    mais completo
                  </div>
                ) : null}
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/35">{plan.name}</p>
                <h3 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-white">{plan.price}</h3>
                <p className="mt-4 text-sm font-light leading-7 text-white/50">{plan.description}</p>
                <div className="mt-8 h-px bg-white/5" />
                <div className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm font-light text-white/65">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1A5CFF]/20 bg-[#1A5CFF]/8">
                        <Check className="h-3.5 w-3.5 text-[#1A5CFF]" />
                      </span>
                      {feature}
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-10">
                  <Link
                    to={crmHref}
                    className={`shiny-cta inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold uppercase tracking-[0.18em] transition-all ${
                      plan.featured
                        ? "bg-[#1A5CFF] text-white hover:bg-[#2E6FFF] shadow-[0_0_30px_rgba(26,92,255,0.20)]"
                        : "bg-white/[0.03] text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {primaryLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="pb-16">
          <div className="overflow-hidden rounded-[2.5rem] border border-[#1A5CFF]/15 bg-[linear-gradient(135deg,rgba(26,92,255,0.15),rgba(46,111,255,0.05),rgba(0,0,0,0.4))] p-[1px]">
            <div className="rounded-[calc(2.5rem-1px)] bg-[#030308] px-6 py-12 text-center sm:px-10 sm:py-16">
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#3A75FF]">PRONTO PARA OPERAR MELHOR</p>
              <h2 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold tracking-[-0.06em] text-white sm:text-6xl">
                Estruture sua operacao comercial com uma base mais tecnologica, moderna e executavel.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-base font-light leading-8 text-white/50">
                Entre no ambiente da Vexo e avance de atendimento disperso para uma maquina de relacionamento e vendas
                com mais visibilidade.
              </p>
              <div className="mt-10 flex justify-center">
                <Link
                  to={crmHref}
                  className="shiny-cta group inline-flex items-center gap-2 rounded-full bg-[#1A5CFF] px-8 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_60px_rgba(26,92,255,0.25)] transition-all hover:scale-[1.01] hover:bg-[#2E6FFF]"
                >
                  {isAuthenticated ? (isClientUser ? "Abrir portal" : "Abrir CRM") : "Entrar no CRM"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
