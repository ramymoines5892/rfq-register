import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";
import { createCompanyBundle, fetchCurrentCompany, hasAnyCompany, updateCompany, type CreateCompanyPayload, type UpdateCompanyPatch } from "./api";

export const hasAnyCompanyQueryOptions = queryOptions({
  queryKey: qk.company.exists(),
  queryFn: hasAnyCompany,
  staleTime: 60_000,
});

export const currentCompanyQueryOptions = queryOptions({
  queryKey: qk.company.current(),
  queryFn: fetchCurrentCompany,
  staleTime: 60_000,
});

export function useHasAnyCompany() {
  return useQuery(hasAnyCompanyQueryOptions);
}

export function useCurrentCompany() {
  return useQuery(currentCompanyQueryOptions);
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => createCompanyBundle(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.company.all });
    },
  });
}
