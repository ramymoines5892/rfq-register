import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApprovals, useDecideApproval, type ApprovalStatus } from "@/features/approvals/api";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
  head: () => ({
    meta: [
      { title: "الاعتمادات | Approvals" },
      { name: "description", content: "قائمة طلبات الاعتماد للترحيل والإلغاء" },
    ],
  }),
});

const ENTITY_LABEL: Record<string, { ar: string; en: string }> = {
  stock_adjustment: { ar: "تسوية مخزون", en: "Stock Adjustment" },
  stock_transfer: { ar: "تحويل مخزنى", en: "Stock Transfer" },
};

function ApprovalsPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [tab, setTab] = useState<ApprovalStatus>("pending");
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const { data: perms } = usePermissions(["approvals.decide", "approvals.view"] as const);
  const canDecide = perms?.map["approvals.decide"] ?? false;

  const { data: rows = [], isLoading } = useApprovals(tab);
  const decide = useDecideApproval();

  const handleDecision = async (id: string, approve: boolean) => {
    try {
      await decide.mutateAsync({ id, approve, note: noteById[id] });
      toast.success(approve ? (ar ? "تم الاعتماد والترحيل" : "Approved & posted") : (ar ? "تم الرفض" : "Rejected"));
      setNoteById((n) => { const c = { ...n }; delete c[id]; return c; });
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    }
  };

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "الاعتمادات" : "Approvals"}</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ApprovalStatus)}>
          <TabsList>
            <TabsTrigger value="pending">{ar ? "بانتظار" : "Pending"}</TabsTrigger>
            <TabsTrigger value="approved">{ar ? "معتمدة" : "Approved"}</TabsTrigger>
            <TabsTrigger value="rejected">{ar ? "مرفوضة" : "Rejected"}</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline me-2" /> {ar ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {ar ? "لا توجد طلبات" : "No requests"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const el = ENTITY_LABEL[r.entity_type] ?? { ar: r.entity_type, en: r.entity_type };
              return (
                <Card key={r.id}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{ar ? el.ar : el.en}</Badge>
                      <Badge variant="secondary" className="uppercase text-[10px]">{r.action}</Badge>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.requested_at).toLocaleString(ar ? "ar-EG" : "en-GB")}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        #{r.entity_id.slice(0, 8)}
                      </div>
                      <div className="flex-1" />
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </div>
                    {r.decision_note && (
                      <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                        {ar ? "ملاحظة القرار: " : "Decision note: "}{r.decision_note}
                      </div>
                    )}
                    {tab === "pending" && canDecide && (
                      <div className="flex items-end gap-2 flex-wrap">
                        <Textarea
                          rows={1}
                          placeholder={ar ? "ملاحظة (اختيارى)" : "Note (optional)"}
                          value={noteById[r.id] ?? ""}
                          onChange={(e) => setNoteById((n) => ({ ...n, [r.id]: e.target.value }))}
                          className="flex-1 min-w-[200px] text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={() => handleDecision(r.id, false)} disabled={decide.isPending}>
                          <XCircle className="h-4 w-4 me-1 text-destructive" /> {ar ? "رفض" : "Reject"}
                        </Button>
                        <Button size="sm" onClick={() => handleDecision(r.id, true)} disabled={decide.isPending}>
                          <CheckCircle2 className="h-4 w-4 me-1" /> {ar ? "اعتماد وترحيل" : "Approve & Post"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
