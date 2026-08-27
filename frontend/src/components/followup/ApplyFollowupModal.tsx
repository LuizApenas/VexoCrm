import { useEffect, useState } from "react";
import { Loader2, CalendarClock, Send, Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Modal "Aplicar Follow-up" — enrola os leads selecionados no Banco de Dados numa
// cadência de follow-up já configurada na aba Follow-up. A data-alvo (reunião, evento,
// pagamento) dirige os lembretes "antes/depois" da cadência.

export interface LeadForFollowup {
  id: string;
  nome: string | null;
  phone?: string | null;
  telefone?: string | null;
}

interface FollowupCompany {
  id: string;
  name: string;
  activeCampaigns?: number;
}

interface FollowupCadence {
  id: string;
  name: string;
  status: string;
}

interface FollowupStep {
  id: string;
  name: string | null;
  message: string;
  trigger_type: string;
  trigger_value: number;
  trigger_unit: string;
  order_index: number;
}

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  clientId: string;
  leads: LeadForFollowup[];
  apiBase: string;
  getToken: () => Promise<string | null>;
}

function unitLabel(unit: string) {
  if (unit === "minutes") return "min";
  if (unit === "hours") return "h";
  return "dias";
}

function toMs(value: number, unit: string) {
  const v = Number(value) || 0;
  if (unit === "minutes") return v * 60 * 1000;
  if (unit === "hours") return v * 60 * 60 * 1000;
  return v * 24 * 60 * 60 * 1000;
}

function formatDateTime(d: Date) {
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

function describeStep(step: FollowupStep) {
  switch (step.trigger_type) {
    case "on_schedule":
      return "na hora da inscrição (imediato)";
    case "after_enrollment":
      return `${step.trigger_value} ${unitLabel(step.trigger_unit)} após a inscrição (incondicional)`;
    case "no_reply":
      return `${step.trigger_value} ${unitLabel(step.trigger_unit)} após a inscrição (se sem resposta)`;
    case "before_meeting":
      return `${step.trigger_value} ${unitLabel(step.trigger_unit)} ANTES da data-alvo`;
    case "after_meeting":
      return `${step.trigger_value} ${unitLabel(step.trigger_unit)} DEPOIS da data-alvo`;
    default:
      return "";
  }
}

function getStepPreview(step: FollowupStep, meetingDatetime: string) {
  const deltaMs = toMs(step.trigger_value, step.trigger_unit);
  const now = new Date();

  if (step.trigger_type === "on_schedule") {
    return {
      type: "valid" as const,
      badge: "Imediato",
      message: "Disparo imediato ao aplicar.",
    };
  }

  if (step.trigger_type === "after_enrollment") {
    const target = new Date(now.getTime() + deltaMs);
    return {
      type: "valid" as const,
      badge: "Agendado",
      message: `Previsto para ${formatDateTime(target)} (${step.trigger_value} ${unitLabel(step.trigger_unit)} após inscrição).`,
    };
  }

  if (step.trigger_type === "no_reply") {
    const target = new Date(now.getTime() + deltaMs);
    return {
      type: "valid" as const,
      badge: "Condicional",
      message: `Previsto para ${formatDateTime(target)} (cancela se lead responder).`,
    };
  }

  if (step.trigger_type === "before_meeting" || step.trigger_type === "after_meeting") {
    if (!meetingDatetime) {
      return {
        type: "warning_no_date" as const,
        badge: "Sem data-alvo",
        message: "Exige data-alvo informada. Este passo será ignorado.",
      };
    }

    const meetingTime = new Date(meetingDatetime).getTime();
    if (isNaN(meetingTime)) {
      return {
        type: "warning_no_date" as const,
        badge: "Data inválida",
        message: "Data-alvo inválida.",
      };
    }

    const targetTime = step.trigger_type === "before_meeting" ? meetingTime - deltaMs : meetingTime + deltaMs;
    const targetDate = new Date(targetTime);

    if (targetDate.getTime() <= now.getTime()) {
      return {
        type: "warning_past" as const,
        badge: "Horário já passou",
        message: `Cairia em ${formatDateTime(targetDate)}, que já passou. Nenhuma mensagem será agendada.`,
      };
    }

    return {
      type: "valid" as const,
      badge: "Agendado",
      message: `Previsto para ${formatDateTime(targetDate)}.`,
    };
  }

  return {
    type: "valid" as const,
    badge: "Agendado",
    message: "",
  };
}

export default function ApplyFollowupModal({ open, onOpenChange, clientId, leads, apiBase, getToken }: Props) {
  const [companies, setCompanies] = useState<FollowupCompany[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [cadences, setCadences] = useState<FollowupCadence[]>([]);
  const [cadenceId, setCadenceId] = useState<string>("");
  const [steps, setSteps] = useState<FollowupStep[]>([]);
  const [meetingDatetime, setMeetingDatetime] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  async function authFetch(path: string, init: RequestInit = {}) {
    const token = await getToken();
    return fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  }

  // Carrega as empresas de follow-up do tenant ao abrir.
  useEffect(() => {
    if (!open) return;
    setCadenceId("");
    setSteps([]);
    setErrorDetails(null);
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/followup/companies?tenantId=${encodeURIComponent(clientId)}`);
        const body = await res.json();
        const list: FollowupCompany[] = body?.companies || [];
        setCompanies(list);
        setCompanyId(list.length === 1 ? list[0].id : "");
      } catch {
        toast.error("Falha ao carregar as empresas de follow-up.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, clientId]);

  // Carrega as cadências ativas da empresa selecionada.
  useEffect(() => {
    if (!companyId) {
      setCadences([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/followup/campaigns?companyId=${encodeURIComponent(companyId)}`);
        const body = await res.json();
        const active: FollowupCadence[] = (body?.campaigns || []).filter((c: FollowupCadence) => c.status === "active");
        setCadences(active);
        setCadenceId(active.length === 1 ? active[0].id : "");
      } catch {
        toast.error("Falha ao carregar as cadências.");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  // Carrega os passos da cadência selecionada (preview).
  useEffect(() => {
    if (!cadenceId) {
      setSteps([]);
      return;
    }
    (async () => {
      try {
        const res = await authFetch(`/api/followup/templates?campaignId=${encodeURIComponent(cadenceId)}`);
        const body = await res.json();
        setSteps((body?.templates || []).sort((a: FollowupStep, b: FollowupStep) => a.order_index - b.order_index));
      } catch {
        setSteps([]);
      }
    })();
  }, [cadenceId]);

  const stepPreviews = steps.map((s) => ({ step: s, preview: getStepPreview(s, meetingDatetime) }));
  const validStepsCount = stepPreviews.filter((p) => p.preview.type === "valid").length;
  const hasOnlySkippedSteps = steps.length > 0 && validStepsCount === 0;

  async function handleSubmit() {
    if (!cadenceId) {
      toast.error("Selecione uma cadência.");
      return;
    }
    setSubmitting(true);
    setErrorDetails(null);

    try {
      const payloadLeads = leads.map((lead) => ({
        name: lead.nome || "Lead",
        phone: lead.phone || lead.telefone || null,
      }));

      const res = await authFetch(`/api/followup/campaigns/${encodeURIComponent(cadenceId)}/enroll`, {
        method: "POST",
        body: JSON.stringify({
          leads: payloadLeads,
          meeting_datetime: meetingDatetime ? new Date(meetingDatetime).toISOString() : null,
          origin: "banco_dados",
        }),
      });

      const body = await res.json();

      // Erro retornado pela API (HTTP 4xx ou success=false)
      if (!res.ok || body?.success === false) {
        const primaryMsg = body?.error?.message || "Falha ao aplicar follow-up.";
        const leadErrors = Array.isArray(body?.errors) ? body.errors : [];
        const skippedList = Array.isArray(body?.skippedSteps) ? body.skippedSteps : [];

        let detailedMsg = primaryMsg;
        if (leadErrors.length > 0) {
          detailedMsg += " Motivos: " + leadErrors.map((e: any) => `${e.lead ? e.lead + ': ' : ''}${e.message}`).join("; ");
        } else if (skippedList.length > 0) {
          detailedMsg += " Passos ignorados: " + skippedList.map((s: any) => s.message).join("; ");
        }

        setErrorDetails(detailedMsg);
        toast.error(primaryMsg);
        return;
      }

      // Se enrolled = 0 ou enqueued = 0 mesmo com 200, NUNCA usar sucesso
      if (body.enrolled === 0 || body.enqueued === 0) {
        const errorMsg = body?.error?.message || "Nenhuma mensagem de follow-up foi agendada para os leads selecionados.";
        setErrorDetails(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Sucesso total ou parcial com mensagens agendadas
      const parts = [`${body.enrolled} lead(s) inscrito(s)`, `${body.enqueued} mensagem(ns) agendada(s)`];
      if (body.skippedPastDate) parts.push(`${body.skippedPastDate} passo(s) no passado`);
      if (body.skippedNoDate) parts.push(`${body.skippedNoDate} passo(s) sem data`);
      if (body.missingPhone) parts.push(`${body.missingPhone} sem telefone`);

      if (body.failed > 0 || body.skippedPastDate > 0 || body.missingPhone > 0) {
        toast.warning(parts.join(" · "));
      } else {
        toast.success(parts.join(" · "));
      }

      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao aplicar o follow-up.";
      setErrorDetails(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
            Aplicar Follow-up
          </DialogTitle>
          <DialogDescription>
            Inscrever {leads.length} lead(s) selecionado(s) numa cadência de follow-up. As mensagens
            saem automaticamente conforme as regras de cada passo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {errorDetails && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold">Não foi possível agendar</AlertTitle>
              <AlertDescription className="text-xs mt-1 leading-relaxed">
                {errorDetails}
              </AlertDescription>
            </Alert>
          )}

          {companies.length === 0 && !loading ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Nenhuma empresa de follow-up configurada para este tenant. Crie a empresa e uma
                cadência ativa na aba <strong>Follow-up</strong> primeiro.
              </span>
            </div>
          ) : null}

          {companies.length > 1 && (
            <div className="space-y-1.5">
              <Label>Empresa (WhatsApp)</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {companyId && (
            <div className="space-y-1.5">
              <Label>Cadência</Label>
              <Select value={cadenceId} onValueChange={setCadenceId} disabled={cadences.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={cadences.length ? "Selecionar cadência" : "Nenhuma cadência ativa"} />
                </SelectTrigger>
                <SelectContent>
                  {cadences.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {companyId && cadences.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground">
                  Sem cadência ativa. Crie e ative uma na aba Follow-up.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Data-alvo (reunião, evento, pagamento)</Label>
            <Input
              type="datetime-local"
              value={meetingDatetime}
              onChange={(e) => setMeetingDatetime(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Opcional. Necessária apenas para passos "antes/depois da data-alvo". Passos calculados a partir da inscrição saem sem depender deste campo.
            </p>
          </div>

          {steps.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Passos desta cadência ({steps.length}):</p>
                {validStepsCount > 0 ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {validStepsCount} passo(s) apto(s)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <AlertTriangle className="h-3 w-3" /> 0 passos aptos
                  </Badge>
                )}
              </div>

              <ol className="space-y-2 text-xs">
                {stepPreviews.map(({ step, preview }, index) => {
                  const isWarning = preview.type !== "valid";
                  return (
                    <li
                      key={step.id}
                      className={`flex flex-col gap-1 p-2 rounded-md border transition-colors ${
                        isWarning
                          ? "bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-200"
                          : "bg-background/60 border-border/80 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                            {index + 1}
                          </span>
                          <span className="truncate">{step.name || "Mensagem"}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 shrink-0 ${
                            preview.type === "warning_past"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                              : preview.type === "warning_no_date"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          }`}
                        >
                          {preview.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Regra: {describeStep(step)}
                      </p>
                      <p
                        className={`text-[11px] ${
                          preview.type === "warning_past"
                            ? "text-rose-600 dark:text-rose-400 font-medium"
                            : preview.type === "warning_no_date"
                            ? "text-amber-600 dark:text-amber-400 font-medium"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {preview.message}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {hasOnlySkippedSteps && (
                <div className="flex items-start gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Atenção: Nenhum passo será agendado com os parâmetros atuais. Ajuste a data-alvo ou use passos baseados em "depois da inscrição".
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading || !cadenceId || hasOnlySkippedSteps}
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Aplicar a {leads.length} lead(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
