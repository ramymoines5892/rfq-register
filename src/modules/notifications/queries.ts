import { useEffect } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/modules/_shared/queryKeys";
import {
  DEFAULT_PREFS,
  fetchNotificationPrefs,
  fetchNotifications,
  getCurrentUserId,
  markNotificationsRead,
  markOneRead,
  saveNotificationPrefs,
  type Notif,
  type NotifPrefs,
} from "./api";

/**
 * Query options for the current user's notifications. Requires a resolved userId.
 * Callers should resolve the userId first via `useCurrentUserId()`.
 */
export function notificationsQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: userId ? qk.notifications.list(userId) : ["notifications", "list", "anon"],
    queryFn: () => (userId ? fetchNotifications(userId) : Promise.resolve([] as Notif[])),
    enabled: !!userId,
    staleTime: 15_000,
  });
}

export function notificationPrefsQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: userId ? qk.notifications.prefs(userId) : ["notifications", "prefs", "anon"],
    queryFn: () => (userId ? fetchNotificationPrefs(userId) : Promise.resolve(DEFAULT_PREFS)),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** Resolve current auth user id once and cache it. */
export function useCurrentUserId() {
  return useQuery({
    queryKey: ["auth", "userId"],
    queryFn: getCurrentUserId,
    staleTime: 5 * 60_000,
  });
}

export function useNotifications() {
  const { data: userId } = useCurrentUserId();
  return useQuery(notificationsQueryOptions(userId ?? null));
}

export function useNotificationPrefs() {
  const { data: userId } = useCurrentUserId();
  return useQuery(notificationPrefsQueryOptions(userId ?? null));
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { data: userId } = useCurrentUserId();
  return useMutation({
    mutationFn: (id: string) => markOneRead(id),
    onSuccess: (_data, id) => {
      if (!userId) return;
      qc.setQueryData<Notif[]>(qk.notifications.list(userId), (prev) =>
        prev?.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { data: userId } = useCurrentUserId();
  return useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: (_data, ids) => {
      if (!userId) return;
      const now = new Date().toISOString();
      const set = new Set(ids);
      qc.setQueryData<Notif[]>(qk.notifications.list(userId), (prev) =>
        prev?.map((n) => (set.has(n.id) ? { ...n, read_at: now } : n)),
      );
    },
  });
}

export function useSaveNotificationPrefs() {
  const qc = useQueryClient();
  const { data: userId } = useCurrentUserId();
  return useMutation({
    mutationFn: (prefs: NotifPrefs) => {
      if (!userId) throw new Error("Not authenticated");
      return saveNotificationPrefs(userId, prefs);
    },
    onSuccess: (_data, prefs) => {
      if (!userId) return;
      qc.setQueryData(qk.notifications.prefs(userId), prefs);
    },
  });
}

/**
 * Subscribes to realtime notification changes for the current user and
 * invalidates the notifications query when rows change. Returns nothing —
 * intended to be called once from a top-level component (e.g. NotificationBell).
 */
export function useNotificationsRealtime(onInsert?: (n: Notif) => void) {
  const qc = useQueryClient();
  const { data: userId } = useCurrentUserId();

  useEffect(() => {
    if (!userId) return;
    // Unique topic per mount to sidestep supabase-js channel caching.
    const topic = `notif_${userId}_${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          qc.setQueryData<Notif[]>(qk.notifications.list(userId), (prev) =>
            prev ? [n, ...prev].slice(0, 30) : [n],
          );
          onInsert?.(n);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          qc.setQueryData<Notif[]>(qk.notifications.list(userId), (prev) =>
            prev?.map((x) => (x.id === n.id ? n : x)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc, onInsert]);
}
