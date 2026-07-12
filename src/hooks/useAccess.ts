import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Central access map. Everything that gates UI (sidebar links, search results,
 * settings tiles) should read from here so unauthorized items disappear from
 * BOTH navigation and search — not just from the sidebar.
 */
export type Access = {
  ready: boolean;
  userId: string | null;
  isAdmin: boolean; // owner or admin role
  canManageFormFields: boolean;
  canManageNotifications: boolean;
  canViewTrash: boolean;
  canManageSemanticSearch: boolean;
};

const DEFAULT: Access = {
  ready: false,
  userId: null,
  isAdmin: false,
  canManageFormFields: false,
  canManageNotifications: false,
  canViewTrash: false,
  canManageSemanticSearch: false,
};

export function useAccess(): Access {
  const [access, setAccess] = useState<Access>(DEFAULT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      if (!uid) {
        if (!cancelled) setAccess({ ...DEFAULT, ready: true });
        return;
      }
      const [rolesRes, formLegacy, formUnified] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.rpc("has_permission", { _user_id: uid, _perm: "manage_customer_fields" }),
        supabase.rpc("has_permission", { _user_id: uid, _perm: "manage_form_fields" }),
      ]);
      const isAdmin = !!rolesRes.data?.some((r) => r.role === "owner" || r.role === "admin");
      const canManageFormFields = Boolean(formLegacy.data) || Boolean(formUnified.data) || isAdmin;
      if (!cancelled) {
        setAccess({
          ready: true,
          userId: uid,
          isAdmin,
          canManageFormFields,
          // The rest are admin-only for now; expand later when perms exist.
          canManageNotifications: isAdmin,
          canViewTrash: isAdmin,
          canManageSemanticSearch: isAdmin,
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return access;
}
