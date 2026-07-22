import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Trash2, Users, Building2, Factory, Ship, ShieldCheck, Truck,
  Landmark, Umbrella, Handshake, Info, Bookmark, BookmarkPlus, X, FileText, History,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScriptInput } from "@/components/ScriptInput";
import { useI18n } from "@/lib/i18n";
import { useConfirm, usePrompt } from "@/hooks/useConfirm";
import {
  usePartners, usePartner, useUpsertPartner, useDeletePartner,
  usePartnerContacts, useUpsertContact, useDeleteContact,
  usePartnerAddresses, useUpsertAddress, useDeleteAddress,
  usePartnerBanks, useUpsertBank, useDeleteBank,
  usePartnerAudit, usePartnerRelated,
} from "@/features/partners/queries";
import { PARTNER_ROLES, type PartnerRole, type BusinessPartner } from "@/features/partners/api";
import { requiredFieldsFor, validatePartner } from "@/features/partners/rules";
import {
  filterDocs, sortDocs, totalsByCurrency, paginate,
  isValidRange, hasActiveFilters, collectStatuses,
  type SortBy, type DocFilters,
} from "@/features/partners/docs-utils";

export const Route = createFileRoute("/_authenticated/partners")({
  head: () => ({
    meta: [
      { title: "شركاء الأعمال — Business Partners" },
      { name: "description", content: "إدارة موحّدة للعملاء والموردين والمصنّعين وشركات الشحن والفحص والبنوك والتأمين والوكلاء." },
      { property: "og:title", content: "Business Partners" },
      { property: "og:description", content: "Unified management for customers, suppliers, manufacturers, and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

const ROLE_ICON: Record<PartnerRole, any> = {
  customer: Users, supplier: Truck, manufacturer: Factory, freight_forwarder: Ship,
  inspection: ShieldCheck, shipping: Truck, bank: Landmark, insurance: Umbrella, agent: Handshake,
};

type AdvFilters = { name: string; tax_id: string; industry: string; address: string };
type SavedFilter = { name: string; role: PartnerRole | "all"; adv: AdvFilters };
const SAVED_KEY = "partners:savedFilters:v1";
const EMPTY_ADV: AdvFilters = { name: "", tax_id: "", industry: "", address: "" };

function PartnersPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [role, setRole] = useState<PartnerRole | "all">("all");
  const [search, setSearch] = useState("");
  const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV);
  const [showAdv, setShowAdv] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedFilter[]>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
  });

  const { data: rows = [], isLoading } = usePartners(role === "all" ? undefined : role, search);
  const upsert = useUpsertPartner();
  const del = useDeletePartner();

  // Client-side advanced filter overlay
  const filtered = useMemo(() => {
    const norm = (v?: string | null) => (v ?? "").toString().toLowerCase();
    return rows.filter((p) => {
      if (adv.name && !`${norm(p.name_ar)} ${norm(p.name_en)} ${norm(p.legal_name)}`.includes(adv.name.toLowerCase())) return false;
      if (adv.tax_id && !norm(p.tax_id).includes(adv.tax_id.toLowerCase())) return false;
      if (adv.industry && !norm(p.industry).includes(adv.industry.toLowerCase())) return false;
      if (adv.address && !`${norm(p.address)} ${norm(p.city)} ${norm(p.country)}`.includes(adv.address.toLowerCase())) return false;
      return true;
    });
  }, [rows, adv]);

  const roleTabs = useMemo(() => [
    { value: "all" as const, ar: "الكل", en: "All", icon: Building2 },
    ...PARTNER_ROLES.map((r) => ({ value: r.value, ar: r.ar, en: r.en, icon: ROLE_ICON[r.value] })),
  ], []);

  useEffect(() => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {} }, [saved]);

  async function handleCreate() {
    try {
      const p = await upsert.mutateAsync({
        name_ar: ar ? "شريك جديد" : null,
        name_en: ar ? null : "New Partner",
        roles: role === "all" ? ["customer"] : [role],
      });
      setOpenId(p.id);
      toast.success(ar ? "تم الإنشاء" : "Created");
    } catch (e: any) {
      toast.error(e?.message ?? (ar ? "تعذّر الإنشاء" : "Create failed"));
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: ar ? "حذف الشريك؟" : "Delete partner?",
      description: ar ? "لن يمكن التراجع عن هذا الإجراء." : "This action cannot be undone.",
      confirmText: ar ? "حذف" : "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try { await del.mutateAsync(id); toast.success(ar ? "تم الحذف" : "Deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function saveCurrentFilter() {
    const name = await prompt({
      title: ar ? "حفظ الفلتر" : "Save filter",
      placeholder: ar ? "اسم الفلتر" : "Filter name",
      required: true,
    });
    if (!name) return;
    setSaved((s) => [...s.filter((x) => x.name !== name), { name, role, adv }]);
    toast.success(ar ? "تم الحفظ" : "Saved");
  }
  function applyFilter(f: SavedFilter) { setRole(f.role); setAdv(f.adv); setShowAdv(true); }
  function removeFilter(name: string) { setSaved((s) => s.filter((x) => x.name !== name)); }

  const hasAdv = Object.values(adv).some(Boolean);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{ar ? "شركاء الأعمال" : "Business Partners"}</h1>
            <p className="text-sm text-muted-foreground">{ar ? "إدارة موحّدة للعملاء والموردين وباقي الأطراف" : "Unified partners across the enterprise"}</p>
          </div>
          <Button onClick={handleCreate} disabled={upsert.isPending}>
            <Plus className="h-4 w-4 me-2" />{ar ? "شريك جديد" : "New Partner"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="ps-8" placeholder={ar ? "بحث سريع بالاسم/الكود/الرقم الضريبي…" : "Quick search…"} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant={showAdv || hasAdv ? "default" : "outline"} size="sm" onClick={() => setShowAdv((v) => !v)}>
            {showAdv ? <ChevronUp className="h-4 w-4 me-1" /> : <ChevronDown className="h-4 w-4 me-1" />}
            {ar ? "بحث متقدّم" : "Advanced"}
            {hasAdv && <Badge variant="secondary" className="ms-2">{Object.values(adv).filter(Boolean).length}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={saveCurrentFilter} disabled={!hasAdv && role === "all"}>
            <BookmarkPlus className="h-4 w-4 me-1" />{ar ? "حفظ الفلتر" : "Save filter"}
          </Button>
        </div>

        {showAdv && (
          <Card><CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input placeholder={ar ? "الاسم" : "Name"} value={adv.name} onChange={(e) => setAdv({ ...adv, name: e.target.value })} />
            <Input placeholder={ar ? "الرقم الضريبي" : "Tax ID"} value={adv.tax_id} onChange={(e) => setAdv({ ...adv, tax_id: e.target.value })} />
            <Input placeholder={ar ? "المجال / الصناعة" : "Industry"} value={adv.industry} onChange={(e) => setAdv({ ...adv, industry: e.target.value })} />
            <Input placeholder={ar ? "العنوان / المدينة / الدولة" : "Address / City / Country"} value={adv.address} onChange={(e) => setAdv({ ...adv, address: e.target.value })} />
            {hasAdv && (
              <Button variant="ghost" size="sm" className="justify-start" onClick={() => setAdv(EMPTY_ADV)}>
                <X className="h-4 w-4 me-1" />{ar ? "مسح الفلاتر" : "Clear filters"}
              </Button>
            )}
          </CardContent></Card>
        )}

        {saved.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {saved.map((f) => (
              <Badge key={f.name} variant="outline" className="cursor-pointer gap-1 py-1" onClick={() => applyFilter(f)}>
                <Bookmark className="h-3 w-3" />{f.name}
                <button className="ms-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeFilter(f.name); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Tabs value={role} onValueChange={(v) => setRole(v as PartnerRole | "all")}>
          <TabsList className="flex flex-wrap h-auto">
            {roleTabs.map((r) => {
              const Icon = r.icon;
              return (
                <TabsTrigger key={r.value} value={r.value} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" /> {ar ? r.ar : r.en}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={role} className="mt-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-10">{t("loading") ?? "…"}</div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                {ar ? "لا توجد نتائج" : "No results"}
              </CardContent></Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <PartnerCard key={p.id} p={p} onOpen={() => setOpenId(p.id)} onDelete={() => handleDelete(p.id)} ar={ar} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <PartnerSheet id={openId} onClose={() => setOpenId(null)} />
      </div>
    </TooltipProvider>
  );
}

function PartnerCard({ p, onOpen, onDelete, ar }: { p: BusinessPartner; onOpen: () => void; onDelete: () => void; ar: boolean }) {
  const name = ar ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar);
  return (
    <Card className="hover:shadow-md transition cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{name || (ar ? "بدون اسم" : "Unnamed")}</div>
            <div className="text-xs text-muted-foreground">{p.code ?? "—"}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {p.roles?.map((r) => {
            const meta = PARTNER_ROLES.find((x) => x.value === r);
            return <Badge key={r} variant="secondary" className="text-[10px]">{ar ? meta?.ar : meta?.en}</Badge>;
          })}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {p.tax_id && <div>#{p.tax_id}</div>}
          {p.industry && <div className="truncate">{p.industry}</div>}
          {p.email && <div className="truncate">{p.email}</div>}
          {p.phone && <div>{p.phone}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function PartnerSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: partner } = usePartner(id);
  const upsert = useUpsertPartner();
  const [form, setForm] = useState<Partial<BusinessPartner>>({});
  const merged = { ...partner, ...form } as BusinessPartner;

  const errors = useMemo(() => partner ? validatePartner(merged, ar) : [], [merged, partner, ar]);
  const errorMap = useMemo(() => Object.fromEntries(errors.map((e) => [e.field, e.message])), [errors]);
  const requiredSet = useMemo(() => new Set(requiredFieldsFor((merged.roles ?? []) as PartnerRole[]).map((r) => String(r.field))), [merged.roles]);

  function set<K extends keyof BusinessPartner>(k: K, v: BusinessPartner[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!id) return;
    if (errors.length > 0) {
      toast.error(ar ? `يوجد ${errors.length} حقل مطلوب` : `${errors.length} required field(s)`);
      return;
    }
    try { await upsert.mutateAsync({ ...form, id }); setForm({}); toast.success(ar ? "تم الحفظ" : "Saved"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) { setForm({}); onClose(); } }}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {ar ? "تفاصيل الشريك" : "Partner Details"}
            {errors.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{errors.length} {ar ? "تنبيه" : "issues"}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {!partner ? <div className="py-10 text-center text-muted-foreground">…</div> : (
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="general">{ar ? "عام" : "General"}</TabsTrigger>
              <TabsTrigger value="contacts">{ar ? "اتصال" : "Contacts"}</TabsTrigger>
              <TabsTrigger value="addresses">{ar ? "عناوين" : "Addr."}</TabsTrigger>
              <TabsTrigger value="banks">{ar ? "بنوك" : "Banks"}</TabsTrigger>
              <TabsTrigger value="docs">{ar ? "مستندات" : "Docs"}</TabsTrigger>
              <TabsTrigger value="audit">{ar ? "التدقيق" : "Audit"}</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <RField label={ar ? "كود" : "Code"} name="code" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.code ?? ""} onChange={(e) => set("code", e.target.value)} />
                </RField>
                <RField label={ar ? "الحالة" : "Status"} name="status" errorMap={errorMap} requiredSet={requiredSet}>
                  <Select value={merged.status ?? "active"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{ar ? "نشط" : "Active"}</SelectItem>
                      <SelectItem value="inactive">{ar ? "متوقّف" : "Inactive"}</SelectItem>
                      <SelectItem value="blocked">{ar ? "محظور" : "Blocked"}</SelectItem>
                    </SelectContent>
                  </Select>
                </RField>
                <RField label={ar ? "الاسم (عربي)" : "Name (Arabic)"} name="name_ar" errorMap={errorMap} requiredSet={requiredSet}>
                  <ScriptInput script="ar" value={merged.name_ar ?? ""} onChange={(v) => set("name_ar", v)} />
                </RField>
                <RField label={ar ? "الاسم (إنجليزي)" : "Name (English)"} name="name_en" errorMap={errorMap} requiredSet={requiredSet}>
                  <ScriptInput script="en" value={merged.name_en ?? ""} onChange={(v) => set("name_en", v)} />
                </RField>
                <RField label={ar ? "الاسم القانوني" : "Legal Name"} name="legal_name" className="col-span-2" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} />
                </RField>
              </div>

              <div>
                <Label className="text-xs">{ar ? "الأدوار" : "Roles"}</Label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PARTNER_ROLES.map((r) => {
                    const active = (merged.roles ?? []).includes(r.value);
                    return (
                      <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border p-2 hover:bg-accent/40">
                        <Checkbox checked={active} onCheckedChange={(v) => {
                          const cur = new Set(merged.roles ?? []);
                          if (v) cur.add(r.value); else cur.delete(r.value);
                          set("roles", Array.from(cur));
                        }} />
                        {ar ? r.ar : r.en}
                      </label>
                    );
                  })}
                </div>
                {requiredSet.size > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {ar ? "حقول إلزامية حسب الأدوار المحددة معروضة بنجمة *" : "Required fields per selected roles are marked with *"}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <RField label={ar ? "الرقم الضريبي" : "Tax ID"} name="tax_id" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />
                </RField>
                <RField label={ar ? "السجل التجاري" : "Commercial Reg."} name="commercial_reg" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.commercial_reg ?? ""} onChange={(e) => set("commercial_reg", e.target.value)} />
                </RField>
                <RField label={ar ? "البريد" : "Email"} name="email" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input type="email" value={merged.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </RField>
                <RField label={ar ? "الموقع" : "Website"} name="website" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.website ?? ""} onChange={(e) => set("website", e.target.value)} />
                </RField>
                <RField label={ar ? "الموبايل" : "Mobile"} name="mobile" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
                </RField>
                <RField label={ar ? "أرضي" : "Phone"} name="phone" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                </RField>
                <RField label={ar ? "فاكس" : "Fax"} name="fax" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.fax ?? ""} onChange={(e) => set("fax", e.target.value)} />
                </RField>
                <RField label={ar ? "الصناعة" : "Industry"} name="industry" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.industry ?? ""} onChange={(e) => set("industry", e.target.value)} />
                </RField>
                <RField label={ar ? "البلد" : "Country"} name="country" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.country ?? ""} onChange={(e) => set("country", e.target.value)} />
                </RField>
                <RField label={ar ? "المدينة" : "City"} name="city" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                </RField>
                <RField label={ar ? "العنوان" : "Address"} name="address" className="col-span-2" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.address ?? ""} onChange={(e) => set("address", e.target.value)} />
                </RField>
                <RField label={ar ? "العملة" : "Currency"} name="currency" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.currency ?? "EGP"} onChange={(e) => set("currency", e.target.value)} />
                </RField>
                <RField label={ar ? "شروط الدفع" : "Payment Terms"} name="payment_terms" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.payment_terms ?? ""} onChange={(e) => set("payment_terms", e.target.value)} />
                </RField>
                <RField label={ar ? "حد الائتمان" : "Credit Limit"} name="credit_limit" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input type="number" value={merged.credit_limit ?? 0} onChange={(e) => set("credit_limit", Number(e.target.value))} />
                </RField>
                <RField label="Incoterm" name="incoterm" errorMap={errorMap} requiredSet={requiredSet}>
                  <Input value={merged.incoterm ?? ""} onChange={(e) => set("incoterm", e.target.value)} />
                </RField>
                <RField label={ar ? "ملاحظات" : "Notes"} name="notes" className="col-span-2" errorMap={errorMap} requiredSet={requiredSet}>
                  <Textarea rows={3} value={merged.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </RField>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="mt-4"><ContactsPanel partnerId={partner.id} ar={ar} /></TabsContent>
            <TabsContent value="addresses" className="mt-4"><AddressesPanel partnerId={partner.id} ar={ar} /></TabsContent>
            <TabsContent value="banks" className="mt-4"><BanksPanel partnerId={partner.id} ar={ar} /></TabsContent>
            <TabsContent value="docs" className="mt-4"><DocsPanel partner={partner} ar={ar} /></TabsContent>
            <TabsContent value="audit" className="mt-4"><AuditPanel partnerId={partner.id} ar={ar} /></TabsContent>
          </Tabs>
        )}

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => { setForm({}); onClose(); }}>{ar ? "إغلاق" : "Close"}</Button>
          <Button onClick={save} disabled={upsert.isPending || Object.keys(form).length === 0}>{ar ? "حفظ" : "Save"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RField({ label, name, children, className, errorMap, requiredSet }: {
  label: string; name: string; children: React.ReactNode; className?: string;
  errorMap: Record<string, string>; requiredSet: Set<string>;
}) {
  const err = errorMap[name];
  const req = requiredSet.has(name);
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className={`text-xs flex items-center gap-1 ${err ? "text-destructive" : "text-muted-foreground"}`}>
        {label}{req && <span className="text-destructive">*</span>}
        {err && (
          <Tooltip>
            <TooltipTrigger asChild><Info className="h-3 w-3 text-destructive" /></TooltipTrigger>
            <TooltipContent side="top">{err}</TooltipContent>
          </Tooltip>
        )}
      </Label>
      <div className={err ? "[&_input]:border-destructive [&_textarea]:border-destructive" : ""}>{children}</div>
    </div>
  );
}

function ContactsPanel({ partnerId, ar }: { partnerId: string; ar: boolean }) {
  const { data: rows = [] } = usePartnerContacts(partnerId);
  const up = useUpsertContact(partnerId);
  const del = useDeleteContact(partnerId);
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => up.mutate({ partner_id: partnerId, name: ar ? "جديد" : "New" })}>
        <Plus className="h-4 w-4 me-1" />{ar ? "إضافة جهة اتصال" : "Add Contact"}
      </Button>
      {rows.map((c) => (
        <Card key={c.id}><CardContent className="p-3 grid grid-cols-2 gap-2">
          <Input placeholder={ar ? "الاسم" : "Name"} defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && up.mutate({ id: c.id, name: e.target.value })} />
          <Input placeholder={ar ? "المسمى" : "Title"} defaultValue={c.title ?? ""} onBlur={(e) => up.mutate({ id: c.id, title: e.target.value })} />
          <Input placeholder={ar ? "البريد" : "Email"} defaultValue={c.email ?? ""} onBlur={(e) => up.mutate({ id: c.id, email: e.target.value })} />
          <Input placeholder={ar ? "الموبايل" : "Mobile"} defaultValue={c.mobile ?? ""} onBlur={(e) => up.mutate({ id: c.id, mobile: e.target.value })} />
          <div className="col-span-2 flex justify-between items-center">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={c.is_default} onCheckedChange={(v) => up.mutate({ id: c.id, is_default: Boolean(v) })} />
              {ar ? "افتراضي" : "Default"}
            </label>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

function AddressesPanel({ partnerId, ar }: { partnerId: string; ar: boolean }) {
  const { data: rows = [] } = usePartnerAddresses(partnerId);
  const up = useUpsertAddress(partnerId);
  const del = useDeleteAddress(partnerId);
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => up.mutate({ partner_id: partnerId, address_type: "billing", label: ar ? "عنوان جديد" : "New Address" })}>
        <Plus className="h-4 w-4 me-1" />{ar ? "إضافة عنوان" : "Add Address"}
      </Button>
      {rows.map((a) => (
        <Card key={a.id}><CardContent className="p-3 grid grid-cols-2 gap-2">
          <Input placeholder={ar ? "التسمية" : "Label"} defaultValue={a.label ?? ""} onBlur={(e) => up.mutate({ id: a.id, label: e.target.value })} />
          <Select value={a.address_type} onValueChange={(v) => up.mutate({ id: a.id, address_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="billing">{ar ? "فوترة" : "Billing"}</SelectItem>
              <SelectItem value="shipping">{ar ? "شحن" : "Shipping"}</SelectItem>
              <SelectItem value="office">{ar ? "مكتب" : "Office"}</SelectItem>
            </SelectContent>
          </Select>
          <Input className="col-span-2" placeholder={ar ? "العنوان" : "Address"} defaultValue={a.address ?? ""} onBlur={(e) => up.mutate({ id: a.id, address: e.target.value })} />
          <Input placeholder={ar ? "المدينة" : "City"} defaultValue={a.city ?? ""} onBlur={(e) => up.mutate({ id: a.id, city: e.target.value })} />
          <Input placeholder={ar ? "البلد" : "Country"} defaultValue={a.country ?? ""} onBlur={(e) => up.mutate({ id: a.id, country: e.target.value })} />
          <div className="col-span-2 flex justify-between items-center">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={a.is_default} onCheckedChange={(v) => up.mutate({ id: a.id, is_default: Boolean(v) })} />
              {ar ? "افتراضي" : "Default"}
            </label>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

function BanksPanel({ partnerId, ar }: { partnerId: string; ar: boolean }) {
  const { data: rows = [] } = usePartnerBanks(partnerId);
  const up = useUpsertBank(partnerId);
  const del = useDeleteBank(partnerId);
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => up.mutate({ partner_id: partnerId, bank_name: ar ? "بنك" : "Bank" })}>
        <Plus className="h-4 w-4 me-1" />{ar ? "إضافة حساب" : "Add Account"}
      </Button>
      {rows.map((b) => (
        <Card key={b.id}><CardContent className="p-3 grid grid-cols-2 gap-2">
          <Input placeholder={ar ? "البنك" : "Bank"} defaultValue={b.bank_name} onBlur={(e) => e.target.value !== b.bank_name && up.mutate({ id: b.id, bank_name: e.target.value })} />
          <Input placeholder={ar ? "الفرع" : "Branch"} defaultValue={b.branch ?? ""} onBlur={(e) => up.mutate({ id: b.id, branch: e.target.value })} />
          <Input placeholder={ar ? "اسم الحساب" : "Account Name"} defaultValue={b.account_name ?? ""} onBlur={(e) => up.mutate({ id: b.id, account_name: e.target.value })} />
          <Input placeholder={ar ? "رقم الحساب" : "Account No"} defaultValue={b.account_no ?? ""} onBlur={(e) => up.mutate({ id: b.id, account_no: e.target.value })} />
          <Input placeholder="IBAN" defaultValue={b.iban ?? ""} onBlur={(e) => up.mutate({ id: b.id, iban: e.target.value })} />
          <Input placeholder="SWIFT" defaultValue={b.swift ?? ""} onBlur={(e) => up.mutate({ id: b.id, swift: e.target.value })} />
          <Input placeholder={ar ? "العملة" : "Currency"} defaultValue={b.currency} onBlur={(e) => up.mutate({ id: b.id, currency: e.target.value })} />
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={b.is_default} onCheckedChange={(v) => up.mutate({ id: b.id, is_default: Boolean(v) })} />
              {ar ? "افتراضي" : "Default"}
            </label>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

function DocsPanel({ partner, ar }: { partner: BusinessPartner; ar: boolean }) {
  const { data: rows = [], isLoading } = usePartnerRelated(partner);
  const [kind, setKind] = useState<DocFilters["kind"]>("all");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortBy>("date_desc");
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  const statuses = useMemo(() => collectStatuses(rows), [rows]);
  // If the previously selected status disappears from the dataset, fall back to "all"
  useEffect(() => {
    if (status !== "all" && !statuses.includes(status)) setStatus("all");
  }, [statuses, status]);

  const filters: DocFilters = { kind, status, from, to };
  const rangeValid = isValidRange(from, to);
  const filtered = useMemo(
    () => sortDocs(filterDocs(rows, filters), sortBy),
    [rows, kind, status, from, to, sortBy],
  );
  const totals = useMemo(() => totalsByCurrency(filtered), [filtered]);

  // reset to page 1 whenever filters/sort/page-size change
  useEffect(() => { setPage(1); }, [kind, status, from, to, sortBy, pageSize]);

  const { totalPages, currentPage, pageStart, pageEnd, paged } = paginate(filtered, page, pageSize);

  const labelKind = (k: string) => ar
    ? ({ quote: "عرض سعر", customer: "عميل مرتبط", stock_movement: "حركة مخزون" } as any)[k] ?? k
    : ({ quote: "Quote", customer: "Linked Customer", stock_movement: "Stock Movement" } as any)[k] ?? k;

  if (isLoading) return <div className="text-center text-muted-foreground py-6">…</div>;

  const clearAll = () => { setKind("all"); setStatus("all"); setFrom(""); setTo(""); };
  const hasFilters = hasActiveFilters(filters);

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{ar ? "النوع" : "Type"}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
              <SelectItem value="quote">{labelKind("quote")}</SelectItem>
              <SelectItem value="customer">{labelKind("customer")}</SelectItem>
              <SelectItem value="stock_movement">{labelKind("stock_movement")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{ar ? "الحالة" : "Status"}</Label>
          <Select value={status} onValueChange={setStatus} disabled={statuses.length === 0}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{ar ? "من تاريخ" : "From"}</Label>
          <Input type="date" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{ar ? "إلى تاريخ" : "To"}</Label>
          <Input type="date" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{ar ? "ترتيب" : "Sort"}</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">{ar ? "الأحدث أولاً" : "Newest first"}</SelectItem>
              <SelectItem value="date_asc">{ar ? "الأقدم أولاً" : "Oldest first"}</SelectItem>
              <SelectItem value="amount_desc">{ar ? "المبلغ (تنازلي)" : "Amount (high → low)"}</SelectItem>
              <SelectItem value="amount_asc">{ar ? "المبلغ (تصاعدي)" : "Amount (low → high)"}</SelectItem>
              <SelectItem value="title_asc">{ar ? "الاسم (أ→ي)" : "Title (A→Z)"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{ar ? "حجم الصفحة" : "Page size"}</Label>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="justify-start col-span-2 md:col-span-4" onClick={clearAll}>
            <X className="h-4 w-4 me-1" />{ar ? "مسح الفلاتر" : "Clear filters"}
          </Button>
        )}
        {!rangeValid && (
          <div className="col-span-2 md:col-span-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1.5">
            {ar ? "نطاق التاريخ غير صالح: «من» بعد «إلى»." : "Invalid date range: “From” is after “To”."}
          </div>
        )}
      </CardContent></Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{ar ? `${filtered.length} نتيجة` : `${filtered.length} results`}</Badge>
          <span>{ar ? `من إجمالي ${rows.length}` : `of ${rows.length} total`}</span>
        </div>
        {Object.keys(totals).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px]">{ar ? "الإجمالي:" : "Totals:"}</span>
            {Object.entries(totals).map(([cur, tot]) => (
              <Badge key={cur} variant="secondary" className="text-[10px]">
                {tot.toLocaleString(undefined, { maximumFractionDigits: 2 })} {cur}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? (ar ? "لا توجد مستندات مرتبطة بعد." : "No linked documents yet.")
            : (ar ? "لا توجد نتائج مطابقة." : "No matching results.")}
        </CardContent></Card>
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((r) => (
              <a key={`${r.kind}:${r.id}`} href={r.link ?? undefined} className="block">
                <Card className="hover:shadow-sm transition"><CardContent className="p-3 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{labelKind(r.kind)}</Badge>
                      {r.status && <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>}
                      <div className="font-medium truncate">{r.title}</div>
                    </div>
                    {r.subtitle && <div className="text-xs text-muted-foreground truncate">{r.subtitle}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground text-end shrink-0">
                    {r.amount != null && <div>{Number(r.amount).toLocaleString()} {r.currency ?? ""}</div>}
                    {r.date && <div>{new Date(r.date).toLocaleDateString()}</div>}
                  </div>
                </CardContent></Card>
              </a>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-muted-foreground">
                {ar
                  ? `عرض ${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} من ${filtered.length}`
                  : `Showing ${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length}`}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={currentPage === 1}>«</Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</Button>
                <span className="text-xs px-2 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>»</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function AuditPanel({ partnerId, ar }: { partnerId: string; ar: boolean }) {
  const { data: rows = [], isLoading, error } = usePartnerAudit(partnerId);
  if (isLoading) return <div className="text-center text-muted-foreground py-6">…</div>;
  if (error) return <div className="text-center text-destructive py-6 text-sm">{ar ? "لا صلاحية لعرض التدقيق" : "No permission to view audit"}</div>;
  if (rows.length === 0) return (
    <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
      {ar ? "لا توجد تغييرات مسجّلة." : "No recorded changes."}
    </CardContent></Card>
  );
  const label = (a: string) => ar
    ? ({ create: "إنشاء", update: "تعديل", delete: "حذف" } as any)[a] ?? a
    : a;
  return (
    <div className="space-y-2">
      {rows.map((e) => (
        <Card key={e.id}><CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px]">{label(e.action)}</Badge>
              <span className="text-sm">{e.actor_email ?? (ar ? "مستخدم" : "user")}</span>
            </div>
            <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
          </div>
          {e.before && e.action === "update" && (
            <div className="mt-2 grid gap-1">
              {Object.entries(e.before as Record<string, { from: any; to: any }>).map(([field, d]) => (
                <div key={field} className="text-xs flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{field}:</span>
                  <span className="text-muted-foreground line-through">{String(d.from ?? "—")}</span>
                  <span>→</span>
                  <span>{String(d.to ?? "—")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}
