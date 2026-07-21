import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { fetchMyUIPrefs, updateMyUIPrefs, type UIPreferences } from "./api";

export const uiPrefsKey = ["ui-preferences", "me"] as const;

export const myUIPrefsQueryOptions = () =>
  queryOptions({
    queryKey: uiPrefsKey,
    queryFn: fetchMyUIPrefs,
    staleTime: 60_000,
  });

export function useMyUIPrefs() {
  return useQuery(myUIPrefsQueryOptions());
}

export function useUpdateMyUIPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<UIPreferences, "user_id">>) => updateMyUIPrefs(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: uiPrefsKey });
      const prev = qc.getQueryData<UIPreferences | null>(uiPrefsKey);
      if (prev) qc.setQueryData(uiPrefsKey, { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(uiPrefsKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: uiPrefsKey }),
  });
}
