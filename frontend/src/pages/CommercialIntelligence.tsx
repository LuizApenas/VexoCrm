import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/EmptyState";
import { CommercialIntelligenceContent } from "@/components/CommercialIntelligenceContent";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";

export default function CommercialIntelligence() {
  const crmClient = useOptionalCrmClient();
  const effectiveClientId = crmClient?.selectedClientId || "";
  const selectedClientName = crmClient?.selectedClient?.name || effectiveClientId;

  return (
    <PageShell
      title="Inteligencia Comercial"
      subtitle="Metricas, rankings, distribuicao e insights para operacao comercial."
      spacing="space-y-6"
      compactHero
      showGlobalClientSelector
    >
      {!effectiveClientId && !(crmClient?.isLoading) && (
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Cadastre um registro em leads_clients para liberar a inteligencia comercial."
        />
      )}

      {effectiveClientId && selectedClientName && (
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
          Cliente ativo: <span className="text-foreground">{selectedClientName}</span>
        </p>
      )}
      {effectiveClientId ? <CommercialIntelligenceContent clientId={effectiveClientId} /> : null}
    </PageShell>
  );
}
