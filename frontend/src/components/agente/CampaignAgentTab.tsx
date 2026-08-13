import React, { useState } from "react";
import { Megaphone, Bot, Sparkles, Sliders, CheckCircle2, Save, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface CampaignAgentConfig {
  id: string;
  name: string;
  channel: string;
  persona: string;
  goal: string;
  qualificationQuestions: string[];
  active: boolean;
}

export function CampaignAgentTab() {
  const [campaigns, setCampaigns] = useState<CampaignAgentConfig[]>([
    {
      id: "camp-1",
      name: "Campanha Instagram Ads - Energia Solar Residencial",
      channel: "Instagram",
      persona: "Especialista Consultivo em Redução de Custos de Energia Residencial",
      goal: "Qualificar valor médio da conta de luz acima de R$ 300 e agendar visita técnica com o SDR",
      qualificationQuestions: [
        "Qual o valor médio da sua conta de luz mensal?",
        "O imóvel é próprio ou alugado?",
        "Qual a sua cidade e estado?",
      ],
      active: true,
    },
    {
      id: "camp-2",
      name: "Campanha Google Ads - Empresas & Indústria B2B",
      channel: "Google Ads",
      persona: "Consultor Sênior de Eficiência Energética e Mercado Livre de Energia",
      goal: "Identificar demanda contratada (kWh) e encaminhar diretamente para o Closer B2B",
      qualificationQuestions: [
        "Qual o tipo de atividade da sua empresa (indústria, comércio, agro)?",
        "Sua fatura de energia é em Baixa ou Alta Tensão?",
      ],
      active: true,
    },
    {
      id: "camp-3",
      name: "Reativação de Base de Clientes Antigos",
      channel: "WhatsApp Broadcast",
      persona: "Assistente de Relacionamento e Pós-Venda Vexo",
      goal: "Apresentar upgrades de módulos e novas condições contratuais de 2026",
      qualificationQuestions: [
        "Você ainda gerencia as operações comerciais da empresa?",
        "Gostaria de ver uma demonstração das novas automações do Vexo OS?",
      ],
      active: false,
    },
  ]);

  const [selectedId, setSelectedId] = useState<string>("camp-1");
  const selected = campaigns.find((c) => c.id === selectedId) || campaigns[0];

  const handleSave = () => {
    toast.success(`Configurações do Agente para "${selected.name}" salvas com sucesso!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Lista de Campanhas */}
        <Card className="h-fit border-border dark:border-zinc-800">
          <CardHeader className="p-4 pb-3 border-b border-border dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-indigo-500" />
                Campanhas Ativas ({campaigns.length})
              </span>
              <Badge variant="outline" className="text-[10px] font-bold text-indigo-600 border-indigo-500/30">
                Segmentado
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left rounded-xl p-3 border transition-all text-xs space-y-1 ${
                  c.id === selectedId
                    ? "border-indigo-500 bg-indigo-500/10 text-foreground font-semibold"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold truncate text-foreground">{c.name}</span>
                  <Badge variant={c.active ? "default" : "secondary"} className="text-[9px] px-1 py-0 shrink-0">
                    {c.active ? "Ativo" : "Pausado"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{c.channel} • {c.goal}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Editor de Agente da Campanha */}
        <Card className="border-border dark:border-zinc-800">
          <CardHeader className="pb-4 border-b border-border dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">{selected.name}</CardTitle>
                  <CardDescription className="text-xs">
                    Instruções personalizadas de qualificação aplicadas automaticamente a leads que responderem a esta campanha.
                  </CardDescription>
                </div>
              </div>
              <Button size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 h-8">
                <Save className="w-3.5 h-3.5" />
                Salvar Configuração
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Persona & Tom de Voz Específico da Campanha</Label>
              <Input
                value={selected.persona}
                onChange={(e) => {
                  const val = e.target.value;
                  setCampaigns((prev) =>
                    prev.map((c) => (c.id === selected.id ? { ...c, persona: val } : c))
                  );
                }}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Objetivo Central do Atendimento (Goal)</Label>
              <Textarea
                rows={2}
                value={selected.goal}
                onChange={(e) => {
                  const val = e.target.value;
                  setCampaigns((prev) =>
                    prev.map((c) => (c.id === selected.id ? { ...c, goal: val } : c))
                  );
                }}
                className="text-xs font-sans"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Perguntas Obrigatórias de Qualificação (SPIN)</Label>
              <div className="space-y-2">
                {selected.qualificationQuestions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground w-4">{idx + 1}.</span>
                    <Input value={q} readOnly className="text-xs bg-muted/40" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
