import { useState } from "react";
import {
  Copy,
  ExternalLink,
  Megaphone,
  Pause,
  Play,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadClients } from "@/hooks/useLeadClients";
import { useLeadImports } from "@/hooks/useLeadImports";
import {
  useCampanhas,
  useCreateCampaign,
  useDeleteCampaign,
  useTriggerCampaign,
  useUpdateCampaign,
  type Campaign,
} from "@/hooks/useCampanhas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:text-primary"
      title="Copiar"
    >
      <Copy className={cn("h-3.5 w-3.5", copied && "text-primary")} />
    </button>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateCampaignDialog({ open, onClose }: CreateDialogProps) {
  const { accessProfile } = useAuth();
  const { data: clients = [] } = useLeadClients();
  const [selectedClientId, setSelectedClientId] = useState("");
  const { data: imports = [] } = useLeadImports(selectedClientId || undefined);

  const [form, setForm] = useState({
    name: "",
    clientId: "",
    importId: "",
    limitPerRun: "50",
    webhookUrl: "",
    webhookToken: "",
  });

  const createCampaign = useCreateCampaign();

  const visibleClients = accessProfile?.isAdmin
    ? clients
    : clients.filter((c) =>
        accessProfile?.clientIds?.includes(c.id) || accessProfile?.clientId === c.id
      );

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Nome da campanha é obrigatório.");
    if (!form.clientId) return toast.error("Selecione um cliente.");
    if (!form.webhookUrl.trim()) return toast.error("URL do webhook é obrigatória.");

    try {
      await createCampaign.mutateAsync({
        name: form.name.trim(),
        clientId: form.clientId,
        importId: form.importId || null,
        limitPerRun: Number(form.limitPerRun) || 50,
        webhookUrl: form.webhookUrl.trim(),
        webhookToken: form.webhookToken.trim() || null,
      });
      toast.success("Campanha criada!");
      onClose();
      setForm({ name: "", clientId: "", importId: "", limitPerRun: "50", webhookUrl: "", webhookToken: "" });
      setSelectedClientId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar campanha.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-white/10 bg-[rgba(3,5,30,0.97)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Megaphone className="h-4 w-4 text-primary" />
            Nova Campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome da Campanha</Label>
            <Input
              placeholder="Ex: SDR Abertura Maio"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border-white/10 bg-white/[0.03]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, clientId: v, importId: "" }));
                  setSelectedClientId(v);
                }}
              >
                <SelectTrigger className="border-white/10 bg-white/[0.03]">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {visibleClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Base (opcional)</Label>
              <Select
                value={form.importId || "__all__"}
                onValueChange={(v) => setForm((f) => ({ ...f, importId: v === "__all__" ? "" : v }))}
                disabled={!form.clientId}
              >
                <SelectTrigger className="border-white/10 bg-white/[0.03]">
                  <SelectValue placeholder="Todas as bases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as bases</SelectItem>
                  {imports.map((imp) => (
                    <SelectItem key={imp.id} value={imp.id}>
                      {imp.source_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Limite por execução
            </Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={form.limitPerRun}
              onChange={(e) => setForm((f) => ({ ...f, limitPerRun: e.target.value }))}
              className="border-white/10 bg-white/[0.03]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              URL do Webhook n8n
              <span className="ml-1 text-primary">*</span>
            </Label>
            <Input
              placeholder="https://seu-n8n.dominio.com/webhook/vexocrm-campanha"
              value={form.webhookUrl}
              onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
              className="border-white/10 bg-white/[0.03] font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Cole aqui a URL do Webhook Trigger do workflow n8n
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Token do Webhook (opcional)
            </Label>
            <Input
              type="password"
              placeholder="Bearer token para autenticação"
              value={form.webhookToken}
              onChange={(e) => setForm((f) => ({ ...f, webhookToken: e.target.value }))}
              className="border-white/10 bg-white/[0.03]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createCampaign.isPending}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {createCampaign.isPending ? "Criando..." : "Criar Campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CampaignCardProps {
  campaign: Campaign;
}

function CampaignCard({ campaign }: CampaignCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const triggerCampaign = useTriggerCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const isActive = campaign.status === "active";

  const handleTrigger = async () => {
    try {
      const result = await triggerCampaign.mutateAsync(campaign.id);
      toast.success(`Campanha disparada! ${result.n8nResponse ?? ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao disparar.");
    }
  };

  const handleToggleStatus = async () => {
    try {
      await updateCampaign.mutateAsync({
        id: campaign.id,
        status: isActive ? "paused" : "active",
      });
      toast.success(isActive ? "Campanha pausada." : "Campanha ativada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCampaign.mutateAsync(campaign.id);
      toast.success("Campanha excluída.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  };

  const truncateUrl = (url: string) =>
    url.length > 52 ? `${url.slice(0, 52)}…` : url;

  return (
    <>
      <Card className="border-white/8 bg-[rgba(3,5,30,0.6)] backdrop-blur-sm transition-all hover:border-white/12">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 shrink-0 text-primary" />
              <CardTitle className="text-sm font-semibold text-foreground">
                {campaign.name}
              </CardTitle>
            </div>
            <Badge
              className={cn(
                "shrink-0 text-[10px] font-medium",
                isActive
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-400"
              )}
            >
              {isActive ? "Ativa" : "Pausada"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <span className="text-muted-foreground">Cliente</span>
              <p className="font-medium text-foreground">{campaign.client_name ?? campaign.client_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Limite/execução</span>
              <p className="font-medium text-foreground">{campaign.limit_per_run} leads</p>
            </div>
            {campaign.last_triggered_at && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Último disparo</span>
                <p className="font-medium text-foreground">
                  {new Date(campaign.last_triggered_at).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-md border border-white/8 bg-white/[0.02] px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Webhook URL
              </span>
              <div className="flex items-center gap-1">
                <CopyButton value={campaign.webhook_url} />
                <a
                  href={campaign.webhook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-primary"
                  title="Abrir"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {truncateUrl(campaign.webhook_url)}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleTrigger}
              disabled={triggerCampaign.isPending || !isActive}
              className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
            >
              {triggerCampaign.isPending ? (
                <>
                  <Zap className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                  Disparando...
                </>
              ) : (
                <>
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Disparar Agora
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleStatus}
              disabled={updateCampaign.isPending}
              className="border border-white/10 text-muted-foreground hover:text-foreground"
              title={isActive ? "Pausar campanha" : "Ativar campanha"}
            >
              {isActive ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="border border-white/10 text-muted-foreground hover:border-red-500/30 hover:text-red-400"
              title="Excluir campanha"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="border-white/10 bg-[rgba(3,5,30,0.97)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>{campaign.name}</strong> será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500/80 text-white hover:bg-red-500"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Campanhas() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: campaigns = [], isLoading, error } = useCampanhas();

  return (
    <PageShell
      title="Campanhas"
      subtitle="Configure e dispare campanhas de mensagem para seus leads via n8n"
      headerRight={
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary text-white hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Campanha
        </Button>
      }
    >

      {error && (
        <ErrorMessage
          message={error instanceof Error ? error.message : "Erro ao carregar campanhas."}
        />
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg border border-white/8 bg-white/[0.02]"
            />
          ))}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && !error && (
        <EmptyState
          title="Nenhuma campanha criada"
          description="Crie uma campanha para configurar disparos de mensagens via n8n."
        />
      )}

      {!isLoading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      <CreateCampaignDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageShell>
  );
}
