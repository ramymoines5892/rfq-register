import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "تسجيل الدخول | متابعة عروض الأسعار" }] }),
});

type Mode = "setup" | "signin" | "signup" | "forgot";

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        navigate({ to: "/" });
        return;
      }
      const { data, error } = await supabase.rpc("has_any_user");
      if (!error && data === false) setMode("setup");
      setChecking(false);
    })();
  }, [navigate]);

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid login credentials")) return lang === "ar" ? "الإيميل أو الباسورد غير صحيح" : "Invalid email or password";
    if (m.includes("email not confirmed")) return lang === "ar" ? "الإيميل لسه ما اتأكدش" : "Email not confirmed";
    if (m.includes("user already registered") || m.includes("already been registered")) return lang === "ar" ? "الإيميل ده مسجّل بالفعل" : "Email already registered";
    return msg;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err) {
      toast.error(friendlyError((err as Error).message));
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error(t("passwordsMismatch")); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;

      const isDuplicate = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
      if (isDuplicate) {
        toast.error(lang === "ar" ? "الإيميل ده مسجّل بالفعل" : "Email already registered");
        setMode("signin");
        return;
      }
      if (data.session) {
        navigate({ to: "/" });
      } else {
        toast.success(lang === "ar" ? "تم إنشاء الحساب" : "Account created");
        setMode("signin");
      }
    } catch (err) {
      toast.error(friendlyError((err as Error).message));
    } finally { setLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(lang === "ar" ? "تم إرسال لينك الاستعادة (لو الحساب موجود)" : "If the account exists, a reset link has been sent");
      setMode("signin");
    } catch (err) {
      toast.error(friendlyError((err as Error).message));
    } finally { setLoading(false); }
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("loading")}</div>;
  }

  const isSetup = mode === "setup";
  const title = isSetup ? t("setupTitle") : mode === "signin" ? t("signIn") : mode === "signup" ? t("signUp") : t("resetPassword");
  const submitFn = mode === "signin" ? handleSignIn : mode === "forgot" ? handleForgot : handleSignUp;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="min-w-0">
              <CardTitle className="text-2xl">{t("appName")}</CardTitle>
              <CardDescription>{t("tagline")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{t("langToggle")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isSetup && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">{t("setupTitle")}</div>
                <div className="text-muted-foreground">{t("setupHint")}</div>
              </div>
            </div>
          )}

          <form onSubmit={submitFn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <PasswordInput id="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
              </div>
            )}

            {(mode === "signup" || isSetup) && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <PasswordInput id="confirmPassword" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} dir="ltr" />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loading") : isSetup ? t("createOwner") : title}
            </Button>

            {!isSetup && mode === "signin" && (
              <div className="flex justify-between text-sm">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signup")}>{t("noAccount")}</button>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("forgot")}>{t("forgotPassword")}</button>
              </div>
            )}
            {!isSetup && mode === "signup" && (
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>{t("haveAccount")}</button>
            )}
            {!isSetup && mode === "forgot" && (
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>{t("backToSignIn")}</button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
