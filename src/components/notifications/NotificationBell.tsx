import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

type Notif = {
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

type Prefs = {
  enabled: boolean;
  reminder_enabled: boolean;
  reminder_interval_minutes: number;
  sound_enabled: boolean;
};

const DEFAULT_PREFS: Prefs = {
  enabled: true,
  reminder_enabled: true,
  reminder_interval_minutes: 15,
  sound_enabled: true,
};

function playPing() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 180);
  } catch { /* ignore */ }
}

function timeAgo(iso: string, ar: boolean) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return ar ? "الآن" : "just now";
  if (diff < 3600) return ar ? `منذ ${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return ar ? `منذ ${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h ago`;
  return ar ? `منذ ${Math.floor(diff / 86400)} ي` : `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [open, setOpen] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const lastReminderCountRef = useRef<number>(-1);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    userIdRef.current = user.user.id;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  }, []);

  const loadPrefs = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data } = await supabase
      .from("notification_preferences")
      .select("enabled,reminder_enabled,reminder_interval_minutes,sound_enabled")
      .eq("user_id", user.user.id)
      .maybeSingle();
    if (data) setPrefs(data as Prefs);
  }, []);

  // Initial load + prefs
  useEffect(() => {
    load();
    loadPrefs();
  }, [load, loadPrefs]);

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      channel = supabase
        .channel(`notif_${user.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.user.id}` },
          (payload) => {
            const n = payload.new as Notif;
            setItems((prev) => [n, ...prev].slice(0, 30));
            if (prefs.enabled) {
              if (prefs.sound_enabled) playPing();
              toast(n.title, { description: n.body ?? undefined });
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.user.id}` },
          (payload) => {
            const n = payload.new as Notif;
            setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [prefs.enabled, prefs.sound_enabled]);

  // Periodic reminder about pending items
  useEffect(() => {
    if (!prefs.enabled || !prefs.reminder_enabled) return;
    const minutes = Math.max(1, prefs.reminder_interval_minutes);
    const interval = setInterval(() => {
      const pending = items.filter((n) => !n.read_at).length;
      if (pending > 0 && pending !== lastReminderCountRef.current) {
        lastReminderCountRef.current = pending;
        toast.info(
          ar ? `لديك ${pending} إشعار غير مقروء` : `You have ${pending} unread notification${pending > 1 ? "s" : ""}`,
        );
        if (prefs.sound_enabled) playPing();
      }
    }, minutes * 60 * 1000);
    return () => clearInterval(interval);
  }, [prefs, items, ar]);

  async function markAllRead() {
    const uid = userIdRef.current;
    if (!uid) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  }

  async function markOne(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
          aria-label={ar ? "الإشعارات" : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">{ar ? "الإشعارات" : "Notifications"}</div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                <CheckCheck className="h-3.5 w-3.5 me-1" />
                {ar ? "تعليم الكل مقروء" : "Mark all read"}
              </Button>
            )}
            <Link to="/settings/notifications" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline px-2">
              {ar ? "إعدادات" : "Settings"}
            </Link>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {ar ? "لا توجد إشعارات" : "No notifications"}
            </div>
          ) : (
            items.map((n) => {
              const inner = (
                <div
                  onClick={() => { if (!n.read_at) markOne(n.id); if (n.link) setOpen(false); }}
                  className={`p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${!n.read_at ? "font-semibold" : ""}`}>{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at, ar)}</div>
                    </div>
                    {n.priority === "high" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase font-bold">
                        {ar ? "هام" : "High"}
                      </span>
                    )}
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} to={n.link} className="block">{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
