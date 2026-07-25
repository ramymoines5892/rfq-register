import type { ReactNode } from "react";
import { useHasPermission } from "@/hooks/useHasPermission";
import type { Database } from "@/integrations/supabase/types";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Perm = Database["public"]["Enums"]["app_permission"];

/**
 * Gate any UI or route on a server-verified permission.
 *
 * Rules:
 *  - Hits `public.has_permission` (same function used by RLS) — so the
 *    UI and database agree on who can do what.
 *  - Union semantics: passes when the user has the permission through
 *    ANY of admin bypass / personal override / job title / department.
 *  - While loading: renders a small spinner (or nothing when `silent`).
 *  - When denied: renders a friendly card (or `fallback` when provided,
 *    or nothing when `silent`).
 */
export function PermissionGate({
  permission,
  children,
  fallback,
  silent = false,
}: {
  permission: Perm;
  children: ReactNode;
  fallback?: ReactNode;
  silent?: boolean;
}) {
  const { allowed, ready } = useHasPermission(permission);
  const { lang } = useI18n();
  const ar = lang === "ar";

  if (!ready) {
    if (silent) return null;
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!allowed) {
    if (fallback !== undefined) return <>{fallback}</>;
    if (silent) return null;
    return (
      <div className="max-w-md mx-auto my-12 rounded-lg border bg-card p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
        <div className="text-lg font-semibold">
          {ar ? "لا تملك صلاحية الوصول" : "You don't have permission"}
        </div>
        <div className="text-sm text-muted-foreground">
          {ar
            ? "هذه الصفحة تتطلب صلاحية غير متوفرة لك. تواصل مع المسؤول لمنحك الصلاحية من إدارتك أو مسماك الوظيفي أو كصلاحية شخصية."
            : "This page requires a permission you don't currently have. Ask an admin to grant it via your Department, Job Title, or as a personal override."}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">{permission}</div>
        <Button asChild size="sm" variant="outline">
          <Link to="/">{ar ? "العودة للرئيسية" : "Back home"}</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

/** Convenience: show/hide a single action (button, menu item, etc). */
export function PermissionAction({
  permission, children,
}: { permission: Perm; children: ReactNode }) {
  return <PermissionGate permission={permission} silent>{children}</PermissionGate>;
}
