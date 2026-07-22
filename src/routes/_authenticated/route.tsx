import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Workflow, LogOut, Languages, UsersRound, Building2,
  Settings2, Pin, PinOff, FolderArchive, ChevronDown, ShoppingCart, Store,
  Package, Warehouse, FileText, Truck, Receipt, ClipboardList, Boxes, Search, Landmark,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearch, GlobalSearchTrigger } from "@/components/search/GlobalSearch";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { useFeatures, isFeatureEnabled } from "@/features/features/queries";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: hasCompany } = await supabase.rpc("has_any_company");
    if (!hasCompany) throw redirect({ to: "/setup" });
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
    if (prof && prof.status !== "active") throw redirect({ to: "/pending" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

/* ─── Navigation model ─────────────────────────────────────────────────── */

type LucideIcon = typeof LayoutDashboard;

type NavLeaf = {
  to?: string;                 // undefined = "coming soon"
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
  soon?: boolean;
  match?: (p: string) => boolean;
};

type NavGroup = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
  featureKey?: string;         // feature gate; hides whole group if OFF
  children: NavLeaf[];
};

type NavSection = {
  labelAr: string;
  labelEn: string;
  entries: (NavLeaf | NavGroup)[];
};

const isGroup = (e: NavLeaf | NavGroup): e is NavGroup => "children" in e;

/* ─── Layout ───────────────────────────────────────────────────────────── */

function AuthenticatedLayout() {
  const { t, lang, setLang, dir } = useI18n();
  const ar = lang === "ar";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const brand = useCompanyBrand();

  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cs.sidebar.pinned") !== "0";
  });
  const collapsed = !pinned;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("cs.sidebar.groups") || "{}"); }
    catch { return {}; }
  });

  useEffect(() => { localStorage.setItem("cs.sidebar.pinned", pinned ? "1" : "0"); }, [pinned]);
  useEffect(() => { localStorage.setItem("cs.sidebar.groups", JSON.stringify(openGroups)); }, [openGroups]);

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

  const { data: featureFlags } = useFeatures();
  const featOn = (key?: string) => !key || (featureFlags ? isFeatureEnabled(key, featureFlags) : false);

  /* Navigation tree — single source of truth */
  const sections: NavSection[] = useMemo(() => [
    {
      labelAr: "القائمة الرئيسية", labelEn: "Main",
      entries: [
        { to: "/", labelAr: "نظرة عامة", labelEn: "Overview", icon: LayoutDashboard, match: (p) => p === "/" },
      ],
    },
    {
      labelAr: "العمليات", labelEn: "Operations",
      entries: [
        {
          id: "sales", labelAr: "المبيعات", labelEn: "Sales", icon: Store,
          children: [
            { to: "/customers", labelAr: "العملاء", labelEn: "Customers", icon: Users, match: (p) => p.startsWith("/customers") },
            { to: "/workflows", labelAr: "عروض الأسعار", labelEn: "Quotes", icon: FileText, match: (p) => p.startsWith("/workflows") },
            { labelAr: "أوامر البيع", labelEn: "Sales Orders", icon: ClipboardList, soon: true },
            { labelAr: "فواتير البيع", labelEn: "Sales Invoices", icon: Receipt, soon: true },
          ],
        },
        {
          id: "procurement", labelAr: "المشتريات", labelEn: "Purchases", icon: ShoppingCart,
          featureKey: "procurement",
          children: [
            { labelAr: "الموردون", labelEn: "Suppliers", icon: Truck, soon: true },
            { labelAr: "طلبات الشراء", labelEn: "Purchase Requests", icon: ClipboardList, soon: true },
            { labelAr: "أوامر التوريد", labelEn: "Purchase Orders", icon: FileText, soon: true },
            { labelAr: "فواتير المشتريات", labelEn: "Purchase Invoices", icon: Receipt, soon: true },
          ],
        },
        {
          id: "inventory", labelAr: "المخازن", labelEn: "Inventory", icon: Warehouse,
          featureKey: "inventory",
          children: [
            { labelAr: "الأصناف", labelEn: "Items", icon: Package, soon: true },
            { labelAr: "المخازن", labelEn: "Warehouses", icon: Warehouse, soon: true },
            { labelAr: "حركات المخزون", labelEn: "Stock Movements", icon: Boxes, soon: true },
          ],
        },
      ],
    },
    {
      labelAr: "الإدارة", labelEn: "Administration",
      entries: [
        ...(isAdmin ? [
          { to: "/organization", labelAr: "المؤسسة", labelEn: "Organization", icon: Landmark, match: (p: string) => p.startsWith("/organization") } as NavLeaf,
          { to: "/hr", labelAr: "الموارد البشرية", labelEn: "HR", icon: Building2, match: (p: string) => p.startsWith("/hr") } as NavLeaf,
          { to: "/team", labelAr: "الفريق", labelEn: "Team", icon: UsersRound, match: (p: string) => p.startsWith("/team") } as NavLeaf,
        ] : []),
        { to: "/settings", labelAr: "الإعدادات", labelEn: "Settings", icon: Settings2, match: (p: string) => p.startsWith("/settings") },
      ],
    },
  ], [isAdmin]);

  /* Auto-open the group containing the active route */
  useEffect(() => {
    for (const s of sections) for (const e of s.entries) {
      if (isGroup(e) && e.children.some((c) => c.to && pathname.startsWith(c.to))) {
        setOpenGroups((prev) => (prev[e.id] ? prev : { ...prev, [e.id]: true }));
      }
    }
  }, [pathname, sections]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const sideStart = dir === "rtl" ? "border-s" : "border-e";
  const initial = (email?.[0] || "U").toUpperCase();

  /* ─── Renderers ─── */

  const soonToast = () => toast.info(ar ? "قريبًا — قيد التطوير" : "Coming soon");

  const LeafItem = ({ n, nested = false }: { n: NavLeaf; nested?: boolean }) => {
    const active = n.to && (n.match ? n.match(pathname) : pathname === n.to);
    const Icon = n.icon;
    const label = ar ? n.labelAr : n.labelEn;

    const collapsedBase = "flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] leading-tight text-center transition-all";
    const expandedBase = `flex items-center gap-3 rounded-lg text-sm transition-all ${nested ? "ps-9 pe-3" : "px-3"} py-2`;
    const base = collapsed ? collapsedBase : expandedBase;

    const stateClass = n.soon
      ? "text-sidebar-foreground/40 hover:text-sidebar-foreground/60 hover:bg-sidebar-accent/30"
      : active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50";

    if (n.soon || !n.to) {
      return (
        <button type="button" onClick={soonToast} title={label} className={`${base} ${stateClass} w-full text-start`}>
          <Icon className="h-4 w-4 shrink-0" />
          {collapsed ? (
            <span className="line-clamp-2 w-full break-words">{label}</span>
          ) : (
            <>
              <span className="truncate flex-1">{label}</span>
              <span className="text-[9px] uppercase tracking-wide bg-sidebar-accent/50 text-sidebar-foreground/50 px-1.5 py-0.5 rounded">
                {ar ? "قريبًا" : "Soon"}
              </span>
            </>
          )}
        </button>
      );
    }

    return (
      <Link to={n.to} title={label} className={`${base} ${stateClass}`}>
        <Icon className="h-4 w-4 shrink-0" />
        {collapsed
          ? <span className="line-clamp-2 w-full break-words">{label}</span>
          : <span className="truncate">{label}</span>}
      </Link>
    );
  };


  const GroupItem = ({ g }: { g: NavGroup }) => {
    const open = !!openGroups[g.id];
    const Icon = g.icon;
    const activeChild = g.children.some((c) => c.to && (c.match ? c.match(pathname) : pathname === c.to));

    if (collapsed) {
      // In icon-rail mode, show children as icon+label tiles (no group header)
      return (
        <div className="space-y-0.5">
          {g.children.map((c, i) => <LeafItem key={i} n={c} />)}
          <div className="mx-2 my-1.5 border-t border-sidebar-border/40" />
        </div>
      );
    }


    return (
      <div>
        <button
          type="button"
          onClick={() => setOpenGroups((p) => ({ ...p, [g.id]: !p[g.id] }))}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
            activeChild ? "text-sidebar-foreground font-medium" : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1 text-start">{ar ? g.labelAr : g.labelEn}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-1 space-y-0.5">
            {g.children.map((c, i) => <LeafItem key={i} n={c} nested />)}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (s: NavSection) => {
    const entries = s.entries.filter((e) => (isGroup(e) ? featOn(e.featureKey) : true));
    if (!entries.length) return null;
    return (
      <div key={s.labelEn} className="space-y-1">
        {!collapsed ? (
          <div className="text-[10px] uppercase tracking-widest font-bold px-3 pt-4 pb-1.5 text-sidebar-primary/70">
            {ar ? s.labelAr : s.labelEn}
          </div>
        ) : (
          <div className="mx-3 my-2 border-t border-sidebar-border/40" />
        )}
        {entries.map((e, i) => isGroup(e) ? <GroupItem key={e.id} g={e} /> : <LeafItem key={i} n={e} />)}
      </div>
    );
  };


  /* ─── Brand block ─── */
  const Brand = ({ tight = false }: { tight?: boolean }) => (
    <div className={`flex items-center ${collapsed && !tight ? "justify-center" : "gap-2.5"}`}>
      <div className="h-9 w-9 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground shadow-sm shrink-0 overflow-hidden">
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt={brand.displayName} className="h-full w-full object-cover" />
          : <span className="font-bold text-sm">{brand.initial}</span>}
      </div>
      {(!collapsed || tight) && (
        <div className="font-display text-base font-bold tracking-tight truncate min-w-0">
          {brand.shortName}
        </div>
      )}
    </div>
  );

  /* ─── Mobile nav (flat list) ─── */
  const mobileLeaves: NavLeaf[] = sections.flatMap((s) =>
    s.entries.filter((e) => (isGroup(e) ? featOn(e.featureKey) : true))
      .flatMap((e) => isGroup(e) ? e.children.filter((c) => c.to && !c.soon) : [e])
  ) as NavLeaf[];

  return (
    <ThemeProvider>
    <div className="min-h-screen flex bg-background" dir={dir}>
      <aside
        className={`hidden md:flex flex-col bg-sidebar text-sidebar-foreground ${sideStart} border-sidebar-border transition-[width] duration-200 ease-out sticky top-0 h-screen ${
          pinned ? "md:w-64 lg:w-72" : "md:w-20"
        }`}
      >

        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          title={pinned ? (ar ? "إلغاء التثبيت" : "Unpin") : (ar ? "تثبيت" : "Pin")}
          className={`absolute top-4 ${dir === "rtl" ? "end-2" : "start-2"} z-10 h-6 w-6 rounded-full bg-background border shadow-sm grid place-items-center transition-colors ${
            pinned ? "text-primary hover:bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>

        <div className={`${collapsed ? "px-3" : "px-5"} pt-7 pb-4`}>
          <Brand />
        </div>

        {!collapsed && (
          <div className="px-3 pb-2">
            <GlobalSearchTrigger className="w-full justify-start" />
          </div>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-global-search"))}
            title={ar ? "بحث" : "Search"}
            className="mx-auto mb-2 h-9 w-9 rounded-lg border border-sidebar-border/60 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 flex items-center justify-center"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        <nav className={`flex-1 ${collapsed ? "px-2" : "px-3"} space-y-2 overflow-y-auto overflow-x-hidden pb-4 scrollbar-slim`}>
          {sections.map(renderSection)}
        </nav>


        <div className={`${collapsed ? "p-2" : "p-3"} space-y-2 border-t border-sidebar-border/40`}>
          {!collapsed && (
            <div className="bg-sidebar-accent/60 rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center font-bold text-sidebar-primary-foreground shrink-0">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">{email}</div>
                <div className="text-[10px] text-sidebar-foreground/60">
                  {isAdmin ? (ar ? "مدير النظام" : "Administrator") : (ar ? "مستخدم" : "Member")}
                </div>
              </div>
            </div>
          )}
          <div className={`flex ${collapsed ? "flex-col" : "gap-1 items-center"}`}>
            <Button
              variant="ghost"
              size="sm"
              className={`${collapsed ? "w-full justify-center" : "flex-1"} text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground`}
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              title={collapsed ? t("langToggle") : undefined}
            >
              <Languages className="h-4 w-4" />
              {!collapsed && <span className="ms-1 text-xs">{lang === "ar" ? "EN" : "ع"}</span>}
            </Button>
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              className={`${collapsed ? "w-full justify-center" : ""} text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground`}
              onClick={signOut}
              title={collapsed ? (ar ? "تسجيل الخروج" : "Sign out") : undefined}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-3 border-b border-sidebar-border">
        <Brand tight />
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {mobileLeaves.slice(0, 5).map((n, i) => {
            const active = n.to && (n.match ? n.match(pathname) : pathname === n.to);
            const Icon = n.icon;
            return (
              <Link key={i} to={n.to!} className={`p-2 rounded-lg ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"}`}>
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
          <button onClick={() => window.dispatchEvent(new Event("open-global-search"))} className="p-2 rounded-lg text-sidebar-foreground/70" title={ar ? "بحث" : "Search"}>
            <Search className="h-4 w-4" />
          </button>
          <NotificationBell />
          <Button variant="ghost" size="sm" className="text-sidebar-foreground" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <Outlet />
      </main>
      <GlobalSearch />
    </div>
    </ThemeProvider>
  );
}
