import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sliders, Plus, Trash2, Send, Loader2, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  useAdjustments, useAdjustmentLines, useCreateAdjustment, usePostAdjustment, useRequestAdjApproval,
  type AdjReason, type AdjStatus, type LineUpsert, type StockAdjustment,
} from "@/modules/adjustments/api";
import { useWarehouses } from "@/modules/warehouses/queries";
import { useBranches } from "@/modules/branches/queries";
import { useProducts } from "@/modules/products/queries";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentCompany } from "@/modules/company/queries";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/adjustments")({
  component: AdjustmentsPage,
  head: () => ({
    meta: [
      { title: "تسويات المخزون | Stock Adjustments" },
      { name: "description", content: "طلب واعتماد وترحيل تسويات المخزون مع تتبع كامل" },
    ],
  }),
});

const REASONS: { v: AdjReason; ar: string; en: string }[] = [
  { v: "count", ar: "جرد", en: "Count" },
  { v: "damage", ar: "تلف", en: "Damage" },
  { v: "loss", ar: "فقد", en: "Loss" },
  { v: "found", ar: "زيادة (وجد)", en: "Found" },
  { v: "correction", ar: "تصحيح", en: "Correction" },
  { v: "other", ar: "أخرى", en: "Other" },
];

const STATUS_BADGE: Record<AdjStatus, { ar: string; en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { ar: "مسودة", en: "Draft", variant: "outline" },
  pending_approval: { ar: "بانتظار الاعتماد", en: "Pending", variant: "secondary" },
  approved: { ar: "معتمد", en: "Approved", variant: "default" },
  posted: { ar: "مرحّل", en: "Posted", variant: "default" },
  rejected: { ar: "مرفوض", en: "Rejected", variant: "destructive" },
  cancelled: { ar: "ملغى", en: "Cancelled", variant: "outline" },
};

function AdjustmentsPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [statusFilter, setStatusFilter] = useState<AdjStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);
  const [openDetail, setOpenDetail] = useState<StockAdjustment | null>(null);

  const { data: perms } = usePermissions([
    "inventory.adjust.create", "inventory.adjust.approve", "inventory.view",
  ] as const);
  const canCreate = perms?.map["inventory.adjust.create"] ?? false;
  const canApprove = perms?.map["inventory.adjust.approve"] ?? false;

  const { data: adjustments = [], isLoading } = useAdjustments(
    statusFilter === "all" ? undefined : { status: statusFilter },
  );

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Sliders className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "تسويات المخزون" : "Stock Adjustments"}</h1>
          <div className="flex-1" />
          {canCreate && (
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 me-1" /> {ar ? "تسوية جديدة" : "New Adjustment"}
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AdjStatus | "all")}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الحالات" : "All statuses"}</SelectItem>
              {(Object.keys(STATUS_BADGE) as AdjStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{ar ? STATUS_BADGE[s].ar : STATUS_BADGE[s].en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : adjustments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-2">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div className="text-sm font-medium">{ar ? "لا توجد تسويات" : "No adjustments yet"}</div>
              {canCreate && (
                <Button size="sm" variant="outline" onClick={() => setOpenNew(true)}>
                  <Plus className="h-4 w-4 me-1" /> {ar ? "إنشاء تسوية" : "Create adjustment"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {adjustments.map((a) => {
              const sb = STATUS_BADGE[a.status];
              return (
                <Card key={a.id} className="hover:shadow-sm cursor-pointer" onClick={() => setOpenDetail(a)}>
                  <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="font-mono text-xs">{a.doc_no ?? a.id.slice(0, 8)}</div>
                    <Badge variant={sb.variant}>{ar ? sb.ar : sb.en}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {ar ? REASONS.find((r) => r.v === a.reason)?.ar : REASONS.find((r) => r.v === a.reason)?.en}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString(ar ? "ar-EG" : "en-GB")}
                    </div>
                    {a.notes && <div className="text-xs text-muted-foreground truncate max-w-md">{a.notes}</div>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {openNew && (
        <NewAdjustmentDialog
          open={openNew}
          onClose={() => setOpenNew(false)}
          ar={ar}
        />
      )}
      {openDetail && (
        <AdjustmentDetailDialog
          adj={openDetail}
          onClose={() => setOpenDetail(null)}
          ar={ar}
          canApprove={canApprove}
          canCreate={canCreate}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function useCurrentCompanyId() {
  const { data } = useCurrentCompany();
  return { data: data?.id ?? null };
}


function NewAdjustmentDialog({ open, onClose, ar }: { open: boolean; onClose: () => void; ar: boolean }) {
  const { data: branches = [] } = useBranches();
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProducts();
  const { data: companyId } = useCurrentCompanyId();

  const [branchId, setBranchId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reason, setReason] = useState<AdjReason>("correction");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineUpsert[]>([]);

  const create = useCreateAdjustment();

  const whOfBranch = useMemo(
    () => warehouses.filter((w: any) => !branchId || w.branch_id === branchId),
    [warehouses, branchId],
  );

  const addLine = () => setLines((prev) => [...prev, {
    product_id: "", bin_id: null, qty: 0, uom: null,
    heat_no: null, lot_no: null, batch_no: null, serial_no: null,
    mtc_ref: null, coo_ref: null, notes: null,
  }]);

  const patch = (i: number, p: Partial<LineUpsert>) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...p } : l));

  const remove = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  async function submit(saveOnly: boolean) {
    if (!companyId) return toast.error(ar ? "لا توجد شركة نشطة" : "No active company");
    if (!branchId || !warehouseId) return toast.error(ar ? "الفرع والمخزن مطلوبان" : "Branch & warehouse required");
    if (lines.length === 0 || lines.some((l) => !l.product_id || Number(l.qty) === 0)) {
      return toast.error(ar ? "أضف بند واحد على الأقل بكمية غير صفرية" : "Add at least one line with a non-zero qty");
    }
    try {
      await create.mutateAsync({
        payload: { company_id: companyId, branch_id: branchId, warehouse_id: warehouseId, reason, notes: notes || null },
        lines,
      });
      toast.success(ar ? "تم الحفظ" : saveOnly ? "Saved" : "Created");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{ar ? "تسوية مخزون جديدة" : "New Stock Adjustment"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto scrollbar-slim space-y-3 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">{ar ? "الفرع" : "Branch"}</label>
              <Select value={branchId} onValueChange={(v) => { setBranchId(v); setWarehouseId(""); }}>
                <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                <SelectContent>
                  {branches.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{ar ? (b.name_ar || b.name) : b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{ar ? "المخزن" : "Warehouse"}</label>
              <Select value={warehouseId} onValueChange={setWarehouseId} disabled={!branchId}>
                <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                <SelectContent>
                  {whOfBranch.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{ar ? (w.name_ar || w.name) : w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{ar ? "السبب" : "Reason"}</label>
              <Select value={reason} onValueChange={(v) => setReason(v as AdjReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => <SelectItem key={r.v} value={r.v}>{ar ? r.ar : r.en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{ar ? "ملاحظات" : "Notes"}</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="border rounded-md">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-medium">{ar ? "البنود" : "Lines"}</div>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-3.5 w-3.5 me-1" /> {ar ? "بند" : "Line"}
              </Button>
            </div>
            <div className="divide-y">
              {lines.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  {ar ? "لا توجد بنود بعد" : "No lines yet"}
                </div>
              )}
              {lines.map((l, i) => (
                <div key={i} className="p-2 grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-end">
                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-muted-foreground">{ar ? "الصنف" : "Product"}</label>
                    <Select value={l.product_id} onValueChange={(v) => {
                      const p: any = products.find((pp: any) => pp.id === v);
                      patch(i, { product_id: v, uom: p?.uom ?? null });
                    }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="…" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code} — {ar ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-muted-foreground">{ar ? "الكمية (± للاتجاه)" : "Qty (± sign)"}</label>
                    <Input type="number" step="any" value={l.qty} onChange={(e) => patch(i, { qty: Number(e.target.value) })} className="h-8" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-muted-foreground">Heat</label>
                    <Input value={l.heat_no ?? ""} onChange={(e) => patch(i, { heat_no: e.target.value || null })} className="h-8" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-muted-foreground">Lot / Batch</label>
                    <Input value={l.lot_no ?? l.batch_no ?? ""} onChange={(e) => patch(i, { lot_no: e.target.value || null })} className="h-8" />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-[10px] text-muted-foreground">Serial</label>
                    <Input value={l.serial_no ?? ""} onChange={(e) => patch(i, { serial_no: e.target.value || null })} className="h-8" />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={() => submit(true)} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (ar ? "حفظ كمسودة" : "Save Draft")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDetailDialog({
  adj, onClose, ar, canApprove, canCreate,
}: { adj: StockAdjustment; onClose: () => void; ar: boolean; canApprove: boolean; canCreate: boolean }) {
  const { data: lines = [], isLoading } = useAdjustmentLines(adj.id);
  const { data: products = [] } = useProducts();
  const post = usePostAdjustment();
  const request = useRequestAdjApproval();

  const prodName = (id: string) => {
    const p: any = products.find((pp: any) => pp.id === id);
    return p ? `${p.code} — ${ar ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar)}` : id.slice(0, 8);
  };

  const canPostDirect = canApprove && (adj.status === "draft" || adj.status === "approved");
  const canRequest = canCreate && adj.status === "draft";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ar ? "تسوية" : "Adjustment"} · {adj.doc_no ?? adj.id.slice(0, 8)}
            <Badge variant={STATUS_BADGE[adj.status].variant}>
              {ar ? STATUS_BADGE[adj.status].ar : STATUS_BADGE[adj.status].en}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto scrollbar-slim space-y-3">
          {adj.notes && (
            <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">{adj.notes}</div>
          )}
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin inline me-2" /> {ar ? "جارٍ التحميل…" : "Loading…"}
            </div>
          ) : lines.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">{ar ? "لا توجد بنود" : "No lines"}</div>
          ) : (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-start">{ar ? "الصنف" : "Product"}</th>
                    <th className="p-2 text-end">{ar ? "الكمية" : "Qty"}</th>
                    <th className="p-2 text-start">Heat/Lot</th>
                    <th className="p-2 text-start">Serial</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{prodName(l.product_id)}</td>
                      <td className="p-2 text-end font-mono">{Number(l.qty).toLocaleString()}</td>
                      <td className="p-2">{l.heat_no ?? l.lot_no ?? l.batch_no ?? "—"}</td>
                      <td className="p-2">{l.serial_no ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter className="border-t pt-3 gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>{ar ? "إغلاق" : "Close"}</Button>
          {canRequest && (
            <Button variant="secondary" onClick={async () => {
              try {
                await request.mutateAsync({ id: adj.id, branchId: adj.branch_id });
                toast.success(ar ? "تم إرسال الطلب" : "Approval requested");
                onClose();
              } catch (e: any) { toast.error(e.message ?? String(e)); }
            }} disabled={request.isPending}>
              <Send className="h-4 w-4 me-1" /> {ar ? "طلب اعتماد" : "Request Approval"}
            </Button>
          )}
          {canPostDirect && (
            <Button onClick={async () => {
              try {
                await post.mutateAsync(adj.id);
                toast.success(ar ? "تم الترحيل" : "Posted");
                onClose();
              } catch (e: any) { toast.error(e.message ?? String(e)); }
            }} disabled={post.isPending}>
              <CheckCircle2 className="h-4 w-4 me-1" /> {ar ? "ترحيل الآن" : "Post Now"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
