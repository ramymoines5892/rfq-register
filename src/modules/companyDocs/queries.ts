import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
import {
  createDocument,
  deleteDocumentType,
  fetchCurrentDocuments,
  fetchDocumentFiles,
  fetchDocumentHistory,
  fetchDocumentTypes,
  upsertDocumentType,
  type DocumentType,
  type NewDocumentPayload,
} from "./api";

export const documentTypesQO = queryOptions({
  queryKey: qk.companyDocs.types(),
  queryFn: fetchDocumentTypes,
  staleTime: 30_000,
});
export const currentDocumentsQO = queryOptions({
  queryKey: qk.companyDocs.list(),
  queryFn: fetchCurrentDocuments,
  staleTime: 30_000,
});
export const documentHistoryQO = (typeId: string) =>
  queryOptions({
    queryKey: qk.companyDocs.history(typeId),
    queryFn: () => fetchDocumentHistory(typeId),
    enabled: !!typeId,
  });
export const documentFilesQO = (docId: string) =>
  queryOptions({
    queryKey: qk.companyDocs.files(docId),
    queryFn: () => fetchDocumentFiles(docId),
    enabled: !!docId,
  });

export function useDocumentTypes() { return useQuery(documentTypesQO); }
export function useCurrentDocuments() { return useQuery(currentDocumentsQO); }
export function useDocumentHistory(typeId: string) { return useQuery(documentHistoryQO(typeId)); }
export function useDocumentFiles(docId: string) { return useQuery(documentFilesQO(docId)); }

export function useUpsertDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: Partial<DocumentType> & Pick<DocumentType, "code" | "name_ar" | "name_en">) => upsertDocumentType(t),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.companyDocs.all }),
  });
}
export function useDeleteDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocumentType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.companyDocs.all }),
  });
}
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: NewDocumentPayload) => createDocument(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.companyDocs.all }),
  });
}
