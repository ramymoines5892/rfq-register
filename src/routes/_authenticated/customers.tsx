import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Users, AlertTriangle, Receipt, Phone, Mail, Globe, MapPin, Building2, Landmark, Star, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { parseTerms, stringifyTerms, parseList, stringifyList, type TermItem } from "@/lib/terms";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "العملاء" }, { name: "description", content: "إدارة العملاء والأشخاص المسؤولين والحسابات البنكية" }] }),
});

type Customer = {
  id: string;
  user_id: string;
  name: string;
  tax_id: string | null;
  currency: string;
  terms: string | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  payment_terms: string | null;
  created_at: string;
};

type Contact = {
  id: string;
  customer_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

type Bank = {
  id: string;
  customer_id: string;
  bank_name: string;
  account_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  branch: string | null;
  is_primary: boolean;
  notes: string | null;
};

const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];

function CustomersPage() {
  const { t, lang } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(s) ||
          (c.tax_id ?? "").toLowerCase().includes(s) ||
          (c.email ?? "").toLowerCase().includes(s) ||
          (c.phone ?? "").toLowerCase().includes(s)
        );
      }),
    [customers, search],
  );

  async function handleDelete(c: Customer) {
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
    load();
  }

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-br from-primary via-primary to-[oklch(0.32_0.07_160)] text-primary-foreground">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-xl bg-accent/90 flex items-center justify-center text-accent-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t("customers")}</h1>
              <p className="text-sm opacity-80">
                {lang === "ar" ? "بيانات العملاء، الأشخاص المسؤولون، الحسابات البنكية والشروط الخاصة" : "Customers, contact persons, bank accounts and special terms"}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" style={{ insetInlineStart: "0.75rem" }} />
              <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-10 bg-background/95 text-foreground" />
            </div>
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 me-1" /> {t("addCustomer")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">{t("noCustomersYet")}</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <Card key={c.id} className="group hover:shadow-lg transition-shadow border-l-4 border-l-primary">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg truncate">{c.name}</h3>
                      {c.industry && <p className="text-xs text-muted-foreground truncate">{c.industry}</p>}
                    </div>
                    <Badge className="bg-accent text-accent-foreground shrink-0">{c.currency}</Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {c.tax_id && (
                      <div className="flex items-center gap-1.5"><Receipt className="h-3 w-3" /><span dir="ltr">{c.tax_id}</span></div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /><span className="truncate" dir="ltr">{c.email}</span></div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /><span dir="ltr">{c.phone}</span></div>
                    )}
                    {(c.city || c.country) && (
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /><span>{[c.city, c.country].filter(Boolean).join(", ")}</span></div>
                    )}
                  </div>

                  <div className="flex justify-end gap-1 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
                          <AlertDialogDescription>{c.name}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c)}>{t("delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} customer={editing} onSaved={load} />
    </div>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer | null;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const emptyForm = {
    name: "", tax_id: "", currency: "EGP", notes: "",
    email: "", phone: "", website: "", address: "", city: "", country: "", industry: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [paymentTermsList, setPaymentTermsList] = useState<string[]>([]);
  const [paymentInput, setPaymentInput] = useState("");
  const [taxIdConflict, setTaxIdConflict] = useState<{ name: string; ownedByMe: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("main");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        name: customer.name,
        tax_id: customer.tax_id ?? "",
        currency: customer.currency,
        notes: customer.notes ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        website: customer.website ?? "",
        address: customer.address ?? "",
        city: customer.city ?? "",
        country: customer.country ?? "",
        industry: customer.industry ?? "",
      });
      setTerms(parseTerms(customer.terms));
      setPaymentTermsList(parseList(customer.payment_terms));
      loadRelated(customer.id);
    } else {
      setForm(emptyForm);
      setTerms([]);
      setPaymentTermsList([]);
      setContacts([]);
      setBanks([]);
    }
    setPaymentInput("");
    setTaxIdConflict(null);
    setTab("main");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  async function loadRelated(customerId: string) {
    const [{ data: cs }, { data: bs }] = await Promise.all([
      supabase.from("customer_contacts").select("*").eq("customer_id", customerId).order("created_at"),
      supabase.from("customer_banks").select("*").eq("customer_id", customerId).order("created_at"),
    ]);
    setContacts((cs ?? []) as Contact[]);
    setBanks((bs ?? []) as Bank[]);
  }

  useEffect(() => {
    const tid = form.tax_id.trim();
    if (!tid) { setTaxIdConflict(null); return; }
    if (customer && customer.tax_id === tid) { setTaxIdConflict(null); return; }
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? "";
      const { data, error } = await supabase.rpc("find_customer_by_tax_id", { _tax_id: tid });
      if (!error && data && data.length > 0) {
        const row = data[0] as { id: string; name: string; owner_id: string };
        if (!customer || row.id !== customer.id) {
          setTaxIdConflict({ name: row.name, ownedByMe: row.owner_id === uid });
        } else setTaxIdConflict(null);
      } else setTaxIdConflict(null);
      setChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.tax_id, customer]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (taxIdConflict) { toast.error(`${t("taxIdInUse")}: ${taxIdConflict.name}`); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const payload = {
        name: form.name.trim(),
        tax_id: form.tax_id.trim() || null,
        currency: form.currency,
        terms: stringifyTerms(terms),
        notes: form.notes.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        industry: form.industry.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
      };

      if (customer) {
        const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...payload, user_id: uid });
        if (error) {
          if (error.code === "23505" || /duplicate|unique/i.test(error.message)) throw new Error(t("taxIdInUse"));
          throw error;
        }
      }
      toast.success(t("customerSaved"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Contact operations (only when editing existing customer)
  async function addContact() {
    if (!customer) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id!;
    const { data, error } = await supabase.from("customer_contacts").insert({
      customer_id: customer.id, user_id: uid, name: lang === "ar" ? "مسؤول جديد" : "New contact",
    }).select().single();
    if (error) return toast.error(error.message);
    setContacts([...contacts, data as Contact]);
  }

  async function updateContact(id: string, patch: Partial<Contact>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("customer_contacts").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function deleteContact(id: string) {
    const { error } = await supabase.from("customer_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function addBank() {
    if (!customer) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id!;
    const { data, error } = await supabase.from("customer_banks").insert({
      customer_id: customer.id, user_id: uid,
      bank_name: lang === "ar" ? "بنك جديد" : "New bank",
      currency: form.currency,
    }).select().single();
    if (error) return toast.error(error.message);
    setBanks([...banks, data as Bank]);
  }

  async function updateBank(id: string, patch: Partial<Bank>) {
    setBanks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const { error } = await supabase.from("customer_banks").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function deleteBank(id: string) {
    const { error } = await supabase.from("customer_banks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setBanks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {customer ? t("editCustomer") : t("newCustomer")}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="main">{t("mainInfo")}</TabsTrigger>
            <TabsTrigger value="contacts" disabled={!customer}>
              {t("contacts")} {contacts.length > 0 && <Badge variant="secondary" className="ms-1.5 h-5">{contacts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="banks" disabled={!customer}>
              {t("banks")} {banks.length > 0 && <Badge variant="secondary" className="ms-1.5 h-5">{banks.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="flex-1 overflow-y-auto mt-4 pe-1">
            <form onSubmit={handleSave} className="space-y-4" id="customer-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>{t("customerName")} *</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("taxIdOptional")}</Label>
                  <Input
                    value={form.tax_id}
                    onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                    maxLength={50} dir="ltr"
                    className={taxIdConflict ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {checking && <p className="text-xs text-muted-foreground">…</p>}
                  {taxIdConflict && (
                    <div className="flex items-start gap-2 text-xs bg-destructive/10 text-destructive rounded-md p-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        {t("taxIdInUse")}: <strong>{taxIdConflict.name}</strong>
                        {!taxIdConflict.ownedByMe && (lang === "ar" ? " (تابع لمستخدم آخر)" : " (owned by another user)")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>{t("industry")}</Label>
                  <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} maxLength={100} />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{t("email")}</Label>
                  <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{t("phone")}</Label>
                  <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={50} />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{t("website")}</Label>
                  <Input dir="ltr" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} maxLength={255} />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{t("address")}</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("city")}</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("country")}</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength={100} />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("defaultCurrency")}</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("paymentTerms")}</Label>
                  <Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} maxLength={200} placeholder={lang === "ar" ? "مثال: 30 يوم" : "e.g. Net 30"} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("terms")}</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTerms([...terms, { title: "", body: "" }])}
                    >
                      <Plus className="h-4 w-4 me-1" />{t("addTerm")}
                    </Button>
                  </div>
                  {terms.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
                      {t("noTerms")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {terms.map((it, idx) => (
                        <div key={idx} className="flex items-start gap-2 border rounded-md p-2 bg-muted/30">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                            <Input
                              placeholder={t("termTitle")}
                              value={it.title}
                              maxLength={120}
                              onChange={(e) => setTerms(terms.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                            />
                            <Textarea
                              rows={1}
                              placeholder={t("termBody")}
                              value={it.body}
                              maxLength={1000}
                              className="md:col-span-2 min-h-[38px]"
                              onChange={(e) => setTerms(terms.map((x, i) => i === idx ? { ...x, body: e.target.value } : x))}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label>{t("notes")}</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="contacts" className="flex-1 overflow-y-auto mt-4 pe-1 space-y-3">
            {!customer ? (
              <div className="text-center py-8 text-sm text-muted-foreground">{t("saveFirst")}</div>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={addContact}><Plus className="h-4 w-4 me-1" />{t("addContact")}</Button>
                </div>
                {contacts.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">{t("noContacts")}</div>
                ) : (
                  contacts.map((c) => (
                    <Card key={c.id} className="border-l-4 border-l-primary/60">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <UserRound className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                            <Input placeholder={t("contactName")} value={c.name} onChange={(e) => updateContact(c.id, { name: e.target.value })} />
                            <Input placeholder={t("jobTitle")} value={c.title ?? ""} onChange={(e) => updateContact(c.id, { title: e.target.value })} />
                            <Input type="email" dir="ltr" placeholder={t("email")} value={c.email ?? ""} onChange={(e) => updateContact(c.id, { email: e.target.value })} />
                            <Input dir="ltr" placeholder={t("phone")} value={c.phone ?? ""} onChange={(e) => updateContact(c.id, { phone: e.target.value })} />
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => deleteContact(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Switch checked={c.is_primary} onCheckedChange={(v) => updateContact(c.id, { is_primary: v })} />
                          <Star className="h-3.5 w-3.5" />{t("primary")}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="banks" className="flex-1 overflow-y-auto mt-4 pe-1 space-y-3">
            {!customer ? (
              <div className="text-center py-8 text-sm text-muted-foreground">{t("saveFirst")}</div>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={addBank}><Plus className="h-4 w-4 me-1" />{t("addBank")}</Button>
                </div>
                {banks.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">{t("noBanks")}</div>
                ) : (
                  banks.map((b) => (
                    <Card key={b.id} className="border-l-4 border-l-accent">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <Landmark className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                            <Input placeholder={t("bankName")} value={b.bank_name} onChange={(e) => updateBank(b.id, { bank_name: e.target.value })} />
                            <Input placeholder={t("accountName")} value={b.account_name ?? ""} onChange={(e) => updateBank(b.id, { account_name: e.target.value })} />
                            <Input dir="ltr" placeholder={t("accountNumber")} value={b.account_number ?? ""} onChange={(e) => updateBank(b.id, { account_number: e.target.value })} />
                            <Input dir="ltr" placeholder={t("iban")} value={b.iban ?? ""} onChange={(e) => updateBank(b.id, { iban: e.target.value })} />
                            <Input dir="ltr" placeholder={t("swift")} value={b.swift ?? ""} onChange={(e) => updateBank(b.id, { swift: e.target.value })} />
                            <Input placeholder={t("branch")} value={b.branch ?? ""} onChange={(e) => updateBank(b.id, { branch: e.target.value })} />
                            <Select value={b.currency} onValueChange={(v) => updateBank(b.id, { currency: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => deleteBank(b.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Switch checked={b.is_primary} onCheckedChange={(v) => updateBank(b.id, { is_primary: v })} />
                          <Star className="h-3.5 w-3.5" />{t("primary")}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button type="submit" form="customer-form" disabled={saving || !!taxIdConflict}>
            {saving ? t("loading") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
