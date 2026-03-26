import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import * as XLSX from "xlsx";
import {
  Building2,
  CalendarDays,
  Clock3,
  Eye,
  FileSpreadsheet,
  History,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Upload,
} from "lucide-react";
import { useLeadClients } from "@/hooks/useLeadClients";
import { useCreateLeadImport, useLeadImports, type LeadImportPreviewItem } from "@/hooks/useLeadImports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { cn } from "@/lib/utils";

type SheetTab = "dados" | "campanha" | "enviadas" | "agendamentos";

interface LeadImportsProps {
  fixedClientId?: string;
  fixedClientName?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

const TABS: Array<{ id: SheetTab; label: string }> = [
  { id: "dados", label: "Dados Gerais" },
  { id: "campanha", label: "Nova Campanha" },
  { id: "enviadas", label: "Campanhas Enviadas" },
  { id: "agendamentos", label: "Agendamentos" },
];

const CAMPAIGNS = [
  ["Black Friday Preview", "10/03/2026 · 09:15 · 1.240 contatos", "CLIENTES VIP", "E-MAIL", "87%", "42%", "18%"],
  ["Newsletter Fev/2026", "01/02/2026 · 08:00 · 2.418 contatos", "TODOS", "E-MAIL", "94%", "38%", "14%"],
  ["Reativacao Inativos", "15/01/2026 · 10:30 · 340 contatos", "INATIVOS", "WHATSAPP", "99%", "61%", "22%"],
  ["Boas-vindas Leads", "05/01/2026 · 14:00 · 180 contatos", "LEADS NOVOS", "E-MAIL", "96%", "55%", "31%"],
  ["Promo Natal 2025", "20/12/2025 · 09:00 · 2.300 contatos", "TODOS", "SMS", "98%", "72%", "12%"],
] as const;

const SCHEDULED = [
  ["20", "MAR", "Black Friday 2026 - Aviso Previo", "E-mail Marketing", "1.240 contatos", "09:00 BRT", "AGENDADA"],
  ["25", "MAR", "Newsletter Marco 2026", "E-mail Marketing", "2.418 contatos", "08:00 BRT", "CONFIRMADA"],
  ["01", "ABR", "Reativacao Q2 - Leads Frios", "WhatsApp", "420 contatos", "10:30 BRT", "RECORRENTE"],
] as const;

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

function Metric({
  value,
  label,
  bar,
  text,
}: {
  value: string;
  label: string;
  bar: string;
  text: string;
}) {
  return (
    <div>
      <p className={cn("font-mono text-[12px] font-bold", text)}>{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 h-1 rounded-full bg-secondary/90">
        <div className={cn("h-1 rounded-full", bar)} style={{ width: value }} />
      </div>
    </div>
  );
}

export default function LeadImports({
  fixedClientId,
  fixedClientName,
  title = "Planilhas",
  subtitle = "Gerencie dados e mantenha a estrutura visual de campanhas dentro do CRM.",
  headerRight,
}: LeadImportsProps) {
  const { data: clients = [], isLoading: clientsLoading } = useLeadClients();
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [importPreview, setImportPreview] = useState<LeadImportPreviewItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SheetTab>("dados");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  const { data: imports = [], isLoading: importsLoading, error: importsError, refetch } = useLeadImports(selectedClientId);
  const createLeadImport = useCreateLeadImport();

  useEffect(() => {
    if (fixedClientId) {
      setSelectedClientId(fixedClientId);
      return;
    }

    if (clients.length > 0 && !selectedClientId) setSelectedClientId(clients[0].id);
  }, [clients, fixedClientId, selectedClientId]);

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const resolvedClientName = fixedClientName || selectedClient?.name || selectedClientId;

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
    if (!selectedClientId) return setParseError("Selecione um cliente antes de importar.");
    if (!selectedFile || parsedRows.length === 0) {
      return setParseError("Selecione uma planilha valida para importar.");
    }
    setParseError(null);
    try {
      const response = await createLeadImport.mutateAsync({
        clientId: selectedClientId,
        sourceName: selectedFile.name,
        sourceType: selectedFile.name.split(".").pop()?.toLowerCase() || "spreadsheet",
        rows: parsedRows,
      });
      setImportPreview(response.preview);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Falha ao importar planilha.");
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
    <PageShell
      title={title}
      subtitle={subtitle}
      headerRight={headerRight ?? clientSelector}
      spacing="space-y-6"
    >
      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70">
          {TABS.map((tab) => (
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
                              {Object.keys(previewRows[0]).map((column) => (
                                <TableCell key={column} className="max-w-[220px] truncate">{String(row[column] ?? "")}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {importPreview.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Resumo do processamento</p>
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <SectionHeader title="Historico" subtitle="Ultimas cargas registradas para consulta operacional e uso em nos de disparo." icon={History} />
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
                  {importsLoading && <EmptyState message="Carregando historico..." />}
                  {!importsLoading && !importsError && imports.length === 0 && (
                    <EmptyState title="Nenhuma importacao encontrada" description="Assim que uma planilha for processada, o historico fica disponivel aqui." />
                  )}
                  {!importsLoading && !importsError && imports.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Arquivo</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Importadas</TableHead>
                            <TableHead>Ignoradas</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Data</TableHead>
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

        {activeTab === "campanha" && (
          <Card className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Criar Nova Campanha</h2>
                <p className="mt-1 text-sm text-muted-foreground">Configure os parametros de envio e segmentacao da campanha.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Nome da Campanha *</p><Input placeholder="Ex: Newsletter Marco 2026" className="border-border/80 bg-secondary/70" /></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Canal de Envio *</p><Select><SelectTrigger className="border-border/80 bg-secondary/70"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="email">E-mail Marketing</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Segmento / Lista *</p><Select><SelectTrigger className="border-border/80 bg-secondary/70"><SelectValue placeholder="Todos os contatos (2.418)" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os contatos (2.418)</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Categoria</p><Select><SelectTrigger className="border-border/80 bg-secondary/70"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="promo">Promocional</SelectItem><SelectItem value="news">Newsletter</SelectItem></SelectContent></Select></div>
                <div className="space-y-2 md:col-span-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Assunto / Titulo *</p><Input placeholder="Ex: Oferta especial para {{nome}} da {{empresa}}" className="border-border/80 bg-secondary/70" /><p className="font-mono text-[10px] text-muted-foreground">Use &#123;&#123;nome&#125;&#125;, &#123;&#123;empresa&#125;&#125;, &#123;&#123;link&#125;&#125; para personalizacao dinamica</p></div>
                <div className="space-y-2 md:col-span-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Conteudo da Mensagem *</p><Textarea placeholder="Digite o conteudo da campanha aqui..." className="min-h-[130px] border-border/80 bg-secondary/70" /></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Remetente</p><Input placeholder="Equipe Vexo CRM" className="border-border/80 bg-secondary/70" /></div>
                <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">E-mail de Resposta</p><Input placeholder="contato@empresa.com.br" className="border-border/80 bg-secondary/70" /></div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary"><CalendarDays className="h-4 w-4" />Agendamento de Envio</div>
                <div className="mb-4 flex items-center gap-3"><Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} /><span className="text-sm text-muted-foreground">Agendar para data e horario especifico</span></div>
                {scheduleEnabled && <div className="grid gap-4 md:grid-cols-3"><Input type="date" defaultValue="2026-03-20" className="border-border/80 bg-secondary/70" /><Input type="time" defaultValue="09:00" className="border-border/80 bg-secondary/70" /><Input placeholder="BRT (Sao Paulo)" className="border-border/80 bg-secondary/70" /></div>}
              </div>
              <div className="flex flex-wrap gap-3 border-t border-border/70 pt-5">
                <Button variant="outline">Salvar Rascunho</Button>
                <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10"><Eye className="mr-2 h-4 w-4" />Pre-visualizar</Button>
                <Button><Send className="mr-2 h-4 w-4" />Enviar Agora</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "enviadas" && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar campanha..." className="border-border/80 bg-secondary/70 pl-9" /></div>
              <Button variant="outline">Todos os canais</Button>
              <Button variant="outline">Todos os periodos</Button>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {CAMPAIGNS.map(([name, info, segment, channel, delivery, open, clicks]) => (
                <Card key={name} className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                  <CardContent className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-xl font-extrabold tracking-tight text-foreground">{name}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{info}</p></div>
                      <span className={cn("rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em]", channel === "WHATSAPP" ? "border-[#1A5CFF]/20 bg-[#1A5CFF]/10 text-[#3A75FF]" : channel === "SMS" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : "border-primary/20 bg-primary/10 text-primary")}>{channel}</span>
                    </div>
                    <div className="border-t border-border/70 pt-4"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Segmento: {segment}</p></div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Metric value={delivery} label="Entrega" bar="bg-cyan-400" text="text-cyan-300" />
                      <Metric value={open} label="Abertura" bar="bg-[#1A5CFF]" text="text-[#3A75FF]" />
                      <Metric value={clicks} label={channel === "WHATSAPP" ? "Resposta" : "Cliques"} bar="bg-pink-500" text="text-pink-300" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "agendamentos" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h2 className="text-2xl font-extrabold tracking-tight text-foreground">Campanhas Agendadas</h2><p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">3 aguardando envio</p></div>
              <Button>+ Agendar Nova</Button>
            </div>
            <div className="space-y-4">
              {SCHEDULED.map(([day, month, name, channel, contacts, time, status]) => (
                <Card key={name} className="rounded-2xl border-border/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                  <CardContent className="flex flex-wrap items-center gap-5 p-5">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-primary/20 bg-primary/5"><span className="font-mono text-3xl font-bold text-primary">{day}</span><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{month}</span></div>
                    <div className="min-w-[220px] flex-1">
                      <p className="text-xl font-extrabold tracking-tight text-foreground">{name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">{channel === "WhatsApp" ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}{channel}</span>
                        <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{contacts}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{time}</span>
                      </div>
                    </div>
                    <span className={cn("rounded-md border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]", status === "AGENDADA" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : status === "RECORRENTE" ? "border-pink-500/20 bg-pink-500/10 text-pink-300" : "border-primary/20 bg-primary/10 text-primary")}>{status}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary/70 text-muted-foreground transition-colors hover:text-foreground"><Eye className="h-4 w-4" /></button>
                      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary/70 text-pink-400 transition-colors hover:text-pink-300">×</button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
