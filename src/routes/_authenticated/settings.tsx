import { createFileRoute, Outlet, Link, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Settings2, LayoutGrid, Languages, FileText, ShieldCheck, Sliders, Trash2, Network, Palette, FolderArchive, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
  head: () => ({ meta: [{ title: "الإعدادات | Settings" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    // Any signed-in user can reach /settings — notification preferences are
    // personal and always available. Individual tabs gate themselves.
  },
});

type TabDef = {
  to: string;
  labelAr: string;
  labelEn: string;
  icon: typeof Settings2;
  perm?: string; // permission required (checked at runtime)
  ownerOnly?: boolean;
  disabled?: boolean;
};

const TABS: TabDef[] = [
  { to: "/settings", labelAr: "نظرة عامة", labelEn: "Overview", icon: Sliders },
  { to: "/settings/appearance", labelAr: "المظهر", labelEn: "Appearance", icon: Palette },
  { to: "/settings/organization", labelAr: "الهيكل التنظيمي", labelEn: "Organization", icon: Network },
  { to: "/settings/document-types", labelAr: "أنواع مستندات الشركة", labelEn: "Company Document Types", icon: FolderArchive },
  { to: "/settings/features", labelAr: "مميزات النظام", labelEn: "System Features", icon: ToggleRight, ownerOnly: false },
  { to: "/settings/form-builder", labelAr: "منشئ الحقول", labelEn: "Form Builder", icon: LayoutGrid, perm: "manage_form_fields" },


  { to: "/settings/trash", labelAr: "سلة المحذوفات", labelEn: "Trash", icon: Trash2, ownerOnly: true },
  { to: "/settings/language", labelAr: "اللغة والتوطين", labelEn: "Language & Locale", icon: Languages, disabled: true },
  { to: "/settings/reports", labelAr: "التقارير", labelEn: "Reports", icon: FileText, disabled: true },
  { to: "/settings/permissions", labelAr: "الصلاحيات", labelEn: "Permissions", icon: ShieldCheck, disabled: true },
];

function SettingsLayout() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: roles }, { data: userPerms }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("user_permissions").select("permission").eq("user_id", u.user.id),
      ]);
      const owner = !!roles?.some((r) => r.role === "owner");
      const admin = owner || !!roles?.some((r) => r.role === "admin");
      setIsOwner(owner);
      setIsAdmin(admin);
      setPerms(new Set((userPerms ?? []).map((p) => p.permission)));
    })();
  }, []);

  const canSee = (tab: TabDef) => {
    if (tab.ownerOnly) return isOwner;
    if (!tab.perm) return true;
    return isAdmin || perms.has(tab.perm);
  };

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "الإعدادات" : "Settings"}</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <aside>
          <nav className="space-y-1 sticky top-20">
            {TABS.map((tab) => {
              const active = pathname === tab.to || (tab.to !== "/settings" && pathname.startsWith(tab.to));
              const visible = canSee(tab);
              const Icon = tab.icon;
              // Hide unauthorized tabs entirely — never show "not authorized".
              if (!visible) return null;
              if (tab.disabled) {
                return (
                  <div
                    key={tab.to}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground/60 cursor-not-allowed"
                    title={ar ? "قريبًا" : "Coming soon"}
                  >

                    <Icon className="h-4 w-4" />
                    <span className="flex-1 truncate">{ar ? tab.labelAr : tab.labelEn}</span>
                    {tab.disabled && <span className="text-[9px] uppercase">{ar ? "قريبًا" : "Soon"}</span>}
                  </div>
                );
              }
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 truncate">{ar ? tab.labelAr : tab.labelEn}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
