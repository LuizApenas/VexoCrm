import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock3,
  LoaderCircle,
  MessageCircle,
  QrCode,
  RefreshCw,
  RotateCcw,
  Send,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCampanhas } from "@/hooks/useCampanhas";
import { useCrmClient } from "@/hooks/useCrmClient";
import { useAuth } from "@/contexts/AuthContext";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { cn } from "@/lib/utils";
import { useLeadClients } from "@/hooks/useLeadClients";
import {
  useSendWhatsAppMessage,
  useWhatsAppChats,
  useWhatsAppMessages,
  useClearWhatsAppChats,
  type WhatsAppChat,
  type WhatsAppMessage,
} from "@/hooks/useWhatsAppInbox";
import { MediaMessage } from "@/components/MediaMessage";

const STATUS_LABELS: Record<string, string> = {
  idle: "Parado",
  initializing: "Inicializando",
  qr_ready: "QR pronto",
  authenticated: "Sincronizando",
  ready: "Conectado",
  disconnected: "Desconectado",
  auth_failure: "Falha de login",
  error: "Erro",
};

function formatTimestamp(timestamp: number | null, withDate = false) {
  if (!timestamp) return "";

  return new Date(timestamp * 1000).toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withDate
      ? {
          day: "2-digit",
          month: "2-digit",
        }
      : {}),
  });
}

function getPreview(chat: WhatsAppChat) {
  const body = chat.lastMessage?.body?.trim();
  if (!body) return "Sem mensagens recentes.";
  return body.length > 72 ? `${body.slice(0, 72)}...` : body;
}

// Avatar: foto de perfil do WhatsApp quando disponível, senão a inicial do nome.
// As URLs do WhatsApp (pps.whatsapp.net) expiram; se a imagem falhar, cai na
// inicial sem quebrar o layout.
function ChatAvatar({ label, picture, size = "md" }: { label?: string; picture?: string | null; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const clean = (label || "").trim();
  const initial = clean ? clean.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase() || "#" : "#";
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";

  if (picture && !failed) {
    return (
      <img
        src={picture}
        alt={clean || "Contato"}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full object-cover", dim)}
      />
    );
  }

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", dim)}>
      {initial}
    </div>
  );
}

function MessageBubble({ message }: { message: WhatsAppMessage }) {
  return (
    <div
      className={cn(
        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
        message.fromMe
          ? "ml-auto rounded-br-md bg-emerald-500 text-white"
          : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      )}
    >
      <MediaMessage
        messageId={message.id}
        hasMedia={message.hasMedia}
        fallbackBody={message.body}
        fromMe={message.fromMe}
      />
      <p className={cn("mt-1 text-right text-[10px]", message.fromMe ? "text-emerald-50/90" : "text-slate-400")}>
        {formatTimestamp(message.timestamp)} {message.fromMe ? "✓✓" : ""}
      </p>
    </div>
  );
}

interface WhatsAppInboxProps {
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  allowSessionControls?: boolean;
  clientId?: string;
}

function OriginBadge({ origin, campaignId, campaignNames }: { origin: string | null; campaignId: string | null; campaignNames: Map<string, string> }) {
  if (!origin) return null;

  if (origin === "campaign") {
    const name = campaignId ? campaignNames.get(campaignId) : undefined;
    return (
      <span className="rounded-full border border-emerald-300/40 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        {name ? `Campanha: ${name}` : "Campanha"}
      </span>
    );
  }

  if (origin === "inbound") {
    return (
      <span className="rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Inbound
      </span>
    );
  }

  return null;
}

export default function WhatsAppInbox({
  title = "WhatsApp",
  subtitle = "Visualize e atenda conversas em tempo real direto do CRM.",
  headerRight,
  allowSessionControls = true,
  clientId: propClientId,
}: WhatsAppInboxProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPhone = searchParams.get("phone") ?? null;

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // Vários chips podem ser vistos ao mesmo tempo. Lista vazia = todos.
  const [selectedInstanceNames, setSelectedInstanceNames] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const chatsContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const { selectedClientId } = useCrmClient();
  const clientId = propClientId || selectedClientId;

  const { data: tenants = [], isLoading: tenantsLoading } = useLeadClients();
  const activeTenant = tenants.find((t) => t.id === clientId) ?? null;
  const evolutionInstances = activeTenant?.n8n_settings?.evolution_instances ?? [];
  const hasConnectedInstances = evolutionInstances.some((inst) => inst.active);

  const campaignsQuery = useCampanhas(clientId ?? undefined);
  const campaignNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaignsQuery.data ?? []) {
      map.set(c.id, c.name);
    }
    return map;
  }, [campaignsQuery.data]);

  const canLoadInbox = Boolean(clientId);
  const instanceFilter = selectedInstanceNames.length > 0 ? selectedInstanceNames.join(",") : null;
  const chatsQuery = useWhatsAppChats(clientId, instanceFilter, canLoadInbox);
  const messagesQuery = useWhatsAppMessages(clientId, instanceFilter, selectedChatId, canLoadInbox);
  const sendMessage = useSendWhatsAppMessage(clientId, selectedChatId);
  const clearChats = useClearWhatsAppChats(clientId);

  const chats = useMemo(() => chatsQuery.items ?? [], [chatsQuery.items]);
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const { getIdToken } = useAuth();
  const [reabrirPending, setReabrirPending] = useState(false);

  const handleReabrirAtendimento = async () => {
    if (!selectedChat || !clientId) return;
    const rawId = String(selectedChat.id || "");
    const phone = rawId.replace(/\D/g, "");
    if (!phone) {
      toast.error("Número de telefone não disponível para esta conversa.");
      return;
    }

    setReabrirPending(true);
    try {
      const token = await getIdToken();
      const res = await fetchApi("/api/chatbot-leads/reabrir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientId,
          phone,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        const msg = data?.error?.message || data?.message || "Falha ao reabrir atendimento.";
        toast.error(msg);
        return;
      }

      toast.success("Atendimento do chatbot reaberto com sucesso");
      chatsQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao reabrir atendimento.");
    } finally {
      setReabrirPending(false);
    }
  };

  useEffect(() => {
    if (!canLoadInbox) {
      setSelectedChatId(null);
      return;
    }

    if (!chats.length) {
      if (selectedChatId) setSelectedChatId(null);
      return;
    }

    // Se chegou via deep-link do Kanban com ?phone=, tenta abrir o chat desse número
    if (initialPhone) {
      const digits = initialPhone.replace(/\D/g, "");
      const match = chats.find((chat) => chat.id.replace(/@.*/, "") === digits);
      if (match) {
        setSelectedChatId(match.id);
        setSearchParams({}, { replace: true }); // limpa o param após selecionar
        return;
      }
    }

    const hasSelectedChat = chats.some((chat) => chat.id === selectedChatId);
    if (!selectedChatId || !hasSelectedChat) {
      setSelectedChatId(chats[0].id);
    }
  }, [canLoadInbox, chats, selectedChatId, initialPhone, setSearchParams]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, selectedChatId]);

  const handleChatsScroll = () => {
    const container = chatsContainerRef.current;
    if (!container || !chatsQuery.hasMore || chatsQuery.isFetchingNextPage) {
      return;
    }

    const remainingScroll = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (remainingScroll < 160) {
      void chatsQuery.loadMore();
    }
  };

  const handleSendMessage = async () => {
    const trimmedDraft = draft.trim();
    if (!selectedChatId || !trimmedDraft) return;

    try {
      await sendMessage.mutateAsync(trimmedDraft);
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar mensagem.");
    }
  };

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      headerRight={headerRight}
      spacing="space-y-6"
    >
      <section className="w-full">
        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-4">
            <SectionHeader
              title="Inbox"
              subtitle="Lista de conversas e envio de mensagens direto do CRM."
              icon={MessageCircle}
              className="mb-0"
            />
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-sm text-muted-foreground">
                <LoaderCircle className="h-7 w-7 animate-spin text-emerald-500" />
                Carregando conversas do WhatsApp...
              </div>
            ) : !hasConnectedInstances ? (
              <EmptyState
                icon={WifiOff}
                title="Nenhum chip de WhatsApp conectado"
                description="Conecte pelo menos um chip de WhatsApp ativo em 'Chips WhatsApp' para visualizar e enviar mensagens."
              />
            ) : (
              <div className="grid h-[calc(100vh-260px)] min-h-[620px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background/30">
                  <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      Conversas · atualizando em tempo real
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedInstanceNames([])}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            selectedInstanceNames.length === 0
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300"
                          )}
                        >
                          Todos
                        </button>
                        {evolutionInstances.map((inst) => {
                          // instance_name gravado no sync é o último segmento da URL
                          // da Evolution (ex.: "geracao-digital-gd-vexo"), não inst.name.
                          const urlName = inst.dispatch_webhook_url
                            ? inst.dispatch_webhook_url.split("/").filter(Boolean).pop() ?? inst.name
                            : inst.name;
                          const checked = selectedInstanceNames.includes(urlName);
                          return (
                            <button
                              key={urlName}
                              type="button"
                              onClick={() =>
                                setSelectedInstanceNames((cur) =>
                                  cur.includes(urlName)
                                    ? cur.filter((n) => n !== urlName)
                                    : [...cur, urlName]
                                )
                              }
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                checked
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300"
                              )}
                              title={checked ? "Clique para remover este chip do filtro" : "Clique para incluir este chip"}
                            >
                              {checked ? "✓ " : ""}{inst.name}
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 shrink-0 px-2 text-xs"
                        disabled={clearChats.isPending}
                        onClick={async () => {
                          if (confirm("Tem certeza que deseja limpar as conversas do banco de dados? Isso apagará o histórico da instância selecionada no CRM.")) {
                            try {
                              await clearChats.mutateAsync(instanceFilter);
                              toast.success("Conversas limpas com sucesso.");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Erro ao limpar conversas.");
                            }
                          }
                        }}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <div
                    ref={chatsContainerRef}
                    onScroll={handleChatsScroll}
                    className="h-[calc(100%-62px)] overflow-y-auto"
                  >
                    {chatsQuery.isLoading ? (
                      <EmptyState message="Carregando conversas mais recentes..." />
                    ) : chats.length === 0 ? (
                      <EmptyState
                        title="Nenhuma conversa encontrada"
                        description="Nenhuma conversa registrada no banco de dados para os chips conectados."
                      />
                    ) : (
                      chats.map((chat) => {
                        const rawId = String(chat.id || "");
                        // Grupo e contato LID nao tem telefone: mostrar o jid cru
                        // ("235368586727590@lid") parece numero errado. Exibe um
                        // rotulo honesto nesses casos.
                        const isJid = rawId.includes("@");
                        const phoneLabel = isJid
                          ? (rawId.includes("@g.us") ? "Grupo do WhatsApp" : "Número não disponível")
                          : `+${rawId}`;
                        const showPhone = !!chat.name && chat.name !== rawId;
                        return (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => setSelectedChatId(chat.id)}
                          className={cn(
                            "flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50",
                            chat.id === selectedChatId && "bg-emerald-50 dark:bg-emerald-500/10"
                          )}
                        >
                          <ChatAvatar label={chat.name || phoneLabel} picture={chat.profilePic} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{chat.name || phoneLabel}</p>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {formatTimestamp(chat.timestamp, true)}
                              </span>
                            </div>
                            {showPhone && <p className="truncate text-[11px] text-slate-400">{phoneLabel}</p>}
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{getPreview(chat)}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {chat.unreadCount > 0 && (
                                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {chat.unreadCount}
                                </span>
                              )}
                              {chat.isGroup && (
                                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 dark:border-slate-700">
                                  Grupo
                                </span>
                              )}
                              <OriginBadge
                                origin={chat.leadOrigin ?? null}
                                campaignId={chat.sourceCampaignId ?? null}
                                campaignNames={campaignNames}
                              />
                            </div>
                          </div>
                        </button>
                        );
                      })
                    )}

                    {!chatsQuery.isLoading && chatsQuery.isFetchingNextPage && (
                      <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Carregando mais conversas...
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background/30">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      {selectedChat && <ChatAvatar label={selectedChat.name || String(selectedChat.id)} picture={selectedChat.profilePic} size="sm" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {selectedChat?.name || "Selecione uma conversa"}
                          </p>
                          {selectedChat && (
                            <OriginBadge
                              origin={selectedChat.leadOrigin ?? null}
                              campaignId={selectedChat.sourceCampaignId ?? null}
                              campaignNames={campaignNames}
                            />
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {selectedChat?.id
                            ? (String(selectedChat.id).includes("@")
                                ? (String(selectedChat.id).includes("@g.us") ? "Grupo do WhatsApp" : "Número não disponível")
                                : `+${selectedChat.id}`)
                            : "Nenhuma conversa selecionada"}
                        </p>
                      </div>
                    </div>
                    {selectedChat && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50"
                        disabled={reabrirPending}
                        onClick={handleReabrirAtendimento}
                      >
                        <RotateCcw className={cn("h-3.5 w-3.5", reabrirPending && "animate-spin")} />
                        Reabrir Atendimento
                      </Button>
                    )}
                  </div>

                  <div
                    ref={messagesContainerRef}
                    className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-900/20"
                  >
                    {messagesQuery.isLoading ? (
                      <EmptyState message="Carregando ultimas mensagens..." />
                    ) : !selectedChat ? (
                      <EmptyState
                        title="Escolha uma conversa"
                        description="Selecione um chat na coluna da esquerda para abrir o historico."
                      />
                    ) : messages.length === 0 ? (
                      <EmptyState
                        title="Sem mensagens carregadas"
                        description="Nenhuma mensagem registrada no banco de dados para esta conversa."
                      />
                    ) : (
                      messages.map((message) => (
                        <MessageBubble key={message.id || `${message.timestamp}-${message.body}`} message={message} />
                      ))
                    )}
                  </div>

                  <div className="border-t border-border/70 p-4">
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Histórico de mensagens sincronizado diretamente a partir do banco de dados do CRM.
                      </p>
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Digite uma mensagem..."
                        rows={4}
                        disabled={!selectedChat || sendMessage.isPending}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleSendMessage}
                          disabled={!selectedChat || !draft.trim() || sendMessage.isPending}
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {sendMessage.isPending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
