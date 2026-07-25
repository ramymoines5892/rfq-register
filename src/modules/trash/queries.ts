import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
import {
  fetchDeletedRows,
  fetchOwnerCheck,
  purgeRow,
  restoreRow,
} from "./api";

export function useOwnerCheck() {
  return useQuery({
    queryKey: qk.trash.ownerCheck(),
    queryFn: fetchOwnerCheck,
    staleTime: 60_000,
  });
}

export function useDeletedRows(tableKey: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.trash.list(tableKey),
    queryFn: () => fetchDeletedRows(tableKey),
    enabled,
  });
}

export function useRestoreRow(tableKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreRow(tableKey, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.trash.list(tableKey) }),
  });
}

export function usePurgeRow(tableKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; email: string; password: string }) =>
      purgeRow(tableKey, args.id, args.email, args.password),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.trash.list(tableKey) }),
  });
}
