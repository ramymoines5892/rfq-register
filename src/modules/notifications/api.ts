import { supabase } from "@/integrations/supabase/client";

export type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  category: string;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotifPrefs = {
  enabled: boolean;
  reminder_enabled: boolean;
  reminder_interval_minutes: number;
  sound_enabled: boolean;
  browser_push_enabled: boolean;
  categories: Record<string, boolean>;
};

export const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  reminder_enabled: true,
  reminder_interval_minutes: 15,
  sound_enabled: true,
  browser_push_enabled: false,
  categories: { pending_users: true, approvals: true, tasks: true, system: true },
};

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchNotifications(userId: string, limit = 30): Promise<Notif[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notif[];
}

export async function fetchNotificationPrefs(userId: string): Promise<NotifPrefs> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("enabled,reminder_enabled,reminder_interval_minutes,sound_enabled,browser_push_enabled,categories")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFS;
  return {
    enabled: data.enabled,
    reminder_enabled: data.reminder_enabled,
    reminder_interval_minutes: data.reminder_interval_minutes,
    sound_enabled: data.sound_enabled,
    browser_push_enabled: data.browser_push_enabled,
    categories: (data.categories as Record<string, boolean>) ?? DEFAULT_PREFS.categories,
  };
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function markOneRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function saveNotificationPrefs(userId: string, prefs: NotifPrefs): Promise<void> {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
  if (error) throw error;
}
