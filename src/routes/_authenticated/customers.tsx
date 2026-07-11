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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Users, AlertTriangle, Receipt } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "العملاء" }, { name: "description", content: "إدارة عملاءك، أرقامهم الضريبية، وشروطهم الخاصة" }] }),
});

type Customer = {
  id: string;
  user_id: string;
  name: string;
  tax_id: string | null;
  currency: string;
  terms: string | null;
  notes: string | null;
  created_at: string;
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
        return c.name.toLowerCase().includes(s) || (c.tax_id ?? "").toLowerCase().includes(s);
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
      {/* Prestige hero header */}
      <div className="bg-gradient-to-br from-primary via-primary to-[oklch(0.32_0.07_160)] text-primary-foreground">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-xl bg-accent/90 flex items-center justify-center text-accent-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t("customers")}</h1>
              <p className="text-sm opacity-80">{lang === "ar" ? "بيانات العملاء، الأرقام الضريبية، والشروط الخاصة بكل عميل" : "Customer records, tax IDs, and per-customer terms"}</p>
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
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{c.name}</h3>
                      {c.tax_id ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Receipt className="h-3 w-3" /> <span dir="ltr">{c.tax_id}</span>
                        </div>
                      ) : null}
                    </div>
                    <Badge className="bg-accent text-accent-foreground shrink-0">{c.currency}</Badge>
                  </div>
                  {c.terms ? (
                    <div className="text-xs bg-muted/60 rounded-md p-2.5 line-clamp-3 whitespace-pre-wrap">{c.terms}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">{lang === "ar" ? "لا شروط خاصة" : "No special terms"}</div>
                  )}
                  <div className="flex justify-end gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(c);
                        setDialogOpen(true);
                      }}
                    >
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
  const [form, setForm] = useState({ name: "", tax_id: "", currency: "EGP", terms: "", notes: "" });
  const [taxIdConflict, setTaxIdConflict] = useState<{ name: string; ownedByMe: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (customer) {
        setForm({ name: customer.name, tax_id: customer.tax_id ?? "", currency: customer.currency, terms: customer.terms ?? "", notes: customer.notes ?? "" });
      } else {
        setForm({ name: "", tax_id: "", currency: "EGP", terms: "", notes: "" });
      }
      setTaxIdConflict(null);
    }
  }, [open, customer]);

  // Debounced tax_id lookup
  useEffect(() => {
    const tid = form.tax_id.trim();
    if (!tid) {
      setTaxIdConflict(null);
      return;
    }
    if (customer && customer.tax_id === tid) {
      setTaxIdConflict(null);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? "";
      const { data, error } = await supabase.rpc("find_customer_by_tax_id", { _tax_id: tid });
      if (!error && data && data.length > 0) {
        const row = data[0] as { id: string; name: string; owner_id: string };
        if (!customer || row.id !== customer.id) {
          setTaxIdConflict({ name: row.name, ownedByMe: row.owner_id === uid });
        } else {
          setTaxIdConflict(null);
        }
      } else {
        setTaxIdConflict(null);
      }
      setChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.tax_id, customer]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (taxIdConflict) {
      toast.error(`${t("taxIdInUse")}: ${taxIdConflict.name}`);
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const payload = {
        name: form.name.trim(),
        tax_id: form.tax_id.trim() || null,
        currency: form.currency,
        terms: form.terms.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (customer) {
        const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...payload, user_id: uid });
        if (error) {
          if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
            throw new Error(t("taxIdInUse"));
          }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? t("editCustomer") : t("newCustomer")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("customerName")} *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("taxIdOptional")}</Label>
            <Input
              value={form.tax_id}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              maxLength={50}
              dir="ltr"
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
            <Label>{t("defaultCurrency")}</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("terms")}</Label>
            <Textarea
              rows={4}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              maxLength={4000}
              placeholder={t("termsPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !!taxIdConflict}>
              {saving ? t("loading") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
