import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearFieldOptions,
  fetchCanManageFormFields,
  fetchFormBuilder,
  persistFieldChanges,
  replaceFieldOptions,
  softDeleteField,
  softDeleteFieldsBulk,
  upsertFieldDefinition,
  type FieldDef,
  type FieldDefInsert,
  type FieldOptionInsert,
} from "./api";

const KEY = {
  perm: ["formBuilder", "canManage"] as const,
  data: (entity: string) => ["formBuilder", "data", entity] as const,
};

export function useCanManageFormFields() {
  return useQuery({
    queryKey: KEY.perm,
    queryFn: fetchCanManageFormFields,
    staleTime: 5 * 60_000,
  });
}

export function useFormBuilderData(entity: string, enabled: boolean) {
  return useQuery({
    queryKey: KEY.data(entity),
    queryFn: () => fetchFormBuilder(entity),
    enabled,
  });
}

function useInvalidate(entity: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY.data(entity) });
}

export function useSoftDeleteField(entity: string) {
  const invalidate = useInvalidate(entity);
  return useMutation({
    mutationFn: (id: string) => softDeleteField(id),
    onSuccess: () => invalidate(),
  });
}

export function useSoftDeleteFieldsBulk(entity: string) {
  const invalidate = useInvalidate(entity);
  return useMutation({
    mutationFn: (ids: string[]) => softDeleteFieldsBulk(ids),
    onSuccess: () => invalidate(),
  });
}

export function usePersistFieldChanges(entity: string) {
  const invalidate = useInvalidate(entity);
  return useMutation({
    mutationFn: (v: { changed: FieldDef[]; original: Map<string, FieldDef> }) =>
      persistFieldChanges(v.changed, v.original),
    onSuccess: () => invalidate(),
  });
}

export function useSaveFieldDefinition(entity: string) {
  const invalidate = useInvalidate(entity);
  return useMutation({
    mutationFn: async (args: {
      editingId: string | null;
      payload: Omit<FieldDefInsert, "position">;
      maxPosition: number;
      options?: { needs: boolean; isReference: boolean; rows: FieldOptionInsert[] };
    }) => {
      const fieldId = await upsertFieldDefinition({
        editingId: args.editingId,
        payload: args.payload,
        maxPosition: args.maxPosition,
      });
      if (args.options && !args.options.isReference) {
        if (args.options.needs) {
          const rows = args.options.rows.map((r) => ({ ...r, field_id: fieldId }));
          await replaceFieldOptions(fieldId, rows);
        } else {
          await clearFieldOptions(fieldId);
        }
      }
      return fieldId;
    },
    onSuccess: () => invalidate(),
  });
}
