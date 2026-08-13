import React, { useState } from "react";
import { Sparkles, ShieldCheck, Copy, Check, RefreshCw, Wand2, MessageSquare, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export function AntibanGroqTab() {
  const [baseMessage, setBaseMessage] = useState(
    "Olá {nome}, tudo bem? Vi que você tem interesse em soluções de energia solar. Posso te apresentar nossa proposta personalizada?"
  );
  const [numVariations, setNumVariations] = useState(5);
  const [creativity, setCreativity] = useState(0.7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [variations, setVariations] = useState<string[]>([
    "Oi {nome}, como vai? Notei seu interesse em reduzir a conta de luz com energia solar. Me avisa se posso te mandar uma simulação rápida!",
    "{nome}, tudo certo? Passando para te apresentar nosso projeto exclusivo de energia solar fotovoltaica. Quer dar uma olhada na proposta?",
    "Olá, {nome}! Vi seu contato aqui sobre energia solar. Temos condições especiais este mês, posso compartilhar os detalhes?",
    "Fala {nome}, tudo bem por aí? Preparei uma prévia da economia com energia solar para o seu perfil. Tem 2 minutinhos para conversar?",
    "Oi {nome}! Identifiquei seu interesse em economia de energia. Gostaria de receber nosso estudo de viabilidade sem compromisso?",
  ]);

  const handleGenerate = () => {
    if (!baseMessage.trim()) {
      toast.error("Insira a mensagem base para gerar variações.");
      return;
    }

    setIsGenerating(true);
    // Simula geração via Groq AI Llama-3-70b
    setTimeout(() => {
      setIsGenerating(false);
      const generated = [
        `Oi {nome}, tudo ótimo? Vi seu interesse no nosso atendimento e gostaria de enviar nossa proposta sob medida. Me diz se faz sentido!`,
        `Olá {nome}! Tudo bem? Separei uma apresentação exclusiva sobre nossas soluções. Posso te encaminhar agora?`,
        `Fala {nome}, como estão as coisas? Queria te mostrar como nossa solução pode te ajudar a economizar tempo e recursos. Topa ver?`,
        `{nome}, como vai? Vi que você procurou por informações recentes. Posso te passar os valores e condições especiais?`,
        `Olá, {nome}! Tudo bem com você? Estou com nossa tabela atualizada em mãos. Quer que eu te envie no WhatsApp?`,
      ];
      setVariations(generated.slice(0, numVariations));
      toast.success(`${numVariations} variações geradas com sucesso via Groq AI!`);
    }, 900);
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success("Variação copiada para a área de transferência!");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <Card className="border-border dark:border-zinc-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Motor Antiban Groq AI (Llama 3 70B)</CardTitle>
                <CardDescription className="text-xs">
                  Gere dezenas de variações semânticas da mesma mensagem para evitar bloqueios de chips no WhatsApp durante disparos em massa.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs font-bold">
              ⚡ Ultra Fast (Groq Inference)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Mensagem Base (Use variáveis como {"{nome}"}, {"{empresa}"})</Label>
            <Textarea
              rows={3}
              value={baseMessage}
              onChange={(e) => setBaseMessage(e.target.value)}
              placeholder="Digite o texto inicial da mensagem..."
              className="text-sm font-sans"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="font-semibold">Quantidade de Variações</Label>
                <span className="font-bold text-foreground">{numVariations} variações</span>
              </div>
              <Slider
                min={3}
                max={15}
                step={1}
                value={[numVariations]}
                onValueChange={(val) => setNumVariations(val[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="font-semibold">Criatividade Semântica (Temperature)</Label>
                <span className="font-bold text-foreground">{creativity.toFixed(1)}</span>
              </div>
              <Slider
                min={0.2}
                max={1.0}
                step={0.1}
                value={[creativity]}
                onValueChange={(val) => setCreativity(val[0])}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 text-xs"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Gerando via Groq AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Gerar Variações Antiban
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Variações Geradas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-purple-500" />
            Variações Prontas para Disparo ({variations.length})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(variations.join("\n---\n"));
              toast.success("Todas as variações copiadas!");
            }}
            className="h-7 text-xs gap-1.5"
          >
            <Copy className="w-3 h-3" />
            Copiar Todas
          </Button>
        </div>

        <div className="grid gap-3">
          {variations.map((v, i) => (
            <Card key={i} className="border-border dark:border-zinc-800/80 bg-muted/20">
              <CardContent className="p-3.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 shrink-0 mt-0.5">
                    #{i + 1}
                  </Badge>
                  <p className="text-xs text-foreground leading-relaxed font-normal">{v}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(v, i)}
                  className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
