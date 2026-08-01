/**
 * Dashboard KPI counts — one round-trip per widget, run in parallel.
 * Extracted from the Dashboard route so it stays UI-only.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Id } from "@/shared/types/common";

export interface DashboardCounts {
  quotesMine: number;
  quotesPending: number;
  customers: number;
  pendingUsers: number;
  unreadNotifs: number;
  expiringDocs: number;
}

export interface DashboardCountsInput {
  userId: Id;
  canManageUsers: boolean;
}

export async function getDashboardCounts(
  input: DashboardCountsInput,
): Promise<DashboardCounts> {
  const { userId, canManageUsers } = input;
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const zero = Promise.resolve({ count: 0 as number | null });

  const results = await Promise.allSettled([
    supabase.from("quotes").select("id", { count: "exact", head: true })
      .eq("user_id", userId).is("deleted_at", null),
    supabase.from("quotes").select("id", { count: "exact", head: true })
      .eq("approval_state", "in_progress").is("deleted_at", null),
    supabase.from("customers").select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    canManageUsers
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")
      : zero,
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", userId).is("read_at", null),
    supabase.from("company_documents").select("id", { count: "exact", head: true })
      .is("superseded_at", null)
      .not("expiry_date", "is", null)
      .gte("expiry_date", today)
      .lte("expiry_date", in7),
    supabase.from("company_documents").select("id", { count: "exact", head: true })
      .is("superseded_at", null)
      .not("expiry_date", "is", null)
      .lt("expiry_date", today),
  ]);

  const count = (idx: number): number => {
    const r = results[idx];
    if (r.status !== "fulfilled") return 0;
    return r.value.count ?? 0;
  };

  return {
    quotesMine:    count(0),
    quotesPending: count(1),
    customers:     count(2),
    pendingUsers:  count(3),
    unreadNotifs:  count(4),
    expiringDocs:  count(5),
  };
}
