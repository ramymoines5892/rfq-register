/**
 * Pure helpers for the Partners → Docs tab.
 * Extracted so they can be unit-tested without React.
 */

export type DocKind = "quote" | "customer" | "stock_movement";

export type RelatedDoc = {
  kind: DocKind | string;
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  date?: string | null;
  amount?: number | null;
  currency?: string | null;
  link?: string | null;
};

export type SortBy =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "title_asc";

export type DocFilters = {
  kind: "all" | DocKind | string;
  status: string; // "all" or exact match
  from: string; // yyyy-mm-dd or ""
  to: string;   // yyyy-mm-dd or ""
};

/** Returns true iff the from/to pair defines a usable window (or is empty). */
export function isValidRange(from: string, to: string): boolean {
  if (!from || !to) return true;
  const a = new Date(from).getTime();
  const b = new Date(`${to}T23:59:59`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a <= b;
}

export function hasActiveFilters(f: DocFilters): boolean {
  return f.kind !== "all" || f.status !== "all" || !!f.from || !!f.to;
}

export function filterDocs(rows: RelatedDoc[], f: DocFilters): RelatedDoc[] {
  const validRange = isValidRange(f.from, f.to);
  return rows.filter((r) => {
    if (f.kind !== "all" && r.kind !== f.kind) return false;
    if (f.status !== "all" && (r.status ?? "") !== f.status) return false;
    if (!validRange) return false;
    if (f.from && (!r.date || new Date(r.date) < new Date(f.from))) return false;
    if (f.to && (!r.date || new Date(r.date) > new Date(`${f.to}T23:59:59`))) return false;
    return true;
  });
}

export function sortDocs(rows: RelatedDoc[], sortBy: SortBy): RelatedDoc[] {
  const time = (v?: string | null) => (v ? new Date(v).getTime() : 0);
  const amt = (v?: number | null) => (v == null ? -Infinity : Number(v));
  const copy = rows.slice();
  copy.sort((a, b) => {
    switch (sortBy) {
      case "date_asc":    return time(a.date) - time(b.date);
      case "amount_desc": return amt(b.amount) - amt(a.amount);
      case "amount_asc":  return amt(a.amount) - amt(b.amount);
      case "title_asc":   return (a.title ?? "").localeCompare(b.title ?? "");
      case "date_desc":
      default:            return time(b.date) - time(a.date);
    }
  });
  return copy;
}

/** Sum amounts grouped by currency. Missing currency → "—". Missing amount → skipped. */
export function totalsByCurrency(rows: RelatedDoc[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.amount == null) continue;
    const n = Number(r.amount);
    if (!Number.isFinite(n)) continue;
    const k = r.currency ?? "—";
    map[k] = (map[k] ?? 0) + n;
  }
  return map;
}

export type Pagination = {
  totalPages: number;
  currentPage: number;
  pageStart: number;
  pageEnd: number; // exclusive
  paged: RelatedDoc[];
};

/** Clamp page to [1, totalPages]. Returns a stable slice + page metadata. */
export function paginate(
  rows: RelatedDoc[],
  page: number,
  pageSize: number,
): Pagination {
  const size = Math.max(1, Math.floor(pageSize || 1));
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.min(Math.max(1, Math.floor(page || 1)), totalPages);
  const pageStart = (currentPage - 1) * size;
  const pageEnd = Math.min(pageStart + size, rows.length);
  return {
    totalPages,
    currentPage,
    pageStart,
    pageEnd,
    paged: rows.slice(pageStart, pageEnd),
  };
}

export function collectStatuses(rows: RelatedDoc[]): string[] {
  const s = new Set<string>();
  for (const r of rows) if (r.status) s.add(r.status);
  return Array.from(s).sort();
}
