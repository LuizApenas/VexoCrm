import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionDivider } from "@/components/SectionDivider";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Bot, Building2, LayoutDashboard, MessageSquareText, Users } from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  {
    title: "Chatbots com IA",
    description: "Automatize atendimento, qualificacao e resposta inicial com fluxos conectados ao seu comercial.",
    icon: Bot,
  },
  {
    title: "CRM e operacao",
    description: "Organize leads, acompanhe o funil e centralize a operacao em um unico ambiente.",
    icon: Users,
  },
  {
    title: "Dashboards e acompanhamento",
    description: "Visualize resultados, performance e dados da operacao com leituras claras para decisao.",
    icon: LayoutDashboard,
  },
];

export default function LandingPage() {
  const { isAuthenticated, isClientUser, defaultRoute } = useAuth();
  const crmHref = isAuthenticated ? defaultRoute : "/login";
  const primaryLabel = isAuthenticated ? (isClientUser ? "Abrir portal" : "Abrir CRM") : "Entrar no CRM";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-6rem] top-20 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
        <header className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">Vexo</p>
              <p className="text-sm text-muted-foreground">Chatbot, CRM e automacao comercial</p>
            </div>
          </div>

          <Button asChild>
            <Link to={crmHref}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20 lg:py-24">
          <div className="space-y-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-sm text-primary">
              <MessageSquareText className="h-4 w-4" />
              Solucoes para vendas, atendimento e relacionamento
            </div>

            <div className="space-y-6">
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
                Tecnologia para escalar atendimento, organizar leads e acelerar vendas.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
                Criamos solucoes com chatbot, CRM e automacoes para empresas que querem vender melhor,
                responder mais rapido e acompanhar a operacao com clareza.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="rounded-xl px-7 sm:min-w-52">
                <Link to={crmHref}>
                  {isAuthenticated ? (isClientUser ? "Ir para o portal" : "Ir para o CRM") : "Acessar CRM"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl border-border/80 bg-transparent sm:min-w-52"
              >
                <a href="#servicos">Conhecer servicos</a>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-card/70 p-7 shadow-sm backdrop-blur-sm sm:p-8 lg:p-10">
            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-sm font-medium text-primary">O que entregamos</p>
                <h2 className="text-2xl font-semibold">Uma estrutura simples para operar melhor</h2>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-5">
                  <p className="text-sm font-semibold">Atendimento automatizado</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Chatbots para captar, responder e qualificar contatos com mais velocidade.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-5">
                  <p className="text-sm font-semibold">Processo comercial organizado</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Leads, status, acompanhamento e visao operacional em um CRM central.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-5">
                  <p className="text-sm font-semibold">Gestao orientada por dados</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Dashboards para acompanhar resultados, gargalos e oportunidades.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionDivider label="servicos" />

        <section id="servicos" className="space-y-8 pb-16 pt-8 sm:space-y-10 sm:pb-20 sm:pt-10 lg:pb-24 lg:pt-12">
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium text-primary">Servicos</p>
            <h2 className="text-3xl font-semibold">Solucoes para atendimento e crescimento comercial</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.title} className="rounded-[1.5rem] border-border/70 bg-card/65">
                <CardHeader className="space-y-5 p-6 pb-4 sm:p-7 sm:pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <service.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="max-w-[12ch] text-2xl leading-tight">{service.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-0 sm:px-7 sm:pb-7">
                  <p className="text-sm leading-7 text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <SectionDivider />

        <section className="pb-10 pt-8 sm:pb-12 sm:pt-10">
          <div className="rounded-[2rem] border border-border/70 bg-card/70 px-6 py-10 text-center sm:px-8 sm:py-12">
            <h2 className="text-3xl font-semibold sm:text-[2.1rem]">Pronto para centralizar sua operacao?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Entre no CRM para acompanhar leads, operacao e resultados em um unico lugar.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" className="rounded-xl px-8 sm:min-w-64">
                <Link to={crmHref}>
                  {isAuthenticated ? (isClientUser ? "Abrir portal agora" : "Abrir CRM agora") : "Entrar no CRM"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
