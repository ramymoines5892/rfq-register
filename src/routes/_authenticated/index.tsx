import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/hooks/useAccess";
import { useCurrentCompany } from "@/features/company/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, FileText, Building2, UsersRound, Settings2,
  ShoppingCart, Store, ClipboardList, CheckCircle2, Bell, ArrowRight,
  UserPlus, ToggleRight, FolderArchive, TrendingUp, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "لوحة التحكم | Dashboard" },
      { name: "description", content: "نظرة عامة مخصصة حسب صلاحياتك" },
    ],
  }),
});

type Counts = {
  quotesMine: number;
  quotesPending: number;
  customers: number;
  pendingUsers: number;
  unreadNotifs: number;
  expiringDocs: number;
};

function Dashboard() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();
  const { data: company } = useCurrentCompany();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({
    quotesMine: 0, quotesPending: 0, customers: 0,
    pendingUsers: 0, unreadNotifs: 0, expiringDocs: 0,
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
      setFullName(prof?.full_name ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!access.ready || !access.userId) return;
    (async () => {
      const uid = access.userId!;
      const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const results = await Promise.allSettled([
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("user_id", uid).is("deleted_at", null),
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("approval_state", "in_progress").is("deleted_at", null),
        supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
        access.canManageUsers
          ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")
          : Promise.resolve({ count: 0 } as any),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
        supabase.from("company_documents").select("id", { count: "exact", head: true })
          .is("superseded_at", null).not("expiry_date", "is", null).gte("expiry_date", today).lte("expiry_date", in7),
      ]);
      const val = (r: any) => (r.status === "fulfilled" ? r.value.count ?? 0 : 0);
      setCounts({
        quotesMine: val(results[0]),
        quotesPending: val(results[1]),
        customers: val(results[2]),
        pendingUsers: val(results[3]),
        unreadNotifs: val(results[4]),
        expiringDocs: val(results[5]),
      });
    })();
  }, [access.ready, access.userId, access.canManageUsers]);

  const displayName = useMemo(() => fullName || email.split("@")[0] || "", [fullName, email]);
  const brandName = company?.short_name || company?.name_ar || company?.name || "";
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (ar) return h < 5 ? "مساء الخير" : h < 12 ? "صباح الخير" : h < 18 ? "طاب يومك" : "مساء الخير";
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [ar]);

  const roleLabel = access.isOwner
    ? (ar ? "مالك النظام" : "Owner")
    : access.isAdmin
      ? (ar ? "مدير" : "Administrator")
      : access.canApprove
        ? (ar ? "مُعتمِد" : "Approver")
        : (ar ? "عضو الفريق" : "Team Member");

  /* Role-based KPI selection */
  type Kpi = { key: string; label: string; value: number; icon: any; tint: string; to?: string };
  const kpis: Kpi[] = useMemo(() => {
    const all: Kpi[] = [];
    if (access.isAdmin) {
      all.push(
        { key: "pendingUsers", label: ar ? "مستخدمون بانتظار التفعيل" : "Pending Users", value: counts.pendingUsers, icon: UserPlus, tint: "text-amber-600 bg-amber-500/10", to: "/hr" },
        { key: "quotesPending", label: ar ? "عروض قيد الاعتماد" : "Quotes Awaiting Approval", value: counts.quotesPending, icon: ClipboardList, tint: "text-blue-600 bg-blue-500/10", to: "/workflows" },
        { key: "expiringDocs", label: ar ? "مستندات تنتهي خلال أسبوع" : "Docs Expiring in 7d", value: counts.expiringDocs, icon: FolderArchive, tint: "text-rose-600 bg-rose-500/10", to: "/settings/company" },
        { key: "customers", label: ar ? "عملاء" : "Customers", value: counts.customers, icon: Users, tint: "text-emerald-600 bg-emerald-500/10", to: "/customers" },
      );
    } else if (access.canApprove) {
      all.push(
        { key: "quotesPending", label: ar ? "بانتظار اعتمادك" : "Awaiting Your Approval", value: counts.quotesPending, icon: CheckCircle2, tint: "text-blue-600 bg-blue-500/10", to: "/workflows" },
        { key: "quotesMine", label: ar ? "عروضي" : "My Quotes", value: counts.quotesMine, icon: FileText, tint: "text-primary bg-primary/10", to: "/workflows" },
        { key: "customers", label: ar ? "عملاء" : "Customers", value: counts.customers, icon: Users, tint: "text-emerald-600 bg-emerald-500/10", to: "/customers" },
      );
    } else {
      all.push(
        { key: "quotesMine", label: ar ? "عروضي" : "My Quotes", value: counts.quotesMine, icon: FileText, tint: "text-primary bg-primary/10", to: "/workflows" },
        { key: "customers", label: ar ? "عملاء" : "Customers", value: counts.customers, icon: Users, tint: "text-emerald-600 bg-emerald-500/10", to: "/customers" },
        { key: "unreadNotifs", label: ar ? "إشعارات غير مقروءة" : "Unread Notifications", value: counts.unreadNotifs, icon: Bell, tint: "text-amber-600 bg-amber-500/10" },
      );
    }
    return all;
  }, [access, counts, ar]);

  type Action = { label: string; desc: string; to: string; icon: any };
  const actions: Action[] = useMemo(() => {
    const list: Action[] = [
      { label: ar ? "عروض الأسعار" : "Quotes", desc: ar ? "إنشاء ومتابعة العروض" : "Create & track quotes", to: "/workflows", icon: FileText },
      { label: ar ? "العملاء" : "Customers", desc: ar ? "قاعدة بيانات العملاء" : "Customer database", to: "/customers", icon: Users },
    ];
    if (access.isAdmin) {
      list.push(
        { label: ar ? "الموارد البشرية" : "HR", desc: ar ? "الموظفون والإدارات" : "Employees & departments", to: "/hr", icon: Building2 },
        { label: ar ? "الفريق" : "Team", desc: ar ? "المستخدمون والصلاحيات" : "Users & permissions", to: "/team", icon: UsersRound },
        { label: ar ? "بيانات الشركة" : "Company Data", desc: ar ? "الإعدادات والمستندات" : "Settings & documents", to: "/settings/company", icon: Settings2 },
      );
    } else {
      list.push({ label: ar ? "الإعدادات" : "Settings", desc: ar ? "تفضيلاتي" : "My preferences", to: "/settings", icon: Settings2 });
    }
    return list;
  }, [access, ar]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background" dir={dir}>
      {/* Hero */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="absolute inset-0 pointer-events-none opacity-40 [background:radial-gradient(60%_60%_at_10%_0%,hsl(var(--primary)/0.15),transparent),radial-gradient(50%_60%_at_100%_10%,hsl(var(--primary)/0.10),transparent)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {brandName && <span className="font-medium">{brandName}</span>}
                  <Badge variant="secondary" className="text-[10px] font-normal">{roleLabel}</Badge>
                </div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
                  {greeting}{displayName ? `، ${displayName}` : ""}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ar ? "لوحة تحكم مخصّصة حسب دورك في النظام" : "A workspace tailored to your role"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/settings"><Settings2 className="h-3.5 w-3.5 me-1.5" />{ar ? "الإعدادات" : "Settings"}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/workflows"><FileText className="h-3.5 w-3.5 me-1.5" />{ar ? "عرض جديد" : "New Quote"}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPIs */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            const body = (
              <Card className="h-full hover:border-primary/60 hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${k.tint}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{k.label}</div>
                    <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                  </div>
                  {k.to && <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />}
                </CardContent>
              </Card>
            );
            return k.to ? <Link key={k.key} to={k.to}>{body}</Link> : <div key={k.key}>{body}</div>;
          })}
        </section>

        {/* Quick Actions */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {ar ? "الوصول السريع" : "Quick Access"}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.to} to={a.to} className="group">
                  <Card className="h-full hover:border-primary/60 hover:shadow-md transition-all">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{a.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 rtl:rotate-180 transition-opacity" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Admin-only insights row */}
        {access.isAdmin && (
          <section className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {ar ? "صحة النظام" : "System Health"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <HealthRow label={ar ? "المستخدمون المعلّقون" : "Pending users"} value={counts.pendingUsers} warn={counts.pendingUsers > 0} />
                <HealthRow label={ar ? "مستندات قاربت الانتهاء" : "Expiring documents"} value={counts.expiringDocs} warn={counts.expiringDocs > 0} />
                <HealthRow label={ar ? "عروض بانتظار الاعتماد" : "Quotes in approval"} value={counts.quotesPending} />
                <HealthRow label={ar ? "إشعارات غير مقروءة" : "Unread notifications"} value={counts.unreadNotifs} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ToggleRight className="h-4 w-4 text-primary" />
                  {ar ? "إعدادات الشركة" : "Company Setup"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link to="/settings/company" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                  <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{ar ? "بيانات الشركة والمستندات" : "Company data & documents"}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                </Link>
                <Link to="/settings/features" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                  <span className="flex items-center gap-2"><ToggleRight className="h-4 w-4 text-muted-foreground" />{ar ? "مميزات النظام" : "System features"}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                </Link>
                <Link to="/settings/organization" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                  <span className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-muted-foreground" />{ar ? "الهيكل التنظيمي" : "Organization"}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                </Link>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}

function HealthRow({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${warn ? "text-amber-600" : ""}`}>{value}</span>
    </div>
  );
}
