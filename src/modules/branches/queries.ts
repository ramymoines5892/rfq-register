import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
import {
  deleteBranchWithTransfer,
  fetchAllUsers,
  fetchBranchAssignments,
  fetchBranches,
  setBranchAssignments,
  upsertBranch,
  type BranchAssignment,
  type BranchUpsertPayload,
  type BranchWithCounts,
  type UserLite,
} from "./api";

export function useBranches() {
  return useQuery<BranchWithCounts[]>({
    queryKey: qk.branches.list(),
    queryFn: fetchBranches,
    staleTime: 15_000,
  });
}

export function useAllUsersLite() {
  return useQuery<UserLite[]>({
    queryKey: ["users", "lite"] as const,
    queryFn: fetchAllUsers,
    staleTime: 60_000,
  });
}

export function useBranchAssignments(branchId: string | null) {
  return useQuery<BranchAssignment[]>({
    queryKey: qk.branches.users(branchId ?? "none"),
    queryFn: () => fetchBranchAssignments(branchId!),
    enabled: !!branchId,
  });
}

export function useUpsertBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: BranchUpsertPayload }) => upsertBranch(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.branches.all }); },
  });
}

export function useSetBranchAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, assignments }: { branchId: string; assignments: BranchAssignment[] }) =>
      setBranchAssignments(branchId, assignments),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.branches.users(vars.branchId) });
      qc.invalidateQueries({ queryKey: qk.branches.list() });
    },
  });
}

export function useDeleteBranchWithTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      deleteBranchWithTransfer(sourceId, targetId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.branches.all }); },
  });
}
