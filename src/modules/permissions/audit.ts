import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PermissionAuditEntry = {
  id: string;
  actor_id: string | null;
  scope: "department" | "job_title" | "user";
  target_id: string;
  target_name: string | null;
  permission: Database["public"]["Enums"]["app_permission"];
  action: "grant" | "revoke";
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
};

/** Audit log for a single scope+target (e.g. one department, one job title, one user). */
export function usePermissionAudit(scope: PermissionAuditEntry["scope"], targetId: string | null | undefined) {
  return useQuery({
    queryKey: ["perm-audit", scope, targetId ?? ""],
    enabled: !!targetId,
    staleTime: 15_000,
    queryFn: async (): Promise<PermissionAuditEntry[]> => {
      const { data, error } = await supabase
        .from("permission_audit_log")
        .select("id, actor_id, scope, target_id, target_name, permission, action, created_at")
        .eq("scope", scope)
        .eq("target_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const entries = (data ?? []) as PermissionAuditEntry[];
      const actorIds = Array.from(new Set(entries.map((e) => e.actor_id).filter(Boolean))) as string[];
      if (!actorIds.length) return entries;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      const map = new Map<string, { full_name: string | null; email: string }>();
      (profiles ?? []).forEach((p) => map.set(p.id, { full_name: p.full_name, email: p.email }));
      return entries.map((e) => {
        const a = e.actor_id ? map.get(e.actor_id) : null;
        return { ...e, actor_name: a?.full_name ?? null, actor_email: a?.email ?? null };
      });
    },
  });
}
