import { useEffect, useMemo, useState, useRef } from "react";
import {
  Database,
  Upload,
  Download,
  RefreshCw,
  Search,
  MessageCircle,
  Clock,
  Sparkles,
  TrendingUp,
  UserCheck,
  Coins,
  AlertCircle,
  Plus,
  FileSpreadsheet,
  Flame,
  Sun,
  Snowflake
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { API_BASE_URL } from "@/lib/api";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export interface LeadIntelligenceItem {
  id: string;
  client_id: string;
  telefone: string;
  phone?: string | null;
  nome: string | null;
  stage?: "buyer" | "open_budget" | "inquiry" | "cold" | "lost" | null;
  temperature?: "hot" | "warm" | "cold" | null;
  tags?: string[] | null;
  last_interaction_at?: string | null;
  extracted_from_wa?: boolean | null;
  raw_chat_summary?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SummaryStats {
  totalLeads: number;
  buyersCount: number;
  openBudgetsCount: number;
  estimatedRevenue: number;
}

export default function BancoDeDados() {
  const { isAuthenticated, getIdToken } = useAuth();
  const crmClient = useOptionalCrmClient();
  const clientId = crmClient?.selectedClient?.id || "infinie";

  const [leads, setLeads] = useState<LeadIntelligenceItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalLeads: 0,
    buyersCount: 0,
    openBudgetsCount: 0,
    estimatedRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // Modals & Actions state
  const [isExtractingWA, setIsExtractingWA] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

  // New Lead Form State
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadStage, setNewLeadStage] = useState<"buyer" | "open_budget" | "inquiry" | "cold" | "lost">("cold");
  const [newLeadTemp, setNewLeadTemp] = useState<"hot" | "warm" | "cold">("warm");
  const [newLeadTags, setNewLeadTags] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLeads = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Usuário não autenticado.");

      const params = new URLSearchParams({ clientId });
      if (activeTab !== "all") params.append("stage", activeTab);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (selectedTag) params.append("tag", selectedTag);

      const res = await fetch(`${API_BASE_URL}/api/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro na API (${res.status}): ${text}`);
      }

      const data = await res.json();
      setLeads(Array.isArray(data.items) ? data.items : []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error("[BancoDeDados] Erro ao carregar base:", err);
      setError(err.message || "Falha ao carregar leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [clientId, activeTab, selectedTag]);

  // Handle WhatsApp Extraction
  const handleExtractWA = async () => {
    setIsExtractingWA(true);
    toast.info("Iniciando extração automática de contatos via WhatsApp...", {
      description: "Conectando à Evolution API e analisando histórico recente de mensagens.",
    });

    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/extract-wa-contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      toast.success(`Extração concluída com sucesso! 🎉`, {
        description: `${data.extractedCount || 0} contatos processados e enriquecidos semanticamente.`,
      });

      fetchLeads();
    } catch (err: any) {
      console.error("[BancoDeDados] Erro na extração WA:", err);
      toast.error("Falha ao extrair contatos do WhatsApp", {
        description: err.message || "Verifique se a instância da Evolution API está conectada.",
      });
    } finally {
      setIsExtractingWA(false);
    }
  };

  // Handle CSV Import
  const handleImportCSVSubmit = async () => {
    if (!csvFile) {
      toast.error("Selecione um arquivo CSV ou Excel antes de enviar.");
      return;
    }

    setIsUploadingCSV(true);
    try {
      const text = await csvFile.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error("O arquivo CSV precisa ter um cabeçalho e pelo menos 1 linha de dados.");
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        if (values.length === 0 || !values[0]) continue;

        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });

        rowObj.telefone = rowObj.telefone || rowObj.phone || rowObj.celular || rowObj.whatsapp || values[0];
        rowObj.nome = rowObj.nome || rowObj.name || rowObj.cliente || values[1] || "";
        rows.push(rowObj);
      }

      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/import-csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId, rows }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Falha ao importar CSV.");
      }

      const data = await res.json();
      toast.success("Planilha importada com sucesso!", {
        description: `${data.importedCount || 0} de ${data.totalRows || 0} leads higienizados e inseridos.`,
      });

      setIsImportModalOpen(false);
      setCsvFile(null);
      fetchLeads();
    } catch (err: any) {
      console.error("[BancoDeDados] Erro na importação CSV:", err);
      toast.error("Erro na importação da planilha", {
        description: err.message || "Verifique o formato das colunas do arquivo.",
      });
    } finally {
      setIsUploadingCSV(false);
    }
  };

  // Handle Export CSV
  const handleExportCSV = async () => {
    try {
      const token = await getIdToken();
      const params = new URLSearchParams({ clientId });
      if (activeTab !== "all") params.append("stage", activeTab);

      const res = await fetch(`${API_BASE_URL}/api/leads/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Falha ao gerar arquivo de exportação.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_export_${clientId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Exportação iniciada!", {
        description: "Seu arquivo CSV foi baixado com sucesso.",
      });
    } catch (err: any) {
      toast.error("Erro ao exportar base", { description: err.message });
    }
  };

  // Handle Create Lead Manual
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadPhone.trim()) {
      toast.error("O número de telefone é obrigatório.");
      return;
    }

    try {
      const token = await getIdToken();
      const tagsArray = newLeadTags
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);

      const res = await fetch(`${API_BASE_URL}/api/leads/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          nome: newLeadName.trim() || undefined,
          telefone: newLeadPhone.trim(),
          stage: newLeadStage,
          temperature: newLeadTemp,
          tags: tagsArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao salvar lead.");
      }

      toast.success("Lead cadastrado com sucesso!");
      setIsCreateModalOpen(false);
      setNewLeadName("");
      setNewLeadPhone("");
      setNewLeadTags("");
      fetchLeads();
    } catch (err: any) {
      toast.error("Falha ao salvar lead", { description: err.message });
    }
  };

  // Handle WhatsApp Direct Message
  const handleSendWhatsApp = (phone: string, name?: string | null) => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return;
    const cleanPhone = digits.startsWith("55") ? digits : `55${digits}`;
    const text = encodeURIComponent(`Olá ${name || ""}! Como podemos te ajudar hoje?`);
    window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, "_blank");
  };

  // Filtered leads local search
  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      const phoneMatch = (item.telefone || item.phone || "").toLowerCase().includes(searchQuery.toLowerCase());
      const nameMatch = (item.nome || "").toLowerCase().includes(searchQuery.toLowerCase());
      const summaryMatch = (item.raw_chat_summary || "").toLowerCase().includes(searchQuery.toLowerCase());
      const searchOk = !searchQuery.trim() || phoneMatch || nameMatch || summaryMatch;

      const stageOk = activeTab === "all" || item.stage === activeTab;

      const tagOk = !selectedTag || (Array.isArray(item.tags) && item.tags.includes(selectedTag));

      return searchOk && stageOk && tagOk;
    });
  }, [leads, searchQuery, activeTab, selectedTag]);

  // Extract unique available tags across base
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (Array.isArray(l.tags)) {
        l.tags.forEach((t) => set.add(t));
      }
    });
    return Array.from(set);
  }, [leads]);

  // Helpers for Badges & Temperature
  const getStageBadge = (stage?: string | null) => {
    switch (stage) {
      case "buyer":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Comprador 🟢</Badge>;
      case "open_budget":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Orçamento Aberto 🟡</Badge>;
      case "inquiry":
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Em Dúvida 🔵</Badge>;
      case "lost":
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">Perdido 🔴</Badge>;
      case "cold":
      default:
        return <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30">Lead Frio ⚪</Badge>;
    }
  };

  const getTemperatureBadge = (temp?: string | null) => {
    switch (temp) {
      case "hot":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500"><Flame className="w-3.5 h-3.5 fill-rose-500" /> Quente</span>;
      case "warm":
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500"><Sun className="w-3.5 h-3.5" /> Morno</span>;
      case "cold":
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-400"><Snowflake className="w-3.5 h-3.5" /> Frio</span>;
    }
  };

  return (
    <PageShell>
      <div className="space-y-6 pb-12">
        {/* Header Superior & Título */}
        <SectionHeader
          title="Banco de Dados Inteligente"
          subtitle="Vexo Lead Intelligence & Extrator de Contatos com Inteligência Semântica via WhatsApp"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLeads()}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleExtractWA}
              disabled={isExtractingWA}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isExtractingWA ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              Extrair do WhatsApp (QR Code)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Importar Planilha
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar Selecionados
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Novo Lead
            </Button>
          </div>
        </SectionHeader>

        {/* Header Métrico (Cards KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card text-card-foreground border-border shadow-sm dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Leads na Base
              </CardTitle>
              <Database className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalLeads.toLocaleString("pt-BR")}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Leads cadastrados e rastreados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card text-card-foreground border-border shadow-sm dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Compradores (Clientes 🟢)
              </CardTitle>
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.buyersCount.toLocaleString("pt-BR")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Clientes ativos e confirmados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card text-card-foreground border-border shadow-sm dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Orçamentos Abertos 🟡
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {summary.openBudgetsCount.toLocaleString("pt-BR")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Propostas em negociação
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                Receita Oculta na Base 💰
              </CardTitle>
              <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {summary.estimatedRevenue.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">
                Orçamentos Abertos x Ticket Médio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Navegação por Abas de Estágio */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border dark:border-zinc-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={activeTab === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("all")}
              className="rounded-full text-xs"
            >
              Todas ({summary.totalLeads})
            </Button>
            <Button
              variant={activeTab === "buyer" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("buyer")}
              className="rounded-full text-xs text-emerald-600 dark:text-emerald-400"
            >
              Clientes 🟢 ({summary.buyersCount})
            </Button>
            <Button
              variant={activeTab === "open_budget" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("open_budget")}
              className="rounded-full text-xs text-amber-600 dark:text-amber-400"
            >
              Orçamentos Abertos 🟡 ({summary.openBudgetsCount})
            </Button>
            <Button
              variant={activeTab === "cold" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("cold")}
              className="rounded-full text-xs text-blue-600 dark:text-blue-400"
            >
              Leads Frios 🔵
            </Button>
            <Button
              variant={activeTab === "lost" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("lost")}
              className="rounded-full text-xs text-rose-600 dark:text-rose-400"
            >
              Perdidos 🔴
            </Button>
          </div>

          {/* Filtros de Busca e Tags */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, fone, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {availableTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground focus:ring-1 focus:ring-ring"
              >
                <option value="">Todas as Tags</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tabela Principal de Leads */}
        <Card className="bg-card text-card-foreground border-border shadow-sm dark:bg-zinc-900/60 dark:border-zinc-800">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Carregando inteligência de base...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-rose-500 gap-2">
                <AlertCircle className="w-6 h-6" />
                <span className="font-semibold">{error}</span>
                <Button variant="outline" size="sm" onClick={fetchLeads} className="mt-2">
                  Tentar Novamente
                </Button>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
                <Database className="w-8 h-8 opacity-40" />
                <p className="font-medium text-sm">Nenhum lead encontrado com os filtros atuais.</p>
                <p className="text-xs opacity-75">
                  Clique em "Extrair do WhatsApp" ou "Importar Planilha" para popular sua base.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border dark:border-zinc-800 bg-muted/40">
                      <TableHead className="w-[220px]">Contato / Nome</TableHead>
                      <TableHead className="w-[160px]">Telefone</TableHead>
                      <TableHead className="w-[150px]">Estágio</TableHead>
                      <TableHead className="w-[120px]">Temperatura</TableHead>
                      <TableHead>Tags & Interesses</TableHead>
                      <TableHead className="w-[160px]">Última Conversa</TableHead>
                      <TableHead className="text-right w-[140px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => {
                      const displayPhone = lead.phone || lead.telefone || "";
                      const displayName = lead.nome || "Sem Nome";
                      const lastInteraction = lead.last_interaction_at
                        ? new Date(lead.last_interaction_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : lead.created_at
                        ? new Date(lead.created_at).toLocaleDateString("pt-BR")
                        : "-";

                      return (
                        <TableRow key={lead.id} className="border-b border-border dark:border-zinc-800/60 hover:bg-muted/30">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                                {displayName.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground line-clamp-1">
                                  {displayName}
                                </span>
                                {lead.extracted_from_wa && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" /> Extraído via WA
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {displayPhone}
                          </TableCell>

                          <TableCell>{getStageBadge(lead.stage)}</TableCell>

                          <TableCell>{getTemperatureBadge(lead.temperature)}</TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(lead.tags) && lead.tags.length > 0 ? (
                                lead.tags.map((tag, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 bg-secondary/60 text-secondary-foreground"
                                  >
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground italic">-</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {lastInteraction}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendWhatsApp(displayPhone, displayName)}
                              className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              Disparar WA
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Importação de Planilha CSV / Excel */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              Importar Planilha de Leads
            </DialogTitle>
            <DialogDescription>
              Selecione um arquivo CSV com colunas de Nome e Telefone. A higienização no formato +55 será aplicada automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border dark:border-zinc-800 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-foreground">
                {csvFile ? csvFile.name : "Clique para selecionar o arquivo CSV"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Formatos suportados: .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleImportCSVSubmit}
              disabled={!csvFile || isUploadingCSV}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isUploadingCSV ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Processar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cadastro Manual de Lead */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateLead}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                Cadastrar Novo Lead Manual
              </DialogTitle>
              <DialogDescription>Preencha as informações principais do novo contato.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div>
                <label className="text-xs font-medium text-foreground">Nome Completo</label>
                <Input
                  placeholder="Ex: João da Silva"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Telefone / WhatsApp (E.164)</label>
                <Input
                  placeholder="Ex: +5511999999999"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  className="text-xs mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Estágio Inicial</label>
                  <select
                    value={newLeadStage}
                    onChange={(e: any) => setNewLeadStage(e.target.value)}
                    className="w-full h-9 px-3 mt-1 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="cold">Lead Frio ⚪</option>
                    <option value="inquiry">Em Dúvida 🔵</option>
                    <option value="open_budget">Orçamento Aberto 🟡</option>
                    <option value="buyer">Comprador 🟢</option>
                    <option value="lost">Perdido 🔴</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Temperatura</label>
                  <select
                    value={newLeadTemp}
                    onChange={(e: any) => setNewLeadTemp(e.target.value)}
                    className="w-full h-9 px-3 mt-1 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="warm">Morno 🌤️</option>
                    <option value="hot">Quente 🔥</option>
                    <option value="cold">Frio ❄️</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Tags (separadas por vírgula)</label>
                <Input
                  placeholder="Ex: Óculos de Sol, Prótese, WhatsApp"
                  value={newLeadTags}
                  onChange={(e) => setNewLeadTags(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Salvar Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
