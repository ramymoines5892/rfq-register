import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { semanticSearch } from "@/lib/semantic-search.functions";
import { useAccess } from "@/hooks/useAccess";
import {
  Users,
  FileText,
  Workflow,
  UserRound,
  Settings2,
  LayoutGrid,
  Trash2,
  Bell,
  Search,
  Building2,
  Clock,
  Sparkles,
} from "lucide-react";

type Hit = {
  entity: "customer" | "quote" | "workflow" | "user";
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
  rank: number;
};

type PageEntry = {
  to: string;
  labelAr: string;
  labelEn: string;
  keywords: string;
  icon: typeof Settings2;
  group: "data" | "settings" | "admin";
  /** Optional gate — page hidden from search when it returns false. */
  when?: (a: import("@/hooks/useAccess").Access) => boolean;
};

const PAGES: PageEntry[] = [
  { to: "/", labelAr: "لوحة التحكم", labelEn: "Dashboard", keywords: "home overview dashboard الرئيسية", icon: LayoutGrid, group: "data" },
  { to: "/customers", labelAr: "العملاء", labelEn: "Customers", keywords: "clients customers عملاء زبائن", icon: Users, group: "data" },
  { to: "/workflows", labelAr: "عروض الأسعار وسير العمل", labelEn: "Quotes & Workflows", keywords: "quotes workflow approvals عروض اسعار موافقات", icon: Workflow, group: "data" },
  { to: "/hr", labelAr: "الموارد البشرية", labelEn: "HR", keywords: "hr users employees team members موظفين موارد بشرية فريق أدوار صلاحيات", icon: Building2, group: "admin", when: (a) => a.isAdmin },
  { to: "/settings", labelAr: "الإعدادات", labelEn: "Settings", keywords: "settings preferences الإعدادات", icon: Settings2, group: "settings", when: (a) => a.isAdmin || a.canManageFormFields },
  { to: "/settings/form-builder", labelAr: "منشئ الحقول", labelEn: "Form Builder", keywords: "fields forms builder حقول تخصيص نماذج", icon: LayoutGrid, group: "settings", when: (a) => a.canManageFormFields },
  { to: "/settings/notifications", labelAr: "الإشعارات", labelEn: "Notifications", keywords: "notifications alerts إشعارات تنبيهات", icon: Bell, group: "settings", when: (a) => a.canManageNotifications },
  { to: "/settings/search", labelAr: "البحث الذكي", labelEn: "AI Search", keywords: "search semantic ai بحث ذكي دلالي embeddings", icon: Sparkles, group: "settings", when: (a) => a.canManageSemanticSearch },
  { to: "/settings/trash", labelAr: "سلة المحذوفات", labelEn: "Trash", keywords: "trash deleted recycle bin سلة محذوفات", icon: Trash2, group: "settings", when: (a) => a.canViewTrash },
];


const ICONS: Record<Hit["entity"], typeof Users> = {
  customer: Users,
  quote: FileText,
  workflow: Workflow,
  user: UserRound,
};

const LABELS: Record<Hit["entity"], { ar: string; en: string }> = {
  customer: { ar: "عميل", en: "Customer" },
  quote: { ar: "عرض سعر", en: "Quote" },
  workflow: { ar: "سير عمل", en: "Workflow" },
  user: { ar: "مستخدم", en: "User" },
};

export function GlobalSearch() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const access = useAccess();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [recent, setRecent] = useState<{ link: string; title: string; entity: string; hits: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiMode, setAiMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("search.ai.enabled") === "1";
  });
  const runSemantic = useServerFn(semanticSearch);


  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("search.ai.enabled", aiMode ? "1" : "0");
    }
  }, [aiMode]);

  // Cmd/Ctrl+K + custom open event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-global-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-global-search", onOpen);
    };
  }, []);

  // Recent frequently-visited items (personalization signal)
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("search_history")
        .select("clicked_link, clicked_entity, query")
        .not("clicked_link", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);
      const counts = new Map<string, { link: string; title: string; entity: string; hits: number }>();
      for (const r of data ?? []) {
        const key = r.clicked_link as string;
        if (!key) continue;
        const cur = counts.get(key);
        if (cur) cur.hits++;
        else counts.set(key, { link: key, title: (r.query as string) || key, entity: (r.clicked_entity as string) || "page", hits: 1 });
      }
      setRecent(Array.from(counts.values()).sort((a, b) => b.hits - a.hits).slice(0, 5));
    })();
  }, [open]);

  // Debounced server search (plain or AI)
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (aiMode) {
          const rows = await runSemantic({ data: { q: s, limit: 8 } });
          setHits(
            (rows ?? []).map((r) => ({
              entity: r.entity as Hit["entity"],
              id: r.entity_id,
              title: r.title,
              subtitle: r.subtitle,
              link: r.link,
              rank: r.similarity,
            })),
          );
        } else {
          const { data, error } = await supabase.rpc("global_search", { _q: s, _limit: 6 });
          if (!error && data) setHits(data as Hit[]);
        }
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, aiMode ? 320 : 180);
    return () => clearTimeout(t);
  }, [q, aiMode, runSemantic]);

  const filteredPages = useMemo(() => {
    // Access gate FIRST: never show pages the user cannot open.
    const allowed = access.ready
      ? PAGES.filter((p) => !p.when || p.when(access))
      : PAGES.filter((p) => !p.when); // before access loads, show only ungated
    const s = q.trim().toLowerCase();
    if (!s) return allowed;
    return allowed.filter((p) =>
      (ar ? p.labelAr : p.labelEn).toLowerCase().includes(s) ||
      p.keywords.toLowerCase().includes(s) ||
      p.to.toLowerCase().includes(s),
    );
  }, [q, ar, access]);


  const go = async (link: string, entity: string, id?: string) => {
    setOpen(false);
    setQ("");
    // fire-and-forget analytics for smart ranking
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      supabase.from("search_history").insert({
        user_id: u.user.id,
        query: q || link,
        clicked_entity: entity,
        clicked_id: id ?? null,
        clicked_link: link,
      });
    }
    // internal links: strip origin if any
    router.history.push(link);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        <CommandInput
          placeholder={
            aiMode
              ? ar ? "اسأل بالمعنى… (AI)" : "Ask by meaning… (AI)"
              : ar ? "ابحث عن أي شيء… (⌘K)" : "Search anything… (⌘K)"
          }
          value={q}
          onValueChange={setQ}
        />
        <button
          type="button"
          onClick={() => setAiMode((v) => !v)}
          className={`absolute top-1/2 -translate-y-1/2 ${ar ? "left-10" : "right-10"} inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium transition-colors ${
            aiMode
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}

          title={ar ? "بحث ذكي بالمعنى" : "Semantic AI search"}
        >
          <Sparkles className="h-3 w-3" />
          AI
        </button>
      </div>
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          {loading ? (ar ? "جارٍ البحث…" : "Searching…") : (ar ? "لا نتائج" : "No results")}
        </CommandEmpty>

        {!q && recent.length > 0 && (
          <CommandGroup heading={ar ? "الأخيرة" : "Recent"}>
            {recent.map((r) => (
              <CommandItem key={r.link} value={`recent ${r.link} ${r.title}`} onSelect={() => go(r.link, r.entity)}>
                <Clock className="h-4 w-4 me-2 opacity-70" />
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-[10px] text-muted-foreground">{r.link}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hits.length > 0 && (
          <>
            {(["customer", "quote", "workflow", "user"] as const).map((ent) => {
              const group = hits.filter((h) => h.entity === ent);
              if (!group.length) return null;
              const Icon = ICONS[ent];
              return (
                <CommandGroup key={ent} heading={ar ? LABELS[ent].ar : LABELS[ent].en}>
                  {group.map((h) => (
                    <CommandItem
                      key={ent + h.id}
                      value={`${ent} ${h.title} ${h.subtitle ?? ""}`}
                      onSelect={() => go(h.link, ent, h.id)}
                    >
                      <Icon className="h-4 w-4 me-2 opacity-70" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{h.title}</div>
                        {h.subtitle && <div className="text-[11px] text-muted-foreground truncate">{h.subtitle}</div>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading={ar ? "الصفحات والإعدادات" : "Pages & Settings"}>
          {filteredPages.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem
                key={p.to}
                value={`page ${p.to} ${p.labelAr} ${p.labelEn} ${p.keywords}`}
                onSelect={() => go(p.to, "page")}
              >
                <Icon className="h-4 w-4 me-2 opacity-70" />
                <span className="flex-1 truncate">{ar ? p.labelAr : p.labelEn}</span>
                <span className="text-[10px] text-muted-foreground">{p.to}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Inline search input that shows results in a popover as the user types.
 * No dialog/popup on click — typing is enabled directly. Cmd/Ctrl+K focuses it.
 */
export function GlobalSearchTrigger({ className = "" }: { className?: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const router = useRouter();
  const access = useAccess();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setHits([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("global_search", { _q: s, _limit: 6 });
        if (!error && data) setHits(data as Hit[]);
      } catch { setHits([]); }
      finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const filteredPages = useMemo(() => {
    const allowed = access.ready
      ? PAGES.filter((p) => !p.when || p.when(access))
      : PAGES.filter((p) => !p.when);
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return allowed.filter((p) =>
      (ar ? p.labelAr : p.labelEn).toLowerCase().includes(s) ||
      p.keywords.toLowerCase().includes(s) ||
      p.to.toLowerCase().includes(s),
    ).slice(0, 6);
  }, [q, ar, access]);

  const go = (link: string) => {
    setQ("");
    setFocused(false);
    inputRef.current?.blur();
    router.history.push(link);
  };

  const show = focused && q.trim().length >= 2;
  const hasAnything = hits.length > 0 || filteredPages.length > 0;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 start-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={ar ? "بحث سريع…" : "Quick search…"}
          className="w-full h-9 ps-8 pe-12 rounded-lg bg-sidebar-accent/60 hover:bg-sidebar-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/60 border border-transparent focus:border-border transition"
        />
        <kbd className="hidden lg:inline absolute top-1/2 -translate-y-1/2 end-2 text-[9px] px-1.5 py-0.5 rounded bg-sidebar/60 border border-sidebar-border text-sidebar-foreground/70">⌘K</kbd>
      </div>

      {show && (
        <div
          className="absolute z-50 top-full mt-1 start-0 end-0 min-w-[280px] rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="max-h-[380px] overflow-y-auto scrollbar-slim">
            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{ar ? "جارٍ البحث…" : "Searching…"}</div>
            )}
            {!loading && !hasAnything && (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">{ar ? "لا نتائج" : "No results"}</div>
            )}

            {hits.length > 0 && (
              <div className="py-1">
                {(["customer", "quote", "workflow", "user"] as const).map((ent) => {
                  const group = hits.filter((h) => h.entity === ent);
                  if (!group.length) return null;
                  const Icon = ICONS[ent];
                  return (
                    <div key={ent}>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ar ? LABELS[ent].ar : LABELS[ent].en}
                      </div>
                      {group.map((h) => (
                        <button
                          key={ent + h.id}
                          type="button"
                          onClick={() => go(h.link)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-start"
                        >
                          <Icon className="h-3.5 w-3.5 opacity-70 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{h.title}</div>
                            {h.subtitle && <div className="text-[10px] text-muted-foreground truncate">{h.subtitle}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {filteredPages.length > 0 && (
              <div className="py-1 border-t">
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {ar ? "الصفحات والإعدادات" : "Pages & Settings"}
                </div>
                {filteredPages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.to}
                      type="button"
                      onClick={() => go(p.to)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-start"
                    >
                      <Icon className="h-3.5 w-3.5 opacity-70 shrink-0" />
                      <span className="flex-1 truncate">{ar ? p.labelAr : p.labelEn}</span>
                      <span className="text-[10px] text-muted-foreground">{p.to}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
