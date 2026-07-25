import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { ScriptInput } from "@/components/ScriptInput";
import { Plus, MapPin, Save, Loader2, Trash2, X, Pencil } from "lucide-react";
import { useBins, useUpsertBin, useDeleteBin, type WarehouseBin } from "@/modules/warehouses/bins";

export function BinsManager({
  warehouseId, branchId, warehouseName, onClose,
}: {
  warehouseId: string;
  branchId: string;
  warehouseName: string;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const { data: bins = [], isLoading } = useBins(warehouseId);
  const upsert = useUpsertBin();
  const del = useDeleteBin();

  const [editing, setEditing] = useState<WarehouseBin | "new" | null>(null);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto scrollbar-slim">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {ar ? "مواقع/رفوف المخزن" : "Warehouse locations / Bins"}
          </SheetTitle>
          <div className="text-xs text-muted-foreground">{warehouseName}</div>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <Button size="sm" onClick={() => setEditing("new")} className="w-full gap-1.5">
            <Plus className="h-4 w-4" /> {ar ? "إضافة موقع جديد" : "Add new location"}
          </Button>

          {isLoading ? (
            <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
          ) : bins.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-xs text-muted-foreground">
                {ar ? "لا توجد مواقع بعد" : "No locations yet"}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {bins.map((b) => (
                <Card key={b.id} className="hover:border-primary/60">
                  <CardContent className="p-3 flex items-start gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold">{b.code}</span>
                        {!b.is_active && <Badge variant="outline" className="text-[9px]">{ar ? "غير نشط" : "Inactive"}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ar ? (b.name_ar || b.name_en || "—") : (b.name_en || b.name_ar || "—")}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                        {b.aisle && <span>A:{b.aisle}</span>}
                        {b.rack && <span>R:{b.rack}</span>}
                        {b.shelf && <span>S:{b.shelf}</span>}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(b)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        try { await del.mutateAsync(b.id); toast.success(ar ? "تم الحذف" : "Deleted"); }
                        catch (e: any) { toast.error(e?.message ?? "Error"); }
                      }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {editing && (
          <BinEditor
            bin={editing === "new" ? null : editing}
            warehouseId={warehouseId} branchId={branchId}
            onClose={() => setEditing(null)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function BinEditor({ bin, warehouseId, branchId, onClose }: {
  bin: WarehouseBin | null; warehouseId: string; branchId: string; onClose: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [form, setForm] = useState({
    code: bin?.code ?? "",
    name_ar: bin?.name_ar ?? "",
    name_en: bin?.name_en ?? "",
    aisle: bin?.aisle ?? "",
    rack: bin?.rack ?? "",
    shelf: bin?.shelf ?? "",
    is_active: bin?.is_active ?? true,
    notes: bin?.notes ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));
  const upsert = useUpsertBin();

  async function save() {
    if (!form.code.trim()) { toast.error(ar ? "الكود مطلوب" : "Code required"); return; }
    try {
      await upsert.mutateAsync({
        id: bin?.id ?? null,
        payload: {
          warehouse_id: warehouseId, branch_id: branchId,
          code: form.code.trim().toUpperCase(),
          name_ar: form.name_ar || null, name_en: form.name_en || null,
          aisle: form.aisle || null, rack: form.rack || null, shelf: form.shelf || null,
          is_active: form.is_active, notes: form.notes || null,
        },
      });
      toast.success(ar ? "تم الحفظ" : "Saved");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-md overflow-y-auto scrollbar-slim">
        <SheetHeader>
          <SheetTitle>{bin ? (ar ? "تعديل الموقع" : "Edit location") : (ar ? "موقع جديد" : "New location")}</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">{ar ? "الكود *" : "Code *"}</Label>
            <ScriptInput script="en" isAr={ar} value={form.code} onChange={(v) => set("code", v.toUpperCase())} placeholder="A1-R2-S3" className="font-mono uppercase" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "الاسم (عربى)" : "Name AR"}</Label>
            <ScriptInput script="ar" isAr={ar} value={form.name_ar} onChange={(v) => set("name_ar", v)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "الاسم (إنجليزى)" : "Name EN"}</Label>
            <ScriptInput script="en" isAr={ar} value={form.name_en} onChange={(v) => set("name_en", v)} />
          </div>
          <div className="space-y-1"><Label className="text-xs">{ar ? "الممر" : "Aisle"}</Label><Input value={form.aisle} onChange={(e) => set("aisle", e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">{ar ? "الرف" : "Rack"}</Label><Input value={form.rack} onChange={(e) => set("rack", e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">{ar ? "الرفّ الفرعى" : "Shelf"}</Label><Input value={form.shelf} onChange={(e) => set("shelf", e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label className="text-xs">{ar ? "ملاحظات" : "Notes"}</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer pt-1">
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <span>{ar ? "نشط" : "Active"}</span>
          </label>
        </div>
        <div className="sticky bottom-0 mt-6 -mx-6 -mb-6 px-6 py-3 bg-background border-t flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="gap-1.5"><X className="h-4 w-4" /> {ar ? "إغلاق" : "Close"}</Button>
          <Button onClick={save} disabled={upsert.isPending} className="gap-1.5">
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {ar ? "حفظ" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
