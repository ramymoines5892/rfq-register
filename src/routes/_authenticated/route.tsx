import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Workflow, LogOut, Languages, Gem, UsersRound, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
    if (prof && prof.status !== "active") throw redirect({ to: "/pending" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { t, lang, setLang, dir } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      if (data.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        setIsAdmin(!!roles?.some((r) => r.role === "owner" || r.role === "admin"));
      }
    })();
  }, []);

  const mainNav = [
    { to: "/", label: t("overview"), icon: LayoutDashboard, match: (p: string) => p === "/" },
    { to: "/customers", label: t("customers"), icon: Users, match: (p: string) => p.startsWith("/customers") },
    { to: "/workflows", label: t("workflows"), icon: Workflow, match: (p: string) => p.startsWith("/workflows") },
  ];
  const adminNav = isAdmin ? [
    { to: "/hr", label: t("hr"), icon: Building2, match: (p: string) => p.startsWith("/hr") },
    { to: "/team", label: t("team"), icon: UsersRound, match: (p: string) => p.startsWith("/team") },
  ] : [];

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const sideStart = dir === "rtl" ? "border-s" : "border-e";
  const initial = (email?.[0] || "U").toUpperCase();

  const renderNav = (items: typeof mainNav) => items.map((n) => {
    const active = n.match(pathname);
    const Icon = n.icon;
    return (
      <Link
        key={n.to}
        to={n.to}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        }`}
      >
        <Icon className="h-4 w-4 opacity-90" />
        <span>{n.label}</span>
      </Link>
    );
  });

  return (
    <div className="min-h-screen flex bg-background" dir={dir}>
      {/* Sidebar */}
      <aside className={`hidden md:flex md:w-64 lg:w-72 flex-col bg-sidebar text-sidebar-foreground ${sideStart} border-sidebar-border`}>
        <div className="px-6 pt-7 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground shadow-sm">
              <Gem className="h-4 w-4" />
            </div>
            <div className="font-display text-lg font-bold tracking-tight">
              <span className="text-sidebar-primary">Core</span>
              <span>Suite</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest font-bold px-4 pt-4 pb-2 text-sidebar-primary/70">
            {t("mainMenu") ?? "القائمة الرئيسية"}
          </div>
          {renderNav(mainNav)}

          {adminNav.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-widest font-bold px-4 pt-6 pb-2 text-sidebar-primary/70">
                {t("administration") ?? "الإدارة"}
              </div>
              {renderNav(adminNav)}
            </>
          )}
        </nav>

        <div className="p-4 space-y-2">
          <div className="bg-sidebar-accent/60 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center font-bold text-sidebar-primary-foreground shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{email}</div>
              <div className="text-[10px] text-sidebar-foreground/60">
                {isAdmin ? (lang === "ar" ? "مدير النظام" : "Administrator") : (lang === "ar" ? "مستخدم" : "Member")}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              <Languages className="h-4 w-4 me-1" /> {t("langToggle")}
            </Button>
            <Button variant="ghost" size="sm" className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Gem className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display font-bold text-sm">CoreSuite</span>
        </div>
        <div className="flex items-center gap-1">
          {[...mainNav, ...adminNav].map((n) => {
            const active = n.match(pathname);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={`p-2 rounded-lg ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"}`}>
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
          <Button variant="ghost" size="sm" className="text-sidebar-foreground" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
