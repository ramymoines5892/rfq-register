import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotifCategory = "pending_users" | "approvals" | "tasks" | "system";

/**
 * Central access map. Everything that gates UI (sidebar links, search results,
 * settings tiles, action buttons) should read from here so unauthorized items
 * disappear from BOTH navigation and search — not just the sidebar.
 */
export type Access = {
  ready: boolean;
  userId: string | null;
  isAdmin: boolean; // owner or admin role
  isOwner: boolean;
  canManageFormFields: boolean;
  /** Personal notification preferences — always true for signed-in users. */
  canManageNotifications: boolean;
  canViewTrash: boolean;
  canManageSemanticSearch: boolean;
  canManageUsers: boolean;
  canApprove: boolean;
  /** Which notification categories this user is allowed to configure. */
  notifCategories: Set<NotifCategory>;
  /** Convenience: does the user have any settings access at all? */
  hasAnySettings: boolean;
};

const DEFAULT: Access = {
  ready: false,
  userId: null,
  isAdmin: false,
  isOwner: false,
  canManageFormFields: false,
  canManageNotifications: false,
  canViewTrash: false,
  canManageSemanticSearch: false,
  canManageUsers: false,
  canApprove: false,
  notifCategories: new Set(),
  hasAnySettings: false,
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
      const [rolesRes, formLegacy, formUnified, approveRes, manageUsersRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.rpc("has_permission", { _user_id: uid, _perm: "manage_customer_fields" }),
        supabase.rpc("has_permission", { _user_id: uid, _perm: "manage_form_fields" }),
        supabase.rpc("has_permission", { _user_id: uid, _perm: "quotes.approve" }),
        supabase.rpc("has_permission", { _user_id: uid, _perm: "users.manage_roles" }),
      ]);
      const isOwner = !!rolesRes.data?.some((r) => r.role === "owner");
      const isAdmin = isOwner || !!rolesRes.data?.some((r) => r.role === "admin");
      const canManageFormFields = Boolean(formLegacy.data) || Boolean(formUnified.data) || isAdmin;
      const canApprove = Boolean(approveRes.data) || isAdmin;
      const canManageUsers = Boolean(manageUsersRes.data) || isAdmin;

      const cats = new Set<NotifCategory>(["tasks", "system"]);
      if (canApprove) cats.add("approvals");
      if (canManageUsers) cats.add("pending_users");

      if (!cancelled) {
        setAccess({
          ready: true,
          userId: uid,
          isAdmin,
          isOwner,
          canManageFormFields,
          canManageNotifications: true,
          canViewTrash: isAdmin,
          canManageSemanticSearch: isAdmin,
          canManageUsers,
          canApprove,
          notifCategories: cats,
          hasAnySettings: true,
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return access;
}
