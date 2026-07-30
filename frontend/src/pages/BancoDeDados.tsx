import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
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
  AlertCircle,
  Plus,
  FileSpreadsheet,
  Flame,
  Sun,
  Snowflake,
  Settings,
  Rocket,
  Trash2,
  Tag as TagIcon,
  X,
  FileText,
  Filter,
  CheckCircle2,
  ChevronDown
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseSpreadsheetFile, detectSpreadsheetColumns } from "@/lib/leadImports/spreadsheet";
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
  [key: string]: any;
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

export interface DynamicFilterRule {
  id: string;
  column: string;
  operator: "equals" | "contains" | "gt" | "lt";
  value: string;
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

  // Import Modal State (Excel .xlsx/.xls + CSV)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsedRows, setImportParsedRows] = useState<Record<string, unknown>[]>([]);
  const [importSanitizePreview, setImportSanitizePreview] = useState<{ validCount: number; invalidCount: number }>({
    validCount: 0,
    invalidCount: 0,
  });
  const [isUploadingImport, setIsUploadingImport] = useState(false);
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

  // Campaign Creation Wizard Modal State
  const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
  const [campaignSourceType, setCampaignSourceType] = useState<"funnel" | "spreadsheet">("funnel");
  
  // Funnel Audience Selection State
  const [campaignStageFilters, setCampaignStageFilters] = useState<string[]>(["all"]);
  const [campaignTagFilter, setCampaignTagFilter] = useState<string>("");
  const [campaignSelectedLeadIds, setCampaignSelectedLeadIds] = useState<string[]>([]);
  const [campaignFunnelFilterRules, setCampaignFunnelFilterRules] = useState<DynamicFilterRule[]>([]);

  // Spreadsheet Audience Selection State
  const [campaignFile, setCampaignFile] = useState<File | null>(null);
  const [campaignSpreadsheetRows, setCampaignSpreadsheetRows] = useState<Record<string, unknown>[]>([]);
  const [campaignSpreadsheetColumns, setCampaignSpreadsheetColumns] = useState<string[]>([]);
  const [campaignSpreadsheetRules, setCampaignSpreadsheetRules] = useState<DynamicFilterRule[]>([]);
  const campaignFileInputRef = useRef<HTMLInputElement>(null);

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
      const fetchedItems = Array.isArray(data.items) ? data.items : [];
      setLeads(fetchedItems);
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

  // Parse Excel (.xlsx, .xls) or CSV File for Import
  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    try {
      const rows = await parseSpreadsheetFile(file);
      const mapping = detectSpreadsheetColumns(rows);
      let valid = 0;
      let invalid = 0;

      const normalizedRows = rows.map((row) => {
        const newRow: Record<string, unknown> = { ...row };
        const rawPhone = String(row[mapping.telefone || "telefone"] || row.phone || row.celular || row.whatsapp || "").trim();
        const digits = rawPhone.replace(/\D/g, "");

        if (digits && digits.length >= 8) {
          valid++;
          newRow.telefone = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
        } else {
          invalid++;
        }
        if (mapping.nome && row[mapping.nome]) {
          newRow.nome = String(row[mapping.nome]).trim();
        }
        return newRow;
      });

      setImportParsedRows(normalizedRows);
      setImportSanitizePreview({ validCount: valid, invalidCount: invalid });
    } catch (err: any) {
      toast.error("Erro ao ler arquivo da planilha", { description: err.message || "Formato não suportado." });
    }
  };

  // Submit Import (CSV / Excel)
  const handleImportSubmit = async () => {
    if (!importParsedRows || importParsedRows.length === 0) {
      toast.error("Nenhum contato válido encontrado na planilha.");
      return;
    }

    setIsUploadingImport(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/leads/import-csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId, rows: importParsedRows }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Falha ao importar planilha.");
      }

      const data = await res.json();
      toast.success("Planilha higienizada e importada com sucesso! 🎉", {
        description: `${data.importedCount || 0} leads inseridos na base no padrão +55 E.164.`,
      });

      setIsImportModalOpen(false);
      setImportFile(null);
      setImportParsedRows([]);
      fetchLeads();
    } catch (err: any) {
      toast.error("Erro na importação da planilha", { description: err.message });
    } finally {
      setIsUploadingImport(false);
    }
  };

  // Save Ticket Médio
  const handleSaveTicketMedio = () => {
    const val = Number(tempTicketInput.replace(/\D/g, "")) || 2500;
    setTicketMedio(val);
    localStorage.setItem(`vexo_ticket_medio_${clientId}`, String(val));
    toast.success("Ticket Médio atualizado com sucesso!", {
      description: `Novo valor: ${val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    });
    setIsTicketModalOpen(false);
  };

  // Export Leads (Excel .xlsx)
  const handleExportXLSX = () => {
    try {
      const exportData = filteredLeads.map((l) => ({
        "ID": l.id,
        "Nome": l.nome || "",
        "Telefone (E.164)": l.phone || l.telefone || "",
        "Estágio": l.stage || "cold",
        "Temperatura": l.temperature || "warm",
        "Tags": Array.isArray(l.tags) ? l.tags.join(", ") : "",
        "Resumo IA": l.raw_chat_summary || "",
        "Última Interação": l.last_interaction_at ? new Date(l.last_interaction_at).toLocaleString("pt-BR") : "",
        "Data de Cadastro": new Date(l.created_at).toLocaleString("pt-BR"),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `leads_${clientId}_${Date.now()}.xlsx`);

      toast.success("Planilha Excel (.xlsx) baixada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao exportar arquivo Excel", { description: err.message });
    }
  };

  // Export Leads (CSV)
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

      toast.success("Arquivo CSV exportado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao exportar base", { description: err.message });
    }
  };

  // Open Campaign Wizard
  const handleOpenCampaignWizard = () => {
    setIsCampaignWizardOpen(true);
    setCampaignSelectedLeadIds(filteredLeads.map((l) => l.id));
  };

  // Handle Campaign Wizard File Select
  const handleCampaignFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCampaignFile(file);

    try {
      const rows = await parseSpreadsheetFile(file);
      setCampaignSpreadsheetRows(rows);
      if (rows.length > 0) {
        setCampaignSpreadsheetColumns(Object.keys(rows[0]));
      }
      toast.success("Planilha carregada para a campanha!", {
        description: `${rows.length} registros e ${Object.keys(rows[0] || {}).length} colunas identificadas.`,
      });
    } catch (err: any) {
      toast.error("Erro ao ler planilha", { description: err.message });
    }
  };

  // Dynamic Rule Helper for Filtering Rows
  const applyDynamicRules = (rows: Record<string, any>[], rules: DynamicFilterRule[]) => {
    if (rules.length === 0) return rows;
    return rows.filter((row) => {
      return rules.every((rule) => {
        if (!rule.column) return true;
        const rawVal = row[rule.column];
        const valStr = String(rawVal ?? "").trim().toLowerCase();
        const ruleVal = rule.value.trim().toLowerCase();

        switch (rule.operator) {
          case "equals":
            return valStr === ruleVal;
          case "contains":
            return valStr.includes(ruleVal);
          case "gt": {
            const num = parseFloat(valStr.replace(/[^\d\.,-]/g, "").replace(",", "."));
            const ruleNum = parseFloat(ruleVal);
            return !isNaN(num) && !isNaN(ruleNum) && num > ruleNum;
          }
          case "lt": {
            const num = parseFloat(valStr.replace(/[^\d\.,-]/g, "").replace(",", "."));
            const ruleNum = parseFloat(ruleVal);
            return !isNaN(num) && !isNaN(ruleNum) && num < ruleNum;
          }
          default:
            return true;
        }
      });
    });
  };

  // Computed Target Audience for Campaign Wizard
  const campaignFunnelFilteredLeads = useMemo(() => {
    const base = leads.filter((l) => {
      const isAll = campaignStageFilters.length === 0 || campaignStageFilters.includes("all");
      const stageOk = isAll || (l.stage && campaignStageFilters.includes(l.stage));
      const tagOk = !campaignTagFilter || (Array.isArray(l.tags) && l.tags.includes(campaignTagFilter));
      return stageOk && tagOk;
    });
    return applyDynamicRules(base, campaignFunnelFilterRules);
  }, [leads, campaignStageFilters, campaignTagFilter, campaignFunnelFilterRules]);

  const campaignSpreadsheetFilteredRows = useMemo(() => {
    return applyDynamicRules(campaignSpreadsheetRows, campaignSpreadsheetRules);
  }, [campaignSpreadsheetRows, campaignSpreadsheetRules]);

  // Submit Campaign Audience and Redirect to Planilhas
  const handleProceedToCampaign = () => {
    let finalRows: Record<string, any>[] = [];
    let campaignTitleName = "";

    if (campaignSourceType === "funnel") {
      const selected = campaignFunnelFilteredLeads.filter((l) => campaignSelectedLeadIds.includes(l.id));
      if (selected.length === 0) {
        toast.error("Selecione pelo menos 1 lead para a campanha.");
        return;
      }
      finalRows = selected.map((l) => ({
        telefone: l.phone || l.telefone,
        nome: l.nome || "",
        stage: l.stage || "cold",
        temperature: l.temperature || "warm",
        tags: Array.isArray(l.tags) ? l.tags.join(", ") : "",
        resumo_ia: l.raw_chat_summary || "",
      }));
      const stageLabel = campaignStageFilters.includes("all") || campaignStageFilters.length === 0
        ? "TODOS OS ESTÁGIOS"
        : campaignStageFilters.map(s => s.toUpperCase()).join("+");
      campaignTitleName = `Campanha Funil [${stageLabel}] (${selected.length} leads)`;
    } else {
      if (campaignSpreadsheetFilteredRows.length === 0) {
        toast.error("Nenhum contato encontrado na planilha com os filtros aplicados.");
        return;
      }
      finalRows = campaignSpreadsheetFilteredRows;
      campaignTitleName = `Campanha Planilha ${campaignFile?.name || "Importada"} (${finalRows.length} contatos)`;
    }

    localStorage.setItem(
      "vexo_pending_campaign_audience",
      JSON.stringify({
        campaignName: campaignTitleName,
        rows: finalRows,
      })
    );

    setIsCampaignWizardOpen(false);
    toast.success("Público-Alvo Configurado! 🎯", {
      description: "Redirecionando para a central de campanhas e disparos...",
    });

    navigate("/crm/planilhas");
  };

  // Create Manual Lead Submit
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

  // Open WhatsApp Web
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
        {/* Header Superior */}
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
              Importar Planilha (.xlsx/.csv)
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

            {/* Dropdown com opções de exportação XLSX e CSV */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  Exportar Leads
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportXLSX} className="cursor-pointer text-xs gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Exportar Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer text-xs gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Exportar CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="default"
              size="sm"
              onClick={handleOpenCampaignWizard}
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
              onClick={handleExportXLSX}
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

      {/* Modal B) Importar Planilha (Excel .xlsx / .xls + CSV) */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              Importar Planilha de Leads (.xlsx / .csv)
            </DialogTitle>

            <DialogDescription>
              Selecione o arquivo Excel ou CSV. O sistema realiza higienização automática no padrão E.164 (+55...).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border dark:border-zinc-800 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-foreground">
                {importFile ? importFile.name : "Clique para selecionar a planilha (.xlsx, .xls, .csv)"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, .ods"
                className="hidden"
                onChange={handleImportFileSelect}
              />
            </div>

            {importFile && (
              <div className="bg-muted/40 border border-border rounded-md p-3 text-xs space-y-1">
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ {importSanitizePreview.validCount} contatos validados no padrão +55...
                </p>
                {importSanitizePreview.invalidCount > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    ⚠ {importSanitizePreview.invalidCount} registros sem fone válido (serão ignorados).
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
              onClick={handleImportSubmit}
              disabled={!importFile || isUploadingImport || importSanitizePreview.validCount === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isUploadingImport ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Processar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Wizard: Criar Nova Campanha & Seleção de Público Alvo */}
      <Dialog open={isCampaignWizardOpen} onOpenChange={setIsCampaignWizardOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Rocket className="w-5 h-5 text-amber-500" />
              Criar Nova Campanha — Configuração do Público-Alvo
            </DialogTitle>
            <DialogDescription>
              Escolha a origem dos contatos e aplique filtros dinâmicos por variáveis antes de enviar a campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Escolha da Origem */}
            <div>
              <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
                1. Origem dos Leads
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setCampaignSourceType("funnel")}
                  className={`border rounded-lg p-3.5 cursor-pointer transition-all flex items-start gap-3 ${
                    campaignSourceType === "funnel"
                      ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/20"
                      : "border-border hover:border-amber-500/40"
                  }`}
                >
                  <Database className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Leads do Banco Inteligente</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Filtrar por estágio do funil, tags, temperatura ou variáveis salvas.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setCampaignSourceType("spreadsheet")}
                  className={`border rounded-lg p-3.5 cursor-pointer transition-all flex items-start gap-3 ${
                    campaignSourceType === "spreadsheet"
                      ? "border-amber-500 bg-amber-500/10 dark:bg-amber-500/20"
                      : "border-border hover:border-amber-500/40"
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Planilha Externa (.xlsx / .csv)</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Carregar ou importar planilha com mapeamento de colunas dinâmicas.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Opção A: Filtros e Seleção do Funil */}
            {campaignSourceType === "funnel" ? (
              <div className="space-y-4 border-t border-border pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">Estágios do Funil (Múltipla Seleção)</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9 justify-between text-xs px-3 font-normal mt-1 border-input bg-background"
                        >
                          <span className="truncate">
                            {campaignStageFilters.includes("all") || campaignStageFilters.length === 0
                              ? `Todos os Estágios (${leads.length})`
                              : `${campaignStageFilters.length} Estágios: ${campaignStageFilters
                                  .map((s) =>
                                    s === "buyer"
                                      ? "Compradores 🟢"
                                      : s === "open_budget"
                                      ? "Orçamentos 🟡"
                                      : s === "inquiry"
                                      ? "Em Dúvida 🔵"
                                      : s === "cold"
                                      ? "Frios ⚪"
                                      : "Perdidos 🔴"
                                  )
                                  .join(", ")}`}
                          </span>
                          <ChevronDown className="w-4 h-4 ml-1 opacity-50 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 p-2 space-y-1 z-[100]">
                        <div
                          onClick={() => setCampaignStageFilters(["all"])}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-muted font-medium ${
                            campaignStageFilters.includes("all") || campaignStageFilters.length === 0 ? "bg-amber-500/10 text-amber-600 font-semibold" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={campaignStageFilters.includes("all") || campaignStageFilters.length === 0}
                            onChange={() => {}}
                            className="rounded text-amber-600 cursor-pointer"
                          />
                          <span>Todos os Estágios ({leads.length})</span>
                        </div>

                        <div className="h-px bg-border my-1" />

                        {[
                          { id: "buyer", label: "Compradores 🟢", count: summary.buyersCount },
                          { id: "open_budget", label: "Orçamentos Abertos 🟡", count: summary.openBudgetsCount },
                          { id: "inquiry", label: "Em Dúvida 🔵", count: leads.filter((l) => l.stage === "inquiry").length },
                          { id: "cold", label: "Leads Frios ⚪", count: leads.filter((l) => l.stage === "cold").length },
                          { id: "lost", label: "Perdidos 🔴", count: leads.filter((l) => l.stage === "lost").length },
                        ].map((stageItem) => {
                          const isChecked = !campaignStageFilters.includes("all") && campaignStageFilters.includes(stageItem.id);
                          return (
                            <div
                              key={stageItem.id}
                              onClick={() => {
                                let next: string[] = [];
                                if (campaignStageFilters.includes("all")) {
                                  next = [stageItem.id];
                                } else if (isChecked) {
                                  next = campaignStageFilters.filter((s) => s !== stageItem.id);
                                  if (next.length === 0) next = ["all"];
                                } else {
                                  next = [...campaignStageFilters, stageItem.id];
                                }
                                setCampaignStageFilters(next);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-muted ${
                                isChecked ? "bg-amber-500/10 text-amber-600 font-semibold" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded text-amber-600 cursor-pointer"
                                />
                                <span>{stageItem.label}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">({stageItem.count})</span>
                            </div>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">Filtrar por Tag</label>
                    <select
                      value={campaignTagFilter}
                      onChange={(e) => setCampaignTagFilter(e.target.value)}
                      className="w-full h-9 px-3 mt-1 rounded-md border border-input bg-background text-xs"
                    >
                      <option value="">Todas as Tags</option>
                      {availableTags.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Seleção Manual com Tabela */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center justify-between text-xs font-semibold">
                    <span>Lista de Leads Selecionados ({campaignSelectedLeadIds.length} de {campaignFunnelFilteredLeads.length})</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] px-2"
                      onClick={() => {
                        if (campaignSelectedLeadIds.length === campaignFunnelFilteredLeads.length) {
                          setCampaignSelectedLeadIds([]);
                        } else {
                          setCampaignSelectedLeadIds(campaignFunnelFilteredLeads.map((l) => l.id));
                        }
                      }}
                    >
                      {campaignSelectedLeadIds.length === campaignFunnelFilteredLeads.length ? "Desmarcar Todos" : "Selecionar Todos"}
                    </Button>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableBody>
                        {campaignFunnelFilteredLeads.map((l) => {
                          const isSel = campaignSelectedLeadIds.includes(l.id);
                          return (
                            <TableRow
                              key={l.id}
                              className="cursor-pointer hover:bg-muted/40"
                              onClick={() => {
                                setCampaignSelectedLeadIds((prev) =>
                                  prev.includes(l.id) ? prev.filter((id) => id !== l.id) : [...prev, l.id]
                                );
                              }}
                            >
                              <TableCell className="w-[30px] px-3">
                                <input type="checkbox" checked={isSel} onChange={() => {}} className="rounded" />
                              </TableCell>
                              <TableCell className="text-xs font-medium">{l.nome || "Sem Nome"}</TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">{l.phone || l.telefone}</TableCell>
                              <TableCell className="text-xs">{getStageBadge(l.stage)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              /* Opção B: Upload e Filtro por Variáveis da Planilha */
              <div className="space-y-4 border-t border-border pt-4">
                <div
                  onClick={() => campaignFileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-amber-500 transition-colors"
                >
                  <FileSpreadsheet className="w-7 h-7 text-amber-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">
                    {campaignFile ? campaignFile.name : "Clique para carregar planilha (.xlsx, .xls, .csv)"}
                  </p>
                  <input
                    ref={campaignFileInputRef}
                    type="file"
                    accept=".csv, .xlsx, .xls, .ods"
                    className="hidden"
                    onChange={handleCampaignFileSelect}
                  />
                </div>

                {/* Filtros por Variáveis Dinâmicas da Planilha */}
                {campaignSpreadsheetColumns.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5 text-amber-500" />
                        Filtros por Coluna / Variáveis Identificadas na Planilha
                      </label>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCampaignSpreadsheetRules((prev) => [
                            ...prev,
                            { id: String(Date.now()), column: campaignSpreadsheetColumns[0] || "", operator: "equals", value: "" },
                          ])
                        }
                        className="h-7 text-[11px] gap-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar Filtro por Variável
                      </Button>
                    </div>

                    {campaignSpreadsheetRules.map((rule, idx) => (
                      <div key={rule.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded-md border border-border">
                        <select
                          value={rule.column}
                          onChange={(e) => {
                            const newCol = e.target.value;
                            setCampaignSpreadsheetRules((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, column: newCol } : r))
                            );
                          }}
                          className="h-8 px-2 text-xs rounded border border-input bg-background flex-1"
                        >
                          {campaignSpreadsheetColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>

                        <select
                          value={rule.operator}
                          onChange={(e) => {
                            const newOp = e.target.value as any;
                            setCampaignSpreadsheetRules((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, operator: newOp } : r))
                            );
                          }}
                          className="h-8 px-2 text-xs rounded border border-input bg-background w-32"
                        >
                          <option value="equals">Igual a (=)</option>
                          <option value="contains">Contém</option>
                          <option value="gt">Maior que (&gt;)</option>
                          <option value="lt">Menor que (&lt;)</option>
                        </select>

                        <Input
                          placeholder="Valor (ex: Masculino, 5000...)"
                          value={rule.value}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setCampaignSpreadsheetRules((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, value: newVal } : r))
                            );
                          }}
                          className="h-8 text-xs flex-1"
                        />

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setCampaignSpreadsheetRules((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
                      <span>Contatos Selecionados pela Regra:</span>
                      <span className="font-bold">{campaignSpreadsheetFilteredRows.length} de {campaignSpreadsheetRows.length}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCampaignWizardOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleProceedToCampaign}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <Rocket className="w-4 h-4" />
              Avançar para Disparos ➔
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
