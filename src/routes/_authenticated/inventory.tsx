import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Boxes, Search, Filter, Loader2, Package, Warehouse, Download, History } from "lucide-react";
import { useInventoryBalances, useMovements, type MovementFilters } from "@/modules/inventory/api";
import { useWarehouses } from "@/modules/warehouses/queries";
import { useProducts } from "@/modules/products/queries";
import { toCSV, downloadCSV } from "@/lib/csv";
import { PermissionGate } from "@/components/permissions/PermissionGate";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: () => (
    <PermissionGate permission="inventory.view">
      <InventoryPage />
    </PermissionGate>
  ),
  head: () => ({
    meta: [
      { title: "المخزون | Inventory" },
      { name: "description", content: "أرصدة وحركات المخزون لكل صنف فى كل مخزن" },
    ],
  }),
});

const MOVEMENT_LABEL: Record<string, { ar: string; en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  receipt: { ar: "استلام", en: "Receipt", variant: "default" },
  issue: { ar: "صرف", en: "Issue", variant: "destructive" },
  transfer_in: { ar: "تحويل داخل", en: "Transfer In", variant: "default" },
  transfer_out: { ar: "تحويل خارج", en: "Transfer Out", variant: "destructive" },
  adjustment: { ar: "تسوية", en: "Adjustment", variant: "secondary" },
  opening: { ar: "افتتاحى", en: "Opening", variant: "outline" },
};

function InventoryPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Boxes className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "المخزون" : "Inventory"}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <Tabs defaultValue="balances">
          <TabsList>
            <TabsTrigger value="balances"><Boxes className="h-4 w-4 me-1" />{ar ? "الأرصدة" : "Balances"}</TabsTrigger>
            <TabsTrigger value="movements"><History className="h-4 w-4 me-1" />{ar ? "الحركات" : "Movements"}</TabsTrigger>
          </TabsList>
          <TabsContent value="balances" className="mt-4"><BalancesTab ar={ar} /></TabsContent>
          <TabsContent value="movements" className="mt-4"><MovementsTab ar={ar} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ─────────── Balances ─────────── */

function BalancesTab({ ar }: { ar: boolean }) {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const { data: warehouses = [] } = useWarehouses();
  const { data: rows = [], isLoading } = useInventoryBalances(
    warehouseFilter === "all" ? undefined : { warehouseId: warehouseFilter },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.product_code, r.product_name_ar, r.product_name_en, r.warehouse_name, r.warehouse_name_ar]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const exportCSV = () => {
    const data = filtered.map((r) => ({
      code: r.product_code, name: ar ? (r.product_name_ar || r.product_name_en) : (r.product_name_en || r.product_name_ar),
      warehouse: ar ? (r.warehouse_name_ar || r.warehouse_name) : r.warehouse_name,
      branch: ar ? (r.branch_name_ar || r.branch_name) : r.branch_name,
      balance: r.balance, uom: r.product_uom, last_movement: r.last_movement_at,
    }));
    downloadCSV(`inventory-balances-${new Date().toISOString().slice(0,10)}.csv`, toCSV(data));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={ar ? "بحث بالصنف أو المخزن…" : "Search product / warehouse…"} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
        </div>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? "كل المخازن" : "All warehouses"}</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>{ar ? (w.name_ar || w.name) : w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 me-1" /> CSV
        </Button>
      </div>

      {isLoading ? (
        <Loading ar={ar} />
      ) : filtered.length === 0 ? (
        <EmptyBalances ar={ar} />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-background">
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr className="text-start">
                  <th className="px-3 py-2 text-start font-medium">{ar ? "الكود" : "Code"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "الصنف" : "Product"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "المخزن" : "Warehouse"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "الفرع" : "Branch"}</th>
                  <th className="px-3 py-2 text-end font-medium">{ar ? "الرصيد" : "Balance"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "الوحدة" : "UoM"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "آخر حركة" : "Last movement"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.product_id}-${r.warehouse_id}`} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.product_code}</td>
                    <td className="px-3 py-2"><div className="flex items-center gap-1.5"><Package className="h-3 w-3 text-muted-foreground" />{ar ? (r.product_name_ar || r.product_name_en) : (r.product_name_en || r.product_name_ar)}</div></td>
                    <td className="px-3 py-2"><div className="flex items-center gap-1.5"><Warehouse className="h-3 w-3 text-muted-foreground" />{ar ? (r.warehouse_name_ar || r.warehouse_name) : r.warehouse_name}</div></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{ar ? (r.branch_name_ar || r.branch_name) : r.branch_name}</td>
                    <td className="px-3 py-2 text-end">
                      <Badge variant={r.balance > 0 ? "default" : r.balance < 0 ? "destructive" : "secondary"} className="font-mono">
                        {Number(r.balance).toLocaleString()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.product_uom}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.last_movement_at ? new Date(r.last_movement_at).toLocaleString(ar ? "ar-EG" : "en-GB") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Movements ─────────── */

function MovementsTab({ ar }: { ar: boolean }) {
  const [filters, setFilters] = useState<MovementFilters>({});
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProducts();
  const { data: rows = [], isLoading } = useMovements(filters);

  const patch = (p: Partial<MovementFilters>) => setFilters((prev) => ({ ...prev, ...p }));

  const productMap = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);
  const whMap = useMemo(() => new Map(warehouses.map((w: any) => [w.id, w])), [warehouses]);

  const exportCSV = () => {
    const data = rows.map((r) => {
      const p: any = productMap.get(r.product_id);
      const w: any = whMap.get(r.warehouse_id);
      return {
        at: r.created_at,
        type: r.movement_type,
        code: p?.code ?? "",
        product: ar ? (p?.name_ar || p?.name_en) : (p?.name_en || p?.name_ar),
        warehouse: ar ? (w?.name_ar || w?.name) : w?.name,
        qty: r.qty, uom: r.uom,
        heat: r.heat_no, lot: r.lot_no, batch: r.batch_no, serial: r.serial_no,
        mtc: r.mtc_ref, coo: r.coo_ref,
        reference: `${r.reference_type ?? ""}:${r.reference_id ?? ""}`,
        notes: r.notes,
      };
    });
    downloadCSV(`stock-movements-${new Date().toISOString().slice(0,10)}.csv`, toCSV(data));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Select value={filters.movementType ?? "all"} onValueChange={(v) => patch({ movementType: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder={ar ? "النوع" : "Type"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? "كل الأنواع" : "All types"}</SelectItem>
            {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{ar ? v.ar : v.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.warehouseId ?? "all"} onValueChange={(v) => patch({ warehouseId: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder={ar ? "المخزن" : "Warehouse"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? "كل المخازن" : "All warehouses"}</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>{ar ? (w.name_ar || w.name) : w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.productId ?? "all"} onValueChange={(v) => patch({ productId: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder={ar ? "الصنف" : "Product"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? "كل الأصناف" : "All products"}</SelectItem>
            {products.slice(0, 300).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Heat" value={filters.heatNo ?? ""} onChange={(e) => patch({ heatNo: e.target.value || undefined })} className="h-9" />
        <Input placeholder="Batch / Lot" value={filters.batchNo ?? ""} onChange={(e) => patch({ batchNo: e.target.value || undefined })} className="h-9" />
        <Input placeholder="Serial" value={filters.serialNo ?? ""} onChange={(e) => patch({ serialNo: e.target.value || undefined })} className="h-9" />
        <Input type="date" value={filters.from?.slice(0,10) ?? ""} onChange={(e) => patch({ from: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className="h-9" />
        <Input type="date" value={filters.to?.slice(0,10) ?? ""} onChange={(e) => patch({ to: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : undefined })} className="h-9" />
        <Button variant="outline" size="sm" onClick={() => setFilters({})} className="h-9">
          <Filter className="h-4 w-4 me-1" /> {ar ? "مسح" : "Clear"}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0} className="h-9">
          <Download className="h-4 w-4 me-1" /> CSV
        </Button>
      </div>

      {isLoading ? (
        <Loading ar={ar} />
      ) : rows.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {ar ? "لا توجد حركات مطابقة" : "No movements match the filters"}
        </CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-background">
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "التاريخ" : "Date"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "النوع" : "Type"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "الصنف" : "Product"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "المخزن" : "Warehouse"}</th>
                  <th className="px-3 py-2 text-end font-medium">{ar ? "الكمية" : "Qty"}</th>
                  <th className="px-3 py-2 text-start font-medium">Heat / Lot / Serial</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "مرجع" : "Ref"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const label = MOVEMENT_LABEL[r.movement_type];
                  const p: any = productMap.get(r.product_id);
                  const w: any = whMap.get(r.warehouse_id);
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString(ar ? "ar-EG" : "en-GB")}</td>
                      <td className="px-3 py-2">
                        <Badge variant={label?.variant ?? "outline"} className="text-[10px]">
                          {ar ? label?.ar : label?.en ?? r.movement_type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-mono">{p?.code ?? "—"}</div>
                        <div className="text-muted-foreground">{ar ? (p?.name_ar || p?.name_en) : (p?.name_en || p?.name_ar)}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{ar ? (w?.name_ar || w?.name) : w?.name}</td>
                      <td className="px-3 py-2 text-end font-mono">
                        <span className={r.qty < 0 ? "text-destructive" : "text-foreground"}>
                          {Number(r.qty).toLocaleString()}
                        </span> {r.uom && <span className="text-[10px] text-muted-foreground">{r.uom}</span>}
                      </td>
                      <td className="px-3 py-2 text-[11px] font-mono">
                        {[r.heat_no, r.lot_no ?? r.batch_no, r.serial_no].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        {r.reference_type ? `${r.reference_type}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Loading({ ar }: { ar: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
    </div>
  );
}
function EmptyBalances({ ar }: { ar: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center space-y-2">
        <Boxes className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <div className="text-sm font-medium">{ar ? "لا توجد أرصدة بعد" : "No balances yet"}</div>
        <div className="text-xs text-muted-foreground">{ar ? "ستظهر هنا بعد أول حركة استلام أو تحويل" : "Balances appear after the first receipt or transfer"}</div>
      </CardContent>
    </Card>
  );
}
