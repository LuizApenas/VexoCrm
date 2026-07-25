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

  const selectedClient = clients.find((c) => c.id === selectedClientId) || (clients.length > 0 ? clients[0] : null);

  const allowedTabs = selectedClient?.n8n_settings?.allowed_tabs;
  const isSubTabAllowed = (subTabKey: string) => {
    if (!allowedTabs || !Array.isArray(allowedTabs)) return true;
    return allowedTabs.includes(`chatbot:${subTabKey}`);
  };

  const currentClientId = selectedClientId || (selectedClient?.id || "global");

  return (
    <PageShell title="Configurações do Chatbot SPIN" subtitle="Ajuste parâmetros gerais, templates, prompts e simulações por empresa" spacing="space-y-6">
      {/* Seletor de empresa */}
      <div className="flex items-center gap-3">
        <Select value={currentClientId} onValueChange={setSelectedClientId} disabled={loadingClients}>
          <SelectTrigger className="w-64 h-9 text-sm bg-white dark:bg-slate-900">
            <SelectValue placeholder={loadingClients ? "Carregando..." : "Selecione a empresa"} />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-sm">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentClientId && currentClientId !== "global" && (
          <span className="text-xs text-slate-400 font-mono">{currentClientId}</span>
        )}
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
