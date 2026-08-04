import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, X, Bookmark, BookmarkPlus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { useConfirm, usePrompt } from "@/hooks/useConfirm";
import { usePartners, useUpsertPartner, useDeletePartner } from "@/modules/partners/queries";
import type { PartnerRole } from "@/modules/partners/api";
import { PartnerCard } from "@/modules/partners/components/PartnerCard";
import { PartnerSheet } from "@/modules/partners/components/PartnerSheet";

type AdvFilters = { name: string; tax_id: string; industry: string; address: string };
type SavedFilter = { name: string; adv: AdvFilters };
const EMPTY_ADV: AdvFilters = { name: "", tax_id: "", industry: "", address: "" };

export function PartnersDirectory({
  role,
  titleAr,
  titleEn,
  subtitleAr,
  subtitleEn,
  newLabelAr,
  newLabelEn,
}: {
  role: PartnerRole;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  newLabelAr: string;
  newLabelEn: string;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();
  const prompt = usePrompt();
  const SAVED_KEY = `partners:${role}:savedFilters:v1`;

  const [search, setSearch] = useState("");
  const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV);
  const [showAdv, setShowAdv] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [saved, setSaved] = useState<SavedFilter[]>([]);
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); } catch { setSaved([]); }
  }, [SAVED_KEY]);
  useEffect(() => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {} }, [SAVED_KEY, saved]);

  const { data: rows = [], isLoading } = usePartners(role, search);
  const upsert = useUpsertPartner();
  const del = useDeletePartner();

  const filtered = useMemo(() => {
    const norm = (v?: string | null) => (v ?? "").toString().toLowerCase();
    return rows.filter((p) => {
      if (adv.name && !`${norm(p.name_ar)} ${norm(p.name_en)} ${norm(p.legal_name)}`.includes(adv.name.toLowerCase())) return false;
      if (adv.tax_id && !norm(p.tax_id).includes(adv.tax_id.toLowerCase())) return false;
      if (adv.industry && !norm(p.industry).includes(adv.industry.toLowerCase())) return false;
      if (adv.address && !`${norm(p.address)} ${norm(p.city)} ${norm(p.country)}`.includes(adv.address.toLowerCase())) return false;
      return true;
    });
  }, [rows, adv]);

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: ar ? "حذف السجل؟" : "Delete record?",
      description: ar ? "لن يمكن التراجع عن هذا الإجراء." : "This action cannot be undone.",
      confirmText: ar ? "حذف" : "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try { await del.mutateAsync(id); toast.success(ar ? "تم الحذف" : "Deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function saveCurrentFilter() {
    const name = await prompt({
      title: ar ? "حفظ الفلتر" : "Save filter",
      placeholder: ar ? "اسم الفلتر" : "Filter name",
      required: true,
    });
    if (!name) return;
    setSaved((s) => [...s.filter((x) => x.name !== name), { name, adv }]);
    toast.success(ar ? "تم الحفظ" : "Saved");
  }

  const hasAdv = Object.values(adv).some(Boolean);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{ar ? titleAr : titleEn}</h1>
            <p className="text-sm text-muted-foreground">{ar ? subtitleAr : subtitleEn}</p>
          </div>
          <Button onClick={() => { setOpenId(null); setCreating(true); }} disabled={upsert.isPending}>
            <Plus className="h-4 w-4 me-2" />{ar ? newLabelAr : newLabelEn}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="ps-8" placeholder={ar ? "بحث سريع بالاسم/الكود/الرقم الضريبي…" : "Quick search…"} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant={showAdv || hasAdv ? "default" : "outline"} size="sm" onClick={() => setShowAdv((v) => !v)}>
            {showAdv ? <ChevronUp className="h-4 w-4 me-1" /> : <ChevronDown className="h-4 w-4 me-1" />}
            {ar ? "بحث متقدّم" : "Advanced"}
            {hasAdv && <Badge variant="secondary" className="ms-2">{Object.values(adv).filter(Boolean).length}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={saveCurrentFilter} disabled={!hasAdv}>
            <BookmarkPlus className="h-4 w-4 me-1" />{ar ? "حفظ الفلتر" : "Save filter"}
          </Button>
        </div>

        {showAdv && (
          <Card><CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input placeholder={ar ? "الاسم" : "Name"} value={adv.name} onChange={(e) => setAdv({ ...adv, name: e.target.value })} />
            <Input placeholder={ar ? "الرقم الضريبي" : "Tax ID"} value={adv.tax_id} onChange={(e) => setAdv({ ...adv, tax_id: e.target.value })} />
            <Input placeholder={ar ? "المجال / الصناعة" : "Industry"} value={adv.industry} onChange={(e) => setAdv({ ...adv, industry: e.target.value })} />
            <Input placeholder={ar ? "العنوان / المدينة / الدولة" : "Address / City / Country"} value={adv.address} onChange={(e) => setAdv({ ...adv, address: e.target.value })} />
            {hasAdv && (
              <Button variant="ghost" size="sm" className="justify-start" onClick={() => setAdv(EMPTY_ADV)}>
                <X className="h-4 w-4 me-1" />{ar ? "مسح الفلاتر" : "Clear filters"}
              </Button>
            )}
          </CardContent></Card>
        )}

        {saved.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {saved.map((f) => (
              <Badge key={f.name} variant="outline" className="cursor-pointer gap-1 py-1" onClick={() => { setAdv(f.adv); setShowAdv(true); }}>
                <Bookmark className="h-3 w-3" />{f.name}
                <button className="ms-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setSaved((s) => s.filter((x) => x.name !== f.name)); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">{t("loading") ?? "…"}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            {ar ? "لا توجد نتائج" : "No results"}
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <PartnerCard key={p.id} p={p} onOpen={() => setOpenId(p.id)} onDelete={() => handleDelete(p.id)} ar={ar} />
            ))}
          </div>
        )}

        <PartnerSheet
          id={openId}
          creating={creating}
          defaultRoles={[role]}
          onCreated={(newId) => { setCreating(false); setOpenId(newId); }}
          onClose={() => { setCreating(false); setOpenId(null); }}
        />
      </div>
    </TooltipProvider>
  );
}
