import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Perm = Database["public"]["Enums"]["app_permission"];

/**
 * Server-side permission check via `public.has_permission`. This is the
 * SAME function that RLS policies use, so a `true` here corresponds
 * exactly to what the database will allow.
 *
 * Prefer this over any client-computed permission map for gating
 * routes and actions — it evaluates admin/owner bypass + user_permissions
 * + job_title_permissions + department_permissions as a union in one call.
 */
export function useHasPermission(perm: Perm | null | undefined) {
  const q = useQuery({
    queryKey: ["has_permission", perm ?? ""],
    enabled: !!perm,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase.rpc("has_permission", { _user_id: uid, _perm: perm! });
      if (error) throw error;
      return Boolean(data);
    },
  });
  return { allowed: !!q.data, ready: !q.isLoading, error: q.error };
}

/** Imperative server-side check — usable in event handlers before mutations. */
export async function requirePermission(perm: Perm): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase.rpc("has_permission", { _user_id: uid, _perm: perm });
  if (error) throw error;
  if (!data) {
    const err = new Error(`Missing permission: ${perm}`);
    (err as any).code = "PERMISSION_DENIED";
    throw err;
  }
}
