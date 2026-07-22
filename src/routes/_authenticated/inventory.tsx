import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Search, Filter, Loader2, Package, Warehouse } from "lucide-react";
import { useInventoryBalances } from "@/features/inventory/api";
import { useWarehouses } from "@/features/warehouses/queries";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "المخزون | Inventory" },
      { name: "description", content: "أرصدة المخزون لكل صنف فى كل مخزن" },
    ],
  }),
});

function InventoryPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";

  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const { data: warehouses = [] } = useWarehouses();
  const { data: rows = [], isLoading } = useInventoryBalances(
    warehouseFilter === "all" ? undefined : { warehouseId: warehouseFilter }
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.product_code, r.product_name_ar, r.product_name_en, r.warehouse_name, r.warehouse_name_ar]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(q))
    );
  }, [rows, query]);

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Boxes className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "المخزون" : "Inventory"}</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {ar ? "أرصدة الأصناف فى كل مخزن" : "Balances per product per warehouse"}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={ar ? "بحث بالصنف أو المخزن…" : "Search product / warehouse…"} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل المخازن" : "All warehouses"}</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{ar ? (w.name_ar || w.name) : w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-2">
              <Boxes className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div className="text-sm font-medium">{ar ? "لا توجد أرصدة بعد" : "No balances yet"}</div>
              <div className="text-xs text-muted-foreground">{ar ? "ستظهر هنا بعد أول حركة استلام أو تحويل" : "Balances appear after the first receipt or transfer"}</div>
            </CardContent>
          </Card>
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
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5"><Package className="h-3 w-3 text-muted-foreground" />{ar ? (r.product_name_ar || r.product_name_en) : (r.product_name_en || r.product_name_ar)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5"><Warehouse className="h-3 w-3 text-muted-foreground" />{ar ? (r.warehouse_name_ar || r.warehouse_name) : r.warehouse_name}</div>
                      </td>
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
      </main>
    </div>
  );
}
