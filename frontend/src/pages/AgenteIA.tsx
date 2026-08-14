import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, KanbanSquare, Settings2, BookOpen, ShieldCheck, Megaphone, Database } from "lucide-react";
import ChatbotKanban from "./ChatbotKanban";
import ChatbotSettings from "./ChatbotSettings";
import InboundAgentConfig from "./InboundAgentConfig";
import ChatbotDocs from "./ChatbotDocs";
import { AntibanGroqTab } from "@/components/agente/AntibanGroqTab";
import { CampaignAgentTab } from "@/components/agente/CampaignAgentTab";
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

  const isAntibanUnlocked = hasFeatureUnlocked(selectedClient, "antiban_groq");
  const isCampaignAgentUnlocked = hasFeatureUnlocked(selectedClient, "agente_campanha");
  const isRagUnlocked = hasFeatureUnlocked(selectedClient, "agente_rag");

  const hasAgente = isInternalUser;
  const hasSettings = isInternalUser;
  const hasDocs = isAdminUser;

  const rawTab = searchParams.get("tab");
  const validTabs = ["operacao", "settings", "inbound", "antiban", "campanhas", "rag", ...(hasDocs ? ["docs"] : [])];
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
                  <TabsTrigger value="antiban" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                    Variações Antiban (Groq)
                  </TabsTrigger>
                )}
                {hasAgente && (
                  <TabsTrigger value="campanhas" className="flex-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Megaphone className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                    Agente por Campanha
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
              <TabsContent value="antiban" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  {isAntibanUnlocked ? (
                    <AntibanGroqTab />
                  ) : (
                    <UpsellCard
                      title="Variações Antiban com Groq AI"
                      subtitle="Exclusivo do Plano Avançado"
                      description="Gere dezenas de variações semânticas instantâneas das suas mensagens de prospecção para proteger seus números de WhatsApp contra banimentos em disparos de alto volume."
                      moduleName="Variações Antiban (Groq AI)"
                      benefits={[
                        "Inferência em tempo real com Groq AI (Llama 3 70B)",
                        "Variações semânticas inteligentes de alta conversão",
                        "Proteção contra filtros de spam do WhatsApp",
                        "Suporte a variáveis dinâmicas ({nome}, {empresa}, etc.)",
                      ]}
                    >
                      <AntibanGroqTab />
                    </UpsellCard>
                  )}
                </ErrorBoundary>
              </TabsContent>
            )}

            {hasAgente && (
              <TabsContent value="campanhas" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ErrorBoundary>
                  {isCampaignAgentUnlocked ? (
                    <CampaignAgentTab />
                  ) : (
                    <UpsellCard
                      title="Agente de Qualificação por Campanha"
                      subtitle="Exclusivo do Plano Avançado"
                      description="Personalize o tom de voz, persona e perguntas SPIN de qualificação para cada campanha de marketing (Instagram Ads, Google Ads, Reativação) separadamente."
                      moduleName="Agente por Campanha"
                      benefits={[
                        "Personas e regras de qualificação distintas por canal",
                        "Roteamento de atendimento inteligente por campanha",
                        "Perguntas de SPIN Selling customizadas",
                        "Passagem de bastão automatizada para o Closer ideal",
                      ]}
                    >
                      <CampaignAgentTab />
                    </UpsellCard>
                  )}
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
