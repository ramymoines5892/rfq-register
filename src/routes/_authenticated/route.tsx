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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const nav = [
    { to: "/", label: t("overview"), icon: LayoutDashboard, match: (p: string) => p === "/" },
    { to: "/customers", label: t("customers"), icon: Users, match: (p: string) => p.startsWith("/customers") },
    { to: "/workflows", label: t("workflows"), icon: Workflow, match: (p: string) => p.startsWith("/workflows") },
    { to: "/team", label: t("team"), icon: UsersRound, match: (p: string) => p.startsWith("/team") },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const sideStart = dir === "rtl" ? "border-s" : "border-e";

  return (
    <div className="min-h-screen flex bg-background" dir={dir}>
      {/* Sidebar */}
      <aside className={`hidden md:flex md:w-64 lg:w-72 flex-col bg-sidebar text-sidebar-foreground ${sideStart} border-sidebar-border`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            <Gem className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{t("appName")}</div>
            <div className="text-[11px] opacity-70">{t("tagline")}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = n.match(pathname);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="text-xs opacity-70 px-2 truncate">{email}</div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              <Languages className="h-4 w-4 me-1" /> {t("langToggle")}
            </Button>
            <Button variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Gem className="h-5 w-5 text-sidebar-primary" />
          <span className="font-semibold text-sm">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-1">
          {nav.map((n) => {
            const active = n.match(pathname);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={`p-2 rounded ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : ""}`}>
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
