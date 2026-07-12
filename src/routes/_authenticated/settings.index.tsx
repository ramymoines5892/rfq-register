import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputIcon } from "@/components/ui/input-icon";
import {
  LayoutGrid,
  Languages,
  FileText,
  ShieldCheck,
  Bell,
  Trash2,
  Search,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAccess, type Access } from "@/hooks/useAccess";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsHome,
});

type Item = {
  id: string;
  to: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  keywords: string;
  icon: typeof LayoutGrid;
  section: "workspace" | "system" | "admin";
  soon?: boolean;
  when?: (a: Access) => boolean;
};

const ITEMS: Item[] = [
  {
    id: "form-builder",
    to: "/settings/form-builder",
    titleAr: "منشئ الحقول",
    titleEn: "Form Builder",
    descAr: "صمّم شاشات البيانات بالسحب والإفلات — أقسام، أعمدة، معاينة حية.",
    descEn: "Design data screens by drag-and-drop — sections, widths, live preview.",
    keywords: "fields form builder حقول نماذج",
    icon: LayoutGrid,
    section: "workspace",
    when: (a) => a.canManageFormFields,
  },
  {
    id: "notifications",
    to: "/settings/notifications",
    titleAr: "الإشعارات",
    titleEn: "Notifications",
    descAr: "تحكّم في التنبيهات، التذكير الدوري، والصوت.",
    descEn: "Alerts, reminder cadence, and sound.",
    keywords: "notifications alerts bell إشعارات",
    icon: Bell,
    section: "system",
    when: (a) => a.canManageNotifications,
  },
  {
    id: "ai-search",
    to: "/settings/search",
    titleAr: "البحث الذكي",
    titleEn: "AI Search",
    descAr: "أعِد فهرسة الفهارس الدلالية، وتحكم في تجربة البحث.",
    descEn: "Reindex semantic embeddings and tune the search experience.",
    keywords: "search ai semantic embeddings بحث ذكي",
    icon: Sparkles,
    section: "system",
    when: (a) => a.canManageSemanticSearch,
  },
  {
    id: "trash",
    to: "/settings/trash",
    titleAr: "سلة المحذوفات",
    titleEn: "Trash",
    descAr: "استعرض العناصر المخفية أو المحذوفة، واستعِدها.",
    descEn: "Review hidden or deleted items, restore them.",
    keywords: "trash deleted recycle bin سلة",
    icon: Trash2,
    section: "admin",
    when: (a) => a.canViewTrash,
  },
  {
    id: "permissions",
    to: "/settings/permissions",
    titleAr: "الصلاحيات",
    titleEn: "Permissions",
    descAr: "حدّد من يقدر يفتح كل جزء من الإعدادات.",
    descEn: "Control who can access each area.",
    keywords: "permissions roles access صلاحيات",
    icon: ShieldCheck,
    section: "admin",
    soon: true,
    when: (a) => a.isAdmin,
  },
  {
    id: "language",
    to: "/settings/language",
    titleAr: "اللغة والتوطين",
    titleEn: "Language & Locale",
    descAr: "الافتراضي، الاتجاه، تنسيقات التاريخ والأرقام.",
    descEn: "Defaults, direction, date and number formats.",
    keywords: "language locale rtl اللغة",
    icon: Languages,
    section: "system",
    soon: true,
  },
  {
    id: "reports",
    to: "/settings/reports",
    titleAr: "التقارير",
    titleEn: "Reports",
    descAr: "قوالب التقارير الافتراضية وخيارات التصدير.",
    descEn: "Report templates and export defaults.",
    keywords: "reports export pdf excel تقارير",
    icon: FileText,
    section: "workspace",
    soon: true,
  },
];

const SECTION_LABELS: Record<Item["section"], { ar: string; en: string }> = {
  workspace: { ar: "مساحة العمل", en: "Workspace" },
  system: { ar: "النظام", en: "System" },
  admin: { ar: "الإدارة", en: "Administration" },
};

function SettingsHome() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();
  const [q, setQ] = useState("");
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  const visible = useMemo(() => {
    if (!access.ready) return [];
    const allowed = ITEMS.filter((i) => !i.when || i.when(access));
    const s = q.trim().toLowerCase();
    if (!s) return allowed;
    return allowed.filter(
      (it) =>
        (ar ? it.titleAr : it.titleEn).toLowerCase().includes(s) ||
        (ar ? it.descAr : it.descEn).toLowerCase().includes(s) ||
        it.keywords.toLowerCase().includes(s),
    );
  }, [access, q, ar]);

  const bySection = useMemo(() => {
    const out: Record<Item["section"], Item[]> = { workspace: [], system: [], admin: [] };
    for (const it of visible) out[it.section].push(it);
    return out;
  }, [visible]);

  return (
    <div className="mx-auto max-w-4xl px-1">
      {/* Header — typographic, generous whitespace */}
      <header className="pt-2 pb-8 border-b border-border/60">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
          {ar ? "إعدادات النظام" : "System"}
        </div>
        <h1 className="mt-1 font-display text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
          {ar ? "الإعدادات" : "Settings"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-lg leading-relaxed">
          {ar
            ? "كل ما يخص شكل البيانات، الإشعارات، والتحكم في الوصول."
            : "Everything about data shape, notifications, and access."}
        </p>
        <div className="mt-6 max-w-md">
          <InputIcon
            leftIcon={<Search />}
            placeholder={ar ? "ابحث في الإعدادات…" : "Search settings…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            clearable
            onClear={() => setQ("")}
            className="h-10 text-sm"
          />
        </div>
      </header>

      {/* Grouped list — one column, hierarchical typography */}
      <div className="py-6 space-y-10">
        {(Object.keys(bySection) as Item["section"][]).map((sec) => {
          const items = bySection[sec];
          if (items.length === 0) return null;
          return (
            <section key={sec}>
              <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/80 mb-3 px-1">
                {ar ? SECTION_LABELS[sec].ar : SECTION_LABELS[sec].en}
              </h2>
              <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card overflow-hidden">
                {items.map((it) => {
                  const Icon = it.icon;
                  const title = ar ? it.titleAr : it.titleEn;
                  const desc = ar ? it.descAr : it.descEn;
                  const inner = (
                    <div className="flex items-center gap-4 px-5 py-4 group">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-[17px] font-semibold tracking-tight leading-none">
                            {title}
                          </span>
                          {it.soon && (
                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">
                              {ar ? "قريبًا" : "Soon"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 text-[13px] text-muted-foreground leading-snug line-clamp-2">
                          {desc}
                        </div>
                      </div>
                      {!it.soon && (
                        <Arrow className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all shrink-0" />
                      )}
                    </div>
                  );
                  return (
                    <li key={it.id}>
                      {it.soon ? (
                        <div className="opacity-50 cursor-not-allowed select-none">{inner}</div>
                      ) : (
                        <Link to={it.to} className="block hover:bg-muted/40 transition-colors">
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {access.ready && visible.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground border border-dashed rounded-2xl">
            {q
              ? (ar ? "لا توجد نتائج مطابقة." : "No matching settings.")
              : (ar ? "لا توجد إعدادات متاحة لك حاليًا." : "You have no available settings.")}
          </div>
        )}

        {!access.ready && (
          <div className="text-center py-16 text-xs text-muted-foreground">
            {ar ? "تحميل…" : "Loading…"}
          </div>
        )}
      </div>

      <div className="pb-10 pt-4 text-[11px] text-muted-foreground/70 text-center">
        {ar ? "لو محتاج إعداد مش موجود، كلّم مسؤول النظام." : "Missing a setting? Ping your admin."}
      </div>
    </div>
  );
}
