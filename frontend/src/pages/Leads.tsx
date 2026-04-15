import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Database, FileSpreadsheet, Filter, RefreshCw } from "lucide-react";
import { useLeads, type LeadRow } from "@/hooks/useLeads";
import { useCampaignLeads, useCampanhas } from "@/hooks/useCampanhas";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { EmptyState } from "@/components/EmptyState";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";

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
const COLUMN_OPTIONS = COLUMNS.map((column) => ({ value: column.key, label: column.label }));

interface LeadsProps {
  fixedClientId?: string;
  fixedClientName?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

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

export default function Leads({
  fixedClientId,
  fixedClientName,
  title = "Leads",
  subtitle = "Tabela alinhada com o schema atual da base leads",
  headerRight,
}: LeadsProps) {
  const crmClient = useOptionalCrmClient();
  const effectiveClientId = fixedClientId || crmClient?.selectedClientId || "";
  const { data, isLoading, error, refetch } = useLeads(effectiveClientId);
  const rows = useMemo(() => data ?? [], [data]);
  const selectedClient = crmClient?.selectedClient || null;
  const selectedClientName = fixedClientName || selectedClient?.name || effectiveClientId;
  const [selectedColumn, setSelectedColumn] = useState<(typeof COLUMNS)[number]["key"]>("nome");
  const [filterTerm, setFilterTerm] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const { data: campaigns = [], error: campaignsError } = useCampanhas(effectiveClientId || undefined);
  const {
    data: campaignLeads = [],
    isLoading: campaignLeadsLoading,
    error: campaignLeadsError,
  } = useCampaignLeads(
    selectedCampaignId || undefined,
  );

  useEffect(() => {
    setSelectedCampaignId("");
  }, [effectiveClientId]);

  const campaignLeadIds = useMemo(
    () => new Set(campaignLeads.map((lead) => lead.id)),
    [campaignLeads],
  );
  const filteredRows = useMemo(() => {
    const normalizedTerm = filterTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesColumn =
        !normalizedTerm ||
        formatCell(row[selectedColumn as keyof LeadRow], selectedColumn)
          .toLowerCase()
          .includes(normalizedTerm);

      const matchesCampaign =
        !selectedCampaignId || campaignLeadIds.size === 0
          ? !selectedCampaignId || campaignLeadsLoading || campaignLeads.length > 0
          : campaignLeadIds.has(row.id);

      return matchesColumn && matchesCampaign;
    });
  }, [campaignLeadIds, campaignLeads.length, campaignLeadsLoading, filterTerm, rows, selectedCampaignId, selectedColumn]);

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      headerRight={headerRight}
      spacing="space-y-6"
      showGlobalClientSelector={!fixedClientId}
    >
      {selectedClientName && (
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Cliente ativo: <span className="text-foreground">{selectedClientName}</span>
        </p>
      )}

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
                {selectedClientName || "Cliente nao selecionado"}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ErrorMessage message={error ? (error as Error).message : null} variant="banner" />
            <ErrorMessage
              message={campaignsError ? "Nao foi possivel carregar as campanhas salvas. Os leads continuam disponiveis normalmente." : null}
              variant="banner"
            />
            <ErrorMessage
              message={campaignLeadsError ? "Nao foi possivel carregar os leads da campanha selecionada. Tente novamente ou limpe o filtro de campanha." : null}
              variant="banner"
            />

            {isLoading && <EmptyState message="Carregando dados..." />}

            {!effectiveClientId && !(crmClient?.isLoading) && (
              <EmptyState
                title="Nenhum cliente cadastrado"
                description="Cadastre um registro em leads_clients para liberar a grade de leads."
              />
            )}

            {effectiveClientId && !isLoading && !error && rows.length === 0 && (
              <EmptyState message="Nenhum lead encontrado. Use o webhook no n8n para inserir." />
            )}

            {effectiveClientId && !isLoading && !error && rows.length > 0 && (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Filter className="h-3.5 w-3.5" />
                      Filtrar por coluna
                    </p>
                    <Select value={selectedColumn} onValueChange={(value) => setSelectedColumn(value as (typeof COLUMNS)[number]["key"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_OPTIONS.map((column) => (
                          <SelectItem key={column.value} value={column.value}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Valor do filtro
                    </p>
                    <Input
                      value={filterTerm}
                      onChange={(e) => setFilterTerm(e.target.value)}
                      placeholder={`Buscar em ${COLUMN_OPTIONS.find((column) => column.value === selectedColumn)?.label || "leads"}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Campanha salva
                    </p>
                    <Select value={selectedCampaignId || "__all__"} onValueChange={(value) => setSelectedCampaignId(value === "__all__" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as campanhas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas as campanhas</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {campaigns.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {campaigns.map((campaign) => (
                      <Button
                        key={campaign.id}
                        type="button"
                        size="sm"
                        variant={selectedCampaignId === campaign.id ? "secondary" : "outline"}
                        onClick={() => setSelectedCampaignId((current) => (current === campaign.id ? "" : campaign.id))}
                      >
                        {campaign.name}
                      </Button>
                    ))}
                  </div>
                )}

                {selectedCampaignId && !campaignLeadsLoading && campaignLeads.length === 0 ? (
                  <EmptyState
                    message="Nenhum lead vinculado a essa campanha no momento. Se ela ainda nao disparou, os leads aparecerao depois do primeiro envio."
                  />
                ) : null}

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
                    {filteredRows.map((row) => (
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
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
