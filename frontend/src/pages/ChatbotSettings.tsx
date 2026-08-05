import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadClients } from "@/hooks/useLeadClients";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { TabGeral } from "./ChatbotSettings/TabGeral";
import { TabTemplate } from "./ChatbotSettings/TabTemplate";
import { TabPrompts } from "./ChatbotSettings/TabPrompts";
import { TabTeste } from "./ChatbotSettings/TabTeste";

export default function ChatbotSettings() {
  const { isInternalUser } = useAuth();
  const crmClient = useOptionalCrmClient();
  const { data: clients = [], isLoading: loadingClients } = useLeadClients();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [subTab, setSubTab] = useState<string>(searchParams.get("subtab") || "geral");

  // Auto-select first client or CRM client
  useEffect(() => {
    if (!selectedClientId) {
      if (crmClient?.selectedClientId && crmClient.selectedClientId !== "global") {
        setSelectedClientId(crmClient.selectedClientId);
      } else if (clients.length > 0) {
        setSelectedClientId(clients[0].id);
      }
    }
  }, [clients, crmClient?.selectedClientId, selectedClientId]);

  // Sync subtab with URL query param `subtab` without wiping `tab=settings`
  useEffect(() => {
    const urlSubtab = searchParams.get("subtab");
    if (urlSubtab && ["geral", "template", "prompts", "teste"].includes(urlSubtab)) {
      setSubTab(urlSubtab);
    }
  }, [searchParams]);

  const handleSubTabChange = (val: string) => {
    setSubTab(val);
    setSearchParams((prev) => {
      prev.set("tab", "settings");
      prev.set("subtab", val);
      return prev;
    });
  };

  if (!isInternalUser) {
    return (
      <PageShell title="Chatbot" subtitle="Acesso restrito">
        <p className="text-sm text-slate-500">Você não tem permissão para acessar esta página.</p>
      </PageShell>
    );
  }

  // NUNCA cair em clients[0]. Enquanto selectedClientId nao esta resolvido, o
  // fallback antigo exibia (e permitia SALVAR sobre) os dados do primeiro tenant
  // da lista. Como o tenant "outlier" tem chatbot_model = "outlier", a tela
  // ficava mostrando esse template no lugar do da empresa selecionada, e voltava
  // a ele a cada carregamento. Risco maior: currentClientId derivava do mesmo
  // fallback, entao um clique nessa janela gravava no tenant errado.
  const selectedClient = selectedClientId
    ? clients.find((c) => c.id === selectedClientId) || null
    : null;

  if (loadingClients || !selectedClientId || !selectedClient) {
    return (
      <PageShell title="Configurações do Chatbot SPIN" subtitle="Ajuste parâmetros gerais, templates, prompts e simulações por empresa">
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-slate-900 dark:border-slate-100" />
        </div>
      </PageShell>
    );
  }

  const allowedTabs = selectedClient?.n8n_settings?.allowed_tabs;
  const isSubTabAllowed = (subTabKey: string) => {
    if (!allowedTabs || !Array.isArray(allowedTabs)) return true;
    return allowedTabs.includes(`chatbot:${subTabKey}`);
  };

  const currentClientId = selectedClientId;

  return (
    <PageShell title="Configurações do Chatbot SPIN" subtitle="Ajuste parâmetros gerais, templates, prompts e simulações por empresa" spacing="space-y-6">
      {/* Empresa vem do seletor do cabecalho. O seletor proprio que existia aqui
          listava TODOS os tenants (Infinie, Outlier, Vexo...) mesmo com a
          Geracao Digital escolhida no topo — dois controles para a mesma coisa,
          um deles mostrando empresas que nao eram a da tela. */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {selectedClient?.name || "Empresa"}
        </span>
        <span className="text-xs text-slate-400 font-mono">{currentClientId}</span>
      </div>

      <Tabs value={subTab} onValueChange={handleSubTabChange} className="w-full">
        <TabsList className="h-10 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-1">
          {isSubTabAllowed("geral") && <TabsTrigger value="geral" className="text-xs font-bold px-4">Geral</TabsTrigger>}
          {isSubTabAllowed("template") && <TabsTrigger value="template" className="text-xs font-bold px-4">Template</TabsTrigger>}
          {isSubTabAllowed("prompts") && <TabsTrigger value="prompts" className="text-xs font-bold px-4">Prompts</TabsTrigger>}
          {isSubTabAllowed("teste") && <TabsTrigger value="teste" className="text-xs font-bold px-4">Simulador de Teste</TabsTrigger>}
        </TabsList>

        <div className="pt-4">
          {subTab === "geral" && isSubTabAllowed("geral") && (
            <TabGeral clientId={currentClientId} clientName={selectedClient?.name || "Empresa"} client={selectedClient} />
          )}

          {subTab === "template" && isSubTabAllowed("template") && (
            <TabTemplate clientId={currentClientId} />
          )}

          {subTab === "prompts" && isSubTabAllowed("prompts") && (
            <TabPrompts clientId={currentClientId} />
          )}

          {subTab === "teste" && isSubTabAllowed("teste") && (
            <TabTeste clientId={currentClientId} />
          )}
        </div>
      </Tabs>
    </PageShell>
  );
}
