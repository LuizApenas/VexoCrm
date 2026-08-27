import React, { useState, useMemo, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  Sparkles,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Send,
  Loader2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateStandaloneReminder } from "@/hooks/useFollowupQueue";

export interface LeadReminderTarget {
  id?: string;
  nome?: string | null;
  name?: string | null;
  phone?: string | null;
  telefone?: string | null;
}

interface SingleFollowupReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadReminderTarget | null;
  companyId?: string;
  tenantId?: string;
}

// Formata uma data para o input datetime-local no fuso local (YYYY-MM-DDTHH:mm)
function formatLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Atalhos de cálculo de data/hora
function getShortcutDates() {
  const now = new Date();

  // 1. Em 1 hora
  const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);

  // 2. Hoje às 18h (se já passou das 18h, amanhã às 18h)
  const today18h = new Date(now);
  today18h.setHours(18, 0, 0, 0);
  if (today18h.getTime() <= now.getTime()) {
    today18h.setDate(today18h.getDate() + 1);
  }

  // 3. Amanhã às 9h
  const tomorrow9h = new Date(now);
  tomorrow9h.setDate(tomorrow9h.getDate() + 1);
  tomorrow9h.setHours(9, 0, 0, 0);

  // 4. Em 2 dias às 9h
  const in2Days = new Date(now);
  in2Days.setDate(in2Days.getDate() + 2);
  in2Days.setHours(9, 0, 0, 0);

  // 5. Próxima segunda-feira às 9h
  const nextMonday = new Date(now);
  const dayOfWeek = nextMonday.getDay(); // 0 = Domingo, 1 = Segunda, ...
  const daysUntilMonday = ((1 + 7 - dayOfWeek) % 7) || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);

  return [
    { label: "Em 1 hora", date: in1Hour },
    { label: today18h.getDate() === now.getDate() ? "Hoje às 18h" : "Amanhã às 18h", date: today18h },
    { label: "Amanhã às 9h", date: tomorrow9h },
    { label: "Em 2 dias", date: in2Days },
    { label: "Próxima segunda às 9h", date: nextMonday },
  ];
}

export function SingleFollowupReminderModal({
  open,
  onOpenChange,
  lead,
  companyId,
  tenantId,
}: SingleFollowupReminderModalProps) {
  const { mutateAsync: createReminder, isPending } = useCreateStandaloneReminder();

  // Dados do lead
  const leadName = lead?.nome || lead?.name || "Lead";
  const rawPhone = lead?.phone || lead?.telefone || "";
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const hasValidPhone = phoneDigits.length >= 10;

  // Estado do formulário
  const [selectedShortcutIndex, setSelectedShortcutIndex] = useState<number | null>(null);
  const [dateTime, setDateTime] = useState<string>(() => {
    const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
    return formatLocalDateTime(defaultDate);
  });
  const [message, setMessage] = useState<string>(
    "Olá {{nome}}, tudo bem? Passando para saber se conseguiu dar uma olhada na proposta!"
  );

  // Reseta estado quando o modal abre para um novo lead
  useEffect(() => {
    if (open) {
      const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
      setSelectedShortcutIndex(null);
      setDateTime(formatLocalDateTime(defaultDate));
      setMessage("Olá {{nome}}, tudo bem? Passando para saber se conseguiu dar uma olhada na proposta!");
    }
  }, [open, lead?.id]);

  // Atalhos calculados
  const shortcuts = useMemo(() => getShortcutDates(), [open]);

  // Validação de horário no passado
  const targetDate = useMemo(() => {
    if (!dateTime) return null;
    const d = new Date(dateTime);
    return isNaN(d.getTime()) ? null : d;
  }, [dateTime]);

  const isPast = Boolean(targetDate && targetDate.getTime() <= Date.now());

  // Cálculo da prévia do texto substituído
  const previewText = useMemo(() => {
    if (!message) return "";
    let rendered = message;
    const firstName = leadName.split(" ")[0] || leadName;
    rendered = rendered.replace(/\{\{\s*(nome|lead_name|name)\s*\}\}/gi, firstName);
    rendered = rendered.replace(/\{\{\s*(telefone|phone|celular)\s*\}\}/gi, rawPhone || "(telefone)");
    rendered = rendered.replace(/\{\{\s*(scheduling_link|link|agendamento)\s*\}\}/gi, "https://vexo.com.br/agenda");
    return rendered;
  }, [message, leadName, rawPhone]);

  // Tempo relativo até o disparo
  const relativeTimeLabel = useMemo(() => {
    if (!targetDate || isPast) return null;
    const diffMs = targetDate.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes < 60) return `em ${diffMinutes} minuto(s)`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `em ${diffHours} hora(s)`;
    const diffDays = Math.round(diffHours / 24);
    return `em ${diffDays} dia(s)`;
  }, [targetDate, isPast]);

  // Inserção de variáveis no texto
  const handleInsertVariable = (token: string) => {
    setMessage((prev) => {
      if (prev.endsWith(" ") || prev === "") return prev + token + " ";
      return prev + " " + token + " ";
    });
  };

  // Submissão
  const handleSubmit = async () => {
    if (!hasValidPhone) {
      toast.error("Lead sem telefone válido. Forneça um número com DDD.");
      return;
    }
    if (!message.trim()) {
      toast.error("Digite a mensagem do lembrete.");
      return;
    }
    if (!targetDate || isPast) {
      toast.error("Esse horário já passou. Escolha um momento futuro.");
      return;
    }

    try {
      // Envia o ISO string UTC exato (ex: 2026-08-28T12:00:00.000Z)
      const scheduledFor = targetDate.toISOString();
      await createReminder({
        leadName,
        phone: rawPhone,
        scheduledFor,
        message: message.trim(),
        companyId,
        tenantId,
      });

      const formattedHour = targetDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const formattedDate = targetDate.toLocaleDateString("pt-BR");

      toast.success(`Lembrete agendado para ${formattedDate} às ${formattedHour}!`, {
        description: `Mensagem agendada para ${leadName} (${rawPhone}).`,
      });

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao agendar lembrete avulso.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Lembrete Avulso para Lead</DialogTitle>
              <DialogDescription className="text-xs">
                Dispare uma mensagem pontual para este lead na data e hora exatas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1 text-sm">
          {/* Card do Lead */}
          <div className="p-3 rounded-xl border border-border/70 bg-muted/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Destinatário</span>
              <div className="font-semibold text-foreground">{leadName}</div>
            </div>
            <div className="text-right">
              {hasValidPhone ? (
                <Badge variant="outline" className="gap-1 font-mono text-xs text-foreground bg-background">
                  <Phone className="w-3 h-3 text-emerald-500" />
                  {rawPhone}
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="w-3 h-3" />
                  Sem Telefone
                </Badge>
              )}
            </div>
          </div>

          {!hasValidPhone && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este lead não possui um número de WhatsApp cadastrado. O agendamento está bloqueado.
              </AlertDescription>
            </Alert>
          )}

          {/* 1. QUANDO */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              1. Quando Enviar (Data e Hora)
            </Label>

            {/* Atalhos Rápidos de 1 Clique */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {shortcuts.map((sc, i) => {
                const formatted = formatLocalDateTime(sc.date);
                const isSelected = selectedShortcutIndex === i;
                return (
                  <Button
                    key={i}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (selectedShortcutIndex === i) {
                        setSelectedShortcutIndex(null);
                      } else {
                        setSelectedShortcutIndex(i);
                        setDateTime(formatted);
                      }
                    }}
                    className={`h-7 px-2.5 text-xs font-medium rounded-lg transition-all ${
                      isSelected
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                        : "border-border/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Zap className="w-3 h-3 mr-1 text-amber-500" />
                    {sc.label}
                  </Button>
                );
              })}
            </div>

            {/* Seletor Manual */}
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => {
                setSelectedShortcutIndex(null);
                setDateTime(e.target.value);
              }}
              className="w-full h-9 px-3 py-1.5 text-xs rounded-xl border border-input bg-background font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            {/* Validação de Horário no Passado */}
            {isPast && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900/50">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Esse horário já passou. Escolha um momento futuro.</span>
              </div>
            )}
          </div>

          {/* 2. MENSAGEM */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                2. Mensagem do Lembrete
              </Label>
              <span className="text-[10px] text-muted-foreground">Suporta variáveis automáticas</span>
            </div>

            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem do WhatsApp..."
              className="text-xs resize-none rounded-xl"
            />

            {/* Variáveis Clicáveis */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Inserir variável:</span>
              {[
                { token: "{{nome}}", label: "Nome do Lead" },
                { token: "{{telefone}}", label: "Telefone" },
                { token: "{{scheduling_link}}", label: "Link de Agenda" },
              ].map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => handleInsertVariable(v.token)}
                  className="px-2 py-0.5 text-[11px] font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded-md border border-indigo-200/60 dark:border-indigo-800 transition-colors"
                >
                  +{v.token}
                </button>
              ))}
            </div>
          </div>

          {/* 3. PRÉVIA EM TEMPO REAL */}
          <div className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                3. Prévia Real do Envio
              </span>
              {targetDate && !isPast && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  {relativeTimeLabel}
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-background border border-border/80 text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed shadow-sm">
              {previewText || <span className="text-muted-foreground italic">Nenhuma mensagem digitada...</span>}
            </div>

            {targetDate && !isPast && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-indigo-500" />
                <span>
                  Envio previsto para{" "}
                  <strong className="text-foreground font-semibold">
                    {targetDate.toLocaleDateString("pt-BR")} às{" "}
                    {targetDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !hasValidPhone || isPast || !message.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs font-semibold shadow-sm"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Confirmar Lembrete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SingleFollowupReminderModal;
