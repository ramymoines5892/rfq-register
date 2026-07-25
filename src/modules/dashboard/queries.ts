import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/shared/constants/app";
import { getDashboardCounts, type DashboardCountsInput } from "./api";

export const dashboardKeys = {
  counts: (input: DashboardCountsInput) =>
    ["dashboard", "counts", input.userId, input.canManageUsers] as const,
};

export function useDashboardCounts(input: DashboardCountsInput | null) {
  return useQuery({
    queryKey: input
      ? dashboardKeys.counts(input)
      : (["dashboard", "counts", "disabled"] as const),
    queryFn: () => getDashboardCounts(input!),
    enabled: !!input,
    staleTime: STALE_TIME.short,
  });
}
