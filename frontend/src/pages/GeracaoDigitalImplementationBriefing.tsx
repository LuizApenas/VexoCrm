import React, { useState, useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { GeracaoDigitalTabs } from "@/components/GeracaoDigitalTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchApi, readApiJson } from "@/lib/api";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Settings,
  Bot,
  Wifi,
  LineChart,
  Layers,
  Calendar,
  Save,
  Send,
  HelpCircle,
  Clock,
  ShieldAlert
} from "lucide-react";

type ModelType = "essencial" | "avancado";

interface TenantOption {
  id: string;
  name: string;
  slug?: string;
}

export default function GeracaoDigitalImplementationBriefing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Selected Tenant
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");

  // Rule Routing
  const [numEmployees, setNumEmployees] = useState<number>(1);
  const [hasCommercialSector, setHasCommercialSector] = useState<boolean>(false);
  const [modelType, setModelType] = useState<ModelType>("essencial");
  const [manualOverride, setManualOverride] = useState<boolean>(false);

  // Active section tab in UI
  const [activeSection, setActiveSection] = useState<string>("prerequisitos");

  // Briefing Form State
  const [prerequisites, setPrerequisites] = useState({
    segmento: "",
    unidades: "1",
    atendentes: "1",
    participantes: "",
    contratoAssinado: false,
  });

  const [operacao, setOperacao] = useState({
    kanbanEtapas: "Lead, Em Atendimento, Agendado, Proposta, Fechado, Perdido",
    kanbanMoverRegra: "",
    visaoPreferida: "inbox", // lista | kanban | inbox
    quemAcessa: "todos", // todos | supervisao
    followupGatilho: "Lead sem resposta em 24h",
    followupIntervalo: "24 horas, 3 tentativas",
    horarioComercial: "08:00 às 18:00 (Seg a Sex)",
    campanhasBase: "leads_sistema", // base_propria | leads_sistema | ambas
    campanhasOrigemOptIn: "",
    campanhasVolumeEstimado: "500 msgs/mês",
    campanhasRelatorioAuto: false,
    eventosFeatureGlobal: false,
  });

  const [inteligencia, setInteligencia] = useState({
    slaPrimeiraRespostaMinutos: "15",
    taxaConversaoMeta: "10%",
    ticketMedioEstimado: "",
    origensTrafego: "Google Ads, Instagram, Inbound",
    jaMedeHoje: "",
    relatoriosFrequencia: "semanal", // diario | semanal | mensal
    relatoriosFormato: "sistema", // sistema | pdf | whatsapp_email
  });

  const [agenteIa, setAgenteIa] = useState({
    tomDeVoz: "Casual e Atencioso",
    exemplosMensagens: "",
    regraEscalonamento: "Transferir para humano se o lead pedir valores específicos ou orçamento customizado.",
    precisaSaber: "Horário de funcionamento, endereço, serviços principais, link de agendamento.",
    naoPodeInformar: "Descontos especiais sem autorização do gerente.",
    materialAnexoUrls: "",
    quemValidaCliente: "",
    kanbanAgenteEtapas: "Triagem e Qualificação",
    inboundIniciaOuResponde: "responde", // inicia | responde
    qualificacaoObrigatoria: "Nome, Cidade, Necessidade principal",
  });

  const [canais, setCanais] = useState({
    quantosChips: "1",
    numeroNovoOuHistorico: "numero_novo", // numero_novo | ja_usado
    prazoVolumeTotal: "14 dias",
    aquecimentoAlinhado: true,
  });

  const [modulosCustom, setModulosCustom] = useState({
    necessidadeEspecifica: false,
    descricao: "",
  });

  const [fechamento, setFechamento] = useState({
    recapitulado: true,
    dataGoLive: "",
    proximoContatoQuem: "",
    proximoContatoData: "",
  });

  // Calculate suggested model based on rules
  const suggestedModel: ModelType =
    numEmployees >= 3 && hasCommercialSector ? "avancado" : "essencial";

  // Auto-update modelType if user hasn't manually overridden it
  useEffect(() => {
    if (!manualOverride) {
      setModelType(suggestedModel);
    }
  }, [numEmployees, hasCommercialSector, suggestedModel, manualOverride]);

  const { getIdToken } = useAuth();

  // Fetch Closed Contracts & Proposals (Autenticado)
  const { data: closedOptions = [], isLoading: isLoadingClosedOptions } = useQuery({
    queryKey: ["gd-closed-contracts-and-proposals"],
    queryFn: async () => {
      const token = await getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [resContracts, resProposals] = await Promise.all([
        fetchApi("/api/gd/contracts", { headers }).catch(() => null),
        fetchApi("/api/gd/proposals", { headers }).catch(() => null),
      ]);

      const items: Array<{ id: string; name: string; status: string }> = [];
      const seenIds = new Set<string>();

      if (resContracts && resContracts.ok) {
        const jsonC = await readApiJson<any>(resContracts, "gd-contracts");
        const listC = Array.isArray(jsonC) ? jsonC : jsonC?.data || [];
        for (const c of listC) {
          const id = c.id || c.proposal_id;
          const name = c.dados?.razao_social || c.dados?.representante || "Contrato Sem Nome";
          const statusLabel = c.status === "enviado_juridico" ? "No Jurídico" : c.status === "gerado" ? "Gerado" : "Contrato";
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            items.push({ id, name, status: statusLabel });
          }
        }
      }

      if (resProposals && resProposals.ok) {
        const jsonP = await readApiJson<any>(resProposals, "gd-proposals");
        const listP = Array.isArray(jsonP) ? jsonP : jsonP?.data || [];
        for (const p of listP) {
          // EXCLUI rascunhos e enviadas. SOMENTE PROPOSTAS ACEITAS/FECHADAS COM CONTRATO!
          if (p.status !== "aceita" && p.status !== "fechado" && p.status !== "assinado") {
            continue;
          }
          const id = p.id || p.tenant_id;
          const name = p.prospect_name || p.client_name || p.dados?.razao_social || "Proposta Aceita";
          const statusLabel = "Contrato Fechado";
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            items.push({ id, name, status: statusLabel });
          }
        }
      }

      return items;
    },
  });

  // Fetch Tenants (Autenticado)
  const { data: tenants = [] } = useQuery<TenantOption[]>({
    queryKey: ["gd-tenants-list"],
    queryFn: async () => {
      const token = await getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetchApi("/api/gd/implementation-briefings?list_tenants=true", { headers }).catch(() => null);
      if (!res || !res.ok) return [];
      const json = await res.json();
      return json.tenants || json.data || [];
    },
  });

  // Load Existing Implementation Briefings (Autenticado)
  const { data: existingBriefings = [], isLoading: isLoadingBriefings } = useQuery({
    queryKey: ["gd-implementation-briefings", selectedTenantId],
    queryFn: async () => {
      const token = await getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const url = selectedTenantId
        ? `/api/gd/implementation-briefings?tenant_id=${selectedTenantId}`
        : `/api/gd/implementation-briefings`;
      const res = await fetchApi(url, { headers });
      if (!res.ok) throw new Error("Erro ao buscar briefings de implantação");
      const json = await res.json();
      return json.data || [];
    },
  });

  // Mutation to Save Briefing (Autenticado)
  const saveMutation = useMutation({
    mutationFn: async (status: "em_andamento" | "concluido") => {
      if (!selectedTenantId) throw new Error("Selecione uma empresa / tenant para prosseguir.");
      if (!clientName) throw new Error("Informe o nome do cliente.");

      const token = await getIdToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        tenant_id: selectedTenantId,
        client_name: clientName,
        model_type: modelType,
        suggested_model: suggestedModel,
        num_employees: numEmployees,
        has_commercial_sector: hasCommercialSector,
        prerequisites,
        operacao,
        inteligencia,
        agente_ia: agenteIa,
        canais,
        modulos_custom: modulosCustom,
        fechamento,
        status,
      };

      const res = await fetchApi("/api/gd/implementation-briefings", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Erro ao salvar briefing de implantação.");
      }
      return await res.json();
    },
    onSuccess: (data, status) => {
      queryClient.invalidateQueries({ queryKey: ["gd-implementation-briefings"] });
      toast({
        title: status === "concluido" ? "Implantação Concluída!" : "Rascunho Salvo!",
        description:
          status === "concluido"
            ? "O briefing de implantação foi finalizado e as configurações do tenant foram atualizadas com sucesso."
            : "As informações foram salvas como rascunho.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Não foi possível salvar o briefing de implantação.",
        variant: "destructive",
      });
    },
  });

  return (
    <PageShell
      title="Briefing de Implantação (Onboarding Técnico)"
      subtitle="Ferramenta de parametrização pós-contrato para go-live e configuração do tenant no Vexo OS."
    >
      <div className="space-y-6">
        <GeracaoDigitalTabs />

        {/* PASSO 0: SELEÇÃO DE TENANT E ROTEAMENTO DO MODELO */}
        <Card className="border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/40 to-slate-50 dark:from-indigo-950/20 dark:to-slate-900 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-lg font-black text-slate-800 dark:text-white">
                  Passo 0: Empresa & Modelo de Implantação
                </CardTitle>
              </div>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold border-indigo-200">
                Setup Inicial
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
              Selecione o cliente contratante e defina o modelo da trilha técnica de implantação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Empresa Contratante (Selecione a partir dos Contratos / Propostas Fechadas)
              </Label>
              <Select
                value={selectedTenantId}
                onValueChange={(val) => {
                  setSelectedTenantId(val);
                  const found = closedOptions.find((opt) => opt.id === val);
                  if (found) {
                    setClientName(found.name);
                  }
                }}
              >
                <SelectTrigger className="w-full h-10 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder={isLoadingClosedOptions ? "Carregando contratos..." : "Selecione a empresa contratante..."} />
                </SelectTrigger>
                <SelectContent>
                  {closedOptions.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum contrato fechado encontrado no sistema
                    </SelectItem>
                  ) : (
                    closedOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="text-sm">
                        {opt.name} <span className="text-xs text-emerald-600 font-bold ml-2">({opt.status})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Opção para ajuste fino ou digitação manual se necessário */}
              <div className="pt-1">
                <Label className="text-[11px] font-semibold text-slate-500">Nome do Cliente / Razão Social Confirmada</Label>
                <Input
                  placeholder="Nome do cliente para o briefing (preenchido automaticamente ao selecionar a empresa)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1 h-9 text-xs bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>

            {/* REGRAS DE ROTEAMENTO */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-600" />
                  Perfil da Operação do Cliente (Sugestão Automática)
                </h4>
                {manualOverride && (
                  <Badge variant="secondary" className="text-[10px]">
                    Seleção Manual Ativa
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Número de Funcionários / Atendentes</Label>
                  <Input
                    type="number"
                    min={1}
                    value={numEmployees}
                    onChange={(e) => setNumEmployees(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Possui Setor Comercial Dedicado?</Label>
                    <p className="text-[11px] text-slate-500">Equipe de vendas própria estruturada.</p>
                  </div>
                  <Switch
                    checked={hasCommercialSector}
                    onCheckedChange={(checked) => setHasCommercialSector(checked)}
                  />
                </div>
              </div>

              {/* SELETORES DE MODELO */}
              <div className="pt-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                  Modelo de Implantação Selecionado:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setModelType("essencial");
                      setManualOverride(true);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      modelType === "essencial"
                        ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Trilha [E]</Badge>
                        Modelo Essencial
                      </span>
                      {suggestedModel === "essencial" && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                          Sugerido pelo sistema
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Operação direta e simplificada (menos de 3 func). Foco em Kanban simples, Follow-up e Agente IA básico de atendimento.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModelType("avancado");
                      setManualOverride(true);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      modelType === "avancado"
                        ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/30 ring-2 ring-purple-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Badge className="bg-purple-600 hover:bg-purple-700 text-white">Trilha [A]</Badge>
                        Modelo Avançado
                      </span>
                      {suggestedModel === "avancado" && (
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                          Sugerido pelo sistema
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Operação robusta com setor comercial. Inclui Inteligência Comercial, Inbound IA, Automações de Kanban e Módulos por tenant.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NAVEGAÇÃO DE SEÇÕES DO BRIEFING */}
        <div className="space-y-4">
          <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
            <TabsList className="flex w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-12 p-1 rounded-xl overflow-x-auto whitespace-nowrap">
              <TabsTrigger value="prerequisitos" className="flex-1 text-xs font-bold gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
                0. Pré-requisitos <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">E+A</Badge>
              </TabsTrigger>
              <TabsTrigger value="operacao" className="flex-1 text-xs font-bold gap-1.5">
                <Settings className="h-3.5 w-3.5 text-blue-500" />
                1. Operação <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">E+A</Badge>
              </TabsTrigger>
              <TabsTrigger value="inteligencia" className="flex-1 text-xs font-bold gap-1.5">
                <LineChart className="h-3.5 w-3.5 text-emerald-500" />
                2. Inteligência {modelType === "essencial" ? <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">E</Badge> : <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">E+A</Badge>}
              </TabsTrigger>
              <TabsTrigger value="agente_ia" className="flex-1 text-xs font-bold gap-1.5">
                <Bot className="h-3.5 w-3.5 text-purple-500" />
                3. Agente IA <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">E+A</Badge>
              </TabsTrigger>
              <TabsTrigger value="canais" className="flex-1 text-xs font-bold gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-amber-500" />
                4. Canais <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">E+A</Badge>
              </TabsTrigger>
              {modelType === "avancado" && (
                <TabsTrigger value="modulos" className="flex-1 text-xs font-bold gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-pink-500" />
                  5. Módulos <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0 ml-1">A</Badge>
                </TabsTrigger>
              )}
              <TabsTrigger value="fechamento" className="flex-1 text-xs font-bold gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                6. Fechamento <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">E+A</Badge>
              </TabsTrigger>
            </TabsList>

            {/* SEÇÃO 0: PRÉ-REQUISITOS */}
            <TabsContent value="prerequisitos" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    0. Checklist Interno de Pré-requisitos
                    <Badge variant="outline" className="text-xs">Essencial + Avançado [E+A]</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Verificação preventiva da gestora antes de iniciar o alinhamento com o cliente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Segmento da Empresa</Label>
                      <Input
                        placeholder="Ex: Odontologia, Educação, Imobiliária"
                        value={prerequisites.segmento}
                        onChange={(e) => setPrerequisites(p => ({ ...p, segmento: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Nº de Unidades / Filiais</Label>
                      <Input
                        type="number"
                        min={1}
                        value={prerequisites.unidades}
                        onChange={(e) => setPrerequisites(p => ({ ...p, unidades: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Nº de Atendentes Operacionais</Label>
                      <Input
                        type="number"
                        min={1}
                        value={prerequisites.atendentes}
                        onChange={(e) => setPrerequisites(p => ({ ...p, atendentes: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Participantes da Reunião (Lado Cliente)</Label>
                    <Input
                      placeholder="Ex: João (Sócio-diretor - Decisor), Maria (Supervisora - Operador)"
                      value={prerequisites.participantes}
                      onChange={(e) => setPrerequisites(p => ({ ...p, participantes: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                    <Checkbox
                      id="contratoAssinado"
                      checked={prerequisites.contratoAssinado}
                      onCheckedChange={(checked) => setPrerequisites(p => ({ ...p, contratoAssinado: !!checked }))}
                    />
                    <Label htmlFor="contratoAssinado" className="text-xs font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                      Contrato de prestação de serviços devidamente assinado em mãos (Evita prometer módulos não contratados).
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEÇÃO 1: OPERAÇÃO */}
            <TabsContent value="operacao" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    1. Operação (Kanban, Follow-up & Campanhas)
                    <Badge variant="outline" className="text-xs">Essencial + Avançado [E+A]</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 1.1 Dashboard / Kanban */}
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      1.1 Dashboard / Conversas & Funil de Vendas
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold flex items-center gap-1.5">
                        Etapas do Funil de Vendas (Colunas do Kanban) <Badge variant="secondary" className="text-[10px]">E+A</Badge>
                      </Label>
                      <Input
                        placeholder="Ex: Novo Lead, Qualificado, Agendado, Proposta Enviada, Fechado, Perdido"
                        value={operacao.kanbanEtapas}
                        onChange={(e) => setOperacao(o => ({ ...o, kanbanEtapas: e.target.value }))}
                      />
                    </div>

                    {modelType === "avancado" && (
                      <div className="space-y-2 pt-2">
                        <Label className="text-xs font-bold flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                          Critério de Movimentação de Etapa (Manual ou Automação) <Badge className="bg-purple-600 text-white text-[10px]">Avançado [A]</Badge>
                        </Label>
                        <Textarea
                          placeholder="Ex: Lead muda automaticamente para 'Agendado' quando a reunião é criada no CRM ou pela IA."
                          value={operacao.kanbanMoverRegra}
                          onChange={(e) => setOperacao(o => ({ ...o, kanbanMoverRegra: e.target.value }))}
                          className="h-20"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Visão Preferida da Equipe <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                        <Select
                          value={operacao.visaoPreferida}
                          onValueChange={(val) => setOperacao(o => ({ ...o, visaoPreferida: val }))}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inbox">Inbox de Conversas (Recomendado para equipes técnicas/atendentes)</SelectItem>
                            <SelectItem value="kanban">Visão Kanban (Colunas de Negociação)</SelectItem>
                            <SelectItem value="lista">Visão em Lista Tabular</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Acesso à Tela de Conversas <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                        <Select
                          value={operacao.quemAcessa}
                          onValueChange={(val) => setOperacao(o => ({ ...o, quemAcessa: val }))}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos os Atendentes e Vendedores</SelectItem>
                            <SelectItem value="supervisao">Apenas Supervisão e Gerência</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* 1.2 Follow-up */}
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      1.2 Regras de Follow-up
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Gatilho Principal de Follow-up <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                        <Input
                          placeholder="Ex: Lead sem resposta há 24h ou agendamento não confirmado"
                          value={operacao.followupGatilho}
                          onChange={(e) => setOperacao(o => ({ ...o, followupGatilho: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Horário Comercial Permitido <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                        <Input
                          placeholder="Ex: 08:00 às 18:00 (Nunca disparar de madrugada)"
                          value={operacao.horarioComercial}
                          onChange={(e) => setOperacao(o => ({ ...o, horarioComercial: e.target.value }))}
                        />
                      </div>
                    </div>

                    {modelType === "avancado" && (
                      <div className="space-y-2 pt-2">
                        <Label className="text-xs font-bold text-purple-700 dark:text-purple-300">
                          Intervalo & Cadência de Tentativas <Badge className="bg-purple-600 text-white text-[10px]">Avançado [A]</Badge>
                        </Label>
                        <Input
                          placeholder="Ex: 1ª tentativa em 24h, 2ª tentativa em 48h, max 3 tentativas antes de marcar perdido"
                          value={operacao.followupIntervalo}
                          onChange={(e) => setOperacao(o => ({ ...o, followupIntervalo: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  {/* 1.3 Campanhas */}
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      1.3 Campanhas & Disparos de Origem
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Origem dos Leads para Campanhas <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                        <Select
                          value={operacao.campanhasBase}
                          onValueChange={(val) => setOperacao(o => ({ ...o, campanhasBase: val }))}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="leads_sistema">Apenas Leads Gerados no Sistema</SelectItem>
                            <SelectItem value="base_propria">Importar Planilha / Base Própria</SelectItem>
                            <SelectItem value="ambas">Ambas as Fontes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Expectativa de Volume Mensal <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                        <Input
                          placeholder="Ex: 500 a 1.000 mensagens/mês"
                          value={operacao.campanhasVolumeEstimado}
                          onChange={(e) => setOperacao(o => ({ ...o, campanhasVolumeEstimado: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-1.5">
                      <Label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-amber-600" />
                        Origem da Base Importada & Opt-in (Prevenção de Anti-ban) <Badge variant="secondary" className="text-[10px]">E+A</Badge>
                      </Label>
                      <Input
                        placeholder="Descreva como os contatos foram coletados (ex: formulário do site com consentimento explícito)"
                        value={operacao.campanhasOrigemOptIn}
                        onChange={(e) => setOperacao(o => ({ ...o, campanhasOrigemOptIn: e.target.value }))}
                        className="bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEÇÃO 2: INTELIGÊNCIA */}
            <TabsContent value="inteligencia" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    2. Inteligência Comercial & Relatórios
                    {modelType === "avancado" ? <Badge className="bg-purple-600 text-white text-xs">Avançado [A]</Badge> : <Badge variant="outline" className="text-xs">Essencial [E]</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {modelType === "avancado" && (
                    <div className="space-y-4 p-4 bg-purple-50/40 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/50">
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300">
                        2.1 Parâmetros da Tela de Inteligência Comercial [A]
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">SLA Alvo de 1ª Resposta (Minutos)</Label>
                          <Input
                            placeholder="Ex: 15 min"
                            value={inteligencia.slaPrimeiraRespostaMinutos}
                            onChange={(e) => setInteligencia(i => ({ ...i, slaPrimeiraRespostaMinutos: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Taxa de Conversão Meta (%)</Label>
                          <Input
                            placeholder="Ex: 12%"
                            value={inteligencia.taxaConversaoMeta}
                            onChange={(e) => setInteligencia(i => ({ ...i, taxaConversaoMeta: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Ticket Médio Estimado (R$)</Label>
                          <Input
                            placeholder="Ex: R$ 1.500,00"
                            value={inteligencia.ticketMedioEstimado}
                            onChange={(e) => setInteligencia(i => ({ ...i, ticketMedioEstimado: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Origens de Tráfego / Canais de Entrada a Acompanhar</Label>
                        <Input
                          placeholder="Ex: Google Ads, Meta Ads, WhatsApp Direto, Indicação"
                          value={inteligencia.origensTrafego}
                          onChange={(e) => setInteligencia(i => ({ ...i, origensTrafego: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2.2 Relatórios */}
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      2.2 Frequência & Entrega de Relatórios <Badge variant="secondary" className="text-[10px]">E+A</Badge>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Frequência de Envio</Label>
                        <Select
                          value={inteligencia.relatoriosFrequencia}
                          onValueChange={(val) => setInteligencia(i => ({ ...i, relatoriosFrequencia: val }))}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="diario">Diário</SelectItem>
                            <SelectItem value="semanal">Semanal (Recomendado)</SelectItem>
                            <SelectItem value="mensal">Mensal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Formato de Recebimento</Label>
                        <Select
                          value={inteligencia.relatoriosFormato}
                          onValueChange={(val) => setInteligencia(i => ({ ...i, relatoriosFormato: val }))}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sistema">Dentro do CRM (Dashboard)</SelectItem>
                            <SelectItem value="pdf">Exportação em PDF</SelectItem>
                            <SelectItem value="whatsapp_email">Envio Automático via WhatsApp / E-mail</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEÇÃO 3: AGENTE IA (Presente nas DUAS trilhas: E + A) */}
            <TabsContent value="agente_ia" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    3. Treinamento & Configuração do Agente IA
                    <Badge variant="outline" className="text-xs">Essencial + Avançado [E+A]</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mesmo no modelo Essencial, a IA opera nos disparos e no atendimento do WhatsApp.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 3.1 Comportamento */}
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      3.1 Comportamento & Tom de Voz <Badge variant="secondary" className="text-[10px]">E+A</Badge>
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Tom de Voz Desejado</Label>
                      <Input
                        placeholder="Ex: Formal, Consultivo, Amigável, Direto"
                        value={agenteIa.tomDeVoz}
                        onChange={(e) => setAgenteIa(a => ({ ...a, tomDeVoz: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">2-3 Exemplos Reais de Mensagens que a Empresa já envia</Label>
                      <Textarea
                        placeholder="Ex: 'Olá! Sou a IA da Clínica X. Como posso te ajudar a agendar sua consulta hoje?'"
                        value={agenteIa.exemplosMensagens}
                        onChange={(e) => setAgenteIa(a => ({ ...a, exemplosMensagens: e.target.value }))}
                        className="h-20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Regra de Transbordo / Escalonamento para Atendente Humano</Label>
                      <Input
                        placeholder="Ex: Transferir quando o lead solicitar orçamento customizado ou demonstrar insatisfação."
                        value={agenteIa.regraEscalonamento}
                        onChange={(e) => setAgenteIa(a => ({ ...a, regraEscalonamento: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* 3.2 Conteúdo */}
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      3.2 Base de Conhecimento & Limites <Badge variant="secondary" className="text-[10px]">E+A</Badge>
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">O que o Agente PRECISA saber (Preços, horários, localização, serviços)</Label>
                      <Textarea
                        placeholder="Descreva as informações fundamentais do negócio..."
                        value={agenteIa.precisaSaber}
                        onChange={(e) => setAgenteIa(a => ({ ...a, precisaSaber: e.target.value }))}
                        className="h-20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">O que o Agente NÃO PODE informar (Ex: Descontos sem consulta, termos jurídicos)</Label>
                      <Input
                        placeholder="Ex: Nunca informar valores de procedimentos cirúrgicos antes de consulta presencial."
                        value={agenteIa.naoPodeInformar}
                        onChange={(e) => setAgenteIa(a => ({ ...a, naoPodeInformar: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Link/URL de Anexo de Materiais (FAQ, Scripts, PDFs)</Label>
                        <Input
                          placeholder="Link da nuvem ou documento de treino"
                          value={agenteIa.materialAnexoUrls}
                          onChange={(e) => setAgenteIa(a => ({ ...a, materialAnexoUrls: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Validador pelo Lado do Cliente</Label>
                        <Input
                          placeholder="Nome da pessoa responsável por aprovar os prompts"
                          value={agenteIa.quemValidaCliente}
                          onChange={(e) => setAgenteIa(a => ({ ...a, quemValidaCliente: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3.3 e 3.4 EXCLUSIVOS DO AVANÇADO */}
                  {modelType === "avancado" && (
                    <div className="space-y-4 p-4 bg-purple-50/40 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/50">
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-2">
                        3.3 & 3.4 Operação de Agente IA & Inbound <Badge className="bg-purple-600 text-white text-[10px]">Avançado [A]</Badge>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Etapas do Funil onde o Agente Opera</Label>
                          <Input
                            placeholder="Ex: Triagem, Pré-qualificação e Agendamento"
                            value={agenteIa.kanbanAgenteEtapas}
                            onChange={(e) => setAgenteIa(a => ({ ...a, kanbanAgenteEtapas: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Modo Inbound</Label>
                          <Select
                            value={agenteIa.inboundIniciaOuResponde}
                            onValueChange={(val) => setAgenteIa(a => ({ ...a, inboundIniciaOuResponde: val }))}
                          >
                            <SelectTrigger className="bg-white dark:bg-slate-800">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="responde">Apenas Responde quando o Lead entra em contato</SelectItem>
                              <SelectItem value="inicia">Inicia a conversa ativamente (Outbound/Disparo)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Qualificação Obrigatória Antes do Atendimento Humano</Label>
                        <Input
                          placeholder="Ex: Coletar Nome, Cidade e Orçamento estimado antes de passar para o corretor."
                          value={agenteIa.qualificacaoObrigatoria}
                          onChange={(e) => setAgenteIa(a => ({ ...a, qualificacaoObrigatoria: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEÇÃO 4: CANAIS */}
            <TabsContent value="canais" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    4. Conexões de WhatsApp & Aquecimento
                    <Badge variant="outline" className="text-xs">Essencial + Avançado [E+A]</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Quantidade de Chips WhatsApp Necessários <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                      <Input
                        type="number"
                        min={1}
                        value={canais.quantosChips}
                        onChange={(e) => setCanais(c => ({ ...c, quantosChips: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Histórico do Número <Badge variant="secondary" className="text-[10px]">E+A</Badge></Label>
                      <Select
                        value={canais.numeroNovoOuHistorico}
                        onValueChange={(val) => setCanais(c => ({ ...c, numeroNovoOuHistorico: val }))}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="numero_novo">Número Novo (Requer curva de aquecimento gradual)</SelectItem>
                          <SelectItem value="ja_usado">Número Antigo com Histórico Comercial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <Label className="text-xs font-bold text-amber-900 dark:text-amber-300">
                        Curva de Aquecimento & Prevenção Anti-ban (Evolution API)
                      </Label>
                    </div>
                    <Input
                      placeholder="Prazo esperado para operar em volume máximo (ex: 14 a 21 dias)"
                      value={canais.prazoVolumeTotal}
                      onChange={(e) => setCanais(c => ({ ...c, prazoVolumeTotal: e.target.value }))}
                      className="bg-white dark:bg-slate-900"
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="aquecimentoAlinhado"
                        checked={canais.aquecimentoAlinhado}
                        onCheckedChange={(checked) => setCanais(c => ({ ...c, aquecimentoAlinhado: !!checked }))}
                      />
                      <Label htmlFor="aquecimentoAlinhado" className="text-xs font-medium text-amber-800 dark:text-amber-400 cursor-pointer">
                        Alinhado com o cliente: o chip novo entra com limite restrito e sobe gradualmente pelas ferramentas de aquecimento do CRM.
                      </Label>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-500 font-mono flex items-center justify-between">
                    <span>Nota Interna: A aba Evolution Admin (/crm/chips-whatsapp?tab=evolution-admin) é restrita a administradores do sistema.</span>
                    <Badge variant="outline" className="text-[10px]">Admin Only</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEÇÃO 5: MÓDULOS (Avançado apenas) */}
            {modelType === "avancado" && (
              <TabsContent value="modulos" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-purple-900 dark:text-purple-300">
                      5. Módulos Específicos do Cliente
                      <Badge className="bg-purple-600 text-white text-xs">Avançado [A]</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Módulos customizados para necessidades exclusivas do negócio do cliente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold">O cliente necessita de algum módulo específico do negócio dele?</Label>
                        <p className="text-[11px] text-slate-500">Recurso exclusivo não contemplado nas automações padrão.</p>
                      </div>
                      <Switch
                        checked={modulosCustom.necessidadeEspecifica}
                        onCheckedChange={(checked) => setModulosCustom(m => ({ ...m, necessidadeEspecifica: checked }))}
                      />
                    </div>

                    {modulosCustom.necessidadeEspecifica && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Descrição da Necessidade (1 Frase)</Label>
                        <Textarea
                          placeholder="Ex: Integração com sistema de agendamento próprio via webhook."
                          value={modulosCustom.descricao}
                          onChange={(e) => setModulosCustom(m => ({ ...m, descricao: e.target.value }))}
                          className="h-20"
                        />
                        <p className="text-[11px] text-amber-600 font-semibold">
                          ⚠️ Importante: Não prometer prazo de entrega de módulo customizado sem validação prévia com o time de engenharia.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* SEÇÃO 6: FECHAMENTO */}
            <TabsContent value="fechamento" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    6. Fechamento da Reunião de Implantação
                    <Badge variant="outline" className="text-xs">Essencial + Avançado [E+A]</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <Checkbox
                      id="recapitulado"
                      checked={fechamento.recapitulado}
                      onCheckedChange={(checked) => setFechamento(f => ({ ...f, recapitulado: !!checked }))}
                    />
                    <Label htmlFor="recapitulado" className="text-xs font-bold cursor-pointer">
                      Cada seção foi recapitulada verbalmente com o cliente, alinhando expectativas operacionais.
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Data Prevista para Go-Live</Label>
                      <Input
                        type="date"
                        value={fechamento.dataGoLive}
                        onChange={(e) => setFechamento(f => ({ ...f, dataGoLive: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Responsável pelo Próximo Contato</Label>
                      <Input
                        placeholder="Ex: Gestora de Contas (Ana)"
                        value={fechamento.proximoContatoQuem}
                        onChange={(e) => setFechamento(f => ({ ...f, proximoContatoQuem: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Data do Próximo Contato</Label>
                      <Input
                        type="date"
                        value={fechamento.proximoContatoData}
                        onChange={(e) => setFechamento(f => ({ ...f, proximoContatoData: e.target.value }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* BOTÕES DE AÇÃO E SALVAMENTO */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate("em_andamento")}
            disabled={saveMutation.isPending}
            className="h-11 font-bold text-xs gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar Rascunho
          </Button>

          <Button
            onClick={() => saveMutation.mutate("concluido")}
            disabled={saveMutation.isPending}
            className="h-11 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md shadow-emerald-600/20 px-6"
          >
            <CheckCircle2 className="h-4 w-4" />
            Concluir & Sincronizar Tenant
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
