import { createFileRoute } from "@tanstack/react-router";
import { useMyUIPrefs, useUpdateMyUIPrefs } from "@/modules/appearance/queries";
import type {
  ThemeFont,
  ThemeMode,
  ThemePreset,
  ThemeRadius,
  ThemeDensity,
} from "@/modules/appearance/api";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor, Check, Palette, Type, CornerDownLeft, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  component: AppearancePage,
  head: () => ({ meta: [{ title: "المظهر | Appearance" }] }),
});

const PRESETS: { id: ThemePreset; nameAr: string; nameEn: string; colors: string[] }[] = [
  { id: "navy",    nameAr: "كحلى موثوق",   nameEn: "Navy Trust",       colors: ["#0f1b3d", "#1e3a5f", "#3b6fa0", "#e8edf3"] },
  { id: "emerald", nameAr: "زمردى فاخر",   nameEn: "Emerald Prestige", colors: ["#064e3b", "#0d7a5f", "#c9a84c", "#f5f0e0"] },
  { id: "slate",   nameAr: "رمادى حديث",   nameEn: "Slate & Steel",    colors: ["#2d3748", "#4a5568", "#718096", "#a0aec0"] },
  { id: "indigo",  nameAr: "إنديجو ليلى",  nameEn: "Midnight Indigo",  colors: ["#0a0a1a", "#141432", "#1e1e5a", "#4f46e5"] },
];

const FONTS: { id: ThemeFont; nameAr: string; nameEn: string; sample: string }[] = [
  { id: "outfit",         nameAr: "Outfit",        nameEn: "Outfit",         sample: "Outfit — أنيق وحديث" },
  { id: "sora",           nameAr: "Sora + Manrope", nameEn: "Sora + Manrope", sample: "Sora — أدوات رقمية" },
  { id: "space-grotesk",  nameAr: "Space Grotesk", nameEn: "Space Grotesk",  sample: "Space — تك معاصر" },
  { id: "urbanist",       nameAr: "Urbanist",      nameEn: "Urbanist",       sample: "Urbanist — هندسى" },
  { id: "cairo",          nameAr: "Cairo (عربى)",  nameEn: "Cairo (Arabic)", sample: "القاهرة — عربى أنيق" },
];

const RADII: { id: ThemeRadius; nameAr: string; nameEn: string }[] = [
  { id: "sm", nameAr: "حاد",     nameEn: "Sharp" },
  { id: "md", nameAr: "متوسط",   nameEn: "Balanced" },
  { id: "lg", nameAr: "دائرى",   nameEn: "Rounded" },
];

const DENSITIES: { id: ThemeDensity; nameAr: string; nameEn: string }[] = [
  { id: "comfortable", nameAr: "مريح",   nameEn: "Comfortable" },
  { id: "compact",     nameAr: "مدمج",   nameEn: "Compact" },
];

function AppearancePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: prefs, isLoading } = useMyUIPrefs();
  const update = useUpdateMyUIPrefs();

  if (isLoading || !prefs) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  const set = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{ar ? "المظهر" : "Appearance"}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "خصّص شكل التطبيق كما يناسبك. الإعدادات محفوظة على حسابك وتظهر على أى جهاز تدخل منه."
            : "Personalize the app to your taste. Your settings sync across all devices you sign in from."}
        </p>
      </div>

      {/* Mode */}
      <section className="space-y-3">
        <Label className="flex items-center gap-2 text-base">
          <Sun className="h-4 w-4" />
          {ar ? "وضع الإضاءة" : "Appearance mode"}
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { id: "light",  ar: "نهارى",  en: "Light",  Icon: Sun },
            { id: "dark",   ar: "ليلى",   en: "Dark",   Icon: Moon },
            { id: "system", ar: "تلقائى", en: "Auto",   Icon: Monitor },
          ] as { id: ThemeMode; ar: string; en: string; Icon: typeof Sun }[]).map((opt) => {
            const active = prefs.theme_mode === opt.id;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => set({ theme_mode: opt.id })}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{ar ? opt.ar : opt.en}</span>
                {active && <Check className="absolute top-2 end-2 h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Presets */}
      <section className="space-y-3">
        <Label className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          {ar ? "الثيم" : "Color theme"}
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PRESETS.map((p) => {
            const active = prefs.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => set({ preset: p.id })}
                className={`relative rounded-xl border-2 p-4 text-start transition-all hover:shadow-md ${
                  active ? "border-primary shadow-sm" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex gap-1.5 mb-3">
                  {p.colors.map((c) => (
                    <div key={c} className="h-6 w-6 rounded-md shadow-sm" style={{ background: c }} />
                  ))}
                </div>
                <div className="text-sm font-semibold">{ar ? p.nameAr : p.nameEn}</div>
                {active && <Check className="absolute top-2 end-2 h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>

        {/* Custom colors */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{ar ? "لون مخصص" : "Custom color"}</div>
              <div className="text-xs text-muted-foreground">
                {ar ? "اختر لونك الأساسى وسيتم تطبيقه فوراً" : "Pick your own primary color"}
              </div>
            </div>
            <Button
              type="button"
              variant={prefs.preset === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => set({ preset: prefs.preset === "custom" ? "navy" : "custom" })}
            >
              {prefs.preset === "custom" ? (ar ? "مُفعّل" : "Active") : (ar ? "تفعيل" : "Enable")}
            </Button>
          </div>
          {prefs.preset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{ar ? "اللون الأساسى" : "Primary"}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={prefs.primary_color ?? "#3b6fa0"}
                    onChange={(e) => set({ primary_color: e.target.value })}
                    className="h-10 w-14 rounded-md border cursor-pointer"
                  />
                  <Input
                    value={prefs.primary_color ?? "#3b6fa0"}
                    onChange={(e) => set({ primary_color: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{ar ? "اللون المميز" : "Accent"}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={prefs.accent_color ?? "#c9a84c"}
                    onChange={(e) => set({ accent_color: e.target.value })}
                    className="h-10 w-14 rounded-md border cursor-pointer"
                  />
                  <Input
                    value={prefs.accent_color ?? "#c9a84c"}
                    onChange={(e) => set({ accent_color: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Font */}
      <section className="space-y-3">
        <Label className="flex items-center gap-2 text-base">
          <Type className="h-4 w-4" />
          {ar ? "الخط" : "Typography"}
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FONTS.map((f) => {
            const active = prefs.font_family === f.id;
            const cssFamily =
              f.id === "outfit" ? "'Outfit'"
              : f.id === "sora" ? "'Sora'"
              : f.id === "space-grotesk" ? "'Space Grotesk'"
              : f.id === "urbanist" ? "'Urbanist'"
              : "'Cairo'";
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => set({ font_family: f.id })}
                className={`relative rounded-xl border-2 p-4 text-start transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="text-lg font-semibold" style={{ fontFamily: cssFamily }}>
                  {f.sample}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{ar ? f.nameAr : f.nameEn}</div>
                {active && <Check className="absolute top-2 end-2 h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Radius + Density */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-base">
            <CornerDownLeft className="h-4 w-4" />
            {ar ? "حواف العناصر" : "Corner style"}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {RADII.map((r) => {
              const active = prefs.radius === r.id;
              const px = r.id === "sm" ? 6 : r.id === "md" ? 12 : 18;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => set({ radius: r.id })}
                  className={`flex flex-col items-center gap-2 p-3 border-2 transition-all ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                  style={{ borderRadius: px }}
                >
                  <div
                    className="h-8 w-12 bg-primary"
                    style={{ borderRadius: px }}
                  />
                  <span className="text-xs font-medium">{ar ? r.nameAr : r.nameEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base">{ar ? "الكثافة" : "Density"}</Label>
          <div className="grid grid-cols-2 gap-2">
            {DENSITIES.map((d) => {
              const active = prefs.density === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => set({ density: d.id })}
                  className={`p-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  {ar ? d.nameAr : d.nameEn}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reset */}
      <div className="pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            set({
              theme_mode: "system",
              preset: "navy",
              primary_color: null,
              accent_color: null,
              radius: "md",
              density: "comfortable",
              font_family: "outfit",
            })
          }
        >
          <RotateCcw className="h-4 w-4 me-2" />
          {ar ? "إعادة الافتراضى" : "Reset to defaults"}
        </Button>
      </div>
    </div>
  );
}
