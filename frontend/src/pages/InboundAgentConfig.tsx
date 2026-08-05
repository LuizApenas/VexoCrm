import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Bot, Save, AlertCircle, Sparkles, Smartphone, Plus, Trash2, Send, Zap, ChevronDown } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { cn } from "@/lib/utils";
import { useCreateFupCompany, useFupCompanies, useUpdateFupCompany } from "@/hooks/useFollowupAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { fetchApi } from "@/lib/api";
import { useLeadClients } from "@/hooks/useLeadClients";
import { useLlmModels } from "@/hooks/useChatbotTemplates";

// Empresa "de mentira" mostrada quando o tenant ainda nao tem linha em
// followup_companies. Salvar com ela cria a linha de verdade.
const PLACEHOLDER_COMPANY_ID = "__sem_empresa__";
// O nome real da instancia Evolution fica no fim da URL de disparo do chip.
function instanceNameFromChip(chip: { name?: string; dispatch_webhook_url?: string | null }) {
  const url = chip?.dispatch_webhook_url || "";
  const last = url.split("/").filter(Boolean).pop();
  return (last && !last.includes("?") ? last : chip?.name) || "";
}

export default function InboundAgentConfig() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const crmClient = useOptionalCrmClient();
  const { getIdToken } = useAuth();
  const selectedClientId = crmClient?.selectedClientId || "";

  const [activeTab, setActiveTab] = useState("config");

  const { data: rawCompanies = [], isLoading: loadingCompanies } = useFupCompanies(selectedClientId);
  // useMemo obrigatorio: sem ele o fallback criava um array (e um objeto de
  // empresa) NOVOS a cada render. Como o efeito que preenche o formulario
  // depende de activeCompany, ele rodava a cada render e resetava todos os
  // campos — nenhum switch ou select conseguia mudar de valor.
  const companies = useMemo(
    () =>
      rawCompanies.length > 0
        ? rawCompanies
        : [{ id: PLACEHOLDER_COMPANY_ID, name: "Agente ainda não criado", company_name: "Agente ainda não criado", evolution_instance: "" } as any],
    [rawCompanies]
  );

  // Chips conectados do tenant: sao eles que devem aparecer como "numero"
  // deste agente. Cada chip vira uma linha propria em followup_companies, entao
  // varios numeros de atendimento funcionam sem mudar schema.
  const { data: leadClients = [] } = useLeadClients();
  const chips = useMemo(() => {
    const tenant = leadClients.find((c) => c.id === selectedClientId);
    return (tenant?.n8n_settings?.evolution_instances ?? []).filter((i) => i.active !== false);
  }, [leadClients, selectedClientId]);

  const [companyId, setCompanyId] = useState<string>("all");
  const updateCompany = useUpdateFupCompany();
  const createCompany = useCreateFupCompany();

  // Modelos vem do backend (LLM_MODELS), nao mais de uma lista fixa nesta tela:
  // ela oferecia ids que o motor nao conhece (llama3-70b-8192, llama3-8b-8192,
  // claude-3-5-sonnet sem data) e escondia os que funcionam.
  const { data: llmInfo } = useLlmModels();
  const llmModels = llmInfo?.models ?? [];
  const providerStatus = llmInfo?.providerStatus;
  const providerOrder = ["groq", "openai", "anthropic", "gemini"] as const;

  useEffect(() => {
    if (companies.length > 0 && (companyId === "all" || !companies.some((c) => c.id === companyId))) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const activeCompany = companies.find((c) => c.id === companyId);

  const [inboundEnabled, setInboundEnabled] = useState(false);
  const [inboundModel, setInboundModel] = useState("gpt-4o");
  const [inboundPrompt, setInboundPrompt] = useState("");
  const [sdrPhone, setSdrPhone] = useState("");
  const [sdrTransferEnabled, setSdrTransferEnabled] = useState(false);
  const [spinFields, setSpinFields] = useState<{ id: string; name: string; required: boolean }[]>([]);
  const [inboundWebhookUrl, setInboundWebhookUrl] = useState("");
  // Números atendidos por ESTE agente. Um agente qualificador pode cobrir os
  // celulares de vários consultores sem duplicar prompt, modelo e SPIN.
  const [numerosVinculados, setNumerosVinculados] = useState<string[]>([]);
  // Funcao do agente. Qualificador atende quem foi disparado; atendimento
  // atende quem procurou a empresa. Muda o rotulo e o agrupamento na tela.
  const [inboundRole, setInboundRole] = useState<"atendimento" | "qualificador">("atendimento");

  const [simMessages, setSimMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Olá! Como posso ajudar?" }
  ]);
  const [simInput, setSimInput] = useState("");

  // Depende do ID, nao do objeto: recarregar a lista nao pode apagar o que o
  // usuario acabou de mexer e ainda nao salvou.
  useEffect(() => {
    if (activeCompany) {
      setInboundEnabled(activeCompany.inbound_enabled ?? false);
      setInboundModel(activeCompany.inbound_model ?? "gpt-4o");
      setInboundPrompt(activeCompany.inbound_prompt ?? "");
      setSdrPhone(activeCompany.sdr_whatsapp_number ?? "");
      setSdrTransferEnabled(activeCompany.sdr_transfer_enabled ?? false);
      setSpinFields(activeCompany.inbound_spin_fields ?? []);
      setInboundWebhookUrl(activeCompany.inbound_webhook_url ?? "");
      const lista = Array.isArray(activeCompany.evolution_instances) && activeCompany.evolution_instances.length > 0
        ? activeCompany.evolution_instances
        : (activeCompany.evolution_instance ? [activeCompany.evolution_instance] : []);
      setNumerosVinculados(lista);
      setInboundRole(activeCompany.inbound_role === "qualificador" ? "qualificador" : "atendimento");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id]);

  const isPlaceholderCompany = activeCompany?.id === PLACEHOLDER_COMPANY_ID;

  // Ligar/desligar grava na hora. Antes era estado local ate clicar em Salvar,
  // entao sair da tela desfazia — parecia que o agente "desligava sozinho".
  const handleToggleInbound = async (value: boolean) => {
    setInboundEnabled(value);
    if (isPlaceholderCompany || !activeCompany) return; // sem linha ainda: salva junto na criacao
    try {
      await updateCompany.mutateAsync({ id: activeCompany.id, inbound_enabled: value } as any);
      toast({ title: value ? "Agente ativado" : "Agente desativado" });
    } catch (e: any) {
      setInboundEnabled(!value);
      toast({ title: "Erro ao salvar status", description: e.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!activeCompany) return;
    const payload = {
      inbound_enabled: inboundEnabled,
      inbound_model: inboundModel,
      inbound_prompt: inboundPrompt,
      inbound_spin_fields: spinFields,
      inbound_webhook_url: inboundWebhookUrl,
      sdr_whatsapp_number: sdrPhone,
      sdr_transfer_enabled: sdrTransferEnabled,
      evolution_instances: numerosVinculados,
      inbound_role: inboundRole,
    };

    // Sem linha em followup_companies o PATCH ia para um id inexistente e o
    // salvar nunca surtia efeito. Aqui a linha e criada no primeiro salvamento.
    if (isPlaceholderCompany) {
      // O backend exige pelo menos um numero. Sem isto o Salvar devolvia
      // 400 MISSING_FIELDS e o agente nunca era criado.
      if (numerosVinculados.length === 0) {
        toast({
          title: "Escolha ao menos um número",
          description: 'Marque os números em "Números atendidos por este agente" antes de salvar.',
          variant: "destructive",
        });
        return;
      }
      try {
        const instancia = numerosVinculados[0] || "WhatsApp";
        const criada = await createCompany.mutateAsync({
          name: inboundRole === "qualificador" ? "Agente Qualificador" : "Agente de Atendimento",
          evolution_instance: instancia,
          tenant_id: selectedClientId,
          ...payload,
        } as any);
        if (criada?.id) setCompanyId(criada.id);
        toast({
          title: "Agente criado",
          description: `Configuração gravada para o número "${instancia}".`,
        });
      } catch (e: any) {
        toast({ title: "Erro ao criar configuração", description: e.message, variant: "destructive" });
      }
      return;
    }

    try {
      await updateCompany.mutateAsync({
        id: activeCompany.id,
        inbound_enabled: inboundEnabled,
        inbound_model: inboundModel,
        inbound_prompt: inboundPrompt,
        inbound_spin_fields: spinFields,
        inbound_webhook_url: inboundWebhookUrl,
        sdr_whatsapp_number: sdrPhone,
        sdr_transfer_enabled: sdrTransferEnabled,
      });
      toast({ title: "Sucesso", description: "Configurações salvas." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const addSpinField = () => {
    setSpinFields([...spinFields, { id: Date.now().toString(), name: "", required: true }]);
  };

  const updateSpinField = (id: string, updates: any) => {
    setSpinFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeSpinField = (id: string) => {
    setSpinFields((prev) => prev.filter((f) => f.id !== id));
  };

  const [simulando, setSimulando] = useState(false);

  // Chama a IA de verdade, passando o numero vinculado para o backend resolver
  // o agente inbound daquele numero (prompt, modelo e SPIN desta tela). Antes
  // era um setTimeout com texto fixo, que nao testava nada.
  const handleSimulate = async () => {
    const texto = simInput.trim();
    if (!texto || simulando) return;
    setSimMessages((prev) => [...prev, { role: "user", text: texto }]);
    setSimInput("");
    setSimulando(true);
    try {
      const token = await getIdToken();
      const res = await fetchApi("/api/chatbot-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          message: texto,
          instanceName: numerosVinculados[0] || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.response) {
        const motivo = data?.error?.message || data?.reason || `HTTP ${res.status}`;
        setSimMessages((prev) => [...prev, { role: "bot", text: `[falha] ${motivo}` }]);
        return;
      }
      const origem = data?.meta?.agente === "inbound" ? "agente inbound" : "chatbot do tenant";
      setSimMessages((prev) => [...prev, { role: "bot", text: `${data.response}\n\n— respondido pelo ${origem}` }]);
    } catch (e: any) {
      setSimMessages((prev) => [...prev, { role: "bot", text: `[erro] ${e?.message || "falha na simulação"}` }]);
    } finally {
      setSimulando(false);
    }
  };

  if (loadingCompanies) {
    return (
      <PageShell title="Assistentes Inbound" description="Gerencie seus agentes receptivos.">
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-slate-900 dark:border-slate-100" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Assistentes Inbound"
      description="Configure IAs que respondem ativamente quem chama no seu WhatsApp."
    >
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Agente
            </Label>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Escolha qual agente editar. Os números que ele atende ficam logo abaixo.
            </p>
          </div>
        </div>
        {/* Com um agente so, este seletor nao escolhe nada e vira ruido ao lado
            de "Numeros atendidos por este agente". So aparece a partir de dois. */}
        <div className={cn("w-full sm:w-[300px]", companies.length < 2 && "hidden")}>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="w-full bg-white dark:bg-slate-950">
              <SelectValue placeholder="Selecione um número..." />
            </SelectTrigger>
            <SelectContent>
              {(["qualificador", "atendimento"] as const).map((papel) => {
                const doGrupo = companies.filter((c: any) =>
                  papel === "qualificador"
                    ? c.inbound_role === "qualificador"
                    : c.inbound_role !== "qualificador"
                );
                if (doGrupo.length === 0) return null;
                return (
                  <SelectGroup key={papel}>
                    <SelectLabel className="text-[10px] uppercase tracking-wide">
                      {papel === "qualificador" ? "Qualificadores" : "Atendimento"}
                    </SelectLabel>
                    {doGrupo.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                          ({Array.isArray(c.evolution_instances) && c.evolution_instances.length > 1
                            ? `${c.evolution_instances.length} números`
                            : c.evolution_instance})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!activeCompany ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-slate-500">Selecione um Número de WhatsApp acima.</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-auto p-1 grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="config" className="rounded-md py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-900">
              Configuração Geral
            </TabsTrigger>
            <TabsTrigger value="identidade" className="rounded-md py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-900">
              Identidade & Prompt
            </TabsTrigger>
            <TabsTrigger value="coleta" className="rounded-md py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-900">
              Coleta SPIN
            </TabsTrigger>
            <TabsTrigger value="simulador" className="rounded-md py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-900">
              Simulador
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            {isPlaceholderCompany && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Este agente ainda não existe no banco. Marque os números em
                  <strong> "Números atendidos por este agente"</strong>, ajuste o resto e clique em
                  <strong> Salvar Alterações</strong> para criá-lo. Enquanto isso, o botão de ligar não tem efeito.
                </span>
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5 text-indigo-500" />
                  Status do Assistente
                </CardTitle>
                <CardDescription>Ative ou desative o agente de IA para esta instância.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <Label className="text-base">Agente Inbound Ativado</Label>
                    <p className="text-sm text-slate-500">
                      Se ativo, a IA responderá automaticamente às mensagens recebidas neste número.
                    </p>
                  </div>
                  <Switch checked={inboundEnabled} onCheckedChange={handleToggleInbound} />
                </div>

                <div className="space-y-2 max-w-md">
                  <Label>Função deste agente</Label>
                  <Select value={inboundRole} onValueChange={(v) => setInboundRole(v as "atendimento" | "qualificador")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="atendimento">Atendimento — responde quem procurou a empresa</SelectItem>
                      <SelectItem value="qualificador">Qualificador — responde quem recebeu disparo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 max-w-md">
                  <Label>Números atendidos por este agente</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <span className="truncate">
                          {numerosVinculados.length === 0
                            ? "Nenhum número vinculado"
                            : numerosVinculados.length === 1
                              ? numerosVinculados[0]
                              : `${numerosVinculados.length} números vinculados`}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] p-1" align="start">
                      <div className="max-h-64 overflow-y-auto">
                        {chips.length === 0 && (
                          <p className="px-2 py-3 text-xs text-slate-400">
                            Nenhum chip conectado. Conecte em "Chips WhatsApp".
                          </p>
                        )}
                        {chips.map((chip) => {
                          const inst = instanceNameFromChip(chip);
                          const marcado = numerosVinculados.includes(inst);
                          return (
                            <label key={chip.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                              <Checkbox
                                checked={marcado}
                                onCheckedChange={() =>
                                  setNumerosVinculados((atual) =>
                                    atual.includes(inst) ? atual.filter((i) => i !== inst) : [...atual, inst]
                                  )
                                }
                              />
                              <span className="truncate">{chip.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-slate-500">
                    Todos os números marcados respondem com este mesmo prompt, modelo e coleta.
                  </p>
                </div>

                <div className="space-y-2 max-w-md">
                  <Label>Modelo de IA</Label>
                  <Select value={inboundModel} onValueChange={setInboundModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOrder.map((provider) => {
                        const group = llmModels.filter((m) => m.provider === provider);
                        if (group.length === 0) return null;
                        const configured = providerStatus?.[provider];
                        return (
                          <SelectGroup key={provider}>
                            <SelectLabel className="text-[10px] uppercase tracking-wide">
                              {group[0].providerName}
                              {configured === false && " — sem chave de API"}
                            </SelectLabel>
                            {group.map((m) => (
                              <SelectItem key={m.id} value={m.id} disabled={configured === false}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {inboundModel && llmModels.length > 0 && !llmModels.some((m) => m.id === inboundModel) && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      O modelo salvo ("{inboundModel}") não está mais disponível. Escolha outro e salve.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transbordo Humano (SDR)</CardTitle>
                <CardDescription>Configuração de encaminhamento para atendentes humanos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <Label className="text-base">Permitir Transferência</Label>
                    <p className="text-sm text-slate-500">
                      O robô poderá avisar ou transferir o lead para um humano quando necessário.
                    </p>
                  </div>
                  <Switch checked={sdrTransferEnabled} onCheckedChange={setSdrTransferEnabled} />
                </div>

                {sdrTransferEnabled && (
                  <div className="space-y-2 max-w-md">
                    <Label>WhatsApp do SDR (Notificação)</Label>
                    <Input
                      placeholder="Ex: 5511999999999"
                      value={sdrPhone}
                      onChange={(e) => setSdrPhone(e.target.value)}
                    />
                    <p className="text-xs text-slate-500">
                      Número que receberá o resumo quando o robô transferir o lead.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="identidade" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Prompt Principal (Instruções)</CardTitle>
                <CardDescription>
                  Defina o comportamento, tom de voz e objetivo principal do seu agente para esta instância.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={inboundPrompt}
                  onChange={(e) => setInboundPrompt(e.target.value)}
                  placeholder="Você é uma assistente virtual de um restaurante... Seu objetivo é realizar reservas..."
                  className="min-h-[400px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coleta" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Coleta de Dados (SPIN)
                </CardTitle>
                <CardDescription>
                  Quais informações o robô deve extrair obrigatoriamente antes de finalizar o atendimento?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {spinFields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-sm text-slate-500 dark:bg-slate-800">
                        {index + 1}
                      </div>
                      <Input
                        placeholder="Nome do campo (ex: Data da Reserva)"
                        value={field.name}
                        onChange={(e) => updateSpinField(field.id, { name: e.target.value })}
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(c) => updateSpinField(field.id, { required: c })}
                        />
                        <Label className="text-xs text-slate-500">Obrigatório</Label>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeSpinField(field.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addSpinField} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Dado para Coleta
                  </Button>
                </div>

                <div className="my-6 border-t border-slate-200 dark:border-slate-800" />

                <div className="space-y-3 max-w-xl">
                  <Label className="text-base font-semibold">Webhook de Finalização (Agenda/Integração)</Label>
                  <p className="text-sm text-slate-500">
                    Quando o robô coletar todas as informações SPIN obrigatórias, ele enviará um POST com os dados para esta URL.
                  </p>
                  <Input
                    placeholder="https://sua-url.com/webhook"
                    value={inboundWebhookUrl}
                    onChange={(e) => setInboundWebhookUrl(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulador" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-indigo-500" />
                  Simulador de Conversa
                </CardTitle>
                <CardDescription>
                  Teste seu agente usando o prompt e os campos de coleta SPIN definidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col h-[500px] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-900/50">
                    {simMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-indigo-600 text-white"
                              : "bg-white border border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center gap-2">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={simInput}
                      onChange={(e) => setSimInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSimulate();
                      }}
                      className="flex-1"
                    />
                    <Button onClick={handleSimulate} className="shrink-0 bg-indigo-600 hover:bg-indigo-700">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <div className="flex items-center justify-end border-t border-slate-200 pt-6 dark:border-slate-800">
            <Button
              onClick={handleSave}
              disabled={updateCompany.isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              {updateCompany.isPending ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </Tabs>
      )}
    </PageShell>
  );
}
