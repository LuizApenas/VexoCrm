import { useRef, type ChangeEvent, type RefObject } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPicker } from "./EmojiPicker";
import { Badge } from "@/components/ui/badge";
import type { CampaignSequenceStep } from "@/hooks/useCampanhas";
import type { StepActionButton } from "@/lib/leadImports/spreadsheet";

type SequenceStep = CampaignSequenceStep & { buttons?: StepActionButton[] };

interface MessageSequenceStepProps {
  sequenceImageInputRef: RefObject<HTMLInputElement>;
  onSequenceImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  campaignSequence: SequenceStep[];
  updateCampaignStep: (stepId: string, patch: Partial<SequenceStep>) => void;
  moveCampaignStep: (stepId: string, direction: -1 | 1) => void;
  removeCampaignStep: (stepId: string) => void;
  addCampaignStep: (type: "text" | "image") => void;
  onSelectImageStep: (stepId: string) => void;
  isGeneratingVariants: boolean;
  onGenerateVariants: (stepId: string, baseText: string) => void;
  variantCount: number;
  onVariantCountChange: (value: number | null) => void;
  suggestedVariantCount: number;
  dailyQuota: number;
  minVariantCount: number;
  maxVariantCount: number;
  onAddStepButton: (stepId: string) => void;
  onRemoveStepButton: (stepId: string, btnIndex: number) => void;
  onUpdateStepButton: (stepId: string, btnIndex: number, patch: Partial<StepActionButton>) => void;
}

export function MessageSequenceStep({
  sequenceImageInputRef,
  onSequenceImageChange,
  campaignSequence,
  updateCampaignStep,
  moveCampaignStep,
  removeCampaignStep,
  addCampaignStep,
  onSelectImageStep,
  isGeneratingVariants,
  onGenerateVariants,
  variantCount,
  onVariantCountChange,
  suggestedVariantCount,
  dailyQuota,
  minVariantCount,
  maxVariantCount,
  onAddStepButton,
  onRemoveStepButton,
  onUpdateStepButton,
}: MessageSequenceStepProps) {
  // Insere o emoji na POSICAO DO CURSOR, nao no fim: escrever no meio do texto e o
  // uso normal, e concatenar quebraria a frase. Sem cursor (campo nunca focado),
  // cai para o fim. So texto entra, entao {{nome}} e a contagem de caracteres do
  // proprio campo seguem valendo.
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  function inserirNoCursor(stepId: string, textoAtual: string, trecho: string) {
    const campo = textareaRefs.current[stepId];
    const base = textoAtual || "";
    const inicio = campo?.selectionStart ?? base.length;
    const fim = campo?.selectionEnd ?? base.length;
    const novoTexto = base.slice(0, inicio) + trecho + base.slice(fim);
    updateCampaignStep(stepId, { text: novoTexto });
    // Reposiciona o cursor depois do que foi inserido, para continuar digitando.
    requestAnimationFrame(() => {
      const alvo = textareaRefs.current[stepId];
      if (!alvo) return;
      const posicao = inicio + trecho.length;
      alvo.focus();
      alvo.setSelectionRange(posicao, posicao);
    });
  }

  const repeticoesPorDia = variantCount > 0 ? Math.ceil(dailyQuota / variantCount) : dailyQuota;
  const riscoAlto = repeticoesPorDia > 40;
  const riscoMedio = !riscoAlto && repeticoesPorDia > 20;

  return (
    <Card className="border-border bg-card shadow-sm text-card-foreground rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white">2</span>
          Timeline de Envio
        </CardTitle>
        <CardDescription>Escreva a mensagem. Adicione mais passos de texto ou imagem para criar uma sequência</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input ref={sequenceImageInputRef} type="file" accept="image/*" className="sr-only" onChange={onSequenceImageChange} />

        {/* Vertical Step cards */}
        <div className="space-y-4 relative border-l border-slate-200/80 dark:border-white/10 ml-3.5 pl-5">
          {campaignSequence.map((step, index) => (
            <div key={step.id} className="relative space-y-3 rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/5 dark:bg-black/35 shadow-sm">
              {/* Left icon marker */}
              <span className="absolute -left-[30px] top-4 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 font-mono text-[9px] font-bold text-slate-500">
                {step.order}
              </span>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                    Passo {step.order} — {step.type === "image" ? "Imagem" : "Texto"}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gatilho:</span>
                    {/* "with_previous" foi removido da tela: nao havia consumidor no
                        backend, e o passo era tratado como imediato (dois envios
                        seguidos, com o atraso normal). Passo antigo gravado assim
                        aparece como "Imediato", que e o que ele de fato faz. */}
                    <Select
                      value={step.triggerMode === "after_reply" ? "after_reply" : "immediate"}
                      onValueChange={(val) => updateCampaignStep(step.id, { triggerMode: val as "immediate" | "after_reply" })}
                    >
                      <SelectTrigger className="h-7 text-[11px] font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 w-[210px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">⚡ Enviar na hora (Imediato)</SelectItem>
                        <SelectItem value="after_reply">💬 Enviar após resposta do lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveCampaignStep(step.id, -1)} disabled={index === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveCampaignStep(step.id, 1)} disabled={index === campaignSequence.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500" onClick={() => removeCampaignStep(step.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {step.triggerMode === "after_reply" && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/80 dark:border-amber-900/40">
                  <span className="font-bold">💬 Aguardar resposta:</span> Esta mensagem só será enviada quando o lead responder à mensagem anterior.
                </div>
              )}

              {/* Message editor */}
              <div className="space-y-2">
                <Textarea
                  ref={(el) => { textareaRefs.current[step.id] = el; }}
                  placeholder={step.type === "image" ? "Legenda opcional para a imagem" : "Olá {{nome}}, tudo bem? Escreva a mensagem de envio..."}
                  className="min-h-[96px] text-xs font-sans"
                  value={step.text}
                  onChange={(e) => updateCampaignStep(step.id, { text: e.target.value })}
                />

                {/* Variables helper */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  <EmojiPicker onSelect={(emoji) => inserirNoCursor(step.id, step.text, emoji)} />
                  <span>Variáveis:</span>
                  <button type="button" onClick={() => updateCampaignStep(step.id, { text: step.text + " {{nome}}" })} className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-0.5 dark:bg-slate-800 dark:hover:bg-slate-700">{"{{nome}}"}</button>
                  <button type="button" onClick={() => updateCampaignStep(step.id, { text: step.text + " {{telefone}}" })} className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-0.5 dark:bg-slate-800 dark:hover:bg-slate-700">{"{{telefone}}"}</button>
                  <button type="button" onClick={() => updateCampaignStep(step.id, { text: step.text + " {{scheduling_link}}" })} className="rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-0.5 dark:bg-slate-800 dark:hover:bg-slate-700">{"{{scheduling_link}}"}</button>
                </div>
              </div>

              {/* Image selector */}
              {step.type === "image" && (
                <div className="space-y-2">
                  {step.image ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50 p-2 dark:border-white/5 dark:bg-slate-900/40">
                      <img src={step.image.dataUrl} alt={step.image.name} className="h-12 w-12 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{step.image.name}</p>
                        <p className="text-[10px] text-slate-500">{Math.round(step.image.size / 1024)} KB</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => updateCampaignStep(step.id, { image: null })} className="text-xs text-rose-500 h-8">Remover</Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-center gap-1.5 h-9"
                      onClick={() => {
                        onSelectImageStep(step.id);
                        sequenceImageInputRef.current?.click();
                      }}
                    >
                      <ImagePlus className="h-4 w-4" />
                      Carregar Imagem do Computador
                    </Button>
                  )}
                </div>
              )}

              {/* AI Variations inline trigger */}
              {step.type === "text" && (
                <div className="border-t border-slate-100 dark:border-white/5 pt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isGeneratingVariants}
                      onClick={() => onGenerateVariants(step.id, step.text)}
                      className="text-[11px] font-bold text-violet-500 hover:text-violet-600 flex items-center gap-1 bg-violet-50 dark:bg-violet-950/20 px-2 py-1 rounded-md"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {isGeneratingVariants ? "Processando..." : "🤖 Gerar Variações Humanizadas (Evitar Spam)"}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Quantidade</label>
                      <Input
                        type="number"
                        min={minVariantCount}
                        max={maxVariantCount}
                        value={variantCount}
                        onChange={(e) => {
                          const raw = Number.parseInt(e.target.value, 10);
                          if (Number.isNaN(raw)) {
                            onVariantCountChange(null);
                            return;
                          }
                          onVariantCountChange(Math.min(maxVariantCount, Math.max(minVariantCount, raw)));
                        }}
                        className="h-8 w-16 text-xs"
                      />
                    </div>
                  </div>

                  {/* Consequencia da escolha, em numero — o sistema sugere a partir
                      da cota ja configurada e mostra o efeito, sem decidir pelo usuario. */}
                  <p
                    className={
                      riscoAlto
                        ? "text-[10px] font-semibold text-red-600 dark:text-red-400"
                        : riscoMedio
                          ? "text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                          : "text-[10px] text-muted-foreground"
                    }
                  >
                    Com {variantCount} variações e cota de {dailyQuota}/dia, cada mensagem se repete ~
                    {repeticoesPorDia} vezes por dia por chip.
                    {riscoAlto
                      ? " Repetição muito alta — risco elevado de bloqueio."
                      : riscoMedio
                        ? " Repetição alta para operação contínua."
                        : ""}
                    {variantCount !== suggestedVariantCount
                      ? ` Sugerido para esta cota: ${suggestedVariantCount}.`
                      : ""}
                  </p>

                  {step.textVariants && step.textVariants.length > 0 && (
                    <div className="rounded-lg border border-violet-100 bg-violet-50/20 p-2.5 dark:border-violet-900/10 dark:bg-violet-950/5 space-y-2">
                      <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400">Variações Alternativas Ativas:</p>
                      <div className="grid gap-1.5">
                        {step.textVariants.map((variant, vIdx) => (
                          <textarea
                            key={vIdx}
                            value={variant}
                            onChange={(e) => {
                              const updatedVariants = [...(step.textVariants || [])];
                              updatedVariants[vIdx] = e.target.value;
                              updateCampaignStep(step.id, { textVariants: updatedVariants });
                            }}
                            className="w-full rounded border border-slate-200 bg-white/80 p-2 text-[10px] dark:border-white/5 dark:bg-black/30 font-sans min-h-[44px] resize-y"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp Actions buttons */}
              {step.type === "text" && (
                <div className="border-t border-slate-100 dark:border-white/5 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Links e opções de resposta (Max 3)</span>
                    <button
                      type="button"
                      onClick={() => onAddStepButton(step.id)}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  </div>

                  {/* O WhatsApp descontinuou botao interativo para conexoes nao-oficiais,
                      entao links e opcoes vao ESCRITOS no corpo. Opcao em texto ainda
                      cumpre o papel: oferece caminhos para o lead nao ter que formular a
                      resposta sozinho, e o agente reconhece a escolha. */}
                  <p className="text-[10px] rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300">
                    Links e opções são <strong>escritos no final da mensagem</strong>, numerados. O
                    WhatsApp deixa a URL clicável, e o agente da campanha reconhece a opção que o
                    lead escolher — por número ou por texto.
                  </p>

                  {step.buttons && step.buttons.length > 0 && (
                    <div className="grid gap-2 pt-1">
                      {step.buttons.map((btn, btnIdx) => (
                        <div key={btnIdx} className="space-y-1 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200/60 dark:border-white/5">
                          <div className="flex gap-2 items-center">
                            <Input
                              value={btn.displayText}
                              placeholder="Nome do Botão (Ex: Agendar)"
                              className="h-8 text-[11px] max-w-[130px]"
                              onChange={(e) => onUpdateStepButton(step.id, btnIdx, { displayText: e.target.value })}
                            />
                            <Select
                              value={btn.type}
                              onValueChange={(val) => onUpdateStepButton(step.id, btnIdx, { type: val as "url" | "reply" })}
                            >
                              <SelectTrigger className="h-8 text-[11px] max-w-[125px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="url">Link / URL</SelectItem>
                                <SelectItem value="reply">Opção de resposta</SelectItem>
                              </SelectContent>
                            </Select>

                            {btn.type === "url" ? (
                              <Input
                                value={btn.url || ""}
                                placeholder="Link (Ex: {{scheduling_link}})"
                                className="h-8 text-[11px] flex-1 font-mono"
                                onChange={(e) => onUpdateStepButton(step.id, btnIdx, { url: e.target.value })}
                              />
                            ) : (
                              <Input
                                value={btn.replyText || btn.url || ""}
                                placeholder="Texto de resposta do lead (Ex: Quero agendar)"
                                className="h-8 text-[11px] flex-1"
                                onChange={(e) => onUpdateStepButton(step.id, btnIdx, { replyText: e.target.value, url: e.target.value })}
                              />
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => onRemoveStepButton(step.id, btnIdx)}
                              className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <p className="text-[10px] text-slate-500 pl-1">
                            {btn.type === "url"
                              ? "🔗 Link externo: vai anexado ao final da mensagem, clicável."
                              : "💬 Opção de resposta: aparece escrita e numerada no final da mensagem. O agente reconhece a escolha do lead — pelo número ou pelo texto."}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => addCampaignStep("text")}>
            <Plus className="h-3.5 w-3.5" /> Envio de Texto
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => addCampaignStep("image")}>
            <Plus className="h-3.5 w-3.5" /> Envio de Imagem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
