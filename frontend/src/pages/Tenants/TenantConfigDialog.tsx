import { useState } from "react";
import {
  Database,
  Save,
  Trash2,
  ShieldCheck,
  Megaphone,
  Zap,
  Sparkles,
  Layers,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  Smartphone,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  LeadClient,
  useDeleteLeadClient,
  useUpdateLeadClientN8nSettings,
  useVerifyLeadClientTable,
  type LeadClientTableStatus,
} from "@/hooks/useLeadClients";

interface TenantConfigDialogProps {
  tenant: LeadClient | null;
  onClose: () => void;
  tableStatuses: Record<string, LeadClientTableStatus>;
  setTableStatuses: React.Dispatch<React.SetStateAction<Record<string, LeadClientTableStatus>>>;
}

export function TenantConfigDialog({
  tenant,
  onClose,
  tableStatuses,
  setTableStatuses,
}: TenantConfigDialogProps) {
  const { hasPermission, isAdminUser } = useAuth();
  const deleteTenant = useDeleteLeadClient();
  const updateN8nSettings = useUpdateLeadClientN8nSettings();
  const verifyTenantTable = useVerifyLeadClientTable();
  const [tenantPendingDelete, setTenantPendingDelete] = useState<string | null>(null);

  const [n8nDrafts, setN8nDrafts] = useState<
    Record<
      string,
      {
        planTier?: "essencial" | "avancado";
        modulosAvulsos?: string[];
        degustacaoExpiraEm?: string | null;
        degustacaoDiasInput?: string;
      }
    >
  >({});

  const canManageTenants = hasPermission("tenants.manage");
  const canManageN8n = isAdminUser;

  const updateTenantN8nDraft = (
    tenantId: string,
    patch: {
      planTier?: "essencial" | "avancado";
      modulosAvulsos?: string[];
      degustacaoExpiraEm?: string | null;
      degustacaoDiasInput?: string;
    }
  ) => {
    setN8nDrafts((current) => ({
      ...current,
      [tenantId]: {
        ...current[tenantId],
        ...patch,
      },
    }));
  };

  const getTenantN8nDraft = (tenant: LeadClient) => {
    const draft = n8nDrafts[tenant.id] || {};
    const rawTier =
      draft.planTier ??
      tenant.n8n_settings?.plan_tier ??
      (tenant as any).model_type ??
      (tenant as any).plan_type ??
      "essencial";
    const planTier: "essencial" | "avancado" =
      String(rawTier).toLowerCase() === "avancado" ? "avancado" : "essencial";

    const modulosAvulsos =
      draft.modulosAvulsos ??
      tenant.n8n_settings?.modulos_avulsos ??
      (tenant as any).modulos_avulsos ??
      [];

    const degustacaoExpiraEm =
      draft.degustacaoExpiraEm !== undefined
        ? draft.degustacaoExpiraEm
        : tenant.n8n_settings?.degustacao_expira_em ?? null;

    let defaultDays = "";
    if (draft.degustacaoDiasInput !== undefined) {
      defaultDays = draft.degustacaoDiasInput;
    } else if (degustacaoExpiraEm) {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(degustacaoExpiraEm).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );
      defaultDays = remaining > 0 ? String(remaining) : "0";
    }

    return {
      planTier,
      modulosAvulsos,
      degustacaoExpiraEm,
      degustacaoDiasInput: defaultDays,
    };
  };

  const handleSetDegustacaoDays = (tenantId: string, days: number | null) => {
    if (days === null || days <= 0) {
      updateTenantN8nDraft(tenantId, {
        degustacaoExpiraEm: null,
        degustacaoDiasInput: "",
      });
    } else {
      const expDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      updateTenantN8nDraft(tenantId, {
        degustacaoExpiraEm: expDate,
        degustacaoDiasInput: String(days),
      });
    }
  };

  const handleSaveTenantN8n = async (tenant: LeadClient) => {
    const draft = getTenantN8nDraft(tenant);

    try {
      await updateN8nSettings.mutateAsync({
        tenantId: tenant.id,
        planTier: draft.planTier,
        plan_tier: draft.planTier,
        modulosAvulsos: draft.modulosAvulsos,
        modulos_avulsos: draft.modulosAvulsos,
        degustacaoExpiraEm: draft.degustacaoExpiraEm,
        degustacao_expira_em: draft.degustacaoExpiraEm,
      });

      setN8nDrafts((current) => ({
        ...current,
        [tenant.id]: {
          planTier: draft.planTier,
          modulosAvulsos: draft.modulosAvulsos,
          degustacaoExpiraEm: draft.degustacaoExpiraEm,
          degustacaoDiasInput: draft.degustacaoDiasInput,
        },
      }));

      toast({
        title: "Configurações da empresa atualizadas",
        description: `O plano e os módulos da empresa ${tenant.name} foram salvos com sucesso.`,
      });
    } catch (settingsError) {
      toast({
        title: "Falha ao salvar configurações",
        description:
          settingsError instanceof Error
            ? settingsError.message
            : "Não foi possível atualizar a configuração do plano.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTenant = async (tenant: { id: string; name: string }) => {
    try {
      await deleteTenant.mutateAsync(tenant.id);

      toast({
        title: "Empresa excluída",
        description: `A empresa ${tenant.name} foi removida do cadastro.`,
      });

      setTenantPendingDelete(null);
      onClose();
    } catch (deleteError) {
      toast({
        title: "Não foi possível excluir",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "O tenant não pode ser removido agora.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyTenantTable = async (tenant: LeadClient) => {
    try {
      const status = await verifyTenantTable.mutateAsync(tenant.id);
      setTableStatuses((current) => ({
        ...current,
        [tenant.id]: status,
      }));
      toast({
        title: status.exists ? "Tabela encontrada" : "Tabela não encontrada",
        description: status.exists
          ? `${status.tableName} existe com ${status.columns?.length || 0} colunas.`
          : `A tabela ${status.tableName} não existe no banco.`,
        variant: status.exists ? "default" : "destructive",
      });
    } catch (statusError) {
      toast({
        title: "Falha ao verificar tabela",
        description:
          statusError instanceof Error
            ? statusError.message
            : "Não foi possível consultar o status da tabela.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={tenant !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {tenant && (() => {
        const draft = getTenantN8nDraft(tenant);
        const tableStatus = tableStatuses[tenant.id] || tenant.leads_table;
        const expectedTableName = tableStatus?.tableName || `leads_${tenant.id.replace(/-/g, "_")}`;

        const isExpired = draft.degustacaoExpiraEm
          ? new Date(draft.degustacaoExpiraEm).getTime() < Date.now()
          : false;

        const remainingDays = draft.degustacaoExpiraEm
          ? Math.max(
              0,
              Math.ceil((new Date(draft.degustacaoExpiraEm).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            )
          : null;

        return (
          <DialogContent className="max-h-[92vh] max-w-[95vw] md:max-w-4xl lg:max-w-4xl w-full overflow-y-auto p-0 border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#0b0e1a] dark:text-white">
            <DialogHeader className="space-y-1 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <span>Configurações de {tenant.name}</span>
                    <Badge className="border border-cyan-400/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200 text-[10px] font-mono">
                      {tenant.id}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Gerencie o plano contratado, prazo de degustação de módulos avançados e banco de dados.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-6 space-y-6">
              {/* Card 1: Plano Geral & Módulos Avulsos / Degustação */}
              {canManageN8n ? (
                <div className="space-y-5 rounded-xl border border-purple-500/20 bg-purple-500/[0.02] p-5 dark:border-purple-500/30 dark:bg-purple-950/10 shadow-sm">
                  <div className="pb-3 border-b border-slate-200/60 dark:border-white/5 flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        Plano da Empresa & Módulos em Degustação
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Defina o plano base e libere recursos avançados em teste com expiração automática.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                      disabled={updateN8nSettings.isPending}
                      onClick={() => void handleSaveTenantN8n(tenant)}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {updateN8nSettings.isPending ? "Salvando..." : "Salvar Configurações"}
                    </Button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {/* Seletor do Plano Geral */}
                    <div className="space-y-3 p-4 rounded-xl border border-slate-200/80 bg-white dark:border-white/5 dark:bg-black/20">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Plano Principal
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Usuários herdam automaticamente as permissões do plano.
                        </p>
                      </div>
                      <Select
                        value={draft.planTier}
                        onValueChange={(val: "essencial" | "avancado") =>
                          updateTenantN8nDraft(tenant.id, { planTier: val })
                        }
                      >
                        <SelectTrigger className="w-full text-xs font-semibold h-10 rounded-lg">
                          <SelectValue placeholder="Selecione o plano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="essencial">
                            🟢 Plano Essencial — Base (Dashboard, Leads, Banco de Dados, Conversas, Disparos, IA Inbound, Follow-up)
                          </SelectItem>
                          <SelectItem value="avancado">
                            🟣 Plano Avançado — Completo (Base RAG, Automações Follow-up, SDR Broadcast, Múltiplos Chips, Origens)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        {draft.planTier === "avancado"
                          ? "🟣 Todas as ferramentas e módulos avançados estão 100% liberados."
                          : "🟢 Plano base ativo. Módulos avançados abaixo podem ser liberados avulsos ou em degustação."}
                      </p>
                    </div>

                    {/* Módulos Avulsos / Degustação */}
                    <div className="space-y-3 p-4 rounded-xl border border-slate-200/80 bg-white dark:border-white/5 dark:bg-black/20">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Módulos Adicionais / Degustação
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Ative recursos pontuais para teste ou contratação avulsa.
                        </p>
                      </div>

                      <div className="space-y-2 text-xs">
                        {[
                          { id: "agente_rag", label: "Base de Conhecimento RAG (Upload de Arquivos)", icon: Sparkles, color: "text-cyan-500" },
                          { id: "followup_automations", label: "Automações por Evento (Follow-up)", icon: Zap, color: "text-amber-500" },
                          { id: "sdr_broadcast", label: "Alertas SDR Broadcast (Multiatendentes)", icon: PhoneCall, color: "text-purple-500" },
                          { id: "multiplos_chips", label: "Chips WhatsApp Adicionais / Ilimitados", icon: Smartphone, color: "text-emerald-500" },
                        ].map((mod) => {
                          const currentAvulsos = draft.modulosAvulsos;
                          const isChecked =
                            draft.planTier === "avancado" || currentAvulsos.includes(mod.id);
                          const isLockedByPlan = draft.planTier === "avancado";

                          const handleToggleModule = (checked: boolean) => {
                            let next = [...currentAvulsos];
                            if (checked) {
                              if (!next.includes(mod.id)) next.push(mod.id);
                            } else {
                              next = next.filter((k) => k !== mod.id);
                            }
                            updateTenantN8nDraft(tenant.id, { modulosAvulsos: next });
                          };

                          const ModIcon = mod.icon;

                          return (
                            <label
                              key={mod.id}
                              className={`flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-muted/40 transition-colors cursor-pointer ${
                                isLockedByPlan ? "opacity-80" : ""
                              }`}
                            >
                              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                                <ModIcon className={`w-4 h-4 ${mod.color}`} />
                                {mod.label}
                              </span>
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 dark:border-white/10 text-purple-600 focus:ring-purple-500 size-4"
                                checked={isChecked}
                                disabled={isLockedByPlan}
                                onChange={(e) => handleToggleModule(e.target.checked)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Seção de Prazo de Degustação */}
                  {draft.planTier === "essencial" && draft.modulosAvulsos.length > 0 && (
                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] dark:bg-amber-950/20 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-bold text-foreground">
                            Prazo de Degustação dos Módulos Avulsos
                          </span>
                        </div>
                        {draft.degustacaoExpiraEm ? (
                          isExpired ? (
                            <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-bold">
                              ⛔ Degustação Expirada
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                              ⏱️ Ativa ({remainingDays} dia{remainingDays === 1 ? "" : "s"} restante{remainingDays === 1 ? "" : "s"})
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Sem prazo de expiração
                          </Badge>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 items-center">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Duração do teste (em dias a partir de hoje)
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="365"
                              placeholder="Ex: 7"
                              className="h-9 text-xs w-28 font-mono"
                              value={draft.degustacaoDiasInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val || parseInt(val, 10) <= 0) {
                                  handleSetDegustacaoDays(tenant.id, null);
                                } else {
                                  handleSetDegustacaoDays(tenant.id, parseInt(val, 10));
                                }
                              }}
                            />
                            <span className="text-xs text-muted-foreground">dias</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2.5 bg-white dark:bg-white/[0.02]"
                            onClick={() => handleSetDegustacaoDays(tenant.id, 7)}
                          >
                            7 dias
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2.5 bg-white dark:bg-white/[0.02]"
                            onClick={() => handleSetDegustacaoDays(tenant.id, 15)}
                          >
                            15 dias
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2.5 bg-white dark:bg-white/[0.02]"
                            onClick={() => handleSetDegustacaoDays(tenant.id, 30)}
                          >
                            30 dias
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] px-2.5 text-muted-foreground hover:text-rose-500"
                            onClick={() => handleSetDegustacaoDays(tenant.id, null)}
                          >
                            Remover Prazo
                          </Button>
                        </div>
                      </div>

                      {draft.degustacaoExpiraEm && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-200">
                          📅 {isExpired ? "Expirou em" : "Expira em"}:{" "}
                          <strong>
                            {new Date(draft.degustacaoExpiraEm).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </strong>
                          . Ao expirar, os módulos em degustação são bloqueados automaticamente com exibição do card de Upsell.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Card 2: Database Verification */}
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.01]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-200" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-xs">Tabela no Banco de Dados</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{expectedTableName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      className={
                        tableStatus?.exists
                          ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 text-[10px] font-medium"
                          : "border border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200 text-[10px] font-medium"
                      }
                    >
                      {tableStatus?.exists ? "OK" : "Não verif."}
                    </Badge>
                    {tableStatus?.exists ? (
                      <Badge className="border border-slate-300/80 bg-white/90 text-[10px] text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/80">
                        {tableStatus.columns?.length || 0} colunas
                      </Badge>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold px-3 bg-white hover:bg-slate-50 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                      disabled={verifyTenantTable.isPending}
                      onClick={() => void handleVerifyTenantTable(tenant)}
                    >
                      {verifyTenantTable.isPending ? "Verificando..." : "Verificar agora"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Card 3: Danger zone / Delete button */}
              {canManageTenants ? (
                <div className="flex items-center justify-between p-4 rounded-xl border border-rose-200/60 bg-rose-50/10 dark:border-rose-950/20 dark:bg-rose-950/5">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Zona de Perigo</p>
                    <p className="text-[11px] text-muted-foreground">Exclusão irreversível da empresa e de todos os dados operacionais.</p>
                  </div>
                  <AlertDialog
                    open={tenantPendingDelete === tenant.id}
                    onOpenChange={(open) => {
                      setTenantPendingDelete(open ? tenant.id : null);
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deleteTenant.isPending}
                        className="h-8 text-xs font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir empresa
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#0b0e1a] dark:text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir empresa cadastrada?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground">
                          Você tem certeza que deseja remover <strong>{tenant.name}</strong> ({tenant.id})? Se
                          esse tenant tiver leads, campanhas ou dados operacionais, eles
                          também serão apagados de forma irreversível. Se houver usuários vinculados, a exclusão
                          será bloqueada automaticamente pelo sistema.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteTenant.isPending} className="h-8 text-xs">
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs"
                          disabled={deleteTenant.isPending}
                          onClick={(event) => {
                            event.preventDefault();
                            void handleDeleteTenant(tenant);
                          }}
                        >
                          {deleteTenant.isPending && tenantPendingDelete === tenant.id
                            ? "Excluindo..."
                            : "Confirmar exclusão"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </div>
          </DialogContent>
        );
      })()}
    </Dialog>
  );
}
