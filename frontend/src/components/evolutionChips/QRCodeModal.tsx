import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useLeadClientEvolutionInstanceStatus } from "@/hooks/useLeadClients";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QRCodeModalProps {
  open: boolean;
  tenantId: string;
  qrModal: {
    base64: string;
    tenantName: string;
    instanceName: string | null;
    instanceId?: string | null;
  } | null;
  onClose: () => void;
}

export function QRCodeModal({ open, tenantId, qrModal, onClose }: QRCodeModalProps) {
  const instanceId = qrModal?.instanceId ?? "";
  const shouldPoll = open && !!tenantId && !!instanceId;

  // Enquanto o QR está na tela, consulta o status da instância. O hook só busca
  // quando há instanceId; aqui forçamos o refetch a cada 3s para detectar a
  // conexão logo depois que o usuário escaneia.
  const status = useLeadClientEvolutionInstanceStatus(tenantId, shouldPoll ? instanceId : "");

  useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(() => {
      status.refetch();
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll, instanceId]);

  // Conectou -> fecha o modal sozinho (não precisa clicar em Fechar).
  useEffect(() => {
    if (open && status.data?.connected) {
      toast({ title: "WhatsApp conectado", description: "Chip pareado com sucesso." });
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status.data?.connected]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">Parear WhatsApp</DialogTitle>
          <DialogDescription className="text-xs">
            Siga as instruções abaixo para vincular o chip <strong>{qrModal?.instanceName ?? "da empresa"}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrModal?.base64 && (
            <div className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm dark:border-white/10">
              <img
                src={qrModal.base64}
                alt="QR Code para parear o WhatsApp"
                className="h-60 w-60 rounded-xl"
              />
            </div>
          )}
          <div className="text-center text-sm space-y-2">
            <p className="font-medium text-foreground text-xs">
              No celular, abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho
            </p>
            <p className="text-[11px] text-muted-foreground px-4">
              A tela fecha sozinha assim que a conexão for detectada. O QR Code expira rapidamente; se expirar, feche, remova a conexão criada e gere um novo.
            </p>
          </div>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button type="button" variant="outline" className="rounded-xl w-full sm:w-28" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
