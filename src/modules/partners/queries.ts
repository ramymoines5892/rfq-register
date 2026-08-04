import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { PartnerRole } from "./api";

const key = {
  list: (role?: PartnerRole, search?: string) => ["partners", "list", role ?? "all", search ?? ""] as const,
  detail: (id: string) => ["partners", "detail", id] as const,
  contacts: (id: string) => ["partners", id, "contacts"] as const,
  addresses: (id: string) => ["partners", id, "addresses"] as const,
  banks: (id: string) => ["partners", id, "banks"] as const,
  audit: (id: string) => ["partners", id, "audit"] as const,
  related: (id: string) => ["partners", id, "related"] as const,
};

export function usePartnerAudit(id: string | null) {
  return useQuery({ queryKey: key.audit(id ?? ""), queryFn: () => api.listPartnerAudit(id!), enabled: !!id });
}
export function usePartnerRelated(p: api.BusinessPartner | null | undefined) {
  return useQuery({
    queryKey: key.related(p?.id ?? ""),
    queryFn: () => api.listRelatedDocuments(p!),
    enabled: !!p?.id,
  });
}

export function usePartners(role?: PartnerRole, search?: string) {
  return useQuery({ queryKey: key.list(role, search), queryFn: () => api.listPartners(role, search), staleTime: 15_000 });
}
export function usePartner(id: string | null) {
  return useQuery({ queryKey: key.detail(id ?? ""), queryFn: () => api.getPartner(id!), enabled: !!id });
}
export function useUpsertPartner() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.upsertPartner, onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }) });
}
export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.softDeletePartner, onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }) });
}

export function usePartnerContacts(id: string | null) {
  return useQuery({ queryKey: key.contacts(id ?? ""), queryFn: () => api.listContacts(id!), enabled: !!id });
}
export function useUpsertContact(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.upsertContact, onSuccess: () => qc.invalidateQueries({ queryKey: key.contacts(partnerId) }) });
}
export function useDeleteContact(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteContact, onSuccess: () => qc.invalidateQueries({ queryKey: key.contacts(partnerId) }) });
}

export function usePartnerAddresses(id: string | null) {
  return useQuery({ queryKey: key.addresses(id ?? ""), queryFn: () => api.listAddresses(id!), enabled: !!id });
}
export function useUpsertAddress(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.upsertAddress, onSuccess: () => qc.invalidateQueries({ queryKey: key.addresses(partnerId) }) });
}
export function useDeleteAddress(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteAddress, onSuccess: () => qc.invalidateQueries({ queryKey: key.addresses(partnerId) }) });
}

export function usePartnerBanks(id: string | null) {
  return useQuery({ queryKey: key.banks(id ?? ""), queryFn: () => api.listBanks(id!), enabled: !!id });
}
export function useUpsertBank(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.upsertBank, onSuccess: () => qc.invalidateQueries({ queryKey: key.banks(partnerId) }) });
}
export function useDeleteBank(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteBank, onSuccess: () => qc.invalidateQueries({ queryKey: key.banks(partnerId) }) });
}

export function usePartnerBulk() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["partners"] });
  return {
    setStatus: useMutation({ mutationFn: (v: { ids: string[]; status: string }) => api.bulkSetStatus(v.ids, v.status), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (ids: string[]) => api.bulkSoftDelete(ids), onSuccess: invalidate }),
    importCsv: useMutation({
      mutationFn: (v: { rows: Record<string, string>[]; role: PartnerRole }) => api.importPartners(v.rows, v.role),
      onSuccess: invalidate,
    }),
  };
}
