import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

export type WhatsAppSessionStatus =
  | "idle"
  | "initializing"
  | "qr_ready"
  | "authenticated"
  | "ready"
  | "disconnected"
  | "auth_failure"
  | "error";

export interface WhatsAppSessionState {
  status: WhatsAppSessionStatus;
  message: string;
  qrCodeDataUrl: string | null;
  lastError: string | null;
  clientInfo: {
    wid: string | null;
    pushname: string | null;
    platform: string | null;
  } | null;
  syncProgress: number | null;
  syncStatusMessage: string | null;
  syncStartedAt: string | null;
  hasPersistedSession: boolean;
  lastUpdatedAt: string;
}

const QUERY_KEY = ["whatsapp-session"];
const ACTIVE_POLLING_STATUSES = new Set<WhatsAppSessionStatus>([
  "initializing",
  "qr_ready",
  "authenticated",
]);

async function parseApiResponse(res: Response) {
  if (res.ok) {
    return res.json();
  }

  let message = `WhatsApp request failed: ${res.status}`;

  try {
    const payload = await res.json();
    message = payload?.error?.message || payload?.message || message;
  } catch {
    const text = await res.text();
    if (text) {
      message = text;
    }
  }

  throw new Error(message);
}

export function useWhatsAppSession() {
  const { isAuthenticated, canAccessView, getIdToken } = useAuth();
  const queryClient = useQueryClient();

  const fetchSessionState = async (): Promise<WhatsAppSessionState> => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Usuario nao autenticado.");
    }

    const res = await fetch(`${API_BASE_URL}/api/whatsapp/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return parseApiResponse(res);
  };

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: isAuthenticated && canAccessView("whatsapp"),
    queryFn: fetchSessionState,
    refetchInterval: (queryData) => {
      const status = queryData.state.data?.status;
      return status && ACTIVE_POLLING_STATUSES.has(status) ? 3000 : false;
    },
    staleTime: 0,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (action: "start" | "reset") => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/whatsapp/session/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return parseApiResponse(res);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    ...query,
    session: query.data ?? null,
    startSession: () => createSessionMutation.mutateAsync("start"),
    resetSession: () => createSessionMutation.mutateAsync("reset"),
    isStarting: createSessionMutation.isPending && createSessionMutation.variables === "start",
    isResetting: createSessionMutation.isPending && createSessionMutation.variables === "reset",
  };
}
