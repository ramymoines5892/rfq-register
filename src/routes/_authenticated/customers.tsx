import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccess } from "@/hooks/useAccess";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputIcon } from "@/components/ui/input-icon";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  AlertTriangle,
  Mail,
  Phone,
  Globe,
  MapPin,
  Building2,
  Landmark,
  Star,
  UserRound,
  FileText,
  Wallet,
  Contact as ContactIcon,
  Info,
  Paperclip,
  Upload,
  Download,
  File as FileIcon,
  Settings2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  parseTerms,
  stringifyTerms,
  parseBiList,
  stringifyBiList,
  emptyTerm,
  type TermItem,
  type BiListItem,
} from "@/lib/terms";
import { BilingualInputs, BilingualText, pickLangValue } from "@/lib/bilingual";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
  head: () => ({
    meta: [
      { title: "العملاء" },
      { name: "description", content: "إدارة العملاء والأشخاص المسؤولين والحسابات البنكية" },
    ],
  }),
});

type Customer = {
  id: string;
  user_id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  tax_id: string | null;
  currency: string;
  terms: string | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  address_ar: string | null;
  address_en: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  industry_ar: string | null;
  industry_en: string | null;
  payment_terms: string | null;
  payment_terms_ar: string | null;
  payment_terms_en: string | null;
  created_at: string;
};

type Contact = {
  id: string;
  customer_id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  title: string | null;
  title_ar: string | null;
  title_en: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

type Bank = {
  id: string;
  customer_id: string;
  bank_name: string;
  bank_name_ar: string | null;
  bank_name_en: string | null;
  account_name: string | null;
  account_name_ar: string | null;
  account_name_en: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  branch: string | null;
  branch_ar: string | null;
  branch_en: string | null;
  is_primary: boolean;
  notes: string | null;
};

type DraftContact = Omit<Contact, "id" | "customer_id"> & { _key: string };
type DraftBank = Omit<Bank, "id" | "customer_id"> & { _key: string };

type AttachmentCategory = "company_profile" | "commercial_register" | "tax_card" | "bank_letter" | "other";

type Attachment = {
  id: string;
  customer_id: string;
  category: AttachmentCategory;
  label: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type DraftAttachment = {
  _key: string;
  file: File;
  category: AttachmentCategory;
  label: string | null;
};

const ATTACHMENT_BUCKET = "customer-attachments";
const ATTACHMENT_CATEGORIES: AttachmentCategory[] = [
  "company_profile",
  "commercial_register",
  "tax_card",
  "bank_letter",
  "other",
];

function attachmentCategoryLabel(cat: AttachmentCategory, lang: "ar" | "en") {
  const ar: Record<AttachmentCategory, string> = {
    company_profile: "بروفيل الشركة",
    commercial_register: "السجل التجاري",
    tax_card: "البطاقة الضريبية",
    bank_letter: "خطاب البنوك",
    other: "أخرى",
  };
  const en: Record<AttachmentCategory, string> = {
    company_profile: "Company profile",
    commercial_register: "Commercial register",
    tax_card: "Tax card",
    bank_letter: "Bank letter",
    other: "Other",
  };
  return lang === "ar" ? ar[cat] : en[cat];
}

function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];

function CustomersPage() {
  const { t, lang } = useI18n();
  const access = useAccess();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (currencyFilter !== "all" && c.currency !== currencyFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      const hay = [
        c.name,
        c.name_ar,
        c.name_en,
        c.tax_id,
        c.email,
        c.phone,
        c.city,
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());
      return hay.some((h) => h.includes(s));
    });
  }, [customers, search, currencyFilter]);

  async function handleDelete(c: Customer) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customers").update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
    }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(lang === "ar" ? "اتنقل لسلة المحذوفات (الـ Owner يقدر يرجّعه)" : "Moved to trash (Owner can restore)");
    load();
  }

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setSheetOpen(true);
  }

  const displayName = (c: Customer) => pickLangValue(c as any, "name", lang).value || c.name;

  return (
    <div className="min-h-screen">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold leading-tight">{t("customers")}</h1>
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? `${customers.length} عميل`
                  : `${customers.length} customer${customers.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {access.canManageFormFields && (
              <Link to="/settings/form-builder">
                <Button variant="outline" size="sm" className="gap-1.5" title={lang === "ar" ? "إعدادات حقول العميل" : "Customer Field Settings"}>
                  <Settings2 className="h-4 w-4" /> {lang === "ar" ? "إعدادات الحقول" : "Field Settings"}
                </Button>
              </Link>
            )}

            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("addCustomer")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <InputIcon
              leftIcon={<Search />}
              placeholder={
                lang === "ar"
                  ? "ابحث بالاسم (عربي أو إنجليزي) / رقم ضريبي / إيميل / تليفون"
                  : "Search name (AR or EN) / tax id / email / phone"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              clearable
              onClear={() => setSearch("")}
            />
          </div>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل العملات" : "All currencies"}</SelectItem>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              {customers.length === 0 ? (
                <div className="space-y-3">
                  <div>{t("noCustomersYet")}</div>
                  <Button onClick={openNew} size="sm">
                    <Plus className="h-4 w-4 me-1" /> {t("addCustomer")}
                  </Button>
                </div>
              ) : (
                lang === "ar" ? "لا توجد نتائج" : "No results"
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{t("customerName")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("industry")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("email")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("phone")}</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {lang === "ar" ? "المدينة" : "City"}
                  </TableHead>
                  <TableHead className="w-20">{t("currency")}</TableHead>
                  <TableHead className="w-24 text-end">
                    {lang === "ar" ? "إجراءات" : "Actions"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const dispName = displayName(c);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => openEdit(c)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                            {dispName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate">
                              <BilingualText row={c as any} base="name" />
                            </div>
                            {c.tax_id && (
                              <div className="text-[10px] text-muted-foreground truncate" dir="ltr">
                                {c.tax_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        <BilingualText row={c as any} base="industry" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground" dir="ltr">
                        {c.email || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground" dir="ltr">
                        {c.phone || "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.currency}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
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
                                <AlertDialogDescription>{dispName}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(c)}>
                                  {t("delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <CustomerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customer={editing}
        onSaved={load}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Side sheet                                                       */
/* ---------------------------------------------------------------- */

type Form = {
  name_ar: string;
  name_en: string;
  tax_id: string;
  currency: string;
  notes: string;
  email: string;
  phone: string;
  website: string;
  address_ar: string;
  address_en: string;
  city: string;
  country: string;
  industry_ar: string;
  industry_en: string;
};

const emptyForm: Form = {
  name_ar: "",
  name_en: "",
  tax_id: "",
  currency: "EGP",
  notes: "",
  email: "",
  phone: "",
  website: "",
  address_ar: "",
  address_en: "",
  city: "",
  country: "",
  industry_ar: "",
  industry_en: "",
};

function CustomerSheet({
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
  const { t, lang, dir } = useI18n();
  const [form, setForm] = useState<Form>(emptyForm);
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [paymentTermsList, setPaymentTermsList] = useState<BiListItem[]>([]);
  const [paymentInputAr, setPaymentInputAr] = useState("");
  const [paymentInputEn, setPaymentInputEn] = useState("");
  const [taxIdConflict, setTaxIdConflict] = useState<{ name: string; ownedByMe: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  const [draftContacts, setDraftContacts] = useState<DraftContact[]>([]);
  const [draftBanks, setDraftBanks] = useState<DraftBank[]>([]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [newAttachCategory, setNewAttachCategory] = useState<AttachmentCategory>("company_profile");
  const [newAttachLabel, setNewAttachLabel] = useState("");

  const [openSection, setOpenSection] = useState<string>("identity");

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        name_ar: customer.name_ar ?? customer.name ?? "",
        name_en: customer.name_en ?? customer.name ?? "",
        tax_id: customer.tax_id ?? "",
        currency: customer.currency,
        notes: customer.notes ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        website: customer.website ?? "",
        address_ar: customer.address_ar ?? customer.address ?? "",
        address_en: customer.address_en ?? customer.address ?? "",
        city: customer.city ?? "",
        country: customer.country ?? "",
        industry_ar: customer.industry_ar ?? customer.industry ?? "",
        industry_en: customer.industry_en ?? customer.industry ?? "",
      });
      setTerms(parseTerms(customer.terms));
      setPaymentTermsList(parseBiList(customer.payment_terms_ar, customer.payment_terms_en ?? customer.payment_terms));
      loadRelated(customer.id);
    } else {
      setForm(emptyForm);
      setTerms([]);
      setPaymentTermsList([]);
      setContacts([]);
      setBanks([]);
      setDraftContacts([]);
      setDraftBanks([]);
      setAttachments([]);
      setDraftAttachments([]);
    }
    setPaymentInputAr("");
    setPaymentInputEn("");
    setTaxIdConflict(null);
    setNewAttachCategory("company_profile");
    setNewAttachLabel("");
    setOpenSection("identity");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  async function loadRelated(customerId: string) {
    const [{ data: cs }, { data: bs }, { data: as }] = await Promise.all([
      supabase.from("customer_contacts").select("*").eq("customer_id", customerId).is("deleted_at", null).order("created_at"),
      supabase.from("customer_banks").select("*").eq("customer_id", customerId).is("deleted_at", null).order("created_at"),
      supabase.from("customer_attachments").select("*").eq("customer_id", customerId).is("deleted_at", null).order("created_at"),
    ]);
    setContacts((cs ?? []) as Contact[]);
    setBanks((bs ?? []) as Bank[]);
    setAttachments((as ?? []) as Attachment[]);
  }

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
        } else setTaxIdConflict(null);
      } else setTaxIdConflict(null);
      setChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.tax_id, customer]);

  const primaryName = form.name_ar.trim() || form.name_en.trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (taxIdConflict) {
      toast.error(`${t("taxIdInUse")}: ${taxIdConflict.name}`);
      return;
    }
    if (!primaryName) {
      toast.error(lang === "ar" ? "اسم العميل مطلوب (عربي أو إنجليزي)" : "Customer name is required (AR or EN)");
      setOpenSection("identity");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const pt = stringifyBiList(paymentTermsList);
      const payload = {
        name: primaryName,
        name_ar: form.name_ar.trim() || null,
        name_en: form.name_en.trim() || null,
        tax_id: form.tax_id.trim() || null,
        currency: form.currency,
        terms: stringifyTerms(terms),
        notes: form.notes.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        address: (form.address_ar.trim() || form.address_en.trim()) || null,
        address_ar: form.address_ar.trim() || null,
        address_en: form.address_en.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        industry: (form.industry_ar.trim() || form.industry_en.trim()) || null,
        industry_ar: form.industry_ar.trim() || null,
        industry_en: form.industry_en.trim() || null,
        payment_terms: pt.ar ?? pt.en,
        payment_terms_ar: pt.ar,
        payment_terms_en: pt.en,
      };

      if (customer) {
        const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("customers")
          .insert({ ...payload, user_id: uid })
          .select()
          .single();
        if (error) {
          if (error.code === "23505" || /duplicate|unique/i.test(error.message))
            throw new Error(t("taxIdInUse"));
          throw error;
        }
        const newId = (inserted as Customer).id;
        if (draftContacts.length > 0) {
          const rows = draftContacts.map((c) => {
            const name = (c.name_ar ?? "").trim() || (c.name_en ?? "").trim() || (lang === "ar" ? "بدون اسم" : "Untitled");
            const title = c.title_ar?.trim() || c.title_en?.trim() || null;
            return {
              customer_id: newId,
              user_id: uid,
              name,
              name_ar: c.name_ar?.trim() || null,
              name_en: c.name_en?.trim() || null,
              title,
              title_ar: c.title_ar?.trim() || null,
              title_en: c.title_en?.trim() || null,
              email: c.email,
              phone: c.phone,
              is_primary: c.is_primary,
              notes: c.notes,
            };
          });
          const { error: ce } = await supabase.from("customer_contacts").insert(rows);
          if (ce) toast.error(ce.message);
        }
        if (draftBanks.length > 0) {
          const rows = draftBanks.map((b) => {
            const bankName =
              b.bank_name_ar?.trim() || b.bank_name_en?.trim() || (lang === "ar" ? "بدون اسم" : "Untitled");
            return {
              customer_id: newId,
              user_id: uid,
              bank_name: bankName,
              bank_name_ar: b.bank_name_ar?.trim() || null,
              bank_name_en: b.bank_name_en?.trim() || null,
              account_name: b.account_name_ar?.trim() || b.account_name_en?.trim() || null,
              account_name_ar: b.account_name_ar?.trim() || null,
              account_name_en: b.account_name_en?.trim() || null,
              account_number: b.account_number,
              iban: b.iban,
              swift: b.swift,
              branch: b.branch_ar?.trim() || b.branch_en?.trim() || null,
              branch_ar: b.branch_ar?.trim() || null,
              branch_en: b.branch_en?.trim() || null,
              currency: b.currency,
              is_primary: b.is_primary,
              notes: b.notes,
            };
          });
          const { error: be } = await supabase.from("customer_banks").insert(rows);
          if (be) toast.error(be.message);
        }
        if (draftAttachments.length > 0) {
          for (const a of draftAttachments) {
            const safeName = a.file.name.replace(/[^\w.\-]+/g, "_");
            const path = `${uid}/${newId}/${crypto.randomUUID()}_${safeName}`;
            const { error: upErr } = await supabase.storage
              .from(ATTACHMENT_BUCKET)
              .upload(path, a.file, { contentType: a.file.type });
            if (upErr) {
              toast.error(upErr.message);
              continue;
            }
            const { error: insErr } = await supabase.from("customer_attachments").insert({
              customer_id: newId,
              user_id: uid,
              category: a.category,
              label: a.category === "other" ? a.label : null,
              file_path: path,
              file_name: a.file.name,
              mime_type: a.file.type || null,
              size_bytes: a.file.size,
            });
            if (insErr) toast.error(insErr.message);
          }
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

  /* ------------- contacts (existing customer) ------------- */
  async function addContact() {
    if (!customer) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id!;
    const seedAr = lang === "ar" ? "مسؤول جديد" : "";
    const seedEn = lang === "en" ? "New contact" : "";
    const { data, error } = await supabase
      .from("customer_contacts")
      .insert({
        customer_id: customer.id,
        user_id: uid,
        name: seedAr || seedEn || "New contact",
        name_ar: seedAr || null,
        name_en: seedEn || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setContacts([...contacts, data as Contact]);
  }
  async function updateContact(id: string, patch: Partial<Contact>) {
    // Keep legacy name/title in sync with picked value from AR/EN if either changed.
    const merged: Partial<Contact> = { ...patch };
    if ("name_ar" in patch || "name_en" in patch) {
      const cur = contacts.find((c) => c.id === id);
      const nameAr = (patch.name_ar ?? cur?.name_ar ?? "") || "";
      const nameEn = (patch.name_en ?? cur?.name_en ?? "") || "";
      merged.name = nameAr.trim() || nameEn.trim() || (lang === "ar" ? "بدون اسم" : "Untitled");
    }
    if ("title_ar" in patch || "title_en" in patch) {
      const cur = contacts.find((c) => c.id === id);
      const ar = (patch.title_ar ?? cur?.title_ar ?? "") || "";
      const en = (patch.title_en ?? cur?.title_en ?? "") || "";
      merged.title = ar.trim() || en.trim() || null;
    }
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...merged } : c)));
    const { error } = await supabase.from("customer_contacts").update(merged).eq("id", id);
    if (error) toast.error(error.message);
  }
  async function deleteContact(id: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_contacts").update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  /* ------------- banks (existing customer) ------------- */
  async function addBank() {
    if (!customer) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id!;
    const seedAr = lang === "ar" ? "بنك جديد" : "";
    const seedEn = lang === "en" ? "New bank" : "";
    const { data, error } = await supabase
      .from("customer_banks")
      .insert({
        customer_id: customer.id,
        user_id: uid,
        bank_name: seedAr || seedEn || "New bank",
        bank_name_ar: seedAr || null,
        bank_name_en: seedEn || null,
        currency: form.currency,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setBanks([...banks, data as Bank]);
  }
  async function updateBank(id: string, patch: Partial<Bank>) {
    const merged: Partial<Bank> = { ...patch };
    if ("bank_name_ar" in patch || "bank_name_en" in patch) {
      const cur = banks.find((b) => b.id === id);
      const ar = (patch.bank_name_ar ?? cur?.bank_name_ar ?? "") || "";
      const en = (patch.bank_name_en ?? cur?.bank_name_en ?? "") || "";
      merged.bank_name = ar.trim() || en.trim() || (lang === "ar" ? "بدون اسم" : "Untitled");
    }
    if ("account_name_ar" in patch || "account_name_en" in patch) {
      const cur = banks.find((b) => b.id === id);
      const ar = (patch.account_name_ar ?? cur?.account_name_ar ?? "") || "";
      const en = (patch.account_name_en ?? cur?.account_name_en ?? "") || "";
      merged.account_name = ar.trim() || en.trim() || null;
    }
    if ("branch_ar" in patch || "branch_en" in patch) {
      const cur = banks.find((b) => b.id === id);
      const ar = (patch.branch_ar ?? cur?.branch_ar ?? "") || "";
      const en = (patch.branch_en ?? cur?.branch_en ?? "") || "";
      merged.branch = ar.trim() || en.trim() || null;
    }
    setBanks((prev) => prev.map((b) => (b.id === id ? { ...b, ...merged } : b)));
    const { error } = await supabase.from("customer_banks").update(merged).eq("id", id);
    if (error) toast.error(error.message);
  }
  async function deleteBank(id: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_banks").update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    setBanks((prev) => prev.filter((b) => b.id !== id));
  }

  /* ------------- drafts (new customer) ------------- */
  function addDraftContact() {
    setDraftContacts((p) => [
      ...p,
      {
        _key: crypto.randomUUID(),
        name: "",
        name_ar: "",
        name_en: "",
        title: null,
        title_ar: "",
        title_en: "",
        email: null,
        phone: null,
        is_primary: p.length === 0,
        notes: null,
      },
    ]);
  }
  function updateDraftContact(key: string, patch: Partial<DraftContact>) {
    setDraftContacts((p) => p.map((c) => (c._key === key ? { ...c, ...patch } : c)));
  }
  function removeDraftContact(key: string) {
    setDraftContacts((p) => p.filter((c) => c._key !== key));
  }
  function addDraftBank() {
    setDraftBanks((p) => [
      ...p,
      {
        _key: crypto.randomUUID(),
        bank_name: "",
        bank_name_ar: "",
        bank_name_en: "",
        account_name: null,
        account_name_ar: "",
        account_name_en: "",
        account_number: null,
        iban: null,
        swift: null,
        branch: null,
        branch_ar: "",
        branch_en: "",
        currency: form.currency,
        is_primary: p.length === 0,
        notes: null,
      },
    ]);
  }
  function updateDraftBank(key: string, patch: Partial<DraftBank>) {
    setDraftBanks((p) => p.map((b) => (b._key === key ? { ...b, ...patch } : b)));
  }
  function removeDraftBank(key: string) {
    setDraftBanks((p) => p.filter((b) => b._key !== key));
  }

  /* ------------- attachments ------------- */
  async function uploadAttachment(file: File) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(lang === "ar" ? "الحد الأقصى 25 ميجا" : "Max size 25 MB");
      return;
    }
    if (newAttachCategory === "other" && !newAttachLabel.trim()) {
      toast.error(lang === "ar" ? "اكتب مسمى الملف" : "Enter a label");
      return;
    }
    if (!customer) {
      setDraftAttachments((p) => [
        ...p,
        {
          _key: crypto.randomUUID(),
          file,
          category: newAttachCategory,
          label: newAttachCategory === "other" ? newAttachLabel.trim() : null,
        },
      ]);
      setNewAttachLabel("");
      return;
    }
    setUploadingAttach(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id!;
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${customer.id}/${crypto.randomUUID()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data, error } = await supabase
        .from("customer_attachments")
        .insert({
          customer_id: customer.id,
          user_id: uid,
          category: newAttachCategory,
          label: newAttachCategory === "other" ? newAttachLabel.trim() : null,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        .select()
        .single();
      if (error) throw error;
      setAttachments((p) => [...p, data as Attachment]);
      setNewAttachLabel("");
      toast.success(lang === "ar" ? "تم الرفع" : "Uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingAttach(false);
    }
  }

  async function downloadAttachment(a: Attachment) {
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(a.file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Error");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteAttachment(a: Attachment) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_attachments").update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
    }).eq("id", a.id);
    if (error) return toast.error(error.message);
    setAttachments((p) => p.filter((x) => x.id !== a.id));
  }

  function removeDraftAttachment(key: string) {
    setDraftAttachments((p) => p.filter((x) => x._key !== key));
  }

  const contactsCount = customer ? contacts.length : draftContacts.length;
  const banksCount = customer ? banks.length : draftBanks.length;
  const attachmentsCount = customer ? attachments.length : draftAttachments.length;

  function addPaymentTerm() {
    const ar = paymentInputAr.trim();
    const en = paymentInputEn.trim();
    if (!ar && !en) return;
    setPaymentTermsList([...paymentTermsList, { ar, en }]);
    setPaymentInputAr("");
    setPaymentInputEn("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={dir === "rtl" ? "left" : "right"}
        className="w-full sm:max-w-2xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-6 py-4 border-b space-y-1 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {customer ? t("editCustomer") : t("newCustomer")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {lang === "ar"
              ? "أدخل البيانات بالعربي والإنجليزي في نفس الوقت علشان التقارير باللغتين تكون تمام."
              : "Enter data in both Arabic and English so bilingual reports render correctly."}
          </SheetDescription>
        </SheetHeader>

        <form id="customer-form" onSubmit={handleSave} className="flex-1 overflow-y-auto">
          <Accordion
            type="single"
            collapsible
            value={openSection}
            onValueChange={(v) => setOpenSection(v || "")}
            className="px-6 py-2"
          >
            {/* Identity */}
            <AccordionItem value="identity">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<Info className="h-4 w-4" />}
                  title={lang === "ar" ? "بيانات أساسية" : "Identity"}
                  subtitle={primaryName || (lang === "ar" ? "اسم العميل مطلوب" : "Required")}
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <BilingualInputs
                  label={<><Building2 className="h-3.5 w-3.5" /> {t("customerName")}</>}
                  required
                  valueAr={form.name_ar}
                  valueEn={form.name_en}
                  onChangeAr={(v) => setForm({ ...form, name_ar: v })}
                  onChangeEn={(v) => setForm({ ...form, name_en: v })}
                  maxLength={200}
                  placeholderAr="اسم الشركة"
                  placeholderEn="Company name"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t("taxIdOptional")}>
                    <Input
                      value={form.tax_id}
                      onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                      maxLength={50}
                      dir="ltr"
                      className={taxIdConflict ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {checking && <p className="text-xs text-muted-foreground mt-1">…</p>}
                    {taxIdConflict && (
                      <div className="mt-1 flex items-start gap-2 text-xs bg-destructive/10 text-destructive rounded-md p-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {t("taxIdInUse")}: <strong>{taxIdConflict.name}</strong>
                          {!taxIdConflict.ownedByMe &&
                            (lang === "ar" ? " (تابع لمستخدم آخر)" : " (owned by another user)")}
                        </span>
                      </div>
                    )}
                  </Field>
                  <Field label={t("defaultCurrency")}>
                    <Select
                      value={form.currency}
                      onValueChange={(v) => setForm({ ...form, currency: v })}
                    >
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
                  </Field>
                </div>
                <BilingualInputs
                  label={t("industry")}
                  valueAr={form.industry_ar}
                  valueEn={form.industry_en}
                  onChangeAr={(v) => setForm({ ...form, industry_ar: v })}
                  onChangeEn={(v) => setForm({ ...form, industry_en: v })}
                  maxLength={100}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Contact info */}
            <AccordionItem value="contact">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<Mail className="h-4 w-4" />}
                  title={lang === "ar" ? "بيانات التواصل" : "Contact info"}
                  subtitle={form.email || form.phone || (lang === "ar" ? "اختياري" : "Optional")}
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field icon={<Mail className="h-3.5 w-3.5" />} label={t("email")}>
                    <Input
                      type="email"
                      dir="ltr"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      maxLength={200}
                    />
                  </Field>
                  <Field icon={<Phone className="h-3.5 w-3.5" />} label={t("phone")}>
                    <Input
                      dir="ltr"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      maxLength={50}
                    />
                  </Field>
                  <Field icon={<Globe className="h-3.5 w-3.5" />} label={t("website")} className="md:col-span-2">
                    <Input
                      dir="ltr"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      maxLength={200}
                    />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Location */}
            <AccordionItem value="location">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<MapPin className="h-4 w-4" />}
                  title={lang === "ar" ? "العنوان" : "Location"}
                  subtitle={[form.city, form.country].filter(Boolean).join(", ") || (lang === "ar" ? "اختياري" : "Optional")}
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <BilingualInputs
                  label={t("address")}
                  textarea
                  rows={2}
                  valueAr={form.address_ar}
                  valueEn={form.address_en}
                  onChangeAr={(v) => setForm({ ...form, address_ar: v })}
                  onChangeEn={(v) => setForm({ ...form, address_en: v })}
                  maxLength={500}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t("city")}>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      maxLength={100}
                    />
                  </Field>
                  <Field label={t("country")}>
                    <Input
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      maxLength={100}
                    />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Contacts */}
            <AccordionItem value="contacts">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<ContactIcon className="h-4 w-4" />}
                  title={t("contacts")}
                  subtitle={
                    contactsCount > 0
                      ? `${contactsCount} ${lang === "ar" ? "" : "item(s)"}`
                      : lang === "ar"
                        ? "لا يوجد"
                        : "None"
                  }
                  count={contactsCount}
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-3">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={customer ? addContact : addDraftContact}
                  >
                    <Plus className="h-4 w-4 me-1" />
                    {t("addContact")}
                  </Button>
                </div>
                {customer
                  ? contacts.map((c) => (
                      <ContactRow
                        key={c.id}
                        contact={c}
                        onChange={(patch) => updateContact(c.id, patch)}
                        onDelete={() => deleteContact(c.id)}
                      />
                    ))
                  : draftContacts.map((c) => (
                      <ContactRow
                        key={c._key}
                        contact={c as unknown as Contact}
                        onChange={(patch) => updateDraftContact(c._key, patch as Partial<DraftContact>)}
                        onDelete={() => removeDraftContact(c._key)}
                      />
                    ))}
                {contactsCount === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-md">
                    {t("noContacts")}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Banks */}
            <AccordionItem value="banks">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<Landmark className="h-4 w-4" />}
                  title={t("banks")}
                  subtitle={
                    banksCount > 0
                      ? `${banksCount} ${lang === "ar" ? "" : "item(s)"}`
                      : lang === "ar"
                        ? "لا يوجد"
                        : "None"
                  }
                  count={banksCount}
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-3">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={customer ? addBank : addDraftBank}
                  >
                    <Plus className="h-4 w-4 me-1" />
                    {t("addBank")}
                  </Button>
                </div>
                {customer
                  ? banks.map((b) => (
                      <BankRow
                        key={b.id}
                        bank={b}
                        onChange={(patch) => updateBank(b.id, patch)}
                        onDelete={() => deleteBank(b.id)}
                      />
                    ))
                  : draftBanks.map((b) => (
                      <BankRow
                        key={b._key}
                        bank={b as unknown as Bank}
                        onChange={(patch) => updateDraftBank(b._key, patch as Partial<DraftBank>)}
                        onDelete={() => removeDraftBank(b._key)}
                      />
                    ))}
                {banksCount === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-md">
                    {t("noBanks")}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Payment terms + terms */}
            <AccordionItem value="terms">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<Wallet className="h-4 w-4" />}
                  title={lang === "ar" ? "الشروط المالية" : "Payment & Terms"}
                  subtitle={
                    paymentTermsList.length + terms.length > 0
                      ? `${paymentTermsList.length + terms.length} ${lang === "ar" ? "" : "entries"}`
                      : lang === "ar"
                        ? "لا يوجد"
                        : "None"
                  }
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-5">
                {/* Payment terms — bilingual chips */}
                <div>
                  <Label className="mb-1.5 block text-xs">{t("paymentTerms")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1 end-1 z-10 rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">AR</span>
                      <Input
                        dir="rtl"
                        value={paymentInputAr}
                        onChange={(e) => setPaymentInputAr(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPaymentTerm(); } }}
                        maxLength={200}
                        placeholder="مثال: 30 يوم من تاريخ الفاتورة"
                        className="pe-8"
                      />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1 end-1 z-10 rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">EN</span>
                      <Input
                        dir="ltr"
                        value={paymentInputEn}
                        onChange={(e) => setPaymentInputEn(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPaymentTerm(); } }}
                        maxLength={200}
                        placeholder="e.g. Net 30"
                        className="pe-8"
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={addPaymentTerm}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {paymentTermsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {paymentTermsList.map((p, i) => {
                        const display = lang === "ar" ? (p.ar || p.en) : (p.en || p.ar);
                        const fallback = !(lang === "ar" ? p.ar : p.en);
                        return (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="gap-1.5 py-1 ps-2.5 pe-1"
                          >
                            <span>{display}</span>
                            {fallback && (
                              <span className="rounded border border-dashed border-muted-foreground/40 px-1 text-[9px] text-muted-foreground">
                                {lang === "ar" ? "EN" : "AR"}
                              </span>
                            )}
                            <button
                              type="button"
                              className="rounded-full hover:bg-destructive/20 p-0.5"
                              onClick={() =>
                                setPaymentTermsList(paymentTermsList.filter((_, idx) => idx !== i))
                              }
                              aria-label="remove"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Terms — bilingual title + body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">{t("terms")}</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTerms([...terms, emptyTerm()])}
                    >
                      <Plus className="h-4 w-4 me-1" />
                      {t("addTerm")}
                    </Button>
                  </div>
                  {terms.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
                      {t("noTerms")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {terms.map((it, idx) => (
                        <div
                          key={idx}
                          className="border rounded-md p-2 bg-muted/30 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              {lang === "ar" ? `شرط ${idx + 1}` : `Term ${idx + 1}`}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <BilingualInputs
                            label={t("termTitle")}
                            valueAr={it.title_ar}
                            valueEn={it.title_en}
                            onChangeAr={(v) =>
                              setTerms(terms.map((x, i) => (i === idx ? { ...x, title_ar: v } : x)))
                            }
                            onChangeEn={(v) =>
                              setTerms(terms.map((x, i) => (i === idx ? { ...x, title_en: v } : x)))
                            }
                            maxLength={120}
                          />
                          <BilingualInputs
                            label={t("termBody")}
                            textarea
                            rows={2}
                            valueAr={it.body_ar}
                            valueEn={it.body_en}
                            onChangeAr={(v) =>
                              setTerms(terms.map((x, i) => (i === idx ? { ...x, body_ar: v } : x)))
                            }
                            onChangeEn={(v) =>
                              setTerms(terms.map((x, i) => (i === idx ? { ...x, body_en: v } : x)))
                            }
                            maxLength={1000}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Attachments */}
            <AccordionItem value="attachments">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<Paperclip className="h-4 w-4" />}
                  title={lang === "ar" ? "المرفقات" : "Attachments"}
                  subtitle={
                    attachmentsCount > 0
                      ? `${attachmentsCount} ${lang === "ar" ? "ملف" : "file(s)"}`
                      : lang === "ar"
                        ? "بروفيل، سجل تجاري، بطاقة ضريبية…"
                        : "Profile, register, tax card…"
                  }
                  count={attachmentsCount}
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-3">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {lang === "ar" ? "نوع الملف" : "File type"}
                      </Label>
                      <Select
                        value={newAttachCategory}
                        onValueChange={(v) => setNewAttachCategory(v as AttachmentCategory)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTACHMENT_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {attachmentCategoryLabel(c, lang)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newAttachCategory === "other" && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {lang === "ar" ? "مسمى الملف" : "File label"}
                        </Label>
                        <Input
                          value={newAttachLabel}
                          onChange={(e) => setNewAttachLabel(e.target.value)}
                          maxLength={100}
                          placeholder={lang === "ar" ? "مثال: عقد الشراكة" : "e.g. Partnership contract"}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      id="customer-attachment-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadAttachment(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingAttach}
                      onClick={() =>
                        document.getElementById("customer-attachment-input")?.click()
                      }
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 me-1.5" />
                      {uploadingAttach
                        ? lang === "ar" ? "جارِ الرفع…" : "Uploading…"
                        : lang === "ar" ? "اختر ملفًا للرفع" : "Choose file to upload"}
                    </Button>
                  </div>
                </div>

                {attachmentsCount === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-md">
                    {lang === "ar" ? "لا توجد مرفقات بعد" : "No attachments yet"}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {customer
                      ? attachments.map((a) => (
                          <AttachmentRow
                            key={a.id}
                            categoryLabel={
                              a.category === "other"
                                ? a.label || attachmentCategoryLabel("other", lang)
                                : attachmentCategoryLabel(a.category, lang)
                            }
                            fileName={a.file_name}
                            size={a.size_bytes ?? undefined}
                            onDownload={() => downloadAttachment(a)}
                            onDelete={() => deleteAttachment(a)}
                          />
                        ))
                      : draftAttachments.map((a) => (
                          <AttachmentRow
                            key={a._key}
                            categoryLabel={
                              a.category === "other"
                                ? a.label || attachmentCategoryLabel("other", lang)
                                : attachmentCategoryLabel(a.category, lang)
                            }
                            fileName={a.file.name}
                            size={a.file.size}
                            pending
                            onDelete={() => removeDraftAttachment(a._key)}
                          />
                        ))}
                  </div>
                )}
                {!customer && draftAttachments.length > 0 && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    {lang === "ar"
                      ? "الملفات هترفع بعد حفظ العميل"
                      : "Files will be uploaded after saving the customer"}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Notes */}
            <AccordionItem value="notes">
              <AccordionTrigger className="hover:no-underline">
                <SectionTitle
                  icon={<FileText className="h-4 w-4" />}
                  title={t("notes")}
                  subtitle={form.notes ? `${form.notes.slice(0, 40)}…` : lang === "ar" ? "اختياري" : "Optional"}
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <Textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  maxLength={2000}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>

        <SheetFooter className="border-t px-6 py-3 shrink-0 flex-row justify-between gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="customer-form" disabled={saving || !!taxIdConflict}>
            {saving ? t("loading") : t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------- small presentational helpers ------------- */

function SectionTitle({
  icon,
  title,
  subtitle,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0 text-start">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {count}
            </Badge>
          )}
        </div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground truncate font-normal">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  className,
  children,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

function ContactRow({
  contact,
  onChange,
  onDelete,
}: {
  contact: Contact;
  onChange: (patch: Partial<Contact>) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="border-s-4 border-s-primary/60">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <UserRound className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
          <div className="flex-1 space-y-3">
            <BilingualInputs
              label={t("contactName")}
              valueAr={contact.name_ar ?? ""}
              valueEn={contact.name_en ?? ""}
              onChangeAr={(v) => onChange({ name_ar: v })}
              onChangeEn={(v) => onChange({ name_en: v })}
              maxLength={150}
            />
            <BilingualInputs
              label={t("jobTitle")}
              valueAr={contact.title_ar ?? ""}
              valueEn={contact.title_en ?? ""}
              onChangeAr={(v) => onChange({ title_ar: v })}
              onChangeEn={(v) => onChange({ title_en: v })}
              maxLength={150}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="email"
                dir="ltr"
                placeholder={t("email")}
                value={contact.email ?? ""}
                onChange={(e) => onChange({ email: e.target.value })}
              />
              <Input
                dir="ltr"
                placeholder={t("phone")}
                value={contact.phone ?? ""}
                onChange={(e) => onChange({ phone: e.target.value })}
              />
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs ps-6">
          <Switch checked={contact.is_primary} onCheckedChange={(v) => onChange({ is_primary: v })} />
          <Star className="h-3.5 w-3.5" />
          {t("primary")}
        </div>
      </CardContent>
    </Card>
  );
}

function BankRow({
  bank,
  onChange,
  onDelete,
}: {
  bank: Bank;
  onChange: (patch: Partial<Bank>) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="border-s-4 border-s-accent">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <Landmark className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
          <div className="flex-1 space-y-3">
            <BilingualInputs
              label={t("bankName")}
              valueAr={bank.bank_name_ar ?? ""}
              valueEn={bank.bank_name_en ?? ""}
              onChangeAr={(v) => onChange({ bank_name_ar: v })}
              onChangeEn={(v) => onChange({ bank_name_en: v })}
              maxLength={150}
            />
            <BilingualInputs
              label={t("accountName")}
              valueAr={bank.account_name_ar ?? ""}
              valueEn={bank.account_name_en ?? ""}
              onChangeAr={(v) => onChange({ account_name_ar: v })}
              onChangeEn={(v) => onChange({ account_name_en: v })}
              maxLength={150}
            />
            <BilingualInputs
              label={t("branch")}
              valueAr={bank.branch_ar ?? ""}
              valueEn={bank.branch_en ?? ""}
              onChangeAr={(v) => onChange({ branch_ar: v })}
              onChangeEn={(v) => onChange({ branch_en: v })}
              maxLength={150}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                dir="ltr"
                placeholder={t("accountNumber")}
                value={bank.account_number ?? ""}
                onChange={(e) => onChange({ account_number: e.target.value })}
              />
              <Input
                dir="ltr"
                placeholder={t("iban")}
                value={bank.iban ?? ""}
                onChange={(e) => onChange({ iban: e.target.value })}
              />
              <Input
                dir="ltr"
                placeholder={t("swift")}
                value={bank.swift ?? ""}
                onChange={(e) => onChange({ swift: e.target.value })}
              />
              <Select value={bank.currency} onValueChange={(v) => onChange({ currency: v })}>
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
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs ps-6">
          <Switch checked={bank.is_primary} onCheckedChange={(v) => onChange({ is_primary: v })} />
          <Star className="h-3.5 w-3.5" />
          {t("primary")}
        </div>
      </CardContent>
    </Card>
  );
}

function AttachmentRow({
  categoryLabel,
  fileName,
  size,
  pending,
  onDownload,
  onDelete,
}: {
  categoryLabel: string;
  fileName: string;
  size?: number;
  pending?: boolean;
  onDownload?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:bg-muted/30 transition-colors">
      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <FileIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
          <span className="truncate">{categoryLabel}</span>
          {pending && (
            <Badge variant="outline" className="h-4 text-[10px] px-1">
              pending
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {fileName}
          {size ? ` · ${formatBytes(size)}` : ""}
        </div>
      </div>
      {onDownload && (
        <Button type="button" variant="ghost" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4" />
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
