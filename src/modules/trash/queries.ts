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

const ORIGIN_KEYS: Record<string, readonly (readonly unknown[])[]> = {
  customers: [qk.customers.all],
  quotes: [["quotes"]],
  partners: [["partners"]],
  branches: [qk.branches.all],
  warehouses: [qk.warehouses.all],
  warehouse_bins: [qk.bins.all],
  products: [qk.products.all],
  departments: [qk.organization.all],
  job_titles: [qk.organization.all],
  employees: [qk.organization.all, ["hr"]],
  workflow_templates: [qk.workflows.all],
  workflow_stages: [qk.workflows.all],
  quote_attachments: [["quotes"]],
  customer_contacts: [qk.customers.all],
  customer_banks: [qk.customers.all],
  customer_attachments: [qk.customers.all],
  customer_field_definitions: [["form-builder"]],
  customer_field_options: [["form-builder"]],
};

export function useRestoreRow(tableKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreRow(tableKey, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.trash.list(tableKey) });
      for (const key of ORIGIN_KEYS[tableKey] ?? []) {
        qc.invalidateQueries({ queryKey: key as readonly unknown[] });
      }
    },
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
