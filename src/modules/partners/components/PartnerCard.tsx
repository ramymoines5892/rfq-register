import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { PARTNER_ROLES, type BusinessPartner } from "@/modules/partners/api";

export function PartnerCard({
  p,
  onOpen,
  onDelete,
  ar,
}: {
  p: BusinessPartner;
  onOpen: () => void;
  onDelete: () => void;
  ar: boolean;
}) {
  const name = ar ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar);
  return (
    <Card className="hover:shadow-md transition cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{name || (ar ? "بدون اسم" : "Unnamed")}</div>
            <div className="text-xs text-muted-foreground">{p.code ?? "—"}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {p.roles?.map((r) => {
            const meta = PARTNER_ROLES.find((x) => x.value === r);
            return <Badge key={r} variant="secondary" className="text-[10px]">{ar ? meta?.ar : meta?.en}</Badge>;
          })}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {p.tax_id && <div>#{p.tax_id}</div>}
          {p.industry && <div className="truncate">{p.industry}</div>}
          {p.email && <div className="truncate">{p.email}</div>}
          {p.phone && <div>{p.phone}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
