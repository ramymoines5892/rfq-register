import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/hooks/useAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Warehouse, Plus, Search, Star, Pencil, Trash2, Save, X, Loader2, Building2, Filter, MapPin, Download, Upload,
} from "lucide-react";
import { useWarehouses, useUpsertWarehouse, useDeleteWarehouse } from "@/features/warehouses/queries";
import { useBranches } from "@/features/branches/queries";
import type { WarehouseWithBranch } from "@/features/warehouses/api";
import { BinsManager } from "@/features/warehouses/BinsManager";
import { toCSV, downloadCSV, parseCSV } from "@/lib/csv";
import { upsertWarehouse } from "@/features/warehouses/api";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";

export const Route = createFileRoute("/_authenticated/warehouses")({
  component: WarehousesPage,
  head: () => ({
    meta: [
      { title: "المخازن | Warehouses" },
      { name: "description", content: "إدارة المخازن مع الربط بالفروع" },
    ],
  }),
});

function WarehousesPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();
  const canManage = access.isAdmin;

  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<WarehouseWithBranch | "new" | null>(null);
  const [toDelete, setToDelete] = useState<WarehouseWithBranch | null>(null);
  const [binsFor, setBinsFor] = useState<WarehouseWithBranch | null>(null);
  const [importing, setImporting] = useState(false);
  const qc = useQueryClient();

  const { data: warehouses = [], isLoading } = useWarehouses(branchFilter === "all" ? null : branchFilter);
  const { data: branches = [] } = useBranches();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter((w) =>
      [w.name, w.name_ar, w.code, w.branch_name, w.branch_name_ar]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [warehouses, query]);

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Warehouse className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "المخازن" : "Warehouses"}</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {ar ? "إدارة المخازن مع الربط بالفروع" : "Manage warehouses linked to branches"}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={ar ? "بحث بالاسم أو الكود…" : "Search by name, code…"}
              value={query} onChange={(e) => setQuery(e.target.value)}
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder={ar ? "كل الفروع" : "All branches"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الفروع" : "All branches"}</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{ar ? (b.name_ar || b.name) : b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canManage && (
            <Button onClick={() => setEditing("new")} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {ar ? "مخزن جديد" : "New warehouse"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
            const rows = warehouses.map((w) => ({
              code: w.code ?? "", name: w.name, name_ar: w.name_ar ?? "",
              branch_code: w.branch_code ?? "", is_main: w.is_main ? "1" : "0", is_active: w.is_active ? "1" : "0",
            }));
            downloadCSV(`warehouses-${new Date().toISOString().slice(0,10)}.csv`,
              toCSV(rows, ["code","name","name_ar","branch_code","is_main","is_active"]));
          }}>
            <Download className="h-4 w-4" /> {ar ? "تصدير" : "Export"}
          </Button>
          {canManage && (
            <label className="cursor-pointer">
              <input type="file" accept=".csv,text/csv" hidden disabled={importing}
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setImporting(true);
                  try {
                    const rows = parseCSV(await f.text());
                    let ok = 0, fail = 0;
                    for (const r of rows) {
                      const name = (r.name || "").trim();
                      if (!name) { fail++; continue; }
                      const branch = branches.find((b) => (b as any).code === r.branch_code || b.name === r.branch_code || b.name_ar === r.branch_code);
                      if (!branch) { fail++; continue; }
                      try {
                        await upsertWarehouse(null, {
                          name, name_ar: r.name_ar || null, code: r.code || null,
                          branch_id: branch.id,
                          is_main: r.is_main === "1" || r.is_main?.toLowerCase() === "true",
                          is_active: r.is_active !== "0" && r.is_active?.toLowerCase() !== "false",
                        });
                        ok++;
                      } catch { fail++; }
                    }
                    qc.invalidateQueries({ queryKey: qk.warehouses.all });
                    toast.success(ar ? `تم استيراد ${ok}${fail ? ` — فشل ${fail}` : ""}` : `Imported ${ok}${fail ? ` — ${fail} failed` : ""}`);
                  } catch (err: any) { toast.error(err?.message ?? "Import error"); }
                  finally { setImporting(false); e.target.value = ""; }
                }} />
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm hover:bg-accent">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {ar ? "استيراد CSV" : "Import CSV"}
              </span>
            </label>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-3">
              <Warehouse className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div className="text-sm font-medium">{ar ? "لا توجد مخازن" : "No warehouses"}</div>
              <div className="text-xs text-muted-foreground">
                {branches.length === 0
                  ? (ar ? "أضف فرعًا أولًا من صفحة المؤسسة." : "Add a branch first from Organization.")
                  : (ar ? "ابدأ بإضافة أول مخزن لفرعك." : "Start by adding the first warehouse.")}
              </div>
              {canManage && branches.length > 0 && (
                <Button size="sm" onClick={() => setEditing("new")} className="gap-1.5">
                  <Plus className="h-4 w-4" /> {ar ? "إضافة مخزن" : "Add warehouse"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((w) => (
              <WarehouseCard
                key={w.id} warehouse={w} canManage={canManage}
                onEdit={() => setEditing(w)} onDelete={() => setToDelete(w)}
                onBins={() => setBinsFor(w)}
              />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <WarehouseEditor
          warehouse={editing === "new" ? null : editing}
          branches={branches}
          defaultBranchId={branchFilter !== "all" ? branchFilter : null}
          canManage={canManage}
          onClose={() => setEditing(null)}
        />
      )}

      {toDelete && (
        <DeleteWarehouseDialog warehouse={toDelete} onClose={() => setToDelete(null)} />
      )}

      {binsFor && (
        <BinsManager
          warehouseId={binsFor.id}
          branchId={binsFor.branch_id ?? ""}
          warehouseName={(ar ? (binsFor.name_ar || binsFor.name) : binsFor.name) ?? ""}
          onClose={() => setBinsFor(null)}
        />
      )}
    </div>
  );
}

/* ─── Card ────────────────────────────────────────────────────────────── */

function WarehouseCard({
  warehouse, canManage, onEdit, onDelete, onBins,
}: { warehouse: WarehouseWithBranch; canManage: boolean; onEdit: () => void; onDelete: () => void; onBins: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const display = ar ? (warehouse.name_ar || warehouse.name) : warehouse.name;
  const branch = ar ? (warehouse.branch_name_ar || warehouse.branch_name) : warehouse.branch_name;

  return (
    <Card className="group hover:border-primary/60 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Warehouse className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold text-sm truncate">{display}</div>
              {warehouse.is_main && (
                <Badge variant="secondary" className="text-[9px] gap-0.5"><Star className="h-2.5 w-2.5" /> {ar ? "رئيسى" : "Main"}</Badge>
              )}
              {!warehouse.is_active && <Badge variant="outline" className="text-[9px]">{ar ? "غير نشط" : "Inactive"}</Badge>}
            </div>
            {warehouse.code && <div className="text-[11px] text-muted-foreground font-mono">{warehouse.code}</div>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {branch ?? (ar ? "غير مرتبط بفرع" : "No branch")}
            {warehouse.branch_code && <span className="font-mono opacity-70"> · {warehouse.branch_code}</span>}
          </span>
        </div>

        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="flex-1 h-8 gap-1.5" onClick={onEdit}>
            <Pencil className="h-3 w-3" /> {ar ? "تعديل" : "Edit"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onBins} title={ar ? "المواقع/الرفوف" : "Locations / bins"}>
            <MapPin className="h-3 w-3" />
          </Button>
          {canManage && (
            <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Editor ──────────────────────────────────────────────────────────── */

function WarehouseEditor({
  warehouse, branches, defaultBranchId, canManage, onClose,
}: {
  warehouse: WarehouseWithBranch | null;
  branches: Array<{ id: string; name: string; name_ar: string | null; is_head_office: boolean }>;
  defaultBranchId: string | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const isNew = !warehouse;

  const [form, setForm] = useState({
    name:      warehouse?.name      ?? "",
    name_ar:   warehouse?.name_ar   ?? "",
    code:      warehouse?.code      ?? "",
    branch_id: warehouse?.branch_id ?? defaultBranchId
                 ?? branches.find((b) => b.is_head_office)?.id
                 ?? branches[0]?.id ?? null,
    is_main:   warehouse?.is_main   ?? false,
    is_active: warehouse?.is_active ?? true,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const upsert = useUpsertWarehouse();

  async function save() {
    if (!form.name.trim()) { toast.error(ar ? "الاسم مطلوب" : "Name required"); return; }
    if (!form.branch_id)   { toast.error(ar ? "اختر فرعًا" : "Branch is required"); return; }
    try {
      await upsert.mutateAsync({
        id: warehouse?.id ?? null,
        payload: {
          name: form.name.trim(),
          name_ar: form.name_ar?.trim() || null,
          code: form.code?.trim() || null,
          branch_id: form.branch_id,
          is_main: form.is_main,
          is_active: form.is_active,
        },
      });
      toast.success(ar ? "تم الحفظ" : "Saved");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto scrollbar-slim">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-primary" />
            {isNew ? (ar ? "إضافة مخزن" : "Add warehouse") : (ar ? "تعديل المخزن" : "Edit warehouse")}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الاسم (إنجليزى)" : "Name (English)"}</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الاسم (عربى)" : "Name (Arabic)"}</Label>
              <Input value={form.name_ar ?? ""} onChange={(e) => set("name_ar", e.target.value)} dir="rtl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الكود" : "Code"}</Label>
              <Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="WH-01" className="font-mono uppercase" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الفرع" : "Branch"} *</Label>
              <Select value={form.branch_id ?? undefined} onValueChange={(v) => set("branch_id", v)}>
                <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-2">
                        {ar ? (b.name_ar || b.name) : b.name}
                        {b.is_head_office && <Badge variant="secondary" className="text-[9px]">HQ</Badge>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={form.is_main} onCheckedChange={(v) => set("is_main", v)} />
              <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {ar ? "مخزن رئيسى" : "Main warehouse"}</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
              <span>{ar ? "نشط" : "Active"}</span>
            </label>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "يمكن أن يكون هناك مخزن رئيسى واحد فقط لكل فرع، وسيتم تعديل المخازن الأخرى تلقائيًا."
              : "Only one main warehouse per branch; other warehouses will be updated automatically."}
          </p>
        </div>

        <div className="sticky bottom-0 mt-6 -mx-6 -mb-6 px-6 py-3 bg-background border-t flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="gap-1.5"><X className="h-4 w-4" /> {ar ? "إغلاق" : "Close"}</Button>
          {canManage && (
            <Button onClick={save} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Delete ──────────────────────────────────────────────────────────── */

function DeleteWarehouseDialog({ warehouse, onClose }: { warehouse: WarehouseWithBranch; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const mut = useDeleteWarehouse();

  async function confirm() {
    try {
      await mut.mutateAsync(warehouse.id);
      toast.success(ar ? "تم الحذف" : "Deleted");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> {ar ? "حذف المخزن" : "Delete warehouse"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "لا يمكن التراجع عن هذا الإجراء. المخزن الذى يحتوى على حركات مخزنية سيتم رفضه."
              : "This action cannot be undone. Warehouses with stock movements will be rejected."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="font-medium">{ar ? (warehouse.name_ar || warehouse.name) : warehouse.name}</div>
          {warehouse.code && <div className="text-[11px] text-muted-foreground font-mono">{warehouse.code}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button variant="destructive" onClick={confirm} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : <Trash2 className="h-4 w-4 me-1.5" />}
            {ar ? "حذف" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
