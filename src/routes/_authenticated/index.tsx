import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Paperclip, Pencil, Trash2, LogOut, Download, Search, AlertTriangle, FileText } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "متابعة عروض الأسعار" }, { name: "description", content: "سجّل عروض الأسعار وتابع صلاحيتها وحالتها بسهولة" }] }),
});

type Quote = {
  id: string;
  user_id: string;
  supplier_name: string;
  reference_no: string | null;
  description: string | null;
  amount: number | null;
  currency: string;
  status: "new" | "reviewing" | "accepted" | "rejected" | "expired";
  received_date: string;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
};

type Attachment = {
  id: string;
  quote_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
};

const STATUSES: Quote["status"][] = ["new", "reviewing", "accepted", "rejected", "expired"];

const statusColor: Record<Quote["status"], string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  reviewing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  expired: "bg-muted text-muted-foreground",
};

function daysBetween(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function Dashboard() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | Quote["status"]>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: qs, error } = await supabase.from("quotes").select("*").order("received_date", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setQuotes(qs as Quote[]);
    if (qs && qs.length) {
      const { data: atts } = await supabase.from("quote_attachments").select("*").in("quote_id", qs.map(q => q.id));
      const grouped: Record<string, Attachment[]> = {};
      (atts ?? []).forEach(a => { (grouped[a.quote_id] ??= []).push(a as Attachment); });
      setAttachments(grouped);
    } else {
      setAttachments({});
    }
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const filtered = useMemo(() => {
    return quotes.filter(q => {
      if (filterStatus !== "all" && q.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return q.supplier_name.toLowerCase().includes(s) ||
          (q.reference_no ?? "").toLowerCase().includes(s) ||
          (q.description ?? "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [quotes, filterStatus, search]);

  const stats = useMemo(() => {
    const totalValue = quotes.filter(q => q.status === "accepted").reduce((s, q) => s + (Number(q.amount) || 0), 0);
    const expiringWeek = quotes.filter(q => q.expiry_date && q.status !== "expired" && q.status !== "rejected" && daysBetween(q.expiry_date) >= 0 && daysBetween(q.expiry_date) <= 7).length;
    return { count: quotes.length, totalValue, expiringWeek };
  }, [quotes]);

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-lg md:text-xl font-bold">{t("appName")}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{userEmail}</span>
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{t("langToggle")}</Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("quotesCount")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.count}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("totalValue")} ({t("accepted")})</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalValue.toLocaleString()}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("expiringWeek")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{stats.expiringWeek}</div></CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" style={{insetInlineStart: '0.75rem'}} />
            <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-10" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t("filterStatus")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as TKey)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 me-1" /> {t("addQuote")}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="text-center py-16 text-muted-foreground">{t("empty")}</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map(q => (
              <QuoteCard key={q.id} quote={q} attachments={attachments[q.id] ?? []} onEdit={() => { setEditing(q); setDialogOpen(true); }} onChanged={load} />
            ))}
          </div>
        )}
      </main>

      <QuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} quote={editing} onSaved={load} />
    </div>
  );
}

function QuoteCard({ quote, attachments, onEdit, onChanged }: { quote: Quote; attachments: Attachment[]; onEdit: () => void; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const expiryDays = quote.expiry_date ? daysBetween(quote.expiry_date) : null;
  const isSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= 7 && quote.status !== "expired" && quote.status !== "rejected";
  const isExpired = expiryDays !== null && expiryDays < 0 && quote.status !== "rejected" && quote.status !== "accepted";

  async function handleDelete() {
    // delete attachment files
    if (attachments.length) {
      await supabase.storage.from("quote-attachments").remove(attachments.map(a => a.storage_path));
    }
    const { error } = await supabase.from("quotes").delete().eq("id", quote.id);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
    onChanged();
  }

  async function downloadFile(a: Attachment) {
    const { data, error } = await supabase.storage.from("quote-attachments").createSignedUrl(a.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{quote.supplier_name}</h3>
              <Badge className={statusColor[quote.status]} variant="secondary">{t(quote.status as TKey)}</Badge>
              {quote.reference_no && <span className="text-xs text-muted-foreground">#{quote.reference_no}</span>}
            </div>
            {quote.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{quote.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {quote.amount !== null && <span className="font-medium">{Number(quote.amount).toLocaleString()} {quote.currency}</span>}
              <span className="text-muted-foreground">{t("receivedDate")}: {quote.received_date}</span>
              {quote.expiry_date && (
                <span className={isExpired ? "text-rose-600 font-medium" : isSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                  {t("expiryDate")}: {quote.expiry_date}
                  {isSoon && expiryDays !== null && <> ({expiryDays} {t("daysLeft")})</>}
                  {isExpired && <> <AlertTriangle className="inline h-3 w-3" /></>}
                </span>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map(a => (
                  <button key={a.id} onClick={() => downloadFile(a)} className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/70 px-2 py-1 rounded">
                    <FileText className="h-3 w-3" /> {a.file_name}
                  </button>
                ))}
              </div>
            )}
            {quote.notes && <p className="mt-2 text-xs text-muted-foreground italic">{quote.notes}</p>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-rose-600" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
                  <AlertDialogDescription>{quote.supplier_name}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>{t("delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteDialog({ open, onOpenChange, quote, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    supplier_name: "", reference_no: "", description: "", amount: "",
    currency: "EGP", status: "new" as Quote["status"],
    received_date: new Date().toISOString().slice(0, 10),
    expiry_date: "", notes: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (quote) {
        setForm({
          supplier_name: quote.supplier_name,
          reference_no: quote.reference_no ?? "",
          description: quote.description ?? "",
          amount: quote.amount?.toString() ?? "",
          currency: quote.currency,
          status: quote.status,
          received_date: quote.received_date,
          expiry_date: quote.expiry_date ?? "",
          notes: quote.notes ?? "",
        });
        supabase.from("quote_attachments").select("*").eq("quote_id", quote.id).then(({ data }) => {
          setExistingAttachments((data ?? []) as Attachment[]);
        });
      } else {
        setForm({ supplier_name: "", reference_no: "", description: "", amount: "", currency: "EGP", status: "new", received_date: new Date().toISOString().slice(0, 10), expiry_date: "", notes: "" });
        setExistingAttachments([]);
      }
      setFiles([]);
    }
  }, [open, quote]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const payload = {
        supplier_name: form.supplier_name.trim(),
        reference_no: form.reference_no.trim() || null,
        description: form.description.trim() || null,
        amount: form.amount ? Number(form.amount) : null,
        currency: form.currency,
        status: form.status,
        received_date: form.received_date,
        expiry_date: form.expiry_date || null,
        notes: form.notes.trim() || null,
      };

      let quoteId = quote?.id;
      if (quote) {
        const { error } = await supabase.from("quotes").update(payload).eq("id", quote.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("quotes").insert({ ...payload, user_id: uid }).select("id").single();
        if (error) throw error;
        quoteId = data.id;
      }

      // upload new files
      for (const f of files) {
        const path = `${uid}/${quoteId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("quote-attachments").upload(path, f);
        if (upErr) throw upErr;
        const { error: aErr } = await supabase.from("quote_attachments").insert({
          quote_id: quoteId, user_id: uid, file_name: f.name, storage_path: path, mime_type: f.type, size_bytes: f.size,
        });
        if (aErr) throw aErr;
      }

      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(a: Attachment) {
    await supabase.storage.from("quote-attachments").remove([a.storage_path]);
    await supabase.from("quote_attachments").delete().eq("id", a.id);
    setExistingAttachments(prev => prev.filter(x => x.id !== a.id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{quote ? t("editQuote") : t("newQuote")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("supplier")} *</Label>
              <Input required value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("reference")}</Label>
              <Input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Quote["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as TKey)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("amount")}</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("currency")}</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["EGP","USD","EUR","SAR","AED","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("receivedDate")}</Label>
              <Input type="date" required value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("expiryDate")}</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("description")}</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("notes")}</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("attachments")}</Label>
              {existingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {existingAttachments.map(a => (
                    <div key={a.id} className="inline-flex items-center gap-2 bg-muted px-2 py-1 rounded text-xs">
                      <FileText className="h-3 w-3" /> {a.file_name}
                      <button type="button" onClick={() => removeAttachment(a)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} {files.length === 1 ? t("file") : t("files")}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("loading") : t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
