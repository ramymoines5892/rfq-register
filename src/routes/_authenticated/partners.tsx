import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2, Users, Building2, Factory, Ship, ShieldCheck, Truck, Landmark, Umbrella, Handshake } from "lucide-react";
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
import { ScriptInput } from "@/components/ScriptInput";
import { useI18n } from "@/lib/i18n";
import {
  usePartners, usePartner, useUpsertPartner, useDeletePartner,
  usePartnerContacts, useUpsertContact, useDeleteContact,
  usePartnerAddresses, useUpsertAddress, useDeleteAddress,
  usePartnerBanks, useUpsertBank, useDeleteBank,
} from "@/features/partners/queries";
import { PARTNER_ROLES, type PartnerRole, type BusinessPartner } from "@/features/partners/api";

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

function PartnersPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [role, setRole] = useState<PartnerRole | "all">("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: rows = [], isLoading } = usePartners(role === "all" ? undefined : role, search);
  const upsert = useUpsertPartner();
  const del = useDeletePartner();

  const roleTabs = useMemo(() => [
    { value: "all" as const, ar: "الكل", en: "All", icon: Building2 },
    ...PARTNER_ROLES.map((r) => ({ value: r.value, ar: r.ar, en: r.en, icon: ROLE_ICON[r.value] })),
  ], []);

  async function handleCreate() {
    try {
      const p = await upsert.mutateAsync({ name_ar: ar ? "شريك جديد" : null, name_en: ar ? null : "New Partner", roles: role === "all" ? ["customer"] : [role] });
      setOpenId(p.id); setCreating(false);
      toast.success(ar ? "تم الإنشاء" : "Created");
    } catch (e: any) {
      toast.error(e?.message ?? (ar ? "تعذّر الإنشاء" : "Create failed"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(ar ? "حذف الشريك؟" : "Delete partner?")) return;
    try { await del.mutateAsync(id); toast.success(ar ? "تم الحذف" : "Deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={ar ? "بحث بالاسم/الكود/الرقم الضريبي…" : "Search by name / code / tax id…"} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

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
          ) : rows.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {ar ? "لا يوجد شركاء بعد" : "No partners yet"}
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((p) => (
                <PartnerCard key={p.id} p={p} onOpen={() => setOpenId(p.id)} onDelete={() => handleDelete(p.id)} ar={ar} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PartnerSheet id={openId} onClose={() => setOpenId(null)} />
      {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
      {creating}
    </div>
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

  function set<K extends keyof BusinessPartner>(k: K, v: BusinessPartner[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!id) return;
    try { await upsert.mutateAsync({ ...form, id }); setForm({}); toast.success(ar ? "تم الحفظ" : "Saved"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) { setForm({}); onClose(); } }}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{ar ? "تفاصيل الشريك" : "Partner Details"}</SheetTitle>
        </SheetHeader>

        {!partner ? <div className="py-10 text-center text-muted-foreground">…</div> : (
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="general">{ar ? "عام" : "General"}</TabsTrigger>
              <TabsTrigger value="contacts">{ar ? "جهات اتصال" : "Contacts"}</TabsTrigger>
              <TabsTrigger value="addresses">{ar ? "العناوين" : "Addresses"}</TabsTrigger>
              <TabsTrigger value="banks">{ar ? "بنوك" : "Banks"}</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label={ar ? "كود" : "Code"}>
                  <Input value={merged.code ?? ""} onChange={(e) => set("code", e.target.value)} />
                </Field>
                <Field label={ar ? "الحالة" : "Status"}>
                  <Select value={merged.status ?? "active"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{ar ? "نشط" : "Active"}</SelectItem>
                      <SelectItem value="inactive">{ar ? "متوقّف" : "Inactive"}</SelectItem>
                      <SelectItem value="blocked">{ar ? "محظور" : "Blocked"}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={ar ? "الاسم (عربي)" : "Name (Arabic)"}>
                  <ScriptInput script="ar" value={merged.name_ar ?? ""} onChange={(v) => set("name_ar", v)} />
                </Field>
                <Field label={ar ? "الاسم (إنجليزي)" : "Name (English)"}>
                  <ScriptInput script="en" value={merged.name_en ?? ""} onChange={(v) => set("name_en", v)} />
                </Field>
                <Field label={ar ? "الاسم القانوني" : "Legal Name"} className="col-span-2">
                  <Input value={merged.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} />
                </Field>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={ar ? "الرقم الضريبي" : "Tax ID"}>
                  <Input value={merged.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />
                </Field>
                <Field label={ar ? "السجل التجاري" : "Commercial Reg."}>
                  <Input value={merged.commercial_reg ?? ""} onChange={(e) => set("commercial_reg", e.target.value)} />
                </Field>
                <Field label={ar ? "البريد" : "Email"}>
                  <Input type="email" value={merged.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label={ar ? "الموقع" : "Website"}>
                  <Input value={merged.website ?? ""} onChange={(e) => set("website", e.target.value)} />
                </Field>
                <Field label={ar ? "الموبايل" : "Mobile"}>
                  <Input value={merged.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
                </Field>
                <Field label={ar ? "أرضي" : "Phone"}>
                  <Input value={merged.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label={ar ? "فاكس" : "Fax"}>
                  <Input value={merged.fax ?? ""} onChange={(e) => set("fax", e.target.value)} />
                </Field>
                <Field label={ar ? "الصناعة" : "Industry"}>
                  <Input value={merged.industry ?? ""} onChange={(e) => set("industry", e.target.value)} />
                </Field>
                <Field label={ar ? "البلد" : "Country"}>
                  <Input value={merged.country ?? ""} onChange={(e) => set("country", e.target.value)} />
                </Field>
                <Field label={ar ? "المدينة" : "City"}>
                  <Input value={merged.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label={ar ? "العنوان" : "Address"} className="col-span-2">
                  <Input value={merged.address ?? ""} onChange={(e) => set("address", e.target.value)} />
                </Field>
                <Field label={ar ? "العملة" : "Currency"}>
                  <Input value={merged.currency ?? "EGP"} onChange={(e) => set("currency", e.target.value)} />
                </Field>
                <Field label={ar ? "شروط الدفع" : "Payment Terms"}>
                  <Input value={merged.payment_terms ?? ""} onChange={(e) => set("payment_terms", e.target.value)} />
                </Field>
                <Field label={ar ? "حد الائتمان" : "Credit Limit"}>
                  <Input type="number" value={merged.credit_limit ?? 0} onChange={(e) => set("credit_limit", Number(e.target.value))} />
                </Field>
                <Field label={ar ? "Incoterm" : "Incoterm"}>
                  <Input value={merged.incoterm ?? ""} onChange={(e) => set("incoterm", e.target.value)} />
                </Field>
                <Field label={ar ? "ملاحظات" : "Notes"} className="col-span-2">
                  <Textarea rows={3} value={merged.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="mt-4"><ContactsPanel partnerId={partner.id} ar={ar} /></TabsContent>
            <TabsContent value="addresses" className="mt-4"><AddressesPanel partnerId={partner.id} ar={ar} /></TabsContent>
            <TabsContent value="banks" className="mt-4"><BanksPanel partnerId={partner.id} ar={ar} /></TabsContent>
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
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
