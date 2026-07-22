import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/hooks/useAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, Save, X, Loader2, Send, Ban, Package, Trash2, ArrowRight } from "lucide-react";
import {
  useTransfers, useTransferDetail, useCreateTransfer, useAddLine,
  useDeleteLine, usePostTransfer, useCancelTransfer,
  type StockTransfer, type TransferStatus,
} from "@/features/transfers/api";
import { useWarehouses } from "@/features/warehouses/queries";
import { useBranches } from "@/features/branches/queries";
import { useProducts } from "@/features/products/queries";

export const Route = createFileRoute("/_authenticated/transfers")({
  component: TransfersPage,
  head: () => ({
    meta: [
      { title: "نقل المخزون | Stock Transfers" },
      { name: "description", content: "نقل المخزون بين المخازن والفروع" },
    ],
  }),
});

const STATUS_COLORS: Record<TransferStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_transit: "bg-warning/20 text-warning-foreground",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-destructive/15 text-destructive",
};

function TransfersPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();

  const { data: transfers = [], isLoading } = useTransfers();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "نقل المخزون" : "Stock Transfers"}</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {ar ? "بين المخازن داخل نفس الفرع أو بين الفروع" : "Between warehouses within a branch or across branches"}
          </span>
          <div className="ms-auto">
            {access.isAdmin && (
              <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5"><Plus className="h-4 w-4" /> {ar ? "تحويل جديد" : "New transfer"}</Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : transfers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-2">
              <ArrowLeftRight className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div className="text-sm font-medium">{ar ? "لا توجد تحويلات" : "No transfers"}</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {transfers.map((t) => (
              <TransferCard key={t.id} transfer={t} onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        )}
      </main>

      {creating && <CreateTransferDialog onClose={(id) => { setCreating(false); if (id) setOpenId(id); }} />}
      {openId && <TransferDetailSheet id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function TransferCard({ transfer, onOpen }: { transfer: StockTransfer; onOpen: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <Card className="hover:border-primary/60 transition-colors cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-mono font-semibold text-sm">{transfer.transfer_no}</div>
          <Badge className={`text-[10px] ${STATUS_COLORS[transfer.status]}`}>{ar ? statusAr(transfer.status) : transfer.status}</Badge>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {new Date(transfer.created_at).toLocaleString(ar ? "ar-EG" : "en-GB")}
        </div>
        {transfer.notes && <div className="text-xs line-clamp-2">{transfer.notes}</div>}
      </CardContent>
    </Card>
  );
}

function statusAr(s: TransferStatus): string {
  return s === "draft" ? "مسودة" : s === "in_transit" ? "فى الطريق" : s === "completed" ? "مكتمل" : "ملغى";
}

function CreateTransferDialog({ onClose }: { onClose: (createdId?: string) => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: branches = [] } = useBranches();
  const { data: warehouses = [] } = useWarehouses();
  const create = useCreateTransfer();

  const [form, setForm] = useState({
    from_branch_id: "", to_branch_id: "",
    from_warehouse_id: "", to_warehouse_id: "",
    notes: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));
  const fromWhs = warehouses.filter((w) => w.branch_id === form.from_branch_id);
  const toWhs = warehouses.filter((w) => w.branch_id === form.to_branch_id);

  async function save() {
    if (!form.from_branch_id || !form.to_branch_id || !form.from_warehouse_id || !form.to_warehouse_id) {
      toast.error(ar ? "أكمل البيانات" : "Complete all fields"); return;
    }
    if (form.from_warehouse_id === form.to_warehouse_id) { toast.error(ar ? "لا يمكن التحويل لنفس المخزن" : "Source & destination must differ"); return; }
    try {
      const t = await create.mutateAsync({
        from_branch_id: form.from_branch_id, to_branch_id: form.to_branch_id,
        from_warehouse_id: form.from_warehouse_id, to_warehouse_id: form.to_warehouse_id,
        notes: form.notes || null,
      });
      toast.success(ar ? "تم الإنشاء" : "Created");
      onClose(t.id);
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{ar ? "تحويل جديد" : "New transfer"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "من الفرع" : "From branch"}</Label>
            <Select value={form.from_branch_id} onValueChange={(v) => { set("from_branch_id", v); set("from_warehouse_id", ""); }}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{ar ? (b.name_ar || b.name) : b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "من المخزن" : "From warehouse"}</Label>
            <Select value={form.from_warehouse_id} onValueChange={(v) => set("from_warehouse_id", v)} disabled={!form.from_branch_id}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
              <SelectContent>{fromWhs.map((w) => <SelectItem key={w.id} value={w.id}>{ar ? (w.name_ar || w.name) : w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "إلى الفرع" : "To branch"}</Label>
            <Select value={form.to_branch_id} onValueChange={(v) => { set("to_branch_id", v); set("to_warehouse_id", ""); }}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{ar ? (b.name_ar || b.name) : b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "إلى المخزن" : "To warehouse"}</Label>
            <Select value={form.to_warehouse_id} onValueChange={(v) => set("to_warehouse_id", v)} disabled={!form.to_branch_id}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
              <SelectContent>{toWhs.map((w) => <SelectItem key={w.id} value={w.id}>{ar ? (w.name_ar || w.name) : w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">{ar ? "ملاحظات" : "Notes"}</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={save} disabled={create.isPending} className="gap-1.5">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {ar ? "إنشاء" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, isLoading } = useTransferDetail(id);
  const { data: products = [] } = useProducts();
  const { data: warehouses = [] } = useWarehouses();
  const { data: branches = [] } = useBranches();

  const addLine = useAddLine(id);
  const deleteLine = useDeleteLine(id);
  const postT = usePostTransfer();
  const cancelT = useCancelTransfer();

  const [line, setLine] = useState({
    product_id: "", qty: 1, uom: "",
    heat_no: "", lot_no: "", batch_no: "", serial_no: "", mtc_ref: "", coo_ref: "", notes: "",
  });
  const setL = <K extends keyof typeof line>(k: K, v: typeof line[K]) => setLine((p) => ({ ...p, [k]: v }));

  const wh = (id: string) => warehouses.find((w) => w.id === id);
  const br = (id: string) => branches.find((b) => b.id === id);

  async function addLineNow() {
    if (!line.product_id) { toast.error(ar ? "اختر صنفًا" : "Select product"); return; }
    if (!line.qty || line.qty <= 0) { toast.error(ar ? "الكمية يجب أن تكون أكبر من صفر" : "Qty > 0"); return; }
    try {
      await addLine.mutateAsync({
        product_id: line.product_id, qty: line.qty,
        uom: line.uom || null, from_bin_id: null, to_bin_id: null,
        heat_no: line.heat_no || null, lot_no: line.lot_no || null, batch_no: line.batch_no || null, serial_no: line.serial_no || null,
        mtc_ref: line.mtc_ref || null, coo_ref: line.coo_ref || null, notes: line.notes || null,
      });
      setLine({ product_id: "", qty: 1, uom: "", heat_no: "", lot_no: "", batch_no: "", serial_no: "", mtc_ref: "", coo_ref: "", notes: "" });
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  async function post() {
    try { await postT.mutateAsync(id); toast.success(ar ? "تم الترحيل" : "Posted"); onClose(); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  async function cancel() {
    try { await cancelT.mutateAsync(id); toast.success(ar ? "تم الإلغاء" : "Cancelled"); onClose(); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-2xl overflow-y-auto scrollbar-slim">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            {ar ? "تفاصيل التحويل" : "Transfer details"}
            {data && <Badge className={`text-[10px] ${STATUS_COLORS[data.transfer.status]}`}>{ar ? statusAr(data.transfer.status) : data.transfer.status}</Badge>}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="py-8 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-3 text-sm space-y-2">
                <div className="font-mono font-semibold">{data.transfer.transfer_no}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{ar ? (br(data.transfer.from_branch_id)?.name_ar || br(data.transfer.from_branch_id)?.name) : br(data.transfer.from_branch_id)?.name} — {ar ? (wh(data.transfer.from_warehouse_id)?.name_ar || wh(data.transfer.from_warehouse_id)?.name) : wh(data.transfer.from_warehouse_id)?.name}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{ar ? (br(data.transfer.to_branch_id)?.name_ar || br(data.transfer.to_branch_id)?.name) : br(data.transfer.to_branch_id)?.name} — {ar ? (wh(data.transfer.to_warehouse_id)?.name_ar || wh(data.transfer.to_warehouse_id)?.name) : wh(data.transfer.to_warehouse_id)?.name}</span>
                </div>
                {data.transfer.notes && <div className="text-xs italic">{data.transfer.notes}</div>}
              </CardContent>
            </Card>

            {data.transfer.status === "draft" && (
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-semibold flex items-center gap-1.5"><Plus className="h-3 w-3" /> {ar ? "إضافة سطر" : "Add line"}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[11px]">{ar ? "الصنف" : "Product"}</Label>
                      <Select value={line.product_id} onValueChange={(v) => setL("product_id", v)}>
                        <SelectTrigger className="h-8"><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                        <SelectContent>{products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="font-mono text-xs me-2">{p.code}</span>
                            {ar ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar)}
                          </SelectItem>
                        ))}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">{ar ? "الكمية" : "Qty"}</Label>
                      <Input type="number" min="0" step="0.0001" className="h-8" value={line.qty} onChange={(e) => setL("qty", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div><Label className="text-[11px]">Heat No</Label><Input className="h-8" value={line.heat_no} onChange={(e) => setL("heat_no", e.target.value)} /></div>
                    <div><Label className="text-[11px]">Lot No</Label><Input className="h-8" value={line.lot_no} onChange={(e) => setL("lot_no", e.target.value)} /></div>
                    <div><Label className="text-[11px]">Batch No</Label><Input className="h-8" value={line.batch_no} onChange={(e) => setL("batch_no", e.target.value)} /></div>
                    <div><Label className="text-[11px]">Serial No</Label><Input className="h-8" value={line.serial_no} onChange={(e) => setL("serial_no", e.target.value)} /></div>
                    <div><Label className="text-[11px]">MTC Ref</Label><Input className="h-8" value={line.mtc_ref} onChange={(e) => setL("mtc_ref", e.target.value)} /></div>
                    <div><Label className="text-[11px]">COO Ref</Label><Input className="h-8" value={line.coo_ref} onChange={(e) => setL("coo_ref", e.target.value)} /></div>
                  </div>
                  <Button size="sm" onClick={addLineNow} disabled={addLine.isPending} className="w-full h-8 gap-1.5">
                    {addLine.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {ar ? "إضافة السطر" : "Add line"}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold">{ar ? `السطور (${data.lines.length})` : `Lines (${data.lines.length})`}</div>
              {data.lines.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4">{ar ? "لا توجد سطور بعد" : "No lines yet"}</div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {data.lines.map((l) => {
                    const p = products.find((x) => x.id === l.product_id);
                    return (
                      <div key={l.id} className="p-2.5 flex items-start gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs">{p?.code}</span>
                            <span className="truncate">{ar ? (p?.name_ar || p?.name_en) : (p?.name_en || p?.name_ar)}</span>
                            <Badge variant="secondary" className="font-mono text-[10px]">{l.qty} {l.uom ?? p?.uom}</Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap mt-1">
                            {l.heat_no && <span>H:{l.heat_no}</span>}
                            {l.lot_no && <span>L:{l.lot_no}</span>}
                            {l.batch_no && <span>B:{l.batch_no}</span>}
                            {l.serial_no && <span>S:{l.serial_no}</span>}
                            {l.mtc_ref && <span>MTC:{l.mtc_ref}</span>}
                            {l.coo_ref && <span>COO:{l.coo_ref}</span>}
                          </div>
                        </div>
                        {data.transfer.status === "draft" && (
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0"
                            onClick={() => deleteLine.mutate(l.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {data.transfer.status === "draft" && (
              <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background border-t flex items-center justify-end gap-2">
                <Button variant="outline" onClick={cancel} disabled={cancelT.isPending} className="gap-1.5">
                  {cancelT.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  {ar ? "إلغاء التحويل" : "Cancel"}
                </Button>
                <Button onClick={post} disabled={postT.isPending || data.lines.length === 0} className="gap-1.5">
                  {postT.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {ar ? "ترحيل" : "Post transfer"}
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
