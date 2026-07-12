import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import { useAccess, type NotifCategory } from "@/hooks/useAccess";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationSettings,
});

type Prefs = {
  enabled: boolean;
  reminder_enabled: boolean;
  reminder_interval_minutes: number;
  sound_enabled: boolean;
  browser_push_enabled: boolean;
  categories: Record<string, boolean>;
};

const DEFAULT: Prefs = {
  enabled: true,
  reminder_enabled: true,
  reminder_interval_minutes: 15,
  sound_enabled: true,
  browser_push_enabled: false,
  categories: { pending_users: true, approvals: true, tasks: true, system: true },
};

function NotificationSettings() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          enabled: data.enabled,
          reminder_enabled: data.reminder_enabled,
          reminder_interval_minutes: data.reminder_interval_minutes,
          sound_enabled: data.sound_enabled,
          browser_push_enabled: data.browser_push_enabled,
          categories: (data.categories as Record<string, boolean>) ?? DEFAULT.categories,
        });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setSaving(false); return; }
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.user.id, ...prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(ar ? "تم الحفظ" : "Saved");
  }

  async function requestBrowserPermission(v: boolean) {
    if (v && "Notification" in window && Notification.permission !== "granted") {
      const p = await Notification.requestPermission();
      if (p !== "granted") { toast.error(ar ? "تم رفض الإذن" : "Permission denied"); return; }
    }
    setPrefs((p) => ({ ...p, browser_push_enabled: v }));
  }

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const allCats: { key: NotifCategory; ar: string; en: string }[] = [
    { key: "pending_users", ar: "المستخدمين الجدد بانتظار التفعيل", en: "New users pending approval" },
    { key: "approvals", ar: "طلبات الموافقة على العروض والمهام", en: "Approvals & tasks" },
    { key: "tasks", ar: "المهام والتذكيرات", en: "Tasks & reminders" },
    { key: "system", ar: "إشعارات النظام", en: "System notifications" },
  ];
  // Only show categories the user is actually authorized to receive.
  const cats = access.ready ? allCats.filter((c) => access.notifCategories.has(c.key)) : [];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{ar ? "إعدادات الإشعارات" : "Notification Settings"}</h2>
          <p className="text-xs text-muted-foreground">{ar ? "تحكم فى الإشعارات والتذكيرات" : "Control notifications & reminders"}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{ar ? "الحالة العامة" : "General"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Row label={ar ? "تفعيل الإشعارات" : "Enable notifications"} desc={ar ? "استقبال الإشعارات داخل النظام" : "Receive in-app notifications"}>
              <Switch checked={prefs.enabled} onCheckedChange={(v) => setPrefs({ ...prefs, enabled: v })} />
            </Row>
            <Row label={ar ? "الصوت" : "Sound"} desc={ar ? "صوت عند وصول إشعار" : "Play a sound on new notification"}>
              <Switch checked={prefs.sound_enabled} onCheckedChange={(v) => setPrefs({ ...prefs, sound_enabled: v })} />
            </Row>
            <Row label={ar ? "إشعارات المتصفح" : "Browser push"} desc={ar ? "إشعار حتى لو التبويب مقفول" : "Notify even when tab is closed"}>
              <Switch checked={prefs.browser_push_enabled} onCheckedChange={requestBrowserPermission} />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{ar ? "التذكير الدورى" : "Periodic reminder"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Row label={ar ? "تذكيرى بالإشعارات غير المقروءة" : "Remind me of unread"} desc={ar ? "يفكرك بالمهام المعلّقة" : "Reminds you of pending tasks"}>
              <Switch checked={prefs.reminder_enabled} onCheckedChange={(v) => setPrefs({ ...prefs, reminder_enabled: v })} />
            </Row>
            <div className={prefs.reminder_enabled ? "" : "opacity-50 pointer-events-none"}>
              <Label className="text-sm">{ar ? `كل ${prefs.reminder_interval_minutes} دقيقة` : `Every ${prefs.reminder_interval_minutes} minutes`}</Label>
              <Slider
                min={1} max={120} step={1}
                value={[prefs.reminder_interval_minutes]}
                onValueChange={([v]) => setPrefs({ ...prefs, reminder_interval_minutes: v })}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1 {ar ? "د" : "min"}</span>
                <span>120 {ar ? "د" : "min"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {cats.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{ar ? "أنواع الإشعارات" : "Categories"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cats.map((c) => (
                <Row key={c.key} label={ar ? c.ar : c.en}>
                  <Switch
                    checked={prefs.categories[c.key] ?? true}
                    onCheckedChange={(v) => setPrefs({ ...prefs, categories: { ...prefs.categories, [c.key]: v } })}
                  />
                </Row>
              ))}
            </CardContent>
          </Card>
        )}


        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
            {ar ? "حفظ" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
