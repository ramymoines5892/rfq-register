import type { Database } from "@/integrations/supabase/types";

type Department = Database["public"]["Tables"]["departments"]["Row"];

// Flatten departments in hierarchical order (parent → children),
// sorted by position at each level. Used for hierarchy-ordered dropdowns.
export function flattenDeptsHierarchy<T extends Pick<Department, "id" | "parent_id" | "position">>(
  all: T[],
): Array<{ dept: T; depth: number }> {
  const byParent = new Map<string | null, T[]>();
  all.forEach((d) => {
    const k = (d.parent_id as string | null) ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(d);
  });
  byParent.forEach((arr) => arr.sort((a, b) => ((a.position as number | null) ?? 0) - ((b.position as number | null) ?? 0)));
  const out: Array<{ dept: T; depth: number }> = [];
  const walk = (parent: string | null, depth: number) => {
    (byParent.get(parent) || []).forEach((d) => {
      out.push({ dept: d, depth });
      walk(d.id, depth + 1);
    });
  };
  walk(null, 0);
  return out;
}
