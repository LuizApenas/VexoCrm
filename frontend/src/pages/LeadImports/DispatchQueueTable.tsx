import { Bot, Download, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/leadImports/spreadsheet";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  type CampaignDispatch,
} from "@/hooks/useCampanhas";

interface DispatchQueueTableProps {
  dispatches: CampaignDispatch[];
  loadingDispatches: boolean;
  refetchDispatches: () => void;
  onTriggerDispatchBatch: (dispId: string) => void;
  onPauseDispatchBatch: (dispId: string) => void;
  onDownloadFailedCsv: (disp: CampaignDispatch) => void;
  onDeleteDispatchBatch: (dispId: string) => void;
  onPreviewDispatch: (dispId: string) => void;
  /** Abre o roteiro do agente DAQUELE disparo (copia isolada, editavel). */
  onEditDispatchPrompt: (dispId: string) => void;
}

export function DispatchQueueTable({
  dispatches,
  loadingDispatches,
  refetchDispatches,
  onTriggerDispatchBatch,
  onPauseDispatchBatch,
  onDownloadFailedCsv,
  onDeleteDispatchBatch,
  onPreviewDispatch,
  onEditDispatchPrompt,
}: DispatchQueueTableProps) {
  const runningDispatches = dispatches.filter((d) => d.status === "running");

  return (
    <Card className="border-border bg-card shadow-lg text-card-foreground rounded-2xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold">Fila de Disparos em Massa</CardTitle>
          <CardDescription>Acompanhe e gerencie lotes de disparos criados por planilha diretamente</CardDescription>
          {/* O disparo guarda os passos do momento em que foi criado
              (dispatch.steps tem precedência sobre a sequência da campanha).
              Sem este aviso, o usuário edita a campanha, vê a tela certa e o
              disparo antigo continua enviando o texto velho.
              BOTÕES sao caso especial e por isso estao citados no texto:
              normalizeSequenceStep DESCARTAVA `buttons` ate 0fee253, entao
              disparo criado antes daquele commit tem steps congelados SEM botao
              nenhum — nao ha o que consertar naquele disparo, so criar outro. */}
          <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Cada disparo guarda os passos de quando foi criado — texto, imagem, gatilho
            e <strong>botões</strong>. Editar a campanha não altera disparo já enfileirado.
            Botão adicionado depois só sai em um disparo novo: exclua e crie de novo, ou
            crie outro lote.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            refetchDispatches();
            toast({ title: "Fila atualizada" });
          }}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </CardHeader>

      {/* ⚠️ AVISO DE DISPARO EM ANDAMENTO */}
      {runningDispatches.length > 0 && (
        <div className="mx-6 mb-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              <strong>Disparo em andamento:</strong>{" "}
              {runningDispatches
                .map((d) => `${d.name} (${d.sent_count ?? 0} de ${d.target_count ?? "—"} enviados)`)
                .join(", ")}.
              <span className="ml-1 font-normal text-amber-700 dark:text-amber-400">
                Evite reiniciar o servidor agora para não interromper a fila.
              </span>
            </p>
          </div>
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold shrink-0">
            Disparando
          </Badge>
        </div>
      )}

      <CardContent className="p-0">
        {loadingDispatches ? (
          <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">Carregando lotes de disparo...</div>
        ) : dispatches.length === 0 ? (
          <div className="p-8">
            <EmptyState title="Nenhum lote de disparo" description="Crie um disparo para enfileirar as execuções de envio em massa." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200/60 dark:border-white/5">
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase font-display">Lote / Origem</TableHead>
                  <TableHead className="px-4 py-4 text-xs font-semibold uppercase font-display text-center">Status</TableHead>
                  <TableHead className="px-4 py-4 text-xs font-semibold uppercase font-display text-center">Progresso</TableHead>
                  <TableHead className="px-4 py-4 text-xs font-semibold uppercase font-display">Criado / Agendado</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-semibold uppercase font-display text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((disp) => {
                  const total = (disp.sent_count ?? 0) + (disp.failed_count ?? 0);
                  return (
                    <TableRow key={disp.id} className="border-border hover:bg-muted/10">
                      <TableCell className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground">{disp.name}</p>
                        <p className="text-xs text-muted-foreground">Campanha: {(disp as any).campaign_name || "Planilha"}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <Badge className={cn("border text-[10px] font-semibold rounded-xl px-2 py-0.5", CAMPAIGN_STATUS_COLORS[disp.status] || "")}>
                          {CAMPAIGN_STATUS_LABELS[disp.status] || disp.status}
                        </Badge>
                        {(disp.status === "failed" || disp.status === "interrupted") && disp.error_message && (
                          <p
                            className={cn(
                              "mt-1 text-[10px] font-medium max-w-[240px] mx-auto leading-tight",
                              disp.status === "interrupted" ? "text-amber-600 dark:text-amber-400" : "text-rose-500"
                            )}
                            title={disp.error_message}
                          >
                            {disp.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex flex-col items-center justify-center gap-1 w-28 mx-auto">
                          <div className="flex items-center justify-between text-[10px] font-bold w-full">
                            <span className="text-emerald-500">{disp.sent_count} ✓</span>
                            <span className="text-rose-500">{disp.failed_count} ✗</span>
                            {disp.target_count != null && (
                              <span
                                className="text-blue-500 ml-1 cursor-pointer hover:underline"
                                title="Ver leads alvo desta campanha"
                                onClick={() => onPreviewDispatch(disp.id)}
                              >
                                / {disp.target_count} 🎯
                              </span>
                            )}
                          </div>
                          {total > 0 && (
                            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((disp.sent_count / total) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-xs text-muted-foreground">
                        {formatDateTime(disp.triggered_at || disp.created_at)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(disp.status === "draft" || disp.status === "paused" || disp.status === "failed" || disp.status === "interrupted") && (
                            <Button
                              size="sm"
                              variant="default"
                              title={
                                disp.status === "paused" || disp.status === "failed" || disp.status === "interrupted"
                                  ? "Continua de onde parou: quem já recebeu não recebe de novo"
                                  : "Iniciar o envio deste lote"
                              }
                              onClick={() => onTriggerDispatchBatch(disp.id)}
                              className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs px-2.5 font-bold shadow-sm"
                            >
                              <Play className="h-3.5 w-3.5 mr-1" />{" "}
                              {disp.status === "paused" || disp.status === "interrupted" ? "Retomar" : disp.status === "failed" ? "Disparar" : "Iniciar"}
                            </Button>
                          )}
                          {disp.status === "running" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onPauseDispatchBatch(disp.id)}
                              className="h-8 border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 rounded-xl text-xs px-2.5 font-bold"
                            >
                              <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                            </Button>
                          )}
                          {disp.failed_count > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Baixar Relatório de Falhas"
                              onClick={() => onDownloadFailedCsv(disp)}
                              className="h-8 w-8 p-0 rounded-xl"
                            >
                              <Download className="h-3.5 w-3.5 text-slate-700 dark:text-white/80" />
                            </Button>
                          )}
                          {/* Roteiro do agente DESTE disparo: corrigir em andamento sem
                              cancelar a campanha nem afetar outros disparos. */}
                          <Button
                            size="sm"
                            variant="outline"
                            title="Roteiro do agente deste disparo"
                            onClick={() => onEditDispatchPrompt(disp.id)}
                            className="h-8 w-8 p-0 rounded-xl"
                          >
                            <Bot className="h-3.5 w-3.5 text-indigo-500" />
                          </Button>
                          {(disp.status === "draft" || disp.status === "failed" || disp.status === "done" || disp.status === "paused" || disp.status === "interrupted") && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Excluir Lote"
                              onClick={() => onDeleteDispatchBatch(disp.id)}
                              className="h-8 w-8 p-0 text-rose-500 border-rose-200/40 hover:bg-rose-50 rounded-xl"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
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
  );
}
