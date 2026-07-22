import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

const K = {
  fiscalYears: ["foundation", "fiscal_years"] as const,
  numbering: ["foundation", "numbering"] as const,
  matrix: ["foundation", "approval_matrix"] as const,
  password: ["foundation", "password_policy"] as const,
  backup: ["foundation", "backup_settings"] as const,
  loginHistory: (n: number) => ["foundation", "login_history", n] as const,
};

// Fiscal Years
export function useFiscalYears() {
  return useQuery({ queryKey: K.fiscalYears, queryFn: api.fetchFiscalYears, staleTime: 30_000 });
}
export function useCreateFiscalYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createFiscalYear,
    onSuccess: () => qc.invalidateQueries({ queryKey: K.fiscalYears }),
  });
}
export function useUpdateFiscalYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.FiscalYear> }) => api.updateFiscalYear(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.fiscalYears }),
  });
}
export function useDeleteFiscalYear() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteFiscalYear, onSuccess: () => qc.invalidateQueries({ queryKey: K.fiscalYears }) });
}
export function useSetCurrentFiscalYear() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.setCurrentFiscalYear, onSuccess: () => qc.invalidateQueries({ queryKey: K.fiscalYears }) });
}

// Numbering
export function useNumberingSeries() {
  return useQuery({ queryKey: K.numbering, queryFn: api.fetchNumberingSeries, staleTime: 30_000 });
}
export function useUpsertNumbering() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.upsertNumberingSeries, onSuccess: () => qc.invalidateQueries({ queryKey: K.numbering }) });
}
export function useUpdateNumbering() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.NumberingSeries> }) => api.updateNumberingSeries(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.numbering }),
  });
}
export function useDeleteNumbering() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteNumberingSeries, onSuccess: () => qc.invalidateQueries({ queryKey: K.numbering }) });
}

// Approval matrix
export function useApprovalMatrix() {
  return useQuery({ queryKey: K.matrix, queryFn: api.fetchApprovalMatrix, staleTime: 30_000 });
}
export function useCreateApprovalRule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createApprovalRule, onSuccess: () => qc.invalidateQueries({ queryKey: K.matrix }) });
}
export function useUpdateApprovalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.ApprovalMatrixRow> }) => api.updateApprovalRule(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.matrix }),
  });
}
export function useDeleteApprovalRule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteApprovalRule, onSuccess: () => qc.invalidateQueries({ queryKey: K.matrix }) });
}

// Password policy
export function usePasswordPolicy() {
  return useQuery({ queryKey: K.password, queryFn: api.fetchPasswordPolicy, staleTime: 60_000 });
}
export function useUpsertPasswordPolicy() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.upsertPasswordPolicy, onSuccess: () => qc.invalidateQueries({ queryKey: K.password }) });
}

// Backup
export function useBackupSettings() {
  return useQuery({ queryKey: K.backup, queryFn: api.fetchBackupSettings, staleTime: 60_000 });
}
export function useUpsertBackupSettings() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.upsertBackupSettings, onSuccess: () => qc.invalidateQueries({ queryKey: K.backup }) });
}

// Login history
export function useLoginHistory(limit = 100) {
  return useQuery({ queryKey: K.loginHistory(limit), queryFn: () => api.fetchLoginHistory(limit), staleTime: 15_000 });
}
