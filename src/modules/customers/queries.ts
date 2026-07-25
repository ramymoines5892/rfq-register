import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
import {
  fetchCustomerRelations,
  fetchCustomers,
  softDeleteCustomer,
  type Customer,
} from "./api";

export const customersListQueryOptions = queryOptions({
  queryKey: qk.customers.list(),
  queryFn: fetchCustomers,
  staleTime: 30_000,
});

export function customerRelationsQueryOptions(customerId: string | null) {
  return queryOptions({
    queryKey: customerId ? qk.customers.detail(customerId) : ["customers", "detail", "none"],
    queryFn: () => (customerId ? fetchCustomerRelations(customerId) : Promise.resolve({ contacts: [], banks: [], attachments: [] })),
    enabled: !!customerId,
    staleTime: 15_000,
  });
}

export function useCustomers() {
  return useQuery(customersListQueryOptions);
}

export function useCustomerRelations(customerId: string | null) {
  return useQuery(customerRelationsQueryOptions(customerId));
}

export function useSoftDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteCustomer(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<Customer[]>(qk.customers.list(), (prev) => prev?.filter((c) => c.id !== id));
      qc.invalidateQueries({ queryKey: qk.customers.all });
    },
  });
}

/** Invalidate customers list — for post-save flows in the big customers route. */
export function useInvalidateCustomers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.customers.all });
}
