import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";
import {
  addStage,
  addStageApprover,
  createTemplate,
  fetchStageCount,
  fetchTeamProfiles,
  fetchTemplateDetail,
  fetchTemplates,
  removeStageApprover,
  renameStage,
  renameTemplate,
  softDeleteStage,
  softDeleteTemplate,
  swapStagePositions,
  type Stage,
  type Template,
} from "./api";

export const templatesQueryOptions = queryOptions({
  queryKey: qk.workflows.templates(),
  queryFn: fetchTemplates,
  staleTime: 30_000,
});

export function useTemplates() {
  return useQuery(templatesQueryOptions);
}

export function useStageCount(templateId: string) {
  return useQuery({
    queryKey: [...qk.workflows.stages(templateId), "count"] as const,
    queryFn: () => fetchStageCount(templateId),
    staleTime: 30_000,
  });
}

export function useTemplateDetail(templateId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: templateId ? qk.workflows.stages(templateId) : ["workflows", "stages", "none"],
    queryFn: () => (templateId ? fetchTemplateDetail(templateId) : Promise.resolve({ stages: [] as Stage[], approversByStage: {} })),
    enabled: enabled && !!templateId,
    staleTime: 15_000,
  });
}

export function useTeamProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ["workflows", "team-profiles"] as const,
    queryFn: fetchTeamProfiles,
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createTemplate(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workflows.all }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteTemplate(id),
    onSuccess: (_d, id) => {
      qc.setQueryData<Template[]>(qk.workflows.templates(), (prev) => prev?.filter((t) => t.id !== id));
      qc.invalidateQueries({ queryKey: qk.workflows.all });
    },
  });
}

export function useRenameTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTemplate(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workflows.templates() }),
  });
}

export function useTemplateMutations(templateId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.workflows.stages(templateId) });

  return {
    addStage: useMutation({ mutationFn: () => addStage(templateId), onSuccess: invalidate }),
    renameStage: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => renameStage(id, name),
      onSuccess: invalidate,
    }),
    deleteStage: useMutation({ mutationFn: (id: string) => softDeleteStage(id), onSuccess: invalidate }),
    swapStages: useMutation({ mutationFn: (v: { a: Stage; b: Stage }) => swapStagePositions(v.a, v.b), onSuccess: invalidate }),
    addApprover: useMutation({
      mutationFn: (v: { stageId: string; approverId: string; position: number }) =>
        addStageApprover(v.stageId, v.approverId, v.position),
      onSuccess: invalidate,
    }),
    removeApprover: useMutation({ mutationFn: (id: string) => removeStageApprover(id), onSuccess: invalidate }),
  };
}
