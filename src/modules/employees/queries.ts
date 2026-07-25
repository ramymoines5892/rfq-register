import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
import {
  fetchEmployees,
  softDeleteEmployee,
  upsertEmployee,
  type Employee,
  type EmployeeUpsertPayload,
} from "./api";

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: qk.employees.list(),
    queryFn: fetchEmployees,
    staleTime: 15_000,
  });
}

export function useUpsertEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: EmployeeUpsertPayload }) =>
      upsertEmployee(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.employees.all });
      qc.invalidateQueries({ queryKey: qk.persons.all });
      qc.invalidateQueries({ queryKey: ["organization"] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.employees.all });
      qc.invalidateQueries({ queryKey: ["organization"] });
    },
  });
}
