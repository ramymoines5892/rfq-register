import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import {
  FEATURE_REGISTRY,
  CATEGORY_LABELS,
  FEATURE_MAP,
  type FeatureCategory,
  type FeatureDef,
} from "@/lib/features/registry";
import { useFeatures, useUpdateFeatures } from "@/modules/features/queries";

export const Route = createFileRoute("/_authenticated/settings/features")({
  component: FeaturesPage,
  head: () => ({ meta: [{ title: "مميزات النظام | System Features" }] }),
});

function FeaturesPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const { data: features, isLoading } = useFeatures();
  const updateMut = useUpdateFeatures();

  const [isAdmin, setIsAdmin] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "owner" || r.role === "admin"));
    })();
  }, []);

  useEffect(() => {
    if (features) setDraft(features);
  }, [features]);

  const dirty = useMemo(() => {
    if (!features) return false;
    return FEATURE_REGISTRY.some((f) => (features[f.key] ?? false) !== (draft[f.key] ?? false));
  }, [features, draft]);

  const grouped = useMemo(() => {
    const g: Record<FeatureCategory, FeatureDef[]> = {
      core: [], operations: [], traceability: [], finance: [], compliance: [],
    };
    for (const f of FEATURE_REGISTRY) g[f.category].push(f);
    return g;
  }, []);

  function toggle(key: string, v: boolean) {
    setDraft((prev) => {
      const next = { ...prev, [key]: v };
      // Cascading OFF: turning off a feature turns off dependents.
      if (!v) {
        for (const f of FEATURE_REGISTRY) {
          if (f.depends_on?.includes(key)) next[f.key] = false;
        }
      }
      // Cascading ON: turning on a feature auto-enables its dependencies.
      if (v) {
        const def = FEATURE_MAP[key];
        for (const dep of def?.depends_on ?? []) next[dep] = true;
      }
      return next;
    });
  }

  async function save() {
    try {
      await updateMut.mutateAsync(draft);
      toast.success(ar ? "تم حفظ المميزات" : "Features saved");
    } catch (e) {
      toast.error(ar ? "تعذّر الحفظ" : "Failed to save", { description: String((e as Error).message) });
    }
  }

  function reset() {
    if (features) setDraft(features);
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-16 border rounded-2xl p-8 text-center">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          {ar ? "هذه الشاشة للأونر والأدمن فقط." : "This screen is for Owner/Admin only."}
        </p>
      </div>
    );
  }

  return (
    <div dir={dir} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{ar ? "مميزات النظام" : "System Features"}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {ar
              ? "فعّل أو عطّل الموديولات حسب حاجة شركتك. الإيقاف يخفي الصفحات والحقول ذات الصلة من التطبيق."
              : "Turn modules on or off. Disabling a feature hides its pages and fields across the app."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="ghost" onClick={reset} disabled={updateMut.isPending}>
              {ar ? "إلغاء" : "Discard"}
            </Button>
          )}
          <Button onClick={save} disabled={!dirty || updateMut.isPending}>
            {updateMut.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {ar ? "حفظ التغييرات" : "Save Changes"}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">{ar ? "جارٍ التحميل..." : "Loading..."}</div>
      )}

      {(Object.keys(grouped) as FeatureCategory[]).map((cat) => {
        const items = grouped[cat];
        if (!items.length) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {ar ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((f) => {
                const on = draft[f.key] ?? false;
                const depMissing = f.depends_on?.filter((d) => !draft[d]) ?? [];
                const blocked = depMissing.length > 0 && !on;
                const Icon = f.icon;
                return (
                  <div
                    key={f.key}
                    className={`border rounded-xl p-4 transition-all ${on ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                            {ar ? f.ar : f.en}
                            {!f.implemented && (
                              <span className="text-[9px] uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                                {ar ? "قريبًا" : "Soon"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {ar ? f.desc_ar : f.desc_en}
                          </div>
                          {f.depends_on && f.depends_on.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1.5">
                              {ar ? "يتطلب:" : "Requires:"}{" "}
                              {f.depends_on.map((d) => (ar ? FEATURE_MAP[d]?.ar : FEATURE_MAP[d]?.en) ?? d).join(", ")}
                            </div>
                          )}
                          {blocked && (
                            <div className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {ar ? "فعّل المتطلبات أولًا" : "Enable prerequisites first"}
                            </div>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={on}
                        disabled={!f.implemented || updateMut.isPending}
                        onCheckedChange={(c) => toggle(f.key, c)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
