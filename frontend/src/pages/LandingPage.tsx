import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  BarChart3,
  MessageCircle,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  const { isAuthenticated, isClientUser, defaultRoute } = useAuth();
  const crmHref = isAuthenticated ? defaultRoute : "/login";
  const primaryLabel = isAuthenticated ? (isClientUser ? "Abrir Portal" : "Abrir CRM") : "Entrar no CRM";

  return (
    <main className="relative min-h-screen overflow-hidden bg-deep-navy text-[#F8FAFC]">
      {/* Background gradient blurs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-electric-indigo/20 blur-[180px]" />
        <div className="absolute right-[5%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-electric-indigo/10 blur-[160px]" />
        <div className="absolute left-[50%] top-[60%] h-[300px] w-[300px] rounded-full bg-cyan-neon/5 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-8">
        {/* ── Header ── */}
        <header className="mb-14 flex items-center justify-between">
          <nav className="flex items-center gap-10 text-sm text-[#E2E8F0]/70">
            <a href="#solucao" className="transition-colors hover:text-[#F8FAFC]">Solucao</a>
            <a href="#modulos" className="transition-colors hover:text-[#F8FAFC]">Modulos</a>
            <a href="#planos" className="transition-colors hover:text-[#F8FAFC]">Estrutura</a>
            <Link to={crmHref} className="transition-colors hover:text-[#F8FAFC]">{primaryLabel}</Link>
          </nav>
        </header>

        {/* ── Hero ── */}
        <section className="mb-16 grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-[#F8FAFC] sm:text-4xl lg:text-[2.75rem]">
              CRM com IA para Operar Atendimento, Leads e Vendas com Mais Controle
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#E2E8F0]/60">
              Automatize processos, melhore o relacionamento com clientes e aumente suas vendas.
            </p>
          </div>

          {/* KPI Card */}
          <div className="glass-panel rounded-xl p-6">
            <div className="space-y-4">
              {[
                ["Novos Contatos", "124"],
                ["Em Atendimento", "37"],
                ["Propostas Abertas", "19"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-[rgba(226,232,240,0.08)] pb-4 last:border-0 last:pb-0">
                  <span className="text-sm text-[#E2E8F0]/70">{label}</span>
                  <span className="font-mono text-2xl font-bold text-[#F8FAFC]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Bento Grid ── */}
        <section id="solucao" className="mb-16 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:grid-rows-2">
          {/* Card grande - Atendimento Inteligente */}
          <div className="glass-panel row-span-2 flex flex-col justify-end rounded-xl p-8">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-neon/20">
              <MessageCircle className="h-8 w-8 text-cyan-neon" />
            </div>
            <h3 className="text-2xl font-bold text-[#F8FAFC]">Atendimento Inteligente</h3>
            <p className="mt-3 text-sm leading-6 text-[#E2E8F0]/60">
              Respostas automatizadas com IA para agilizar o suporte.
            </p>
          </div>

          {/* Card - Gestao de Leads */}
          <div className="glass-panel flex items-start gap-4 rounded-xl p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-electric-indigo/20">
              <Users className="h-6 w-6 text-electric-indigo" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Gestao de Leads</h3>
              <p className="mt-1 text-sm text-[#E2E8F0]/60">Organize e qualifique seus leads facilmente.</p>
            </div>
          </div>

          {/* Card - Analises Avancadas */}
          <div className="glass-panel flex items-start gap-4 rounded-xl p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-electric-indigo/20">
              <BarChart3 className="h-6 w-6 text-electric-indigo" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">Analises Avancadas</h3>
              <p className="mt-1 text-sm text-[#E2E8F0]/60">Insights detalhados para decisao estrategica.</p>
            </div>
          </div>
        </section>

        {/* ── Planos ── */}
        <section id="planos" className="mb-20 grid gap-4 lg:grid-cols-3">
          {/* Start */}
          <div className="glass-panel flex flex-col items-center rounded-xl p-8 text-center">
            <h3 className="text-xl font-bold text-[#F8FAFC]">Start</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-sm text-[#E2E8F0]/60">R$</span>
              <span className="font-mono text-4xl font-bold text-[#F8FAFC]">79</span>
              <span className="text-sm text-[#E2E8F0]/60">/mes</span>
            </div>
            <Link
              to={crmHref}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-electric-indigo px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-electric-indigo/90"
            >
              Assinar
            </Link>
          </div>

          {/* Scale */}
          <div className="glass-panel flex flex-col items-center rounded-xl p-8 text-center">
            <h3 className="text-xl font-bold text-[#F8FAFC]">Scale</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-sm text-[#E2E8F0]/60">R$</span>
              <span className="font-mono text-4xl font-bold text-[#F8FAFC]">149</span>
              <span className="text-sm text-[#E2E8F0]/60">/mes</span>
            </div>
            <Link
              to={crmHref}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-electric-indigo px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-electric-indigo/90"
            >
              Assinar
            </Link>
          </div>

          {/* Custom */}
          <div className="glass-panel flex flex-col items-center rounded-xl p-8 text-center">
            <h3 className="text-xl font-bold text-[#F8FAFC]">Custom</h3>
            <p className="mt-3 text-sm text-[#E2E8F0]/60">Plano Sob Medida</p>
            <Link
              to={crmHref}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-[rgba(226,232,240,0.15)] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-[#F8FAFC] transition-all duration-300 hover:bg-white/[0.06]"
            >
              Fale com Vendas
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
