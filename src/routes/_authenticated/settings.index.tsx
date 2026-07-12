import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutGrid, Languages, FileText, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsHome,
});

function SettingsHome() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const items = [
    {
      to: "/settings/form-builder",
      titleAr: "منشئ الحقول",
      titleEn: "Form Builder",
      descAr: "حرّك الحقول بالسحب والإفلات، وحدّد شكل ظهورها في كل شاشة (بجانب بعض أو تحت بعض).",
      descEn: "Drag & drop fields, decide column widths, and design each screen the way you want.",
      icon: LayoutGrid,
      enabled: true,
    },
    {
      to: "/settings/language",
      titleAr: "اللغة والتوطين",
      titleEn: "Language & Locale",
      descAr: "افتراضي اللغة، اتجاه القراءة، وتنسيقات التاريخ والأرقام.",
      descEn: "Default language, direction, and date/number formats.",
      icon: Languages,
      enabled: false,
    },
    {
      to: "/settings/reports",
      titleAr: "التقارير",
      titleEn: "Reports",
      descAr: "قوالب التقارير الافتراضية وخيارات التصدير.",
      descEn: "Report templates and export defaults.",
      icon: FileText,
      enabled: false,
    },
    {
      to: "/settings/permissions",
      titleAr: "الصلاحيات",
      titleEn: "Permissions",
      descAr: "حدد مين يقدر يفتح كل جزء من الإعدادات.",
      descEn: "Control who can access each settings section.",
      icon: ShieldCheck,
      enabled: false,
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">{ar ? "إعدادات النظام" : "System Settings"}</h2>
      <p className="text-muted-foreground text-sm mb-6">
        {ar
          ? "كل الإعدادات في مكان واحد. الأقسام الظاهرة هنا حسب صلاحياتك."
          : "All settings in one place. Sections visible here depend on your permissions."}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          const inner = (
            <Card className={`h-full transition-shadow ${it.enabled ? "hover:shadow-md" : "opacity-60"}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">{ar ? it.titleAr : it.titleEn}</h3>
                  {!it.enabled && (
                    <span className="ms-auto text-[10px] uppercase text-muted-foreground">{ar ? "قريبًا" : "Soon"}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{ar ? it.descAr : it.descEn}</p>
              </CardContent>
            </Card>
          );
          return it.enabled ? (
            <Link key={it.to} to={it.to} className="block">
              {inner}
            </Link>
          ) : (
            <div key={it.to}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
