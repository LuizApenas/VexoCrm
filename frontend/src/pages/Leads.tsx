// VexoCrm/frontend/src/pages/Leads.tsx
import { useLeads } from "@/hooks/useLeads";
import { FileSpreadsheet, RefreshCw, Database } from "lucide-react";
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
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { EmptyState } from "@/components/EmptyState";

const COLUMNS = [
  { key: "telefone", label: "Telefone" },
  { key: "nome", label: "Nome" },
  { key: "tipo_cliente", label: "Tipo de Cliente" },
  { key: "faixa_consumo", label: "Faixa de Consumo" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "status", label: "Status" },
  { key: "bot_ativo", label: "Bot Ativo" },
  { key: "data_hora", label: "Data e Hora" },
  { key: "historico", label: "Histórico" },
] as const;

function formatCell(value: unknown, key: string): string {
  if (value === null || value === undefined) return "";
  if (key === "bot_ativo") return value ? "Sim" : "Não";
  if (key === "data_hora" && typeof value === "string") {
    try {
      const d = new Date(value);
      return d.toLocaleString("pt-BR");
    } catch {
      return String(value);
    }
  }
  if (key === "historico" && typeof value === "string") {
    return value.length > 80 ? value.slice(0, 80) + "…" : value;
  }
  return String(value);
}

export default function Leads() {
  const { data, isLoading, error, refetch } = useLeads("infinie");
  const rows = data ?? [];

  return (
    <PageShell title="Leads" spacing="space-y-6">
      <section>
        <SectionHeader
          title="Planilhas"
          subtitle="Dados no PostgreSQL. Atualize via n8n (HTTP Request → leads-webhook)."
          icon={Database}
        />

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Infinie
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ErrorMessage
              message={error ? (error as Error).message : null}
              variant="banner"
            />

            {isLoading && <EmptyState message="Carregando dados..." />}

            {!isLoading && !error && rows.length === 0 && (
              <EmptyState message="Nenhum lead encontrado. Use o webhook no n8n para inserir." />
            )}

            {!isLoading && !error && rows.length > 0 && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {COLUMNS.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        {COLUMNS.map((c) => (
                          <TableCell key={c.key} className="max-w-[200px] truncate">
                            {formatCell(row[c.key as keyof typeof row], c.key)}
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
