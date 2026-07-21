import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentFeatures, updateCurrentFeatures } from "./api";
import { FEATURE_MAP, type FeatureKey } from "@/lib/features/registry";

const FEATURES_KEY = ["company", "features"] as const;

export const featuresQueryOptions = queryOptions({
  queryKey: FEATURES_KEY,
  queryFn: fetchCurrentFeatures,
  staleTime: 5 * 60_000,
});

export function useFeatures() {
  return useQuery(featuresQueryOptions);
}

/**
 * Returns whether a feature (and its dependencies) is enabled.
 * While loading, returns `false` — components should render a skeleton
 * or nothing until data arrives.
 */
export function useFeature(key: FeatureKey | string): boolean {
  const { data } = useFeatures();
  if (!data) return false;
  return isFeatureEnabled(key, data);
}

export function isFeatureEnabled(key: string, features: Record<string, boolean>): boolean {
  const def = FEATURE_MAP[key];
  if (!def) return false;
  if (!features[key]) return false;
  if (def.depends_on) {
    for (const dep of def.depends_on) {
      if (!features[dep]) return false;
    }
  }
  return true;
}

export function useUpdateFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, boolean>) => updateCurrentFeatures(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEATURES_KEY });
    },
  });
}
