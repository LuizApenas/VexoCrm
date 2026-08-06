import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLeadImportItems, type LeadImportItem } from "@/hooks/useLeadImports";

const PAGE_SIZE = 50;

// Chaves de normalized_data que ja tem coluna propria ou sao ruido de controle.
const RESERVED_KEYS = new Set(["nome", "telefone", "client_id", "clientId"]);

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface ImportViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  importRecord: LeadImportItem | null;
}

export function ImportViewerDialog({ open, onOpenChange, clientId, importRecord }: ImportViewerDialogProps) {
  const [tab, setTab] = useState<"imported" | "skipped">("imported");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const importId = importRecord?.id;

  const { data, isLoading, isError, error, refetch } = useLeadImportItems(clientId, importId, undefined, {
    status: tab,
    search: search.trim() || undefined,
    page,
    limit: PAGE_SIZE,
    enabled: open && !!importId,
  });

  const items = data?.items ?? [];
  const matched = data?.matched ?? items.length;
  const totalPages = Math.max(1, Math.ceil(matched / PAGE_SIZE));

  // Colunas extras da planilha: uniao das chaves de normalized_data (e de raw_data nos
  // ignorados, que e onde sobra o dado cru quando a normalizacao nao aproveitou a linha).
  const extraColumns = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      const source = { ...(item.raw_data ?? {}), ...(item.normalized_data ?? {}) };
      for (const key of Object.keys(source)) {
        if (!RESERVED_KEYS.has(key)) keys.add(key);
      }
    }
    return Array.from(keys).slice(0, 8);
  }, [items]);

  function switchTab(next: "imported" | "skipped") {
    setTab(next);
    setPage(1);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-base">{importRecord?.source_name || "Planilha"}</DialogTitle>
          <DialogDescription>
            {importRecord
              ? `${importRecord.imported_rows} leads importados · ${importRecord.skipped_rows} ignorados · ${importRecord.total_rows} linhas no arquivo`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={tab === "imported" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => switchTab("imported")}
            >
              Importados
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "skipped" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => switchTab("skipped")}
            >
              Ignorados
            </Button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {isError ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
            <span>{(error as Error)?.message || "Não foi possível carregar os leads desta planilha."}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  {tab === "skipped" && <TableHead>Motivo</TableHead>}
                  {extraColumns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3 + extraColumns.length + (tab === "skipped" ? 1 : 0)} className="text-center text-xs text-slate-400 py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3 + extraColumns.length + (tab === "skipped" ? 1 : 0)} className="text-center text-xs text-slate-400 py-8">
                      {search
                        ? "Nenhuma linha bate com a busca."
                        : tab === "skipped"
                          ? "Nenhuma linha ignorada nesta planilha."
                          : "Nenhum lead importado nesta planilha."}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const source = { ...(item.raw_data ?? {}), ...(item.normalized_data ?? {}) };
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-slate-400">{item.row_number}</TableCell>
                        <TableCell className="text-xs font-semibold">{cellText(item.normalized_data?.nome)}</TableCell>
                        <TableCell className="text-xs font-mono">{cellText(item.telefone)}</TableCell>
                        {tab === "skipped" && (
                          <TableCell className="text-xs text-amber-700 dark:text-amber-400">
                            {cellText(item.skip_reason)}
                          </TableCell>
                        )}
                        {extraColumns.map((col) => (
                          <TableCell key={col} className="text-xs text-slate-500 max-w-[180px] truncate">
                            {cellText(source[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!isError && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {matched} {matched === 1 ? "linha" : "linhas"}
              {search ? " encontradas" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
