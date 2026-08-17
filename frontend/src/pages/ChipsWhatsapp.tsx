import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, Flame, ShieldAlert } from "lucide-react";
import Conexoes from "./Conexoes";
import Aquecimento from "./Aquecimento";
import EvolutionAdmin from "./EvolutionAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { canUseChipsPage, chipLimitFor, chipLimitLabel } from "@/lib/chipLimit";
import { useChipLimits } from "@/hooks/useChipLimits";
import { UpsellCard } from "@/components/UpsellCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageShell, PageShellContext } from "@/components/PageShell";

export default function ChipsWhatsapp() {
  const { canAccessInternalPage, isAdminUser } = useAuth();
  const crmClient = useOptionalCrmClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // A pergunta mudou de "tem o modulo pago?" para "tem direito a pelo menos 1
  // chip?". O modulo multiplos_chips vende chip A MAIS; a tela nunca foi o
  // produto. Perguntar pelo modulo bloqueava todo tenant Essencial — inclusive
  // de conectar os 2 chips que ele ja pagou, e sem chip nem disparo nem inbound
  // funcionam. Mesma funcao que a sidebar usa (lib/moduleAccess -> lib/chipLimit).
  const chipLimits = useChipLimits();
  const chipLimit = chipLimitFor(crmClient?.selectedClient, chipLimits);
  const isChipsUnlocked = canUseChipsPage(crmClient?.selectedClient, chipLimits);
  const chipsConectados = Array.isArray(crmClient?.selectedClient?.n8n_settings?.evolution_instances)
    ? crmClient.selectedClient.n8n_settings.evolution_instances.length
    : 0;

  const hasConexoes = canAccessInternalPage("conexoes");
  const hasAquecimento = canAccessInternalPage("aquecimento");
  const hasEvolutionAdmin = isAdminUser;

  // Determine default tab based on first allowed page
  const defaultTab = hasConexoes ? "conexoes" : hasAquecimento ? "aquecimento" : hasEvolutionAdmin ? "evolution-admin" : "";
  const activeTab = searchParams.get("tab") || defaultTab;

  useEffect(() => {
    if (activeTab === "conexoes" && !hasConexoes) {
      setSearchParams({ tab: defaultTab });
    } else if (activeTab === "aquecimento" && !hasAquecimento) {
      setSearchParams({ tab: defaultTab });
    } else if (activeTab === "evolution-admin" && !hasEvolutionAdmin) {
      setSearchParams({ tab: defaultTab });
    }
  }, [activeTab, hasConexoes, hasAquecimento, hasEvolutionAdmin, defaultTab, setSearchParams]);

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  // So fecha a tela inteira quando o limite e ZERO — plano modular que nao
  // contratou disparador nem agente, e portanto nao tem o que fazer com um chip.
  // Qualquer tenant com direito a 1 chip entra normalmente.
  if (!isChipsUnlocked) {
    return (
      <PageShell title="Canais & Chips" subtitle="Gerencie instâncias de WhatsApp e rotinas de aquecimento de chips">
        <div className="max-w-2xl mx-auto py-8">
          <UpsellCard
            title="Conexão de WhatsApp"
            subtitle="Seu plano ainda não inclui nenhum canal de WhatsApp"
            description="Para conectar um número é preciso ter o Disparador de Campanhas ou o Agente IA no plano — é um deles que usa o chip."
            moduleName="Canal de WhatsApp"
            benefits={[
              "Disparador de Campanhas: envio em massa com cadência segura",
              "Agente IA Inbound: atendimento automático 24/7",
              "Aquecimento automático anti-ban",
              "Monitoramento de saúde e status das instâncias",
            ]}
          />
        </div>
      </PageShell>
    );
  }

  if (!defaultTab) {
    return (
      <PageShell title="Canais & Chips" subtitle="Gerencie instâncias de WhatsApp e rotinas de aquecimento de chips">
        <div className="p-8 text-center text-muted-foreground">
          Você não possui permissão para gerenciar canais de WhatsApp.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Canais & Chips" subtitle="Gerencie instâncias de WhatsApp e rotinas de aquecimento de chips">
      <PageShellContext.Provider value={true}>
        <div className="w-full space-y-6">
          {/* Quantos chips o tenant já usa e quantos pode. Quem recusa de fato é
              a rota; isto só evita que o usuário descubra o limite pelo erro. */}
          <div
            data-testid="chip-limit-banner"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">
              {chipsConectados} {chipsConectados === 1 ? "chip conectado" : "chips conectados"} de{" "}
              {chipLimitLabel(chipLimit)}
            </span>
            {chipLimit !== null && chipsConectados >= chipLimit && (
              <span className="text-amber-600 dark:text-amber-400">
                — limite atingido. O módulo <strong>Múltiplos Chips WhatsApp</strong> libera números
                adicionais.
              </span>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="border-b border-slate-200 dark:border-white/10 pb-2">
              <TabsList className="flex w-full max-w-lg bg-muted border border-border h-10 p-1">
                {hasConexoes && (
                  <TabsTrigger value="conexoes" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Wifi className="h-3.5 w-3.5 mr-1.5" />
                    Conexões
                  </TabsTrigger>
                )}
                {hasAquecimento && (
                  <TabsTrigger value="aquecimento" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Flame className="h-3.5 w-3.5 mr-1.5" />
                    Aquecimento
                  </TabsTrigger>
                )}
                {hasEvolutionAdmin && (
                  <TabsTrigger value="evolution-admin" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                    Evolution Admin
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {hasConexoes && (
              <TabsContent value="conexoes" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  <Conexoes />
                </ErrorBoundary>
              </TabsContent>
            )}
            {hasAquecimento && (
              <TabsContent value="aquecimento" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  <Aquecimento />
                </ErrorBoundary>
              </TabsContent>
            )}
            {hasEvolutionAdmin && (
              <TabsContent value="evolution-admin" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  <EvolutionAdmin />
                </ErrorBoundary>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </PageShellContext.Provider>
    </PageShell>
  );
}
