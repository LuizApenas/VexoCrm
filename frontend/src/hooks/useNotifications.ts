import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const API_URL = `${API_BASE_URL}/api/notifications`;
const POLL_INTERVAL = 15000;
const LAST_SEEN_KEY = "notifications_lastSeenCreatedAt";

function matchesSelectedClient(
  item: Notification,
  selectedClientName: string | null,
) {
  if (!selectedClientName) {
    return true;
  }

  const haystack = `${item.title} ${item.description || ""}`.toLowerCase();
  return haystack.includes(selectedClientName.toLowerCase());
}

export function useNotifications() {
  const { user, getIdToken, canAccessInternalPage } = useAuth();
  const crmClient = useOptionalCrmClient();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const lastSeenRef = useRef(localStorage.getItem(LAST_SEEN_KEY) || "");
  const canReadNotifications = canAccessInternalPage("agente");
  const selectedClientName = crmClient?.selectedClient?.name || null;

  const filteredItems = useMemo(
    () => items.filter((item) => matchesSelectedClient(item, selectedClientName)),
    [items, selectedClientName],
  );
  const unreadCount = useMemo(
    () => filteredItems.filter((item) => !item.read).length,
    [filteredItems],
  );

  const fetchNotifications = useCallback(async () => {
    if (!user || !canReadNotifications) return;
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`${API_URL}?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      setItems(data.items || []);

      // Toast for new notifications
      const newItems = (data.items || []).filter(
        (item: Notification) =>
          lastSeenRef.current && item.created_at > lastSeenRef.current && !item.read
      );
      for (const item of newItems.slice(0, 3)) {
        toast.error(item.title, { description: item.description || undefined });
      }

      if (data.items?.length > 0) {
        const newest = data.items[0].created_at;
        if (newest > lastSeenRef.current) {
          lastSeenRef.current = newest;
          localStorage.setItem(LAST_SEEN_KEY, newest);
        }
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [canReadNotifications, getIdToken, user]);

  useEffect(() => {
    if (!user || !canReadNotifications) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [canReadNotifications, fetchNotifications, user]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!canReadNotifications) return;
      const token = await getIdToken();
      if (!token) return;

      await fetch(API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, read: true }),
      });
      await fetchNotifications();
    },
    [canReadNotifications, fetchNotifications, getIdToken]
  );

  const markAllRead = useCallback(async () => {
    if (!canReadNotifications) return;
    const token = await getIdToken();
    if (!token) return;

    await fetch(API_URL, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ markAllRead: true }),
    });
    await fetchNotifications();
  }, [canReadNotifications, fetchNotifications, getIdToken]);

  return { items: filteredItems, unreadCount, loading, markAsRead, markAllRead };
}
