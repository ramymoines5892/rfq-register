import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPrefs,
  useNotifications,
  useNotificationsRealtime,
} from "@/modules/notifications/queries";
import type { Notif, NotifPrefs } from "@/modules/notifications/api";

function playPing() {
  try {
    const AudioCtx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useNotifications();
  const { data: prefs } = useNotificationPrefs();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  // Latest prefs via ref so realtime handler doesn't need re-registration.
  const prefsRef = useRef<NotifPrefs | undefined>(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const onIncoming = useCallback((n: Notif) => {
    const p = prefsRef.current;
    if (!p?.enabled) return;
    if (p.sound_enabled) playPing();
    toast(n.title, { description: n.body ?? undefined });
  }, []);

  useNotificationsRealtime(onIncoming);

  const unreadCount = items.filter((n) => !n.read_at).length;

  // Periodic reminder about pending items
  const lastReminderCountRef = useRef<number>(-1);
  useEffect(() => {
    if (!prefs?.enabled || !prefs.reminder_enabled) return;
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

  function markAllRead() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    markAll.mutate(ids);
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
          {isLoading ? (
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
                  onClick={() => { if (!n.read_at) markOne.mutate(n.id); if (n.link) setOpen(false); }}
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
