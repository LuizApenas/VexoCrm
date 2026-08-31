import { AlertTriangle, Ban, PlusCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DuplicateDispatchWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  pendingDispatchesCount: number;
  pendingRecipientsCount: number;
  onCancelPreviousAndCreate: () => void;
  onCreateAnyway: () => void;
  isProcessing?: boolean;
}

export function DuplicateDispatchWarningDialog({
  open,
  onOpenChange,
  campaignName,
  pendingDispatchesCount,
  pendingRecipientsCount,
  onCancelPreviousAndCreate,
  onCreateAnyway,
  isProcessing = false,
}: DuplicateDispatchWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[540px] rounded-2xl bg-card border-border shadow-2xl p-6 animate-fadeIn">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Disparos em Aberto Detectados
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Campanha: <span className="font-semibold text-foreground">{campaignName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-4 text-xs space-y-2 text-amber-900 dark:text-amber-200">
            <p className="font-semibold">
              Esta campanha já tem{" "}
              <span className="font-black underline">
                {pendingDispatchesCount} {pendingDispatchesCount === 1 ? "lote pendente" : "lotes pendentes"}
              </span>{" "}
              com{" "}
              <span className="font-black underline">
                {pendingRecipientsCount} {pendingRecipientsCount === 1 ? "destinatário" : "destinatários"}
              </span>
              .
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Criar um novo disparo pode enviar a mesma mensagem duas vezes para as mesmas pessoas se as filas anteriores não forem canceladas.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Escolha como deseja prosseguir com a criação deste novo envio:
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-col gap-2.5 pt-2">
          <Button
            type="button"
            variant="destructive"
            disabled={isProcessing}
            onClick={onCancelPreviousAndCreate}
            className="w-full h-10 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center justify-center gap-2"
          >
            <Ban className="h-4 w-4" />
            {isProcessing
              ? "Cancelando lotes anteriores e criando..."
              : "Cancelar os lotes anteriores e criar este"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isProcessing}
            onClick={onCreateAnyway}
            className="w-full h-10 rounded-xl text-xs font-semibold border-border hover:bg-muted/30 flex items-center justify-center gap-2"
          >
            <PlusCircle className="h-4 w-4 text-indigo-500" />
            Criar mesmo assim (duas ondas simultâneas)
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isProcessing}
            onClick={() => onOpenChange(false)}
            className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            Voltar e revisar campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
