import { useEffect, useState } from "react";
import { Loader2, CalendarClock, Send, Info } from "lucide-react";
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

function describeStep(step: FollowupStep) {
  switch (step.trigger_type) {
    case "on_schedule":
      return "na entrada do lead";
    case "before_meeting":
      return `${step.trigger_value} ${unitLabel(step.trigger_unit)} ANTES da data-alvo`;
    case "after_meeting":
      return `${step.trigger_value} ${unitLabel(step.trigger_unit)} DEPOIS da data-alvo`;
    case "no_reply":
      return `${step.trigger_value} ${unitLabel(step.trigger_unit)} após entrada (se sem resposta)`;
    default:
      return "";
  }
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

  const needsDate = steps.some((s) => s.trigger_type === "before_meeting" || s.trigger_type === "after_meeting");
  const dateMissing = needsDate && !meetingDatetime;

  async function handleSubmit() {
    if (!cadenceId) {
      toast.error("Selecione uma cadência.");
      return;
    }
    setSubmitting(true);
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
      if (!res.ok || body?.success === false) {
        throw new Error(body?.error?.message || "Falha ao aplicar o follow-up.");
      }
      const parts = [`${body.enrolled} lead(s) enrolado(s)`, `${body.enqueued} mensagem(ns) agendada(s)`];
      if (body.missingPhone) parts.push(`${body.missingPhone} sem telefone`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar o follow-up.");
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
            Enrolar {leads.length} lead(s) selecionado(s) numa cadência de follow-up. As mensagens
            saem automaticamente conforme os passos da cadência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <p className="text-xs text-muted-foreground">
              Opcional. Necessária para passos do tipo "antes/depois da data" — é a partir dela
              que os lembretes são calculados.
            </p>
          </div>

          {steps.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Passos desta cadência:</p>
              <ol className="space-y-1.5 text-xs text-muted-foreground">
                {steps.map((step, index) => (
                  <li key={step.id} className="flex gap-2">
                    <Badge variant="outline" className="h-5 shrink-0">{index + 1}</Badge>
                    <span>
                      <strong>{step.name || "Mensagem"}</strong> — {describeStep(step)}
                    </span>
                  </li>
                ))}
              </ol>
              {dateMissing && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sem data-alvo, os passos "antes/depois da data" serão ignorados.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loading || !cadenceId}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Aplicar a {leads.length} lead(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
