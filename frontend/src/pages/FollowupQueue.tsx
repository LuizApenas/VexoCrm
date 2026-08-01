import { useEffect, useState, type ReactNode } from "react";
import { Smartphone, Send, Zap, BarChart3, Settings, ChevronDown } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { useFupCompanies } from "@/hooks/useFollowupAdmin";
import { FollowUpJourneys } from "@/components/followup/FollowUpJourneys";
import CadenceEditor from "@/components/followup/CadenceEditor";
import { AnalyticsTab } from "@/pages/FollowupQueue/AnalyticsTab";
import { ConfigTab } from "@/pages/FollowupQueue/ConfigTab";

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO DE FOLLOW-UP — fluxo LINEAR (redesenho). Em vez de abas soltas, uma sequência
// de passos de cima para baixo: 1) número de WhatsApp do tenant → 2) cadências (o núcleo,
// usado pelo Banco de Dados) → 3) automações por evento (opcional) → 4) fila & métricas →
// configurações avançadas. As empresas são escopadas ao tenant (sem vazar outro cliente).
// ═══════════════════════════════════════════════════════════════════════════════

// Bloco de passo. `collapsible` recolhe seções secundárias para o fluxo não virar um scroll
// gigante. A seção principal (Cadências) fica sempre aberta.
function StepSection({
  step,
  icon,
  title,
  subtitle,
  children,
  collapsible = false,
  defaultOpen = false,
}: {
  step?: number;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const header = (
    <div className="flex items-center gap-3">
      {step != null && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {step}
        </span>
      )}
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
        {icon}
      </span>
      <div className="min-w-0 text-left">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground leading-4">{subtitle}</p>}
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          {header}
          <div>{children}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card>
        <CollapsibleTrigger className="group w-full">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            {header}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function FollowupDashboard() {
  const { canAccessInternalPage } = useAuth();
  const crmClient = useOptionalCrmClient();
  const selectedCrmClient = crmClient?.selectedClient;
  // Tenant ativo — escopa as empresas de follow-up ao próprio cliente.
  const tenantId = crmClient?.selectedClientId || selectedCrmClient?.id || undefined;

  const allowedTabs = selectedCrmClient?.n8n_settings?.allowed_tabs;
  const isSectionAllowed = (key: string) => {
    if (!allowedTabs || !Array.isArray(allowedTabs)) return true;
    if (key === "journeys") {
      if (allowedTabs.includes("followup:journeys")) return true;
      if (allowedTabs.includes("followup:regras") || allowedTabs.includes("followup:fila")) return true;
    }
    return allowedTabs.includes(`followup:${key}`);
  };

  const { data: companies = [], isLoading: loadingCompanies } = useFupCompanies(tenantId);
  const [companyId, setCompanyId] = useState("");

  // Seleciona o número do tenant automaticamente assim que carrega.
  useEffect(() => {
    if (companies.length > 0 && !companies.some((c) => c.id === companyId)) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  if (!canAccessInternalPage("fila-de-followup")) {
    return (
      <PageShell title="Follow-up" subtitle="Acesso restrito">
        <p className="text-sm text-slate-500">Você não tem permissão para acessar o painel de follow-up.</p>
      </PageShell>
    );
  }

  const activeCompany = companies.find((c) => c.id === companyId) || null;
  const hasCompany = companies.length > 0;

  return (
    <PageShell
      title="Módulo de Follow-up"
      subtitle="Configure, do começo ao fim, como o Vexo faz o acompanhamento automático dos seus leads."
      spacing="space-y-4"
    >
      {/* Passo 1 — Número de WhatsApp do tenant */}
      <StepSection
        step={1}
        icon={<Smartphone className="h-4 w-4" />}
        title="Número de WhatsApp"
        subtitle="O número por onde as mensagens de follow-up saem. É exclusivo desta empresa."
      >
        {loadingCompanies ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : !hasCompany ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
            Nenhum número configurado ainda. Abra <strong>Configurações da empresa</strong> (mais abaixo) e
            cadastre o número de WhatsApp deste cliente para começar.
          </div>
        ) : companies.length === 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-foreground">{activeCompany?.name}</span>
            <span className="text-muted-foreground">— número ativo deste tenant</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 max-w-sm">
            <Label className="text-xs font-semibold shrink-0">Número:</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </StepSection>

      {/* Passo 2 — Cadências (núcleo, integrado com o Banco de Dados) */}
      {isSectionAllowed("cadencias") && (
        <StepSection
          step={2}
          icon={<Send className="h-4 w-4" />}
          title="Cadências de follow-up"
          subtitle="Monte sequências de mensagens reutilizáveis (ex.: lembretes 7d/3d/1d antes de uma data). É o que você aplica nos leads pelo Banco de Dados."
        >
          {hasCompany ? (
            <CadenceEditor companyId={companyId} />
          ) : (
            <p className="text-xs text-muted-foreground">Cadastre o número de WhatsApp (passo 1) para criar cadências.</p>
          )}
        </StepSection>
      )}

      {/* Passo 3 — Automações por evento (opcional) */}
      {isSectionAllowed("journeys") && hasCompany && (
        <StepSection
          step={3}
          icon={<Zap className="h-4 w-4" />}
          title="Automações por evento (opcional)"
          subtitle="Mensagens disparadas automaticamente por gatilhos: novo lead, agendamento, proposta enviada, no-show."
          collapsible
        >
          <FollowUpJourneys companyId={companyId} />
        </StepSection>
      )}

      {/* Passo 4 — Fila & Métricas */}
      {isSectionAllowed("metrics") && hasCompany && (
        <StepSection
          step={4}
          icon={<BarChart3 className="h-4 w-4" />}
          title="Fila & Métricas"
          subtitle="Acompanhe os envios agendados e o resultado das cadências."
          collapsible
        >
          <AnalyticsTab companyId={companyId} />
        </StepSection>
      )}

      {/* Configurações da empresa (avançado) — inclui criar/editar o número de WhatsApp */}
      {isSectionAllowed("config") && (
        <StepSection
          icon={<Settings className="h-4 w-4" />}
          title="Configurações da empresa (avançado)"
          subtitle="Cadastrar/editar o número de WhatsApp, horários de envio, motor de reabordagem e integração Calendly."
          collapsible
          defaultOpen={!hasCompany}
        >
          <ConfigTab />
        </StepSection>
      )}
    </PageShell>
  );
}
