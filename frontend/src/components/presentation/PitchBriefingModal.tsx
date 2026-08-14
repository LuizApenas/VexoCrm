import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchApi } from "@/lib/api";
import { type PitchSlide } from "@/lib/presentation/pitchContent";
import { Sparkles, RefreshCw, Building2, Target, FileText, Rocket } from "lucide-react";

interface PitchBriefingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  prospectName: string;
  segmentName?: string | null;
  initialNotes?: string | null;
  onPitchGenerated: (slides: PitchSlide[], meetingNotes: string) => void;
}

export function PitchBriefingModal({
  open,
  onOpenChange,
  proposalId,
  prospectName,
  segmentName,
  initialNotes,
  onPitchGenerated,
}: PitchBriefingModalProps) {
  const { getIdToken, clientId } = useAuth();
  const [meetingNotes, setMeetingNotes] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setMeetingNotes(initialNotes || "");
    }
  }, [open, initialNotes]);

  const handleGeneratePitch = async () => {
    try {
      setIsGenerating(true);
      const token = await getIdToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetchApi(
        `/api/gd/proposals/${proposalId}/generate-pitch?client_id=${clientId || ""}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ meetingNotes: meetingNotes.trim() }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Falha ao gerar apresentação de pitch com a IA da Groq.");
      }

      const json = await res.json();
      const generatedSlides = json?.data || json?.slides;
      if (Array.isArray(generatedSlides) && generatedSlides.length > 0) {
        toast({
          title: "Pitch Gerado com Sucesso! ✨",
          description: "Os 6 slides foram criados sob medida com base na reunião.",
        });
        onPitchGenerated(generatedSlides, meetingNotes.trim());
        onOpenChange(false);
      } else {
        throw new Error("Formato de slides retornado inválido.");
      }
    } catch (err: any) {
      console.error("[PitchBriefingModal] Erro:", err);
      toast({
        title: "Erro ao gerar pitch",
        description: err?.message || "Verifique sua chave da Groq ou conexão.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background text-foreground border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Gerador de Pitch com IA (Groq)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Insira os pontos-chave da reunião para a IA criar uma apresentação de alto impacto personalizada.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="border-purple-500/40 text-purple-600 dark:text-purple-300 text-[10px] shrink-0 font-bold">
              SPIN Selling
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/80">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-500" />
                Empresa
              </span>
              <p className="text-xs font-bold text-foreground truncate">{prospectName || "Cliente"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-500" />
                Segmento / Nicho
              </span>
              <p className="text-xs font-bold text-foreground truncate">{segmentName || "Geral / B2B"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-500" />
                Observações da Reunião / Dores do Cliente
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">Opcional, mas altamente recomendado</span>
            </Label>
            <Textarea
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              rows={5}
              placeholder="Ex: O cliente tem 3 vendedores no WhatsApp mas perde até 40% dos contatos à noite e nos fins de semana. Reclamou que orçamentos enviados esfriam rápido. Quer aumentar as vendas em 30% e automatizar o primeiro atendimento com IA..."
              className="bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary text-xs leading-relaxed resize-none rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleGeneratePitch}
            disabled={isGenerating}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold gap-2 shadow-md rounded-xl"
          >
            {isGenerating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            {isGenerating ? "Gerando Slides com Groq..." : "Gerar Slides Personalizados com IA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
