import { useEffect, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useDispatchPrompt, useSaveDispatchPrompt } from "@/hooks/useCampaignPrompts";

interface DispatchPromptDialogProps {
  dispatchId: string | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Roteiro do agente DAQUELE disparo.
 *
 * Cada disparo nasce com uma copia propria do roteiro da campanha. Editar aqui
 * corrige o atendimento dos leads DESTE disparo que ainda vao responder, sem tocar
 * na campanha nem em outros disparos — que e o ponto: se a IA responde algo errado,
 * da para consertar em andamento, sem cancelar a campanha e sem depender de quem ja
 * recebeu abrir a mensagem de novo.
 */
export function DispatchPromptDialog({ dispatchId, onOpenChange }: DispatchPromptDialogProps) {
  const { data, isLoading, isError, error } = useDispatchPrompt(dispatchId);
  const salvar = useSaveDispatchPrompt();
  const [texto, setTexto] = useState("");
  const [carregadoDe, setCarregadoDe] = useState<string | null>(null);

  // Hidrata uma vez por disparo: refetch nao pode sobrescrever o que o usuario digitou.
  useEffect(() => {
    if (!dispatchId || !data) return;
    if (carregadoDe === dispatchId) return;
    setCarregadoDe(dispatchId);
    setTexto(data.prompt?.content ?? "");
  }, [dispatchId, data, carregadoDe]);

  useEffect(() => {
    if (!dispatchId) setCarregadoDe(null);
  }, [dispatchId]);

  const semRoteiro = !isLoading && !isError && !data?.prompt;

  async function handleSalvar() {
    if (!dispatchId) return;
    try {
      await salvar.mutateAsync({ dispatchId, content: texto });
      toast({
        title: "Roteiro do disparo salvo",
        description: "Vale para os leads deste disparo que ainda responderem. A campanha não foi alterada.",
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Não foi possível salvar o roteiro.",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={!!dispatchId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-indigo-500" />
            Roteiro do agente — {data?.dispatchName || "disparo"}
          </DialogTitle>
          <DialogDescription>
            Este roteiro é só deste disparo. Editar aqui muda o atendimento dos leads dele que ainda
            responderem — não altera a campanha nem outros disparos.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-xs text-slate-400 py-8 text-center">Carregando roteiro...</p>
        ) : isError ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-6 text-center">
            {(error as Error)?.message || "Não foi possível carregar o roteiro."}
          </p>
        ) : semRoteiro ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
            Este disparo não tem roteiro próprio. Ou ele foi criado antes desta funcionalidade, ou a
            campanha não usa "Agente da campanha" — nesse caso quem responde é o agente de atendimento,
            configurado em Agente IA.
          </p>
        ) : (
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Como o agente deve conduzir a conversa de quem responder a este disparo."
            className="min-h-[240px] text-xs"
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Fechar
          </Button>
          <Button onClick={handleSalvar} disabled={semRoteiro || isLoading || isError || salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar roteiro deste disparo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
