import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { reindexSemanticSearch } from "@/lib/semantic-search.functions";

export const Route = createFileRoute("/_authenticated/settings/search")({
  component: SearchSettings,
});

function SearchSettings() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const reindex = useServerFn(reindexSemanticSearch);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ indexed: number; total: number } | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const r = await reindex({ data: {} });
      setLast(r);
      toast.success(
        ar ? `تمت الفهرسة (${r.indexed}/${r.total})` : `Indexed ${r.indexed}/${r.total}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{ar ? "البحث الذكي" : "AI Semantic Search"}</h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "بحث دلالي مبني على الذكاء الاصطناعي — يفهم القصد لا الكلمات فقط."
              : "Semantic search powered by AI embeddings — understands meaning, not just keywords."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ar ? "فهرسة الداتا" : "Index data"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {ar
              ? "شغّل الفهرسة أول مرة أو بعد إضافة داتا كتيرة. النظام يحوّل النصوص إلى متجهات (embeddings) ويحفظها لبحث سريع لاحقًا."
              : "Run once to build the index (or after bulk data changes). Text is converted to vector embeddings for fast semantic lookup."}
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 me-2" />
              )}
              {ar ? "إعادة فهرسة الآن" : "Reindex now"}
            </Button>
            {last && (
              <span className="text-xs text-muted-foreground">
                {ar ? "آخر تشغيل:" : "Last:"} {last.indexed} / {last.total}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ar ? "كيف يعمل" : "How it works"}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            {ar
              ? "١) من ⌘K فعّل زر «AI» عشان تشغّل البحث الدلالي."
              : "1) Toggle the “AI” pill in ⌘K to run semantic queries."}
          </p>
          <p>
            {ar
              ? "٢) البحث النصي العادي (أسرع) يبقى الافتراضي."
              : "2) Plain text search stays the default (faster & cheaper)."}
          </p>
          <p>
            {ar
              ? "٣) الفهرسة تشمل: العملاء، عروض الأسعار، قوالب سير العمل، المستخدمين."
              : "3) Indexed entities: customers, quotes, workflow templates, users."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
