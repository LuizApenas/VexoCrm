import type { Dispatch, SetStateAction } from "react";
import { Mic, RefreshCw, Bot, Square, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { useBriefingRecorder } from "@/hooks/useBriefingRecorder";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TRANSCRIPT_OPTIONS } from "@/lib/geracaoDigital/constants";

// Extraído de src/pages/GeracaoDigitalPitch.tsx (Onda 4 Run F5) — coluna esquerda do Slide 5 (transcrição + IA), movimento puro.
interface BriefingTranscriptPanelProps {
  transcriptText: string;
  setTranscriptText: Dispatch<SetStateAction<string>>;
  isProcessingAI: boolean;
  aiProgressText: string;
  selectTranscriptPreset: (presetId: string) => void;
  processBriefingWithGemini: () => void;
}

export function BriefingTranscriptPanel({
  transcriptText,
  setTranscriptText,
  isProcessingAI,
  aiProgressText,
  selectTranscriptPreset,
  processBriefingWithGemini,
}: BriefingTranscriptPanelProps) {
  const { user } = useAuth();

  // Cada trecho transcrito é ANEXADO ao que já existe, para o operador poder
  // editar o texto durante a reunião sem perder o que vem depois.
  const gravador = useBriefingRecorder((trecho) =>
    setTranscriptText((atual) => (atual ? `${atual.trimEnd()} ${trecho}` : trecho))
  );

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const alternarGravacao = async () => {
    if (gravador.gravando) {
      gravador.parar();
      return;
    }
    // Aviso de consentimento antes da primeira captura. Gravar reunião com
    // cliente sem avisar não é aceitável, então o passo é obrigatório.
    const ok = window.confirm(
      "Você vai gravar o áudio do microfone para gerar a transcrição.\n\n" +
        "Avise as pessoas na reunião de que a conversa está sendo transcrita.\n\n" +
        "O áudio não é armazenado: vira texto e é descartado. Só a transcrição fica na tela.\n\n" +
        "Começar a gravar?"
    );
    if (!ok) return;
    await gravador.iniciar(async () => (await user?.getIdToken()) || "");
  };

  return (
                  <div className="md:col-span-2 space-y-6">
                    <Card className="border-slate-200 bg-white shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden">
                      <CardHeader className="pb-4 bg-slate-50 border-b border-slate-100">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <Mic className="h-5 w-5 text-indigo-600" />
                          Áudio Transcrito do Briefing
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 pt-6">
                        
                        {/* Gravação da reunião */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Button
                              type="button"
                              onClick={alternarGravacao}
                              disabled={!gravador.suportado}
                              className={
                                gravador.gravando
                                  ? "gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold h-11 rounded-xl px-5"
                                  : "gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl px-5"
                              }
                            >
                              {gravador.gravando ? (
                                <>
                                  <Square className="h-4 w-4" />
                                  Parar gravação · {mmss(gravador.segundos)}
                                </>
                              ) : (
                                <>
                                  <Mic className="h-4 w-4" />
                                  Gravar a reunião
                                </>
                              )}
                            </Button>

                            {gravador.gravando && (
                              <span className="flex items-center gap-2 text-xs font-bold text-rose-600">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse" />
                                Gravando o microfone
                              </span>
                            )}
                            {gravador.transcrevendo && (
                              <span className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Transcrevendo o trecho...
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Grava o microfone e vai escrevendo a transcrição aqui embaixo durante a reunião.
                            O primeiro trecho aparece em cerca de 12 segundos. O áudio não é armazenado.
                          </p>
                          <ul className="text-[11px] text-slate-500 leading-relaxed list-disc pl-4 space-y-0.5">
                            <li>Deixe a caixa de som aberta: com fone, só a sua voz é gravada.</li>
                            <li>
                              Grave em <strong>um computador só</strong>. Duas máquinas na mesma sala se
                              realimentam e a transcrição embaralha.
                            </li>
                            <li>Quanto menos conversa paralela e ruído em volta, melhor o resultado.</li>
                          </ul>

                          {!gravador.suportado && (
                            <p className="text-[11px] font-bold text-amber-600">
                              Este navegador não permite gravar áudio. Use o Chrome no computador.
                            </p>
                          )}
                          {gravador.erro && (
                            <p className="flex items-start gap-1.5 text-[11px] font-bold text-rose-600">
                              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
                              {gravador.erro}
                            </p>
                          )}
                        </div>

                        {/* Textarea */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm text-slate-600 uppercase font-mono font-bold" htmlFor="transcript-area">Cole a Transcrição da Reunião Aqui</Label>
                            {transcriptText.trim() && !gravador.gravando && (
                              <button
                                type="button"
                                onClick={() => setTranscriptText("")}
                                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Limpar
                              </button>
                            )}
                          </div>
                          <textarea
                            id="transcript-area"
                            value={transcriptText}
                            onChange={(e) => setTranscriptText(e.target.value)}
                            placeholder="Exemplo: 'O cliente disse que o orçamento é de 5 mil reais mensais para Google Ads...'"
                            className="w-full h-[500px] p-5 text-base bg-white border border-slate-200 rounded-2xl text-slate-900 font-sans focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none leading-relaxed resize-none shadow-sm transition-all"
                          />
                        </div>

                        {/* Run Button */}
                        <Button
                          onClick={processBriefingWithGemini}
                          disabled={isProcessingAI || !transcriptText.trim()}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 font-black text-base text-white h-14 rounded-2xl gap-3 shadow-lg shadow-indigo-600/20 mt-2 transition-all"
                        >
                          {isProcessingAI ? (
                            <>
                              <RefreshCw className="h-6 w-6 animate-spin text-white" />
                              Extraindo Dados com Gemini...
                            </>
                          ) : (
                            <>
                              <Bot className="h-6 w-6 text-white" />
                              Gerar Automação do Briefing
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Gemini Processing Console view */}
                    {isProcessingAI && (
                      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2 animate-pulse shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-indigo-700 uppercase font-bold">Console do Processador de IA</span>
                          <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                        </div>
                        <p className="text-sm font-mono text-indigo-900 leading-normal">{aiProgressText}</p>
                      </div>
                    )}
                  </div>
  );
}
