import { useState, useEffect } from "react";
import { Clock, Globe, Calendar, Bot, ShieldCheck, Check, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  type LeadClient,
  useUpdateLeadClientN8nSettings,
} from "@/hooks/useLeadClients";
import {
  BRAZIL_TIMEZONES,
  WEEKDAYS_ORDER,
  WEEKDAY_LABELS,
  resolveSendWindowConfig,
  isWithinSendWindow,
  formatSendWindowNotice,
} from "@/lib/sendWindow";

interface Props {
  tenant: LeadClient;
  canEdit?: boolean;
}

export function SendWindowSettings({ tenant, canEdit = true }: Props) {
  const updateSettings = useUpdateLeadClientN8nSettings();
  const n8n = tenant.n8n_settings;

  const initialConfig = resolveSendWindowConfig(n8n);

  const [enabled, setEnabled] = useState<boolean>(initialConfig.enabled);
  const [start, setStart] = useState<string>(initialConfig.start);
  const [end, setEnd] = useState<string>(initialConfig.end);
  const [days, setDays] = useState<string[]>(initialConfig.days);
  const [timezone, setTimezone] = useState<string>(initialConfig.timezone);
  const [agentRepliesOutside, setAgentRepliesOutside] = useState<boolean>(initialConfig.agentRepliesOutsideWindow);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const config = resolveSendWindowConfig(tenant.n8n_settings);
    setEnabled(config.enabled);
    setStart(config.start);
    setEnd(config.end);
    setDays(config.days);
    setTimezone(config.timezone);
    setAgentRepliesOutside(config.agentRepliesOutsideWindow);
  }, [tenant.id, tenant.n8n_settings]);

  const currentWindowConfig = {
    enabled,
    start,
    end,
    days,
    timezone,
    agentRepliesOutsideWindow: agentRepliesOutside,
  };

  const isCurrentlyOpen = isWithinSendWindow(new Date(), currentWindowConfig);

  const toggleDay = (dayKey: string) => {
    if (!canEdit) return;
    if (days.includes(dayKey)) {
      if (days.length === 1) {
        toast({
          title: "Atenção",
          description: "Selecione pelo menos um dia da semana para envio.",
          variant: "destructive",
        });
        return;
      }
      setDays(days.filter((d) => d !== dayKey));
    } else {
      setDays([...days, dayKey]);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync({
        tenantId: tenant.id,
        sendWindowStart: start,
        sendWindowEnd: end,
        sendWindowDays: days,
        sendWindowTimezone: timezone,
        sendWindowEnabled: enabled,
        agentRepliesOutsideWindow: agentRepliesOutside,
      });

      toast({
        title: "Janela de envio atualizada",
        description: `Configurações de horário salvas com sucesso para ${tenant.name || tenant.id}.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Não foi possível salvar os horários de envio.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border border-border/80 shadow-sm bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Janela de Horário Permitido para Envio</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Limite os horários e dias em que o CRM pode disparar mensagens ativas para evitar banimento e incômodo de leads fora do horário comercial.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {enabled ? (
              <Badge variant={isCurrentlyOpen ? "default" : "secondary"} className={isCurrentlyOpen ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"}>
                {isCurrentlyOpen ? "● Janela Aberta Agora" : "○ Janela Fechada Agora"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Trava Desativada (24/7)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Toggle principal */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/60">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="send-window-toggle" className="text-sm font-medium cursor-pointer">
              Ativar Trava de Janela de Horário
            </Label>
            <p className="text-xs text-muted-foreground">
              Bloqueia disparos de campanhas, lembretes e cadências fora da faixa configurada abaixo.
            </p>
          </div>
          <Switch
            id="send-window-toggle"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canEdit}
          />
        </div>

        {enabled && (
          <div className="space-y-5 animate-in fade-in-50 duration-200">
            {/* Faixa de Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-xs font-medium text-muted-foreground">
                  Horário de Início (Disparos iniciam a partir de)
                </Label>
                <div className="relative">
                  <Input
                    id="start-time"
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    disabled={!canEdit}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-time" className="text-xs font-medium text-muted-foreground">
                  Horário de Término (Disparos encerram às)
                </Label>
                <div className="relative">
                  <Input
                    id="end-time"
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    disabled={!canEdit}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium text-muted-foreground">Dias da Semana Permitidos</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS_ORDER.map((dayKey) => {
                  const isSelected = days.includes(dayKey);
                  const isWeekend = dayKey === "sat" || dayKey === "sun";
                  return (
                    <Button
                      key={dayKey}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(dayKey)}
                      disabled={!canEdit}
                      className={`text-xs px-3 py-1.5 h-8 font-medium transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground bg-background"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 mr-1" />}
                      {WEEKDAY_LABELS[dayKey]?.short || dayKey}
                      {isWeekend && !isSelected && <span className="ml-1 text-[10px] opacity-60">(opcional)</span>}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Fuso Horário */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="timezone-select" className="text-xs font-medium text-muted-foreground">
                  Fuso Horário de Referência do Tenant
                </Label>
              </div>
              <Select value={timezone} onValueChange={setTimezone} disabled={!canEdit}>
                <SelectTrigger id="timezone-select" className="text-xs">
                  <SelectValue placeholder="Selecione o fuso horário" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZIL_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value} className="text-xs">
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Agente IA responde fora da janela */}
            <div className="flex items-start justify-between p-3.5 rounded-lg bg-primary/5 border border-primary/20 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-primary" />
                  <Label htmlFor="agent-replies-toggle" className="text-sm font-medium cursor-pointer text-foreground">
                    Agente IA responde fora da janela
                  </Label>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                    Recomendado
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se um lead escrever para a sua empresa às 22h, ele espera resposta imediata. Mantenha ligado para que o Agente responda na hora sem ficar em silêncio.
                </p>
              </div>
              <Switch
                id="agent-replies-toggle"
                checked={agentRepliesOutside}
                onCheckedChange={setAgentRepliesOutside}
                disabled={!canEdit}
              />
            </div>
          </div>
        )}

        {/* Botão de Salvar */}
        {canEdit && (
          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 text-xs font-medium"
            >
              {isSaving ? "Salvando..." : "Salvar Configurações de Horário"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SendWindowSettings;
