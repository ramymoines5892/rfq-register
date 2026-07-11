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

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "تسجيل الدخول | متابعة عروض الأسعار" }] }),
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid login credentials")) {
      return lang === "ar" ? "الإيميل أو الباسورد غير صحيح" : "Invalid email or password";
    }
    if (m.includes("email not confirmed")) {
      return lang === "ar" ? "الإيميل لسه ما اتأكدش. راجع بريدك أو استخدم استعادة كلمة المرور." : "Email not confirmed. Check your inbox or use password reset.";
    }
    if (m.includes("user already registered") || m.includes("already been registered")) {
      return lang === "ar" ? "الإيميل ده مسجّل بالفعل" : "This email is already registered";
    }
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
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;

      // Supabase obfuscates duplicate signups: user exists but identities is empty.
      const isDuplicate = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
      if (isDuplicate) {
        toast.error(
          lang === "ar"
            ? "الإيميل ده مسجّل بالفعل. سجّل دخول أو استخدم استعادة كلمة المرور."
            : "This email is already registered. Sign in or reset your password.",
        );
        setMode("signin");
        return;
      }

      if (data.session) {
        // auto-confirm on: session is issued immediately
        navigate({ to: "/" });
      } else {
        toast.success(lang === "ar" ? "تم إنشاء الحساب" : "Account created");
        setMode("signin");
      }
    } catch (err) {
      toast.error(friendlyError((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(
        lang === "ar"
          ? "تم إرسال لينك استعادة كلمة المرور على الإيميل (لو الحساب موجود)"
          : "If the account exists, a reset link has been sent",
      );
      setMode("signin");
    } catch (err) {
      toast.error(friendlyError((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signin" ? t("signIn") : mode === "signup" ? t("signUp") : lang === "ar" ? "استعادة كلمة المرور" : "Reset password";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{t("appName")}</CardTitle>
              <CardDescription>{t("tagline")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              {t("langToggle")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={mode === "signin" ? handleSignIn : mode === "signup" ? handleSignUp : handleForgot}
            className="space-y-4"
          >
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loading") : title}
            </Button>

            {mode === "signin" && (
              <div className="flex justify-between text-sm">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signup")}>
                  {t("noAccount")}
                </button>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("forgot")}>
                  {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </button>
              </div>
            )}
            {mode === "signup" && (
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                {t("haveAccount")}
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                {lang === "ar" ? "رجوع لتسجيل الدخول" : "Back to sign in"}
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
