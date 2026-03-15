import { useEffect, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { Building2, FileSpreadsheet, History, RefreshCw, Upload } from "lucide-react";
import { useLeadClients } from "@/hooks/useLeadClients";
import {
  useCreateLeadImport,
  useLeadImports,
  type LeadImportPreviewItem,
} from "@/hooks/useLeadImports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";

function parseSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (!result) {
          reject(new Error("Nao foi possivel ler o arquivo."));
          return;
        }

        const workbook = XLSX.read(result, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error("A planilha nao possui abas com dados."));
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: false,
        });

        resolve(rows);
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

export default function LeadImports() {
  const { data: clients = [], isLoading: clientsLoading } = useLeadClients();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [importPreview, setImportPreview] = useState<LeadImportPreviewItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const { data: imports = [], isLoading: importsLoading, error: importsError, refetch } = useLeadImports(selectedClientId);
  const createLeadImport = useCreateLeadImport();

  useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const selectedClient = clients.find((client) => client.id === selectedClientId);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setImportPreview([]);
    setParseError(null);
    setParsedRows([]);
    setPreviewRows([]);

    if (!file) {
      return;
    }

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
      setImportPreview(response.preview);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Falha ao importar planilha.");
    }
  }

  const clientSelector = (
    <div className="flex min-w-[220px] items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={clientsLoading}>
        <SelectTrigger>
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
      title="Planilhas"
      subtitle="Receba planilhas dos clientes, extraia os numeros e grave a carga no banco para disparos."
      headerRight={clientSelector}
      spacing="space-y-6"
    >
      <section>
        <SectionHeader
          title="Nova importacao"
          subtitle="Aceita CSV, XLS e XLSX. O backend normaliza os campos e popula a tabela leads."
          icon={Upload}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4" />
              {selectedClient?.name || "Selecione um cliente"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ErrorMessage message={parseError} variant="banner" />

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <Input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileChange} />
              <Button onClick={handleImport} disabled={!selectedFile || createLeadImport.isPending}>
                <Upload className="mr-2 h-4 w-4" />
                {createLeadImport.isPending ? "Importando..." : "Importar planilha"}
              </Button>
            </div>

            {selectedFile && (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <p>Arquivo: {selectedFile.name}</p>
                <p>Linhas lidas: {parsedRows.length}</p>
              </div>
            )}

            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(previewRows[0]).map((column) => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, index) => (
                      <TableRow key={`${index}-${Object.values(row).join("-")}`}>
                        {Object.keys(previewRows[0]).map((column) => (
                          <TableCell key={column} className="max-w-[220px] truncate">
                            {String(row[column] ?? "")}
                          </TableCell>
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
                <div className="overflow-x-auto rounded-md border">
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
        <SectionHeader
          title="Historico"
          subtitle="Ultimas cargas registradas para consulta operacional e uso em nos de disparo."
          icon={History}
        />

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Importacoes recentes</CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={importsLoading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${importsLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ErrorMessage
              message={importsError ? (importsError as Error).message : null}
              variant="banner"
            />

            {importsLoading && <EmptyState message="Carregando historico..." />}

            {!importsLoading && !importsError && imports.length === 0 && (
              <EmptyState
                title="Nenhuma importacao encontrada"
                description="Assim que uma planilha for processada, o historico fica disponivel aqui."
              />
            )}

            {!importsLoading && !importsError && imports.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
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
    </PageShell>
  );
}
