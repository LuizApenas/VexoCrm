import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Snowflake,
  Settings,
  Rocket,
  CheckSquare,
  Square,
  Trash2,
  Tag as TagIcon,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  X
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export interface EvolutionInstanceItem {
  id: string;
  name: string;
  active: boolean;
  is_default: boolean;
}

export default function BancoDeDados() {
  const navigate = useNavigate();
  const { isAuthenticated, getIdToken } = useAuth();
  const crmClient = useOptionalCrmClient();
  const clientId = crmClient?.selectedClient?.id || "infinie";

  // Main Data States
  const [leads, setLeads] = useState<LeadIntelligenceItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalLeads: 0,
    buyersCount: 0,
    openBudgetsCount: 0,
    estimatedRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ticket Médio Config (stored in localStorage)
  const [ticketMedio, setTicketMedio] = useState<number>(() => {
    const saved = localStorage.getItem(`vexo_ticket_medio_${clientId}`);
    return saved ? Number(saved) : 2500;
  });
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [tempTicketInput, setTempTicketInput] = useState(String(ticketMedio));

  // Evolution Instances for WA Extractor
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstanceItem[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // WhatsApp Extraction Modal State
  const [isWAModalOpen, setIsWAModalOpen] = useState(false);
  const [waChatLimit, setWaChatLimit] = useState<number>(100);
  const [isExtractingWA, setIsExtractingWA] = useState(false);
  const [waExtractStep, setWaExtractStep] = useState<string>("");

  // CSV Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsedRows, setCsvParsedRows] = useState<Record<string, string>[]>([]);
  const [csvSanitizePreview, setCsvSanitizePreview] = useState<{ validCount: number; invalidCount: number }>({
    validCount: 0,
    invalidCount: 0,
  });
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create Manual Lead State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadStage, setNewLeadStage] = useState<"buyer" | "open_budget" | "inquiry" | "cold" | "lost">("cold");
  const [newLeadTemp, setNewLeadTemp] = useState<"hot" | "warm" | "cold">("warm");
  const [newLeadTags, setNewLeadTags] = useState("");

  // Lead Detail Sheet (Slide-Over Drawer)
  const [selectedLead, setSelectedLead] = useState<LeadIntelligenceItem | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  // Bulk Selection (Ações em Lote)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBulkStageModalOpen, setIsBulkStageModalOpen] = useState(false);
  const [bulkStageValue, setBulkStageValue] = useState<"buyer" | "open_budget" | "inquiry" | "cold" | "lost">("cold");
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");

  // Fetch Leads List & Aggregations
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

  // Fetch Available Evolution Instances for Tenant
  const fetchEvolutionInstances = async () => {
    if (!isAuthenticated) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/lead-clients/${clientId}/evolution-instances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setEvolutionInstances(items);
        const defaultInst = items.find((i: any) => i.is_default) || items[0];
        if (defaultInst) {
          setSelectedInstanceId(defaultInst.id);
        }
      }
    } catch (e) {
      console.warn("[BancoDeDados] Instâncias Evolution não carregadas:", e);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [clientId, activeTab, selectedTag]);

  useEffect(() => {
    fetchEvolutionInstances();
  }, [clientId]);

  // Handle WhatsApp Extraction Execution
  const handleExtractWA = async () => {
    setIsExtractingWA(true);
    setWaExtractStep("Conectando à Evolution API...");

    try {
      const token = await getIdToken();
      
      setTimeout(() => {
        setWaExtractStep("Buscando mensagens recentes e minerando contatos...");
      }, 1500);

      setTimeout(() => {
        setWaExtractStep("Classificando conversas com IA semântica...");
      }, 3500);

      const res = await fetch(`${API_BASE_URL}/api/leads/extract-wa-contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          instanceId: selectedInstanceId || undefined,
          chatLimit: waChatLimit,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      toast.success(`Extração Semântica Concluída! 🎉`, {
        description: `${data.extractedCount || 0} contatos minerados e enriquecidos com IA.`,
      });

      setIsWAModalOpen(false);
      fetchLeads();
    } catch (err: any) {
      console.error("[BancoDeDados] Erro na extração WA:", err);
      toast.error("Falha ao extrair contatos do WhatsApp", {
        description: err.message || "Verifique se a instância da Evolution API está conectada.",
      });
    } finally {
      setIsExtractingWA(false);
      setWaExtractStep("");
    }
  };

  // Parse CSV File for Preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        setCsvParsedRows([]);
        setCsvSanitizePreview({ validCount: 0, invalidCount: 0 });
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const rows: Record<string, string>[] = [];
      let valid = 0;
      let invalid = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        if (values.length === 0 || !values[0]) continue;

        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });

        const rawPhone = rowObj.telefone || rowObj.phone || rowObj.celular || rowObj.whatsapp || values[0];
        const digits = (rawPhone || "").replace(/\D/g, "");

        if (digits && digits.length >= 8) {
          valid++;
          rowObj.telefone = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
          rowObj.nome = rowObj.nome || rowObj.name || rowObj.cliente || values[1] || "";
          rows.push(rowObj);
        } else {
          invalid++;
        }
      }

      setCsvParsedRows(rows);
      setCsvSanitizePreview({ validCount: valid, invalidCount: invalid });
    } catch (err) {
      toast.error("Erro ao ler arquivo CSV.");
    }
  };

  // Submit CSV Import
  const handleImportCSVSubmit = async () => {
    if (!csvParsedRows || csvParsedRows.length === 0) {
      toast.error("Nenhum contato válido encontrado na planilha.");
      return;
    }

    setIsUploadingCSV(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/import-csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId, rows: csvParsedRows }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Falha ao importar CSV.");
      }

      const data = await res.json();
      toast.success("Planilha higienizada e importada!", {
        description: `${data.importedCount || 0} leads inseridos na base com padrão +55 E.164.`,
      });

      setIsImportModalOpen(false);
      setCsvFile(null);
      setCsvParsedRows([]);
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro na importação da planilha", { description: err.message });
    } finally {
      setIsUploadingCSV(false);
    }
  };

  // Ticket Médio Config Save
  const handleSaveTicketMedio = () => {
    const val = Number(tempTicketInput.replace(/\D/g, "")) || 2500;
    setTicketMedio(val);
    localStorage.setItem(`vexo_ticket_medio_${clientId}`, String(val));
    toast.success("Ticket Médio atualizado com sucesso!", {
      description: `Novo valor: ${val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    });
    setIsTicketModalOpen(false);
  };

  // Export Filtered CSV
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

      toast.success("Exportação concluída com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao exportar base", { description: err.message });
    }
  };

  // Create Campaign Navigation
  const handleCreateCampaign = () => {
    navigate("/crm/planilhas");
    toast.info("Redirecionando para disparos de campanhas...", {
      description: `Filtro ativo: ${activeTab.toUpperCase()}`,
    });
  };

  // Create Manual Lead
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
        .map((t) => t.trim())
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

  // Send WhatsApp Direct Message
  const handleSendWhatsApp = (phone: string, name?: string | null) => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return;
    const cleanPhone = digits.startsWith("55") ? digits : `55${digits}`;
    const text = encodeURIComponent(`Olá ${name || ""}! Como podemos te ajudar hoje?`);
    window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, "_blank");
  };

  // Lead Detail Sheet Actions
  const handleUpdateLeadStage = async (leadId: string, newStage: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) throw new Error("Falha ao atualizar estágio.");

      toast.success("Estágio do lead atualizado!");
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, stage: newStage as any });
      }
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro ao atualizar estágio", { description: err.message });
    }
  };

  const handleAddTagToLead = async (leadId: string) => {
    if (!newTagInput.trim() || !selectedLead) return;
    const tagToAdd = newTagInput.trim();
    const currentTags = Array.isArray(selectedLead.tags) ? selectedLead.tags : [];
    if (currentTags.includes(tagToAdd)) {
      setNewTagInput("");
      return;
    }

    const updatedTags = [...currentTags, tagToAdd];
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags: updatedTags }),
      });

      if (!res.ok) throw new Error("Falha ao adicionar tag.");

      setSelectedLead({ ...selectedLead, tags: updatedTags });
      setNewTagInput("");
      fetchLeads();
      toast.success(`Tag "${tagToAdd}" adicionada!`);
    } catch (err: any) {
      toast.error("Erro ao adicionar tag", { description: err.message });
    }
  };

  const handleRemoveTagFromLead = async (leadId: string, tagToRemove: string) => {
    if (!selectedLead) return;
    const currentTags = Array.isArray(selectedLead.tags) ? selectedLead.tags : [];
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);

    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags: updatedTags }),
      });

      if (!res.ok) throw new Error("Falha ao remover tag.");

      setSelectedLead({ ...selectedLead, tags: updatedTags });
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro ao remover tag", { description: err.message });
    }
  };

  const handleDeleteSingleLead = async (leadId: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/${leadId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Falha ao deletar lead.");

      toast.success("Lead removido com sucesso.");
      setIsDetailSheetOpen(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro ao deletar lead", { description: err.message });
    }
  };

  // Bulk Selection Actions
  const handleToggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStageSubmit = async () => {
    if (selectedLeadIds.length === 0) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/bulk-update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          leadIds: selectedLeadIds,
          updates: { stage: bulkStageValue },
        }),
      });

      if (!res.ok) throw new Error("Falha ao atualizar em lote.");

      toast.success(`Estágio alterado para ${selectedLeadIds.length} leads!`);
      setIsBulkStageModalOpen(false);
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro na atualização em lote", { description: err.message });
    }
  };

  const handleBulkTagSubmit = async () => {
    if (selectedLeadIds.length === 0 || !bulkTagValue.trim()) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/bulk-update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          leadIds: selectedLeadIds,
          updates: { addTag: bulkTagValue.trim() },
        }),
      });

      if (!res.ok) throw new Error("Falha ao adicionar tag em lote.");

      toast.success(`Tag "${bulkTagValue.trim()}" adicionada a ${selectedLeadIds.length} leads!`);
      setIsBulkTagModalOpen(false);
      setBulkTagValue("");
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro na tag em lote", { description: err.message });
    }
  };

  const handleBulkDeleteSubmit = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir os ${selectedLeadIds.length} leads selecionados?`)) {
      return;
    }

    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/bulk-delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          leadIds: selectedLeadIds,
        }),
      });

      if (!res.ok) throw new Error("Falha ao excluir em lote.");

      toast.success(`${selectedLeadIds.length} leads excluídos com sucesso!`);
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro ao excluir leads", { description: err.message });
    }
  };

  // Local filtered search list
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

  // Dynamic calculation for Receita Oculta card
  const computedRevenue = useMemo(() => {
    return summary.openBudgetsCount * ticketMedio;
  }, [summary.openBudgetsCount, ticketMedio]);

  // Unique tags across base
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (Array.isArray(l.tags)) {
        l.tags.forEach((t) => set.add(t));
      }
    });
    return Array.from(set);
  }, [leads]);

  // Badges & Temperature Helpers
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
      <div className="space-y-6 pb-20">
        {/* Header Superior com Botões de Ação Renderizados no Children */}
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
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setIsWAModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Extrair do WhatsApp (QR Code)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-2 text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Planilha
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTicketModalOpen(true)}
              className="gap-2 text-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              Ticket Médio
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Leads
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleCreateCampaign}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2 text-xs"
            >
              <Rocket className="w-3.5 h-3.5" />
              Criar Campanha
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
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
              <p className="text-xs text-muted-foreground mt-1">Leads cadastrados e minerados</p>
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
              <p className="text-xs text-muted-foreground mt-1">Clientes ativos e confirmados</p>
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
              <p className="text-xs text-muted-foreground mt-1">Propostas em negociação</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/40 shadow-sm relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                Receita Oculta na Base 💰
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsTicketModalOpen(true)}
                className="h-6 w-6 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                title="Configurar Ticket Médio"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {computedRevenue.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium flex items-center justify-between">
                <span>Orçamentos Abertos x Ticket</span>
                <span className="font-semibold">{ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Abas e Busca */}
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

        {/* Tabela Principal */}
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
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border dark:border-zinc-800 bg-muted/40">
                      <TableHead className="w-[40px] px-3">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.length > 0 && selectedLeadIds.length === filteredLeads.length}
                          onChange={handleToggleSelectAll}
                          className="rounded border-input text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </TableHead>
                      <TableHead className="w-[220px]">Contato / Nome</TableHead>
                      <TableHead className="w-[150px]">Telefone</TableHead>
                      <TableHead className="w-[140px]">Estágio</TableHead>
                      <TableHead className="w-[120px]">Temperatura</TableHead>
                      <TableHead>Tags & Interesses</TableHead>
                      <TableHead className="w-[150px]">Última Conversa</TableHead>
                      <TableHead className="text-right w-[120px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => {
                      const displayPhone = lead.phone || lead.telefone || "";
                      const displayName = lead.nome || "Sem Nome";
                      const isSelected = selectedLeadIds.includes(lead.id);
                      const lastInteraction = lead.last_interaction_at
                        ? new Date(lead.last_interaction_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : lead.created_at
                        ? new Date(lead.created_at).toLocaleDateString("pt-BR")
                        : "-";

                      return (
                        <TableRow
                          key={lead.id}
                          className={`border-b border-border dark:border-zinc-800/60 hover:bg-muted/30 cursor-pointer ${
                            isSelected ? "bg-indigo-500/5 dark:bg-indigo-500/10" : ""
                          }`}
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsDetailSheetOpen(true);
                          }}
                        >
                          <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(lead.id)}
                              className="rounded border-input text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </TableCell>

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

                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendWhatsApp(displayPhone, displayName)}
                              className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WA
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

        {/* Barra Flutuante de Ações em Lote (Bulk Actions) */}
        {selectedLeadIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-zinc-700 animate-in fade-in slide-in-from-bottom-4">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-500 text-white">
              {selectedLeadIds.length} selecionados
            </span>

            <div className="h-4 w-px bg-zinc-700 dark:bg-zinc-300" />

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsBulkStageModalOpen(true)}
              className="text-xs h-8 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Alterar Estágio
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsBulkTagModalOpen(true)}
              className="text-xs h-8 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Adicionar Tag
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleExportCSV}
              className="text-xs h-8 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Exportar
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleBulkDeleteSubmit}
              className="text-xs h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-900/30"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Excluir
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedLeadIds([])}
              className="h-7 w-7 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Modal A) Mineração Semântica via WhatsApp */}
      <Dialog open={isWAModalOpen} onOpenChange={setIsWAModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              Mineração Semântica via WhatsApp
            </DialogTitle>

            <DialogDescription>
              Conecte-se à Evolution API para extrair automaticamente contatos e enriquecer leads com inteligência semântica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-semibold text-foreground">Instância Conectada</label>
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full h-9 px-3 mt-1 rounded-md border border-input bg-background text-xs"
              >
                {evolutionInstances.length === 0 ? (
                  <option value="">Instância Padrão Evolution</option>
                ) : (
                  evolutionInstances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} {inst.is_default ? "(Padrão)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Limite de Conversas para Analisar</label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[50, 100, 300].map((limitOption) => (
                  <Button
                    key={limitOption}
                    type="button"
                    variant={waChatLimit === limitOption ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWaChatLimit(limitOption)}
                    className="text-xs"
                  >
                    {limitOption} chats
                  </Button>
                ))}
              </div>
            </div>

            {isExtractingWA && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center space-y-2">
                <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto" />
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {waExtractStep || "Minerando contatos..."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWAModalOpen(false)} disabled={isExtractingWA}>
              Cancelar
            </Button>
            <Button
              onClick={handleExtractWA}
              disabled={isExtractingWA}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isExtractingWA ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Iniciar Extração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal B) Importar Planilha CSV/Excel */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              Importar Planilha de Leads
            </DialogTitle>

            <DialogDescription>
              Selecione o arquivo CSV. O sistema realiza higienização automática no padrão E.164 (+55...).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border dark:border-zinc-800 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-foreground">
                {csvFile ? csvFile.name : "Clique para selecionar a planilha (.csv)"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {csvFile && (
              <div className="bg-muted/40 border border-border rounded-md p-3 text-xs space-y-1">
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ {csvSanitizePreview.validCount} contatos validados no padrão +55...
                </p>
                {csvSanitizePreview.invalidCount > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    ⚠ {csvSanitizePreview.invalidCount} registros sem fone válido (serão ignorados).
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleImportCSVSubmit}
              disabled={!csvFile || isUploadingCSV || csvSanitizePreview.validCount === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isUploadingCSV ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Processar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal C) Ticket Médio Config */}
      <Dialog open={isTicketModalOpen} onOpenChange={setIsTicketModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-500" />
              Configurar Ticket Médio
            </DialogTitle>
            <DialogDescription>Defina o valor médio estimado por contrato no seu segmento.</DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <label className="text-xs font-semibold text-foreground">Valor do Ticket Médio (R$)</label>
            <Input
              type="number"
              value={tempTicketInput}
              onChange={(e) => setTempTicketInput(e.target.value)}
              className="text-sm mt-1"
              placeholder="Ex: 2500"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTicketModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTicketMedio} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Salvar Valor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cadastro Manual */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateLead}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                Cadastrar Novo Lead Manual
              </DialogTitle>
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

      {/* Drawer Lateral (Sheet) de Detalhes do Lead */}
      <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedLead && (
            <div className="space-y-6 pt-4">
              <SheetHeader>
                <SheetTitle className="text-lg font-bold flex items-center justify-between">
                  <span>{selectedLead.nome || "Lead Sem Nome"}</span>
                </SheetTitle>
                <SheetDescription className="text-xs font-mono">
                  {selectedLead.phone || selectedLead.telefone}
                </SheetDescription>
              </SheetHeader>

              <div className="flex items-center gap-2">
                {getStageBadge(selectedLead.stage)}
                {getTemperatureBadge(selectedLead.temperature)}
              </div>

              {/* Resumo da IA */}
              <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Resumo Semântico da IA
                </span>
                <p className="text-xs text-foreground/90 leading-relaxed italic">
                  "{selectedLead.raw_chat_summary || "Sem histórico recente analisado."}"
                </p>
              </div>

              {/* Tags Management */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <TagIcon className="w-3.5 h-3.5" /> Tags do Lead
                </label>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(selectedLead.tags) && selectedLead.tags.length > 0 ? (
                    selectedLead.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="text-xs gap-1 py-0.5 bg-secondary text-secondary-foreground"
                      >
                        {t}
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-rose-500"
                          onClick={() => handleRemoveTagFromLead(selectedLead.id, t)}
                        />
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Nenhuma tag atribuída.</span>
                  )}
                </div>

                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Adicionar nova tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddTagToLead(selectedLead.id)}
                    className="h-8 text-xs"
                  >
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-2"
                  onClick={() => handleSendWhatsApp(selectedLead.phone || selectedLead.telefone, selectedLead.nome)}
                >
                  <MessageCircle className="w-4 h-4" />
                  Abrir Conversa no WhatsApp
                </Button>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Alterar Estágio</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant={selectedLead.stage === "buyer" ? "default" : "outline"}
                      onClick={() => handleUpdateLeadStage(selectedLead.id, "buyer")}
                      className="text-xs"
                    >
                      Comprador 🟢
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedLead.stage === "open_budget" ? "default" : "outline"}
                      onClick={() => handleUpdateLeadStage(selectedLead.id, "open_budget")}
                      className="text-xs"
                    >
                      Orçamento Aberto 🟡
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedLead.stage === "cold" ? "default" : "outline"}
                      onClick={() => handleUpdateLeadStage(selectedLead.id, "cold")}
                      className="text-xs"
                    >
                      Lead Frio ⚪
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedLead.stage === "lost" ? "default" : "outline"}
                      onClick={() => handleUpdateLeadStage(selectedLead.id, "lost")}
                      className="text-xs"
                    >
                      Perdido 🔴
                    </Button>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteSingleLead(selectedLead.id)}
                  className="w-full text-xs gap-2 mt-4"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Lead
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal Bulk Change Stage */}
      <Dialog open={isBulkStageModalOpen} onOpenChange={setIsBulkStageModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Alterar Estágio em Lote</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <select
              value={bulkStageValue}
              onChange={(e: any) => setBulkStageValue(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
            >
              <option value="cold">Lead Frio ⚪</option>
              <option value="inquiry">Em Dúvida 🔵</option>
              <option value="open_budget">Orçamento Aberto 🟡</option>
              <option value="buyer">Comprador 🟢</option>
              <option value="lost">Perdido 🔴</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsBulkStageModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleBulkStageSubmit} className="bg-indigo-600 text-white">
              Aplicar a {selectedLeadIds.length} leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Bulk Add Tag */}
      <Dialog open={isBulkTagModalOpen} onOpenChange={setIsBulkTagModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Adicionar Tag em Lote</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              placeholder="Digite a nova tag..."
              value={bulkTagValue}
              onChange={(e) => setBulkTagValue(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsBulkTagModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleBulkTagSubmit} className="bg-indigo-600 text-white">
              Adicionar Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
