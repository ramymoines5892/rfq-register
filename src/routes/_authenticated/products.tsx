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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScriptInput } from "@/components/ScriptInput";
import { toast } from "sonner";
import { Package, Plus, Search, Pencil, Trash2, Save, X, Loader2 } from "lucide-react";
import { useProducts, useUpsertProduct, useDeleteProduct } from "@/features/products/queries";
import type { Product } from "@/features/products/api";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "الأصناف | Products" },
      { name: "description", content: "إدارة الأصناف والمنتجات" },
    ],
  }),
});

function ProductsPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();
  const canManage = access.isAdmin;

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useProducts();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.code, p.name_ar, p.name_en, p.category].filter(Boolean).some((v) => v!.toLowerCase().includes(q))
    );
  }, [products, query]);

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "الأصناف" : "Products"}</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {ar ? "قائمة مبسّطة — الموديل الديناميكى الكامل قريبًا" : "Simplified list — dynamic model coming soon"}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={ar ? "بحث…" : "Search…"} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setEditing("new")} className="gap-1.5">
              <Plus className="h-4 w-4" /> {ar ? "صنف جديد" : "New product"}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-3">
              <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div className="text-sm font-medium">{ar ? "لا توجد أصناف" : "No products"}</div>
              {canManage && (
                <Button size="sm" onClick={() => setEditing("new")} className="gap-1.5">
                  <Plus className="h-4 w-4" /> {ar ? "إضافة صنف" : "Add product"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <Card key={p.id} className="hover:border-primary/60 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{ar ? (p.name_ar || p.name_en || p.code) : (p.name_en || p.name_ar || p.code)}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{p.code}</div>
                    </div>
                    <Badge variant="secondary" className="text-[9px]">{p.uom}</Badge>
                  </div>
                  {p.category && <div className="text-[11px] text-muted-foreground">{p.category}</div>}
                  <div className="flex gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 h-7 gap-1" onClick={() => setEditing(p)}>
                      <Pencil className="h-3 w-3" /> {ar ? "تعديل" : "Edit"}
                    </Button>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(p)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {editing && <ProductEditor product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {toDelete && <DeleteProductDialog product={toDelete} onClose={() => setToDelete(null)} />}
    </div>
  );
}

function ProductEditor({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [form, setForm] = useState({
    code: product?.code ?? "",
    name_ar: product?.name_ar ?? "",
    name_en: product?.name_en ?? "",
    category: product?.category ?? "",
    uom: product?.uom ?? "PCS",
    is_active: product?.is_active ?? true,
    notes: product?.notes ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));
  const upsert = useUpsertProduct();

  async function save() {
    if (!form.code.trim()) { toast.error(ar ? "الكود مطلوب" : "Code required"); return; }
    try {
      await upsert.mutateAsync({
        id: product?.id ?? null,
        payload: {
          code: form.code.trim().toUpperCase(),
          name_ar: form.name_ar || null,
          name_en: form.name_en || null,
          category: form.category || null,
          uom: form.uom.trim() || "PCS",
          is_active: form.is_active,
          notes: form.notes || null,
        },
      });
      toast.success(ar ? "تم الحفظ" : "Saved");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto scrollbar-slim">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" />
            {product ? (ar ? "تعديل صنف" : "Edit product") : (ar ? "صنف جديد" : "New product")}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الكود *" : "Code *"}</Label>
              <ScriptInput script="en" isAr={ar} value={form.code} onChange={(v) => set("code", v.toUpperCase())} className="font-mono uppercase" placeholder="PRD-001" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الوحدة" : "UoM"}</Label>
              <ScriptInput script="en" isAr={ar} value={form.uom} onChange={(v) => set("uom", v.toUpperCase())} className="font-mono uppercase" placeholder="PCS / KG / M" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الاسم (عربى)" : "Name (Arabic)"}</Label>
              <ScriptInput script="ar" isAr={ar} value={form.name_ar} onChange={(v) => set("name_ar", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الاسم (إنجليزى)" : "Name (English)"}</Label>
              <ScriptInput script="en" isAr={ar} value={form.name_en} onChange={(v) => set("name_en", v)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{ar ? "الفئة" : "Category"}</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder={ar ? "Flange / Pipe / Valve …" : "Flange / Pipe / Valve …"} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{ar ? "ملاحظات" : "Notes"}</Label>
              <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
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

function DeleteProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const mut = useDeleteProduct();
  async function confirm() {
    try { await mut.mutateAsync(product.id); toast.success(ar ? "تم الحذف" : "Deleted"); onClose(); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> {ar ? "حذف الصنف" : "Delete product"}</DialogTitle>
        </DialogHeader>
        <div className="text-sm">{ar ? (product.name_ar || product.code) : (product.name_en || product.code)}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button variant="destructive" onClick={confirm} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : <Trash2 className="h-4 w-4 me-1.5" />}{ar ? "حذف" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
