import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus, Search, X, SlidersHorizontal, Download, Upload, Columns3,
  Trash2, CheckCircle2, Ban, ChevronDown, ChevronUp, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { usePartners, usePartnerBulk } from "@/modules/partners/queries";
import type { BusinessPartner, PartnerRole } from "@/modules/partners/api";
import { PartnerSheet } from "@/modules/partners/components/PartnerSheet";
import { toCSV, downloadCSV, parseCSV } from "@/modules/partners/csv";

type ColKey =
  | "code" | "name" | "tax_id" | "email" | "phone" | "city" | "country"
  | "industry" | "currency" | "payment_terms" | "credit_limit" | "status";

const COLUMNS: { key: ColKey; ar: string; en: string; always?: boolean; numeric?: boolean }[] = [
  { key: "name", ar: "الاسم", en: "Name", always: true },
  { key: "code", ar: "الكود", en: "Code" },
  { key: "tax_id", ar: "الرقم الضريبي", en: "Tax ID" },
  { key: "email", ar: "البريد", en: "Email" },
  { key: "phone", ar: "الهاتف", en: "Phone" },
  { key: "city", ar: "المدينة", en: "City" },
  { key: "country", ar: "الدولة", en: "Country" },
  { key: "industry", ar: "الصناعة", en: "Industry" },
  { key: "currency", ar: "العملة", en: "Currency" },
  { key: "payment_terms", ar: "شروط الدفع", en: "Payment Terms" },
  { key: "credit_limit", ar: "حد الائتمان", en: "Credit Limit", numeric: true },
  { key: "status", ar: "الحالة", en: "Status", always: true },
];

const DEFAULT_COLS: ColKey[] = ["name", "code", "tax_id", "phone", "city", "currency", "status"];
const EXPORT_HEADERS = [
  "code", "name_ar", "name_en", "legal_name", "tax_id", "email", "phone", "mobile",
  "country", "city", "address", "industry", "currency", "payment_terms", "credit_limit", "status", "roles",
];

type SortKey = "name" | "code" | "created" | "credit_limit";

export function PartnersDirectory({
  role, basePath, titleAr, titleEn, subtitleAr, subtitleEn, newLabelAr, newLabelEn,
}: {
  role: PartnerRole;
  basePath: string;
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  newLabelAr: string; newLabelEn: string;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const confirm = useConfirm();
  const COLS_KEY = `partners:${role}:columns:v2`;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [cols, setCols] = useState<ColKey[]>(DEFAULT_COLS);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLS_KEY);
      if (raw) setCols(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [COLS_KEY]);
  useEffect(() => { try { localStorage.setItem(COLS_KEY, JSON.stringify(cols)); } catch { /* ignore */ } }, [COLS_KEY, cols]);

  const { data: rows = [], isLoading } = usePartners(role, search);
  const bulk = usePartnerBulk();

  const cities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.city).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const out = rows.filter((p) => {
      if (status !== "all" && (p.status ?? "active") !== status) return false;
      if (city !== "all" && p.city !== city) return false;
      return true;
    });
    const nameOf = (p: BusinessPartner) => (ar ? p.name_ar || p.name_en : p.name_en || p.name_ar) ?? "";
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      if (sort.key === "credit_limit") return ((a.credit_limit ?? 0) - (b.credit_limit ?? 0)) * dir;
      if (sort.key === "created") return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      const av = sort.key === "code" ? a.code ?? "" : nameOf(a);
      const bv = sort.key === "code" ? b.code ?? "" : nameOf(b);
      return av.localeCompare(bv, ar ? "ar" : "en") * dir;
    });
  }, [rows, status, city, sort, ar]);

  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => filtered.some((r) => r.id === id))));
  }, [filtered]);

  const visibleCols = COLUMNS.filter((c) => c.always || cols.includes(c.key));
  const allChecked = filtered.length > 0 && selected.size === filtered.length;
  const hasFilters = status !== "all" || city !== "all";

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function cellValue(p: BusinessPartner, key: ColKey) {
    switch (key) {
      case "name":
        return (
          <div className="min-w-0">
            <div className="font-medium truncate">{(ar ? p.name_ar || p.name_en : p.name_en || p.name_ar) || "—"}</div>
            {p.legal_name && <div className="text-xs text-muted-foreground truncate">{p.legal_name}</div>}
          </div>
        );
      case "status": {
        const s = p.status ?? "active";
        const variant = s === "active" ? "secondary" : s === "blocked" ? "destructive" : "outline";
        return <Badge variant={variant as any} className="text-[10px]">
          {ar ? ({ active: "نشط", inactive: "متوقّف", blocked: "محظور" } as any)[s] ?? s : s}
        </Badge>;
      }
      case "credit_limit":
        return p.credit_limit != null ? Number(p.credit_limit).toLocaleString() : "—";
      default:
        return (p as any)[key] || "—";
    }
  }

  function exportCsv(only?: Set<string>) {
    const src = only && only.size ? filtered.filter((r) => only.has(r.id)) : filtered;
    if (!src.length) { toast.error(ar ? "لا توجد بيانات للتصدير" : "Nothing to export"); return; }
    downloadCSV(`${role}s-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(src as any, EXPORT_HEADERS));
  }

  function downloadTemplate() {
    downloadCSV(`${role}-import-template.csv`, toCSV([], EXPORT_HEADERS));
  }

  async function onImportFile(file: File) {
    try {
      const rowsIn = parseCSV(await file.text());
      if (!rowsIn.length) { toast.error(ar ? "الملف فارغ" : "Empty file"); return; }
      const res = await bulk.importCsv.mutateAsync({ rows: rowsIn, role });
      if (res.failed.length) {
        toast.warning(ar
          ? `تم استيراد ${res.inserted}، وفشل ${res.failed.length} صف`
          : `Imported ${res.inserted}, ${res.failed.length} row(s) failed`);
      } else {
        toast.success(ar ? `تم استيراد ${res.inserted} سجل` : `Imported ${res.inserted} records`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    }
  }

  async function bulkDelete() {
    const ids = [...selected];
    const ok = await confirm({
      title: ar ? `حذف ${ids.length} سجل؟` : `Delete ${ids.length} records?`,
      description: ar ? "لن يمكن التراجع عن هذا الإجراء." : "This action cannot be undone.",
      confirmText: ar ? "حذف" : "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try { await bulk.remove.mutateAsync(ids); setSelected(new Set()); toast.success(ar ? "تم الحذف" : "Deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function bulkStatus(next: string) {
    try {
      await bulk.setStatus.mutateAsync({ ids: [...selected], status: next });
      setSelected(new Set());
      toast.success(ar ? "تم التحديث" : "Updated");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{ar ? titleAr : titleEn}</h1>
            <p className="text-sm text-muted-foreground">{ar ? subtitleAr : subtitleEn}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Upload className="h-4 w-4 me-1" />{ar ? "استيراد" : "Import"}</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {ar ? "استورد ملف CSV بنفس أعمدة القالب." : "Upload a CSV using the template columns."}
                </p>
                <Button size="sm" className="w-full" onClick={() => fileRef.current?.click()} disabled={bulk.importCsv.isPending}>
                  {ar ? "اختيار ملف CSV" : "Choose CSV file"}
                </Button>
                <Button size="sm" variant="outline" className="w-full" onClick={downloadTemplate}>
                  {ar ? "تنزيل القالب" : "Download template"}
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={() => exportCsv()}>
              <Download className="h-4 w-4 me-1" />{ar ? "تصدير" : "Export"}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 me-1" />{ar ? newLabelAr : newLabelEn}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder={ar ? "بحث بالاسم/الكود/الرقم الضريبي/الهاتف…" : "Search name, code, tax ID, phone…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant={showFilters || hasFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4 me-1" />{ar ? "فلاتر" : "Filters"}
            {hasFilters && <Badge variant="secondary" className="ms-2">{(status !== "all" ? 1 : 0) + (city !== "all" ? 1 : 0)}</Badge>}
            {showFilters ? <ChevronUp className="h-4 w-4 ms-1" /> : <ChevronDown className="h-4 w-4 ms-1" />}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><Columns3 className="h-4 w-4 me-1" />{ar ? "الأعمدة" : "Columns"}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <div className="text-xs font-medium mb-2">{ar ? "الأعمدة الظاهرة" : "Visible columns"}</div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {COLUMNS.map((c) => (
                  <label key={c.key} className={`flex items-center gap-2 text-sm ${c.always ? "opacity-60" : "cursor-pointer"}`}>
                    <Checkbox
                      checked={c.always || cols.includes(c.key)}
                      disabled={c.always}
                      onCheckedChange={(v) => setCols((s) => (v ? [...s, c.key] : s.filter((k) => k !== c.key)))}
                    />
                    {ar ? c.ar : c.en}
                  </label>
                ))}
              </div>
              <Separator className="my-2" />
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setCols(DEFAULT_COLS)}>
                {ar ? "استعادة الافتراضي" : "Reset to default"}
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {showFilters && (
          <Card><CardContent className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder={ar ? "الحالة" : "Status"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "All statuses"}</SelectItem>
                <SelectItem value="active">{ar ? "نشط" : "Active"}</SelectItem>
                <SelectItem value="inactive">{ar ? "متوقّف" : "Inactive"}</SelectItem>
                <SelectItem value="blocked">{ar ? "محظور" : "Blocked"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger><SelectValue placeholder={ar ? "المدينة" : "City"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل المدن" : "All cities"}</SelectItem>
                {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="justify-start" onClick={() => { setStatus("all"); setCity("all"); }}>
                <X className="h-4 w-4 me-1" />{ar ? "مسح الفلاتر" : "Clear filters"}
              </Button>
            )}
          </CardContent></Card>
        )}

        {selected.size > 0 && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-2.5 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{ar ? `${selected.size} محدد` : `${selected.size} selected`}</Badge>
              <Button variant="outline" size="sm" onClick={() => bulkStatus("active")}>
                <CheckCircle2 className="h-4 w-4 me-1" />{ar ? "تفعيل" : "Activate"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulkStatus("inactive")}>
                <Ban className="h-4 w-4 me-1" />{ar ? "تعطيل" : "Deactivate"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCsv(selected)}>
                <Download className="h-4 w-4 me-1" />{ar ? "تصدير المحدد" : "Export selected"}
              </Button>
              <Button variant="destructive" size="sm" onClick={bulkDelete}>
                <Trash2 className="h-4 w-4 me-1" />{ar ? "حذف" : "Delete"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="h-4 w-4 me-1" />{ar ? "إلغاء التحديد" : "Clear"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((r) => r.id)) : new Set())}
                      aria-label={ar ? "تحديد الكل" : "Select all"}
                    />
                  </TableHead>
                  {visibleCols.map((c) => {
                    const sortable: Partial<Record<ColKey, SortKey>> = { name: "name", code: "code", credit_limit: "credit_limit" };
                    const sk = sortable[c.key];
                    return (
                      <TableHead key={c.key} className={c.numeric ? "text-end whitespace-nowrap" : "whitespace-nowrap"}>
                        {sk ? (
                          <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(sk)}>
                            {ar ? c.ar : c.en}<ArrowUpDown className="h-3 w-3" />
                          </button>
                        ) : (ar ? c.ar : c.en)}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={visibleCols.length + 1} className="text-center py-10 text-muted-foreground">…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={visibleCols.length + 1} className="text-center py-10 text-muted-foreground">
                    {ar ? "لا توجد نتائج" : "No results"}
                  </TableCell></TableRow>
                ) : filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: `${basePath}/$id`, params: { id: p.id } })}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={(v) => setSelected((s) => {
                          const n = new Set(s);
                          if (v) n.add(p.id); else n.delete(p.id);
                          return n;
                        })}
                      />
                    </TableCell>
                    {visibleCols.map((c) => (
                      <TableCell key={c.key} className={c.numeric ? "text-end tabular-nums" : "max-w-[220px] truncate"}>
                        {cellValue(p, c.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <div className="text-xs text-muted-foreground">
          {ar ? `${filtered.length} من ${rows.length}` : `${filtered.length} of ${rows.length}`}
        </div>

        <QuickCreatePartner
          open={creating}
          role={role}
          onCreated={(newId) => { setCreating(false); navigate({ to: `${basePath}/$id`, params: { id: newId } }); }}
          onClose={() => setCreating(false)}
        />
      </div>
    </TooltipProvider>
  );
}

