import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import * as XLSX from "xlsx";
import {
  Building2,
  CheckCircle2,
  DatabaseZap,
  Eye,
  FileSpreadsheet,
  History,
  Layers3,
  RefreshCw,
  Search,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadClients } from "@/hooks/useLeadClients";
import {
  useCreateLeadImport,
  useCreateN8nDispatch,
  useLeadImports,
  type CreateN8nDispatchResponse,
  type LeadImportItem,
  type LeadImportPreviewItem,
} from "@/hooks/useLeadImports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { cn } from "@/lib/utils";

type SheetTab = "dados" | "disparo" | "bases" | "agendamentos";

interface LeadImportsProps {
  fixedClientId?: string;
  fixedClientName?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

interface DispatchSessionState extends CreateN8nDispatchResponse {
  importId: string;
  requestedAt: string;
}

const INTERNAL_TABS: Array<{ id: SheetTab; label: string }> = [
  { id: "dados", label: "Dados Gerais" },
  { id: "disparo", label: "Novo Disparo" },
  { id: "bases", label: "Bases para Disparo" },
  { id: "agendamentos", label: "Agendamentos" },
];

const CLIENT_TABS: Array<{ id: SheetTab; label: string }> = [
  { id: "dados", label: "Dados Gerais" },
  { id: "bases", label: "Bases para Disparo" },
];

function parseSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (!result) return reject(new Error("Nao foi possivel ler o arquivo."));
        const workbook = XLSX.read(result, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) return reject(new Error("A planilha nao possui abas com dados."));
        const worksheet = workbook.Sheets[firstSheetName];
        resolve(XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "", raw: false }));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Falha ao processar a planilha."));
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo selecionado."));
    reader.readAsArrayBuffer(file);
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function SummaryCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof Layers3;
}) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function LeadImports({
  fixedClientId,
  fixedClientName,
  title = "Planilhas",
  subtitle = "Gerencie bases importadas e prepare disparos reais para o n8n.",
  headerRight,
}: LeadImportsProps) {
  const { isInternalUser } = useAuth();
  const { data: clients = [], isLoading: clientsLoading } = useLeadClients();
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [importPreview, setImportPreview] = useState<LeadImportPreviewItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SheetTab>("dados");
  const [selectedImportId, setSelectedImportId] = useState("");
  const [dispatchName, setDispatchName] = useState("");
  const [dispatchChannel, setDispatchChannel] = useState("whatsapp");
  const [dispatchLimit, setDispatchLimit] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [basesSearch, setBasesSearch] = useState("");
  const [dispatchSession, setDispatchSession] = useState<DispatchSessionState | null>(null);

  const { data: imports = [], isLoading: importsLoading, error: importsError, refetch } = useLeadImports(selectedClientId);
  const createLeadImport = useCreateLeadImport();
  const createN8nDispatch = useCreateN8nDispatch();

  useEffect(() => {
    if (fixedClientId) {
      setSelectedClientId(fixedClientId);
      return;
    }

    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, fixedClientId, selectedClientId]);

  useEffect(() => {
    if (!isInternalUser && activeTab !== "dados" && activeTab !== "bases") {
      setActiveTab("dados");
    }
  }, [activeTab, isInternalUser]);

  useEffect(() => {
    if (imports.length === 0) {
      setSelectedImportId("");
      return;
    }

    if (!selectedImportId || !imports.some((item) => item.id === selectedImportId)) {
      setSelectedImportId(imports[0].id);
    }
  }, [imports, selectedImportId]);

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const resolvedClientName = fixedClientName || selectedClient?.name || selectedClientId;
  const tabs = isInternalUser ? INTERNAL_TABS : CLIENT_TABS;
  const selectedImport = imports.find((item) => item.id === selectedImportId) || null;
  const totalImportedRows = imports.reduce((sum, item) => sum + item.imported_rows, 0);
  const filteredImports = imports.filter((item) =>
    [item.source_name, item.source_type, item.uploaded_by_email, formatDate(item.created_at)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(basesSearch.trim().toLowerCase())
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setImportPreview([]);
    setParseError(null);
    setParsedRows([]);
    setPreviewRows([]);

    if (!file) return;

    try {
      const rows = await parseSpreadsheetFile(file);
      setParsedRows(rows);
      setPreviewRows(rows.slice(0, 8));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Falha ao processar a planilha.");
    }
  }

  async function handleImport() {
    if (!selectedClientId) {
      setParseError("Selecione um cliente antes de importar.");
      return;
    }

    if (!selectedFile || parsedRows.length === 0) {
      setParseError("Selecione uma planilha valida para importar.");
      return;
    }

    setParseError(null);

    try {
      const response = await createLeadImport.mutateAsync({
        clientId: selectedClientId,
        sourceName: selectedFile.name,
        sourceType: selectedFile.name.split(".").pop()?.toLowerCase() || "spreadsheet",
        rows: parsedRows,
      });
      setSelectedImportId(response.item.id);
      setDispatchName(`Disparo ${response.item.source_name}`);
      setImportPreview(response.preview);
      toast.success("Base importada com sucesso.");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Falha ao importar planilha.");
    }
  }

  async function handleDispatch(importItem?: LeadImportItem) {
    const currentImport = importItem || selectedImport;
    if (!selectedClientId || !currentImport) {
      toast.error("Selecione uma base antes de disparar.");
      return;
    }

    const parsedLimit = Number.parseInt(dispatchLimit, 10);
    const limit = dispatchLimit.trim() && !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

    try {
      const response = await createN8nDispatch.mutateAsync({
        clientId: selectedClientId,
        importId: currentImport.id,
        limit,
      });
      setDispatchSession({
        ...response,
        importId: currentImport.id,
        requestedAt: new Date().toISOString(),
      });
      toast.success(`${response.total} leads enviados ao n8n.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao disparar base.");
    }
  }

  const clientSelector = fixedClientId ? null : (
    <div className="flex min-w-[220px] items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={clientsLoading}>
        <SelectTrigger className="border-border/80 bg-secondary/80">
          <SelectValue placeholder="Selecionar empresa" />
        </SelectTrigger>
        <SelectContent>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <PageShell title={title} subtitle={subtitle} headerRight={headerRight ?? clientSelector} spacing="space-y-6">
      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative -mb-px px-4 py-3 text-sm font-semibold transition-colors",
                activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(0,212,255,0.9)]" />}
            </button>
          ))}
        </div>

        {activeTab === "dados" && (
          <div className="space-y-6">
            <section className="grid gap-4 xl:grid-cols-3">
              <SummaryCard title="Bases Importadas" value={formatNumber(imports.length)} helper="Cada subida vira uma base real para disparo." icon={Layers3} />
              <SummaryCard title="Leads Prontos" value={formatNumber(totalImportedRows)} helper="Total de telefones validados nas importacoes." icon={CheckCircle2} />
              <SummaryCard title="Ultima Subida" value={imports[0] ? formatDateShort(imports[0].created_at) : "--"} helper={imports[0] ? imports[0].source_name : "Nenhuma planilha importada ainda."} icon={DatabaseZap} />
            </section>

            <section>
              <SectionHeader title="Nova importacao" subtitle="Aceita CSV, XLS e XLSX. O backend normaliza os campos e popula a tabela leads." icon={Upload} />
              <Card className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileSpreadsheet className="h-4 w-4" />
                    {resolvedClientName || "Selecione um cliente"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ErrorMessage message={parseError} variant="banner" />
                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <Input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileChange} className="border-border/80 bg-secondary/80" />
                    <Button onClick={handleImport} disabled={!selectedFile || createLeadImport.isPending}>
                      <Upload className="mr-2 h-4 w-4" />
                      {createLeadImport.isPending ? "Importando..." : "Importar planilha"}
                    </Button>
                  </div>

                  {selectedFile && (
                    <div className="rounded-xl border border-border/70 bg-secondary/30 p-4 text-sm">
                      <p>Arquivo: {selectedFile.name}</p>
                      <p>Linhas lidas: {parsedRows.length}</p>
                    </div>
                  )}

                  {previewRows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>{Object.keys(previewRows[0]).map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRows.map((row, index) => (
                            <TableRow key={`${index}-${Object.values(row).join("-")}`}>
                              {Object.keys(previewRows[0]).map((column) => <TableCell key={column} className="max-w-[220px] truncate">{String(row[column] ?? "")}</TableCell>)}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {importPreview.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Linha</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Cidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Resultado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.map((item) => (
                            <TableRow key={`${item.rowNumber}-${item.telefone || "skip"}`}>
                              <TableCell>{item.rowNumber}</TableCell>
                              <TableCell>{item.telefone || "-"}</TableCell>
                              <TableCell>{item.nome || "-"}</TableCell>
                              <TableCell>{item.cidade || "-"}</TableCell>
                              <TableCell>{item.status || "-"}</TableCell>
                              <TableCell>{item.imported ? "Importado" : item.skipReason || "Ignorado"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <SectionHeader title="Bases prontas" subtitle="Lista operacional das importacoes que ja podem ser usadas em disparos." icon={History} />
              <Card className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Importacoes recentes</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={importsLoading}>
                      <RefreshCw className={cn("mr-1 h-4 w-4", importsLoading && "animate-spin")} />
                      Atualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ErrorMessage message={importsError ? (importsError as Error).message : null} variant="banner" />
                  {importsLoading && <EmptyState message="Carregando bases..." />}
                  {!importsLoading && !importsError && imports.length === 0 && <EmptyState title="Nenhuma importacao encontrada" description="Assim que uma planilha for processada, a base aparece aqui." />}
                  {!importsLoading && !importsError && imports.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Base</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Prontas</TableHead>
                            <TableHead>Ignoradas</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Subida em</TableHead>
                            {isInternalUser && <TableHead className="text-right">Acao</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {imports.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.source_name}</TableCell>
                              <TableCell>{item.source_type}</TableCell>
                              <TableCell>{item.total_rows}</TableCell>
                              <TableCell>{item.imported_rows}</TableCell>
                              <TableCell>{item.skipped_rows}</TableCell>
                              <TableCell>{item.uploaded_by_email || "-"}</TableCell>
                              <TableCell>{formatDate(item.created_at)}</TableCell>
                              {isInternalUser && <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setSelectedImportId(item.id); setDispatchName(`Disparo ${item.source_name}`); setActiveTab("disparo"); }}>Preparar disparo</Button></TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        )}

        {activeTab === "disparo" && isInternalUser && (
          <Card className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Novo Disparo para Leads</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selecione uma base importada e envie os leads para o webhook do n8n configurado no backend.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Nome de Referencia</p><Input value={dispatchName} onChange={(event) => setDispatchName(event.target.value)} placeholder="Ex: Disparo leads novos" className="border-border/80 bg-secondary/70" /></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Canal Operacional</p><Select value={dispatchChannel} onValueChange={setDispatchChannel}><SelectTrigger className="border-border/80 bg-secondary/70"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Base Importada</p><Select value={selectedImportId} onValueChange={setSelectedImportId}><SelectTrigger className="border-border/80 bg-secondary/70"><SelectValue placeholder="Selecione uma base" /></SelectTrigger><SelectContent>{imports.map((item) => <SelectItem key={item.id} value={item.id}>{item.source_name} · {formatNumber(item.imported_rows)} leads</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Limite Opcional</p><Input value={dispatchLimit} onChange={(event) => setDispatchLimit(event.target.value)} inputMode="numeric" placeholder="Enviar toda a base" className="border-border/80 bg-secondary/70" /></div>
                <div className="space-y-2 md:col-span-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Observacoes Internas</p><Textarea value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} placeholder="Contexto interno. Este campo nao vai para o n8n nesta etapa." className="min-h-[110px] border-border/80 bg-secondary/70" /></div>
              </div>

              {selectedImport && (
                <div className="rounded-xl border border-border/70 bg-secondary/30 p-5 text-sm">
                  <p>Base: {selectedImport.source_name}</p>
                  <p>Leads prontos: {formatNumber(selectedImport.imported_rows)}</p>
                  <p>Subida em: {formatDate(selectedImport.created_at)}</p>
                </div>
              )}

              {dispatchSession && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Ultimo envio nesta sessao</p>
                  <p className="mt-2 text-lg font-bold text-foreground">{formatNumber(dispatchSession.total)} leads enviados ao n8n</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(dispatchSession.requestedAt)} · webhook {dispatchSession.webhookUrl}</p>
                  {dispatchSession.n8nResponse && <pre className="mt-4 overflow-x-auto rounded-lg border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">{dispatchSession.n8nResponse}</pre>}
                </div>
              )}

              <ErrorMessage message={createN8nDispatch.error ? (createN8nDispatch.error as Error).message : null} variant="banner" />
              <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">O disparo usa a base importada como origem. Metricas como entrega, abertura e cliques sairam da tela porque nao sao dados reais persistidos hoje.</div>
              <div className="flex flex-wrap gap-3 border-t border-border/70 pt-5">
                <Button variant="outline" onClick={() => setActiveTab("bases")}><Eye className="mr-2 h-4 w-4" />Ver bases</Button>
                <Button onClick={() => void handleDispatch()} disabled={!selectedImport || createN8nDispatch.isPending}><Send className="mr-2 h-4 w-4" />{createN8nDispatch.isPending ? "Enviando ao n8n..." : "Disparar Agora"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "bases" && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={basesSearch} onChange={(event) => setBasesSearch(event.target.value)} placeholder="Buscar base, usuario ou data..." className="border-border/80 bg-secondary/70 pl-9" /></div>
              <Button variant="outline" onClick={() => refetch()} disabled={importsLoading}><RefreshCw className={cn("mr-2 h-4 w-4", importsLoading && "animate-spin")} />Atualizar bases</Button>
            </div>

            <ErrorMessage message={importsError ? (importsError as Error).message : null} variant="banner" />
            {!importsLoading && filteredImports.length === 0 && <EmptyState title="Nenhuma base encontrada" description="Importe uma planilha ou ajuste a busca para visualizar as bases prontas." />}
            <div className="grid gap-4 xl:grid-cols-3">
              {filteredImports.map((item) => (
                <Card key={item.id} className={cn("rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]", dispatchSession?.importId === item.id && "border-primary/40")}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-extrabold tracking-tight text-foreground">{item.source_name}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{formatDate(item.created_at)}</p>
                      </div>
                      <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{item.source_type}</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div><p className="font-mono text-[11px] font-bold text-cyan-300">{formatNumber(item.imported_rows)}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Leads prontos</p></div>
                      <div><p className="font-mono text-[11px] font-bold text-amber-300">{formatNumber(item.skipped_rows)}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Ignorados</p></div>
                      <div><p className="font-mono text-[11px] font-bold text-primary">{item.uploaded_by_email || "-"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Usuario</p></div>
                    </div>
                    {dispatchSession?.importId === item.id && <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">Ultimo envio nesta sessao em {formatDate(dispatchSession.requestedAt)}.</div>}
                    {isInternalUser && <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4"><Button variant="outline" onClick={() => { setSelectedImportId(item.id); setDispatchName(`Disparo ${item.source_name}`); setActiveTab("disparo"); }}><Eye className="mr-2 h-4 w-4" />Abrir no disparo</Button><Button onClick={() => { setSelectedImportId(item.id); void handleDispatch(item); }} disabled={createN8nDispatch.isPending}><Send className="mr-2 h-4 w-4" />Disparar base</Button></div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "agendamentos" && (
          <Card className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <CardContent className="p-8">
              <EmptyState title="Agendamentos ainda nao conectados" description="O envio imediato para o n8n ja esta operacional. Quando persistirmos agendas reais no backend, esta aba passa a mostrar pendencias e recorrencias." />
            </CardContent>
          </Card>
        )}
      </section>
    </PageShell>
  );
}
