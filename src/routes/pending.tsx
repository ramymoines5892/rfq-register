import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, LogOut, RefreshCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/pending")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
    if (prof?.status === "active") throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: PendingPage,
  head: () => ({ meta: [{ title: "بانتظار الموافقة" }] }),
});

function PendingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "")); }, []);

  async function refresh() {
    setRefreshing(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", userData.user?.id ?? "").maybeSingle();
    setRefreshing(false);
    if (prof?.status === "active") navigate({ to: "/" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2">
            <Clock className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle>{t("pendingTitle")}</CardTitle>
          <CardDescription>{email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed text-center">{t("pendingBody")}</p>
          <Button className="w-full" onClick={refresh} disabled={refreshing}>
            <RefreshCcw className="h-4 w-4 me-2" /> {t("refresh")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 me-2" /> {t("signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
