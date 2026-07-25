import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
import {
  fetchOrganizationData,
  reorderDepartments,
  softDeleteOrgRow,
  upsertDepartment,
  upsertJobTitle,
  type DepartmentPositionUpdate,
  type Department,
  type JobTitle,
  type OrganizationData,
} from "./api";

export function useOrganizationData() {
  return useQuery<OrganizationData>({
    queryKey: qk.organization.data(),
    queryFn: fetchOrganizationData,
    staleTime: 30_000,
  });
}

export function useReorderDepartments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: DepartmentPositionUpdate[]) => reorderDepartments(updates),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.organization.all });
    },
  });
}

export function useSoftDeleteOrgRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; kind: "department" | "job_title" }) =>
      softDeleteOrgRow(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.organization.all });
    },
  });
}

export function useUpsertDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id?: string; payload: Partial<Department>; isNew: boolean }) =>
      upsertDepartment(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.organization.all });
    },
  });
}

export function useUpsertJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id?: string; payload: Partial<JobTitle>; isNew: boolean }) =>
      upsertJobTitle(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.organization.all });
    },
  });
}
