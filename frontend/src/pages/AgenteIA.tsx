import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, KanbanSquare, Settings2, BookOpen, Database } from "lucide-react";
import ChatbotKanban from "./ChatbotKanban";
import ChatbotSettings from "./ChatbotSettings";
import InboundAgentConfig from "./InboundAgentConfig";
import ChatbotDocs from "./ChatbotDocs";
import { KnowledgeBaseRagTab } from "@/components/agente/KnowledgeBaseRagTab";
import { UpsellCard } from "@/components/UpsellCard";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { resolveTenantPlan, hasFeatureUnlocked } from "@/lib/planTier";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageShell, PageShellContext } from "@/components/PageShell";

export default function AgenteIA() {
  const { isInternalUser, isAdminUser } = useAuth();
  const crmClient = useOptionalCrmClient();
  const selectedClient = crmClient?.selectedClient;
  const [searchParams, setSearchParams] = useSearchParams();

  const isRagUnlocked = hasFeatureUnlocked(selectedClient, "agente_rag");

  const hasAgente = isInternalUser;
  const hasSettings = isInternalUser;
  const hasDocs = isAdminUser;

  const rawTab = searchParams.get("tab");
  const validTabs = ["operacao", "settings", "inbound", "rag", ...(hasDocs ? ["docs"] : [])];
  const activeTab = validTabs.includes(rawTab || "") ? (rawTab as string) : "operacao";

  const handleTabChange = (val: string) => {
    setSearchParams((prev) => {
      prev.set("tab", val);
      return prev;
    });
  };

  if (!isInternalUser) {
    return (
      <PageShell title="Agente IA" subtitle="Gerencie triagem, prompts, assistentes e monitoramento em tempo real">
        <div className="p-8 text-center text-muted-foreground">
          Você não possui permissão para acessar o ecossistema do Agente IA.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Agente IA" subtitle="Gerencie triagem, prompts, assistentes e monitoramento em tempo real">
      <PageShellContext.Provider value={true}>
        <div className="w-full space-y-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="border-b border-slate-200 dark:border-white/10 pb-2 overflow-x-auto">
              <TabsList className="flex w-max min-w-full bg-muted border border-border h-10 p-1">
                {hasAgente && (
                  <TabsTrigger value="operacao" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <KanbanSquare className="h-3.5 w-3.5 mr-1.5" />
                    Operação
                  </TabsTrigger>
                )}
                {hasSettings && (
                  <TabsTrigger value="settings" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                    Configurações
                  </TabsTrigger>
                )}
                {hasAgente && (
                  <TabsTrigger value="inbound" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Bot className="h-3.5 w-3.5 mr-1.5" />
                    Inbound (1 Chip)
                  </TabsTrigger>
                )}
                {hasAgente && (
                  <TabsTrigger value="rag" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Database className="h-3.5 w-3.5 mr-1.5 text-cyan-500" />
                    Base RAG (Arquivos)
                  </TabsTrigger>
                )}
                {hasDocs && (
                  <TabsTrigger value="docs" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    Documentação
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {hasAgente && (
              <TabsContent value="operacao" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  <ChatbotKanban />
                </ErrorBoundary>
              </TabsContent>
            )}

            {hasSettings && (
              <TabsContent value="settings" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  <ChatbotSettings />
                </ErrorBoundary>
              </TabsContent>
            )}

            {hasAgente && (
              <TabsContent value="inbound" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  <InboundAgentConfig />
                </ErrorBoundary>
              </TabsContent>
            )}

            {hasAgente && (
              <TabsContent value="rag" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  {isRagUnlocked ? (
                    <KnowledgeBaseRagTab />
                  ) : (
                    <UpsellCard
                      title="Base de Conhecimento RAG (PDFs & Docs)"
                      subtitle="Exclusivo do Plano Avançado"
                      description="Faça upload de catálogos, tabelas de preços, manuais técnicos e termos contratuais para o Agente IA consultar fatos exatos sem risco de alucinação."
                      moduleName="Base de Conhecimento RAG"
                      benefits={[
                        "Upload de PDFs, DOCX, TXT e planilhas técnicas",
                        "Indexação vetorial automática e busca semântica",
                        "Respostas 100% embasadas na documentação oficial",
                        "Simulador integrado de busca semântica em tempo real",
                      ]}
                    >
                      <KnowledgeBaseRagTab />
                    </UpsellCard>
                  )}
                </ErrorBoundary>
              </TabsContent>
            )}

            {hasDocs && (
              <TabsContent value="docs" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  <ChatbotDocs />
                </ErrorBoundary>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </PageShellContext.Provider>
    </PageShell>
  );
}
