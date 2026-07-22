import type { Access } from "@/hooks/useAccess";

export type PageEntry = {
  to: string;
  labelAr: string;
  labelEn: string;
  keywords: string;
  group: "data" | "settings" | "admin";
  when?: (a: Access) => boolean;
};

/** Filter navigation pages by access + free-text query. Pure. */
export function filterPages(
  pages: PageEntry[],
  q: string,
  ar: boolean,
  access: Access,
): PageEntry[] {
  const allowed = access.ready
    ? pages.filter((p) => !p.when || p.when(access))
    : pages.filter((p) => !p.when); // pre-hydration: only ungated
  const s = q.trim().toLowerCase();
  if (!s) return allowed;
  return allowed.filter((p) => {
    const label = (ar ? p.labelAr : p.labelEn).toLowerCase();
    return (
      label.includes(s) ||
      p.keywords.toLowerCase().includes(s) ||
      p.to.toLowerCase().includes(s)
    );
  });
}
