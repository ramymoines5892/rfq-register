import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Perm = Database["public"]["Enums"]["app_permission"];

/**
 * Batch-check a set of permissions for the current user.
 * Returns a stable object `{ [perm]: boolean, isAdmin }`.
 */
export function usePermissions<T extends readonly Perm[]>(perms: T) {
  return useQuery({
    queryKey: ["perm-check", [...perms].sort()],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { isAdmin: false, isOwner: false, map: {} as Record<Perm, boolean> };

      const [rolesRes, ...permResults] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        ...perms.map((p) => supabase.rpc("has_permission", { _user_id: uid, _perm: p })),
      ]);
      const isOwner = !!rolesRes.data?.some((r) => r.role === "owner");
      const isAdmin = isOwner || !!rolesRes.data?.some((r) => r.role === "admin");
      const map = {} as Record<Perm, boolean>;
      perms.forEach((p, i) => { map[p] = Boolean(permResults[i]?.data) || isAdmin; });
      return { isAdmin, isOwner, map };
    },
    staleTime: 60_000,
  });
}

export function useHasPerm(perm: Perm) {
  const q = usePermissions([perm] as const);
  return { allowed: q.data?.map[perm] ?? false, isAdmin: q.data?.isAdmin ?? false, ready: !q.isLoading };
}
