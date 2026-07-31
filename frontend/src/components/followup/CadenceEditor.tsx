import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Play, Pause, Loader2, MessageSquarePlus, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFupCampaigns,
  useCreateFupCampaign,
  useUpdateFupCampaign,
  useDeleteFupCampaign,
  useFupTemplates,
  useCreateFupTemplate,
  useDeleteFupTemplate,
  useReorderFupTemplates,
  type FupTemplate,
} from "@/hooks/useFollowupAdmin";

// Editor de cadências de follow-up (objetivo: dar onde criar as cadências reutilizáveis
// que o Banco de Dados aplica). Uma cadência = passos (templates), cada passo = mensagem +
// quando enviar (na entrada, X antes/depois da data-alvo, ou X após a entrada sem resposta).

type TriggerType = FupTemplate["trigger_type"];

const TRIGGER_OPTIONS: { value: TriggerType; label: string; needsValue: boolean }[] = [
  { value: "on_schedule", label: "Na entrada do lead", needsValue: false },
  { value: "before_meeting", label: "Antes da data-alvo", needsValue: true },
  { value: "after_meeting", label: "Depois da data-alvo", needsValue: true },
  { value: "no_reply", label: "Após a entrada (se sem resposta)", needsValue: true },
];

function unitLabel(unit: string) {
  if (unit === "minutes") return "min";
  if (unit === "hours") return "h";
  return "dias";
}

function describeStep(step: FupTemplate) {
  const opt = TRIGGER_OPTIONS.find((o) => o.value === step.trigger_type);
  if (!opt) return "";
  if (!opt.needsValue) return opt.label;
  return `${step.trigger_value} ${unitLabel(step.trigger_unit)} — ${opt.label}`;
}

export default function CadenceEditor({ companyId }: { companyId: string }) {
  const validCompany = companyId && companyId !== "all" ? companyId : "";
  const { data: cadences = [], isLoading } = useFupCampaigns(validCompany || undefined);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newCadenceName, setNewCadenceName] = useState("");

  const createCadence = useCreateFupCampaign();
  const updateCadence = useUpdateFupCampaign();
  const deleteCadence = useDeleteFupCampaign();

  const selected = cadences.find((c) => c.id === selectedId) || null;
  const { data: steps = [] } = useFupTemplates(selectedId || undefined);
  const orderedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);

  const createStep = useCreateFupTemplate();
  const deleteStep = useDeleteFupTemplate();
  const reorderSteps = useReorderFupTemplates();

  // Form de novo passo
  const [stepName, setStepName] = useState("");
  const [stepMessage, setStepMessage] = useState("");
  const [stepTrigger, setStepTrigger] = useState<TriggerType>("before_meeting");
  const [stepValue, setStepValue] = useState<number>(1);
  const [stepUnit, setStepUnit] = useState<"minutes" | "hours" | "days">("days");

  const triggerOpt = TRIGGER_OPTIONS.find((o) => o.value === stepTrigger)!;

  if (!validCompany) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Selecione uma empresa (WhatsApp) no topo para gerenciar as cadências.
        </CardContent>
      </Card>
    );
  }

  async function handleCreateCadence() {
    const name = newCadenceName.trim();
    if (!name) return;
    try {
      const created = await createCadence.mutateAsync({ company_id: validCompany, name });
      setNewCadenceName("");
      setSelectedId(created.id);
      toast.success("Cadência criada. Adicione os passos e ative.");
    } catch {
      toast.error("Falha ao criar a cadência.");
    }
  }

  async function toggleActive() {
    if (!selected) return;
    const next = selected.status === "active" ? "paused" : "active";
    try {
      await updateCadence.mutateAsync({ id: selected.id, company_id: validCompany, status: next });
      toast.success(next === "active" ? "Cadência ativada." : "Cadência pausada.");
    } catch {
      toast.error("Falha ao atualizar a cadência.");
    }
  }

  async function removeCadence() {
    if (!selected) return;
    if (!["draft", "archived"].includes(selected.status)) {
      toast.error("Só dá para excluir cadência em rascunho ou arquivada. Pause e arquive antes.");
      return;
    }
    try {
      await deleteCadence.mutateAsync({ id: selected.id, company_id: validCompany });
      setSelectedId("");
      toast.success("Cadência excluída.");
    } catch {
      toast.error("Falha ao excluir.");
    }
  }

  async function addStep() {
    if (!selected) return;
    if (!stepMessage.trim()) {
      toast.error("Escreva a mensagem do passo.");
      return;
    }
    try {
      await createStep.mutateAsync({
        campaign_id: selected.id,
        name: stepName.trim() || `Passo ${orderedSteps.length + 1}`,
        message: stepMessage.trim(),
        trigger_type: stepTrigger,
        trigger_value: triggerOpt.needsValue ? Number(stepValue) || 0 : 0,
        trigger_unit: stepUnit,
        trigger_direction: stepTrigger === "before_meeting" ? "before" : stepTrigger === "after_meeting" ? "after" : null,
        is_active: true,
        order_index: orderedSteps.length,
      });
      setStepName("");
      setStepMessage("");
      toast.success("Passo adicionado.");
    } catch {
      toast.error("Falha ao adicionar o passo.");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= orderedSteps.length || !selected) return;
    const reordered = [...orderedSteps];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await reorderSteps.mutateAsync({
        campaign_id: selected.id,
        items: reordered.map((s, i) => ({ id: s.id, order_index: i })),
      });
    } catch {
      toast.error("Falha ao reordenar.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Lista de cadências */}
      <Card className="h-fit">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nome da nova cadência"
              value={newCadenceName}
              onChange={(e) => setNewCadenceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCadence()}
            />
            <Button size="icon" onClick={handleCreateCadence} disabled={createCadence.isPending || !newCadenceName.trim()}>
              <ListPlus className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando…</p>
          ) : cadences.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma cadência ainda. Crie a primeira acima.</p>
          ) : (
            <div className="space-y-1">
              {cadences.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    c.id === selectedId ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{c.name}</span>
                    <Badge variant={c.status === "active" ? "default" : "outline"} className="text-[10px]">
                      {c.status === "active" ? "ativa" : c.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.totalLeads} leads · {c.messagesSent} envios</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor da cadência selecionada */}
      {!selected ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Selecione ou crie uma cadência para montar os passos.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">{selected.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {orderedSteps.length} passo(s) · status: {selected.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleActive} disabled={updateCadence.isPending}>
                  {selected.status === "active" ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                  {selected.status === "active" ? "Pausar" : "Ativar"}
                </Button>
                <Button variant="ghost" size="icon" onClick={removeCadence} disabled={deleteCadence.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Passos existentes */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold">Passos da cadência</p>
              {orderedSteps.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum passo. Adicione o primeiro abaixo.</p>
              ) : (
                orderedSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <Badge variant="outline" className="mt-0.5 shrink-0">{index + 1}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{step.name || "Mensagem"}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">{describeStep(step)}</p>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">{step.message}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(index, -1)} disabled={index === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(index, 1)} disabled={index === orderedSteps.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteStep.mutateAsync({ id: step.id, campaign_id: selected.id }).catch(() => toast.error("Falha ao excluir passo."))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Novo passo */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4" /> Adicionar passo (lembrete)
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome (opcional)</Label>
                <Input value={stepName} onChange={(e) => setStepName(e.target.value)} placeholder="Ex: Lembrete 3 dias antes" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  value={stepMessage}
                  onChange={(e) => setStepMessage(e.target.value)}
                  placeholder="Use {{nome}} para personalizar. Ex: Oi {{nome}}, passando para lembrar da nossa reunião!"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Quando enviar</Label>
                  <Select value={stepTrigger} onValueChange={(v) => setStepTrigger(v as TriggerType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {triggerOpt.needsValue && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quanto</Label>
                      <Input type="number" min={0} value={stepValue} onChange={(e) => setStepValue(Number(e.target.value))} className="w-24" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Unidade</Label>
                      <Select value={stepUnit} onValueChange={(v) => setStepUnit(v as "minutes" | "hours" | "days")}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">minutos</SelectItem>
                          <SelectItem value="hours">horas</SelectItem>
                          <SelectItem value="days">dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dica: para "vários lembretes até o dia marcado", crie passos "Antes da data-alvo" com 7, 3 e 1 dia.
              </p>
              <Button onClick={addStep} disabled={createStep.isPending || !stepMessage.trim()} className="w-full sm:w-auto">
                {createStep.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Adicionar passo
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
