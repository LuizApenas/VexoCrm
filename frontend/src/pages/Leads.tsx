import { useEffect, useState } from "react";
import { Building2, Database, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useLeads, type LeadRow } from "@/hooks/useLeads";
import { useLeadClients } from "@/hooks/useLeadClients";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { EmptyState } from "@/components/EmptyState";

const COLUMNS = [
  { key: "telefone", label: "Telefone" },
  { key: "nome", label: "Nome" },
  { key: "tipo_cliente", label: "Perfil" },
  { key: "faixa_consumo", label: "Consumo" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "status", label: "Status" },
  { key: "data_hora", label: "Data e Hora" },
  { key: "qualificacao", label: "Qualificacao" },
  { key: "created_at", label: "Criado em" },
] as const;

function formatCell(value: unknown, key: string): string {
  if (value === null || value === undefined) return "";

  if ((key === "data_hora" || key === "created_at") && typeof value === "string") {
    try {
      return new Date(value).toLocaleString("pt-BR");
    } catch {
      return String(value);
    }
  }

  if (key === "qualificacao" && typeof value === "string") {
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact;
  }

  return String(value);
}

export default function Leads() {
  const { data: clients = [], isLoading: clientsLoading } = useLeadClients();
  const [selectedClientId, setSelectedClientId] = useState("infinie");
  const { data, isLoading, error, refetch } = useLeads(selectedClientId);
  const rows = data ?? [];
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  useEffect(() => {
    if (!clients.length) return;
    const selectedStillExists = clients.some((client) => client.id === selectedClientId);
    if (!selectedStillExists) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const headerRight = (
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
      title="Leads"
      subtitle="Tabela alinhada com o schema atual da base leads"
      headerRight={headerRight}
      spacing="space-y-6"
    >
      <section>
        <SectionHeader
          title="Base de Leads"
          subtitle="Dados no PostgreSQL. Atualize via n8n (HTTP Request -> leads-webhook)."
          icon={Database}
        />

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4" />
                {selectedClient?.name ?? selectedClientId}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ErrorMessage message={error ? (error as Error).message : null} variant="banner" />

            {isLoading && <EmptyState message="Carregando dados..." />}

            {!isLoading && !error && rows.length === 0 && (
              <EmptyState message="Nenhum lead encontrado. Use o webhook no n8n para inserir." />
            )}

            {!isLoading && !error && rows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {COLUMNS.map((column) => (
                        <TableHead key={column.key}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        {COLUMNS.map((column) => (
                          <TableCell key={column.key} className="max-w-[240px] truncate">
                            {formatCell(row[column.key as keyof LeadRow], column.key)}
                          </TableCell>
                        ))}
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
