import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, FileText, FileCheck } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import GeracaoDigitalImplementationBriefing from "./GeracaoDigitalImplementationBriefing";
import GeracaoDigitalProposals from "./GeracaoDigitalProposals";
import GeracaoDigitalContracts from "./GeracaoDigitalContracts/GeracaoDigitalContracts";

export default function ComercialVexo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "propostas";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  return (
    <PageShell
      title="Comercial Vexo"
      subtitle="Suíte Comercial Integrada Vexo OS: Propostas, Apresentações de Pitch, Briefings e Contratos"
    >
      <div className="w-full space-y-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="border-b border-slate-200 dark:border-white/10 pb-3 mb-6">
            <TabsList className="flex w-full max-w-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 h-11 p-1 rounded-xl">
              <TabsTrigger
                value="propostas"
                className="flex-1 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm"
              >
                <FileText className="h-4 w-4 mr-2" />
                Propostas
              </TabsTrigger>
              <TabsTrigger
                value="briefings"
                className="flex-1 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Briefings
              </TabsTrigger>
              <TabsTrigger
                value="contratos"
                className="flex-1 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Contratos
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="propostas" className="mt-0 focus-visible:outline-none">
            <ErrorBoundary>
              <GeracaoDigitalProposals isVexoCommercial={true} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="briefings" className="mt-0 focus-visible:outline-none">
            <ErrorBoundary>
              <GeracaoDigitalImplementationBriefing isVexoCommercial={true} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="contratos" className="mt-0 focus-visible:outline-none">
            <ErrorBoundary>
              <GeracaoDigitalContracts isVexoCommercial={true} />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
