import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
import {
  deleteWarehouse,
  fetchWarehouses,
  upsertWarehouse,
  type WarehouseUpsertPayload,
  type WarehouseWithBranch,
} from "./api";

export function useWarehouses(branchId?: string | null) {
  return useQuery<WarehouseWithBranch[]>({
    queryKey: qk.warehouses.list(branchId),
    queryFn: () => fetchWarehouses(branchId),
    staleTime: 15_000,
  });
}

export function useUpsertWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: WarehouseUpsertPayload }) => upsertWarehouse(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.warehouses.all });
      qc.invalidateQueries({ queryKey: qk.branches.all });
    },
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.warehouses.all });
      qc.invalidateQueries({ queryKey: qk.branches.all });
    },
  });
}
