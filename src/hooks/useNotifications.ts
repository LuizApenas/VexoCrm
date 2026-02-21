import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notifications-api`;
const POLL_INTERVAL = 15000;
const LAST_SEEN_KEY = "notifications_lastSeenCreatedAt";

export function useNotifications() {
  const { getIdToken, user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const lastSeenRef = useRef(localStorage.getItem(LAST_SEEN_KEY) || "");

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`${API_URL}?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      setItems(data.items || []);
      setUnreadCount(data.unreadCount || 0);

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
  }, [getIdToken, user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications, user]);

  const markAsRead = useCallback(
    async (id: string) => {
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
    [getIdToken, fetchNotifications]
  );

  const markAllRead = useCallback(async () => {
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
  }, [getIdToken, fetchNotifications]);

  return { items, unreadCount, loading, markAsRead, markAllRead };
}
