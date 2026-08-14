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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchApi } from "@/lib/api";
import { type PitchSlide, buildPitch } from "@/lib/presentation/pitchContent";
import {
  Sparkles,
  Save,
  Play,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  ArrowRight,
  TrendingUp,
  Target,
  FileCheck,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SlideEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  proposalName: string;
  segmentName?: string | null;
  initialSlides?: PitchSlide[] | null;
  onSlidesSaved?: (newSlides: PitchSlide[]) => void;
}

export function SlideEditorModal({
  open,
  onOpenChange,
  proposalId,
  proposalName,
  segmentName,
  initialSlides,
  onSlidesSaved,
}: SlideEditorModalProps) {
  const { getIdToken, clientId } = useAuth();
  const navigate = useNavigate();

  const [slides, setSlides] = useState<PitchSlide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Inicializa os slides
  useEffect(() => {
    if (!open) return;

    if (Array.isArray(initialSlides) && initialSlides.length > 0) {
      setSlides(JSON.parse(JSON.stringify(initialSlides)));
    } else {
      // Fallback para os slides canônicos do segmento
      const { slides: defaultSlides } = buildPitch({
        companyName: proposalName,
        segmentId: segmentName,
      });
      setSlides(JSON.parse(JSON.stringify(defaultSlides)));
    }
    setActiveSlideIndex(0);
  }, [open, initialSlides, proposalName, segmentName]);

  const currentSlide = slides[activeSlideIndex] || slides[0];

  const updateCurrentSlide = (field: keyof PitchSlide, value: any) => {
    setSlides((prev) => {
      const next = [...prev];
      if (next[activeSlideIndex]) {
        next[activeSlideIndex] = {
          ...next[activeSlideIndex],
          [field]: value,
        };
      }
      return next;
    });
  };

  const updateMetric = (field: "value" | "caption", value: string) => {
    setSlides((prev) => {
      const next = [...prev];
      if (next[activeSlideIndex]) {
        const curMetric = next[activeSlideIndex].metric || { value: "", caption: "" };
        next[activeSlideIndex] = {
          ...next[activeSlideIndex],
          metric: {
            ...curMetric,
            [field]: value,
          },
        };
      }
      return next;
    });
  };

  const handleStepChange = (index: number, val: string) => {
    if (!currentSlide?.steps) return;
    const newSteps = [...currentSlide.steps];
    newSteps[index] = val;
    updateCurrentSlide("steps", newSteps);
  };

  const handleAddStep = () => {
    const curSteps = currentSlide?.steps || [];
    updateCurrentSlide("steps", [...curSteps, "Novo ponto estratégico"]);
  };

  const handleRemoveStep = (index: number) => {
    if (!currentSlide?.steps) return;
    const newSteps = currentSlide.steps.filter((_, i) => i !== index);
    updateCurrentSlide("steps", newSteps);
  };

  // Chamada à Groq para gerar/regenerar os 6 slides
  const handleGenerateWithGroq = async () => {
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
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Falha ao gerar pitch com a IA da Groq.");
      }

      const json = await res.json();
      const generatedSlides = json?.data || json?.slides;
      if (Array.isArray(generatedSlides) && generatedSlides.length > 0) {
        setSlides(generatedSlides);
        if (onSlidesSaved) onSlidesSaved(generatedSlides);
        toast({
          title: "Pitch Gerado com Sucesso! ✨",
          description: "Os 6 slides foram personalizados com IA Groq para a proposta.",
        });
      }
    } catch (err: any) {
      console.error("[SlideEditorModal] Erro:", err);
      toast({
        title: "Erro ao gerar pitch",
        description: err?.message || "Verifique sua chave da Groq ou conexão.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Salva os slides editados no backend
  const handleSaveSlides = async () => {
    try {
      setIsSaving(true);
      const token = await getIdToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetchApi(
        `/api/gd/proposals/${proposalId}/slides?client_id=${clientId || ""}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ slides }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Falha ao salvar slides da proposta.");
      }

      if (onSlidesSaved) onSlidesSaved(slides);
      toast({
        title: "Slides Salvos! 💾",
        description: "A apresentação personalizada foi atualizada com sucesso.",
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("[SlideEditorModal] Erro ao salvar:", err);
      toast({
        title: "Erro ao salvar slides",
        description: err?.message || "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const slideTitles = [
    "1. Capa & Posicionamento",
    "2. Diagnóstico & Dores",
    "3. Agitação & Vazamento",
    "4. Solução Técnica",
    "5. Entregáveis & Escopo",
    "6. Projeção de ROI",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-950 text-slate-100 border-slate-800 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <Layers className="w-5 h-5 text-purple-400" />
                Editor Visual de Slides do Pitch
                <Badge variant="outline" className="border-purple-500/40 text-purple-300 text-[10px] ml-2">
                  SPIN Selling
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-1">
                Personalize os textos da apresentação para <strong>{proposalName}</strong> ou use a IA da Groq para reescrever sob medida.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateWithGroq}
                disabled={isGenerating || isSaving}
                className="bg-purple-950/40 border-purple-500/50 text-purple-200 hover:bg-purple-900/60 hover:text-white text-xs font-bold gap-1.5 shadow-sm"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                )}
                {isGenerating ? "Gerando com Groq..." : "Gerar Pitch com IA"}
              </Button>
            </div>
          </div>

          {/* Navegação entre os 6 slides */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-4 pb-1 scrollbar-none">
            {slides.map((s, idx) => (
              <button
                key={s.id || idx}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  activeSlideIndex === idx
                    ? "bg-purple-600 border-purple-500 text-white shadow-md"
                    : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {slideTitles[idx] || `Slide ${idx + 1}`}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Corpo do Editor de Slide */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentSlide && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Coluna Esquerda: Textos Principais */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Rótulo Superior (Eyebrow)
                  </Label>
                  <Input
                    value={currentSlide.eyebrow || ""}
                    onChange={(e) => updateCurrentSlide("eyebrow", e.target.value)}
                    placeholder="Ex: O DIAGNÓSTICO ATUAL"
                    className="bg-slate-900 border-slate-800 text-xs font-mono text-purple-300 focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Título Principal do Slide
                  </Label>
                  <Input
                    value={currentSlide.title || ""}
                    onChange={(e) => updateCurrentSlide("title", e.target.value)}
                    placeholder="Título de impacto"
                    className="bg-slate-900 border-slate-800 text-xs font-bold text-slate-100 focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Subtítulo / Chamada Secundária
                  </Label>
                  <Input
                    value={currentSlide.subtitle || ""}
                    onChange={(e) => updateCurrentSlide("subtitle", e.target.value)}
                    placeholder="Subtítulo complementar"
                    className="bg-slate-900 border-slate-800 text-xs text-slate-300 focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Corpo do Texto / Narrativa
                  </Label>
                  <Textarea
                    value={currentSlide.body || ""}
                    onChange={(e) => updateCurrentSlide("body", e.target.value)}
                    rows={3}
                    placeholder="Parágrafo descritivo do slide..."
                    className="bg-slate-900 border-slate-800 text-xs text-slate-300 focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              {/* Coluna Direita: Elementos Especiais (Steps, Métricas, Punchline) */}
              <div className="space-y-4">
                {/* Steps / Tópicos */}
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-purple-400" />
                      Tópicos & Pontos-Chave ({currentSlide.steps?.length || 0})
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleAddStep}
                      className="h-6 px-2 text-[11px] text-purple-400 hover:text-purple-300 hover:bg-purple-950/40"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Adicionar Ponto
                    </Button>
                  </div>

                  {currentSlide.steps && currentSlide.steps.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {currentSlide.steps.map((st, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={st}
                            onChange={(e) => handleStepChange(i, e.target.value)}
                            className="h-8 bg-slate-950 border-slate-800 text-xs text-slate-200"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveStep(i)}
                            className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-950/30 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      Nenhum ponto de lista configurado para este slide.
                    </p>
                  )}
                </div>

                {/* Destaque Numérico / ROI */}
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Métrica de Impacto / ROI
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-slate-400">Valor em Destaque</Label>
                      <Input
                        value={currentSlide.metric?.value || ""}
                        onChange={(e) => updateMetric("value", e.target.value)}
                        placeholder="Ex: R$ 45.000+"
                        className="h-8 bg-slate-950 border-slate-800 text-xs font-mono font-bold text-emerald-400"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-400">Legenda da Métrica</Label>
                      <Input
                        value={currentSlide.metric?.caption || ""}
                        onChange={(e) => updateMetric("caption", e.target.value)}
                        placeholder="Ex: estimativa anual"
                        className="h-8 bg-slate-950 border-slate-800 text-xs text-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Frase de Efeito (Punchline de Fechamento) */}
                {activeSlideIndex === 5 && (
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40">
                    <Label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Frase de Efeito (Chamada para Ação)
                    </Label>
                    <Input
                      value={currentSlide.punch || ""}
                      onChange={(e) => updateCurrentSlide("punch", e.target.value)}
                      placeholder="Vamos iniciar a implementação hoje?"
                      className="bg-slate-950 border-purple-900/50 text-xs text-purple-200 font-medium"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 px-6 border-t border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              navigate(`/crm/propostas-gd/${proposalId}/apresentacao`);
            }}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white text-xs font-semibold gap-1.5"
          >
            <Play className="w-3.5 h-3.5 text-purple-400" />
            Visualizar em Tela Cheia
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveSlides}
              disabled={isSaving || isGenerating}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold gap-1.5 shadow-md"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isSaving ? "Salvando..." : "Salvar Slides"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
