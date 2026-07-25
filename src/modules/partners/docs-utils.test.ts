import { describe, it, expect } from "vitest";
import {
  filterDocs,
  sortDocs,
  totalsByCurrency,
  paginate,
  isValidRange,
  hasActiveFilters,
  collectStatuses,
  type RelatedDoc,
  type DocFilters,
} from "./docs-utils";

const R = (o: Partial<RelatedDoc>): RelatedDoc => ({
  kind: "quote", id: Math.random().toString(36).slice(2),
  title: "T", ...o,
});

const rows: RelatedDoc[] = [
  R({ id: "1", kind: "quote", title: "Alpha", status: "draft",     date: "2026-01-10", amount: 100, currency: "USD" }),
  R({ id: "2", kind: "quote", title: "Bravo", status: "sent",      date: "2026-02-01", amount: 200, currency: "USD" }),
  R({ id: "3", kind: "stock_movement", title: "Charlie", status: null, date: "2026-03-15", amount: 50, currency: "EGP" }),
  R({ id: "4", kind: "customer", title: "Delta", status: "active", date: null,          amount: null, currency: null }),
  R({ id: "5", kind: "quote", title: "Echo",  status: "sent",      date: "2026-02-15", amount: 300, currency: "EUR" }),
];

const EMPTY: DocFilters = { kind: "all", status: "all", from: "", to: "" };

describe("filterDocs", () => {
  it("returns all rows when no filters", () => {
    expect(filterDocs(rows, EMPTY)).toHaveLength(5);
  });
  it("filters by kind", () => {
    expect(filterDocs(rows, { ...EMPTY, kind: "quote" })).toHaveLength(3);
  });
  it("filters by status", () => {
    expect(filterDocs(rows, { ...EMPTY, status: "sent" }).map((r) => r.id)).toEqual(["2", "5"]);
  });
  it("filters by date range (inclusive end of day)", () => {
    const out = filterDocs(rows, { ...EMPTY, from: "2026-02-01", to: "2026-02-15" });
    expect(out.map((r) => r.id).sort()).toEqual(["2", "5"]);
  });
  it("excludes rows with no date when a date range is set", () => {
    const out = filterDocs(rows, { ...EMPTY, from: "2026-01-01", to: "2026-12-31" });
    expect(out.every((r) => r.id !== "4")).toBe(true);
  });
  it("invalid range (from > to) returns empty", () => {
    const out = filterDocs(rows, { ...EMPTY, from: "2026-06-01", to: "2026-01-01" });
    expect(out).toEqual([]);
  });
  it("combines filters", () => {
    const out = filterDocs(rows, { kind: "quote", status: "sent", from: "2026-02-10", to: "2026-02-20" });
    expect(out.map((r) => r.id)).toEqual(["5"]);
  });
});

describe("sortDocs", () => {
  it("date_desc default", () => {
    expect(sortDocs(rows, "date_desc").map((r) => r.id)).toEqual(["3", "5", "2", "1", "4"]);
  });
  it("date_asc places null dates first", () => {
    expect(sortDocs(rows, "date_asc").map((r) => r.id)[0]).toBe("4");
  });
  it("amount_desc sorts nulls last", () => {
    expect(sortDocs(rows, "amount_desc").map((r) => r.id)).toEqual(["5", "2", "1", "3", "4"]);
  });
  it("amount_asc sorts nulls first", () => {
    expect(sortDocs(rows, "amount_asc").map((r) => r.id)[0]).toBe("4");
  });
  it("title_asc", () => {
    expect(sortDocs(rows, "title_asc").map((r) => r.title)).toEqual(["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
  });
  it("does not mutate the input", () => {
    const snap = rows.map((r) => r.id);
    sortDocs(rows, "amount_desc");
    expect(rows.map((r) => r.id)).toEqual(snap);
  });
});

describe("totalsByCurrency", () => {
  it("groups by currency, ignores null amounts", () => {
    expect(totalsByCurrency(rows)).toEqual({ USD: 300, EGP: 50, EUR: 300 });
  });
  it("uses — for missing currency", () => {
    expect(totalsByCurrency([R({ amount: 10, currency: null })])).toEqual({ "—": 10 });
  });
  it("skips non-finite amounts", () => {
    expect(totalsByCurrency([R({ amount: NaN, currency: "USD" }), R({ amount: 5, currency: "USD" })])).toEqual({ USD: 5 });
  });
  it("empty rows → empty map", () => {
    expect(totalsByCurrency([])).toEqual({});
  });
});

describe("paginate", () => {
  const list = Array.from({ length: 23 }, (_, i) => R({ id: String(i + 1) }));
  it("first page", () => {
    const p = paginate(list, 1, 10);
    expect(p.paged).toHaveLength(10);
    expect(p.totalPages).toBe(3);
    expect(p.currentPage).toBe(1);
    expect(p.pageStart).toBe(0);
  });
  it("last (partial) page returns remainder", () => {
    const p = paginate(list, 3, 10);
    expect(p.paged).toHaveLength(3);
    expect(p.pageEnd).toBe(23);
  });
  it("clamps page above totalPages to last page", () => {
    const p = paginate(list, 99, 10);
    expect(p.currentPage).toBe(3);
    expect(p.paged.map((r) => r.id)).toEqual(["21", "22", "23"]);
  });
  it("clamps page below 1", () => {
    expect(paginate(list, 0, 10).currentPage).toBe(1);
    expect(paginate(list, -5, 10).currentPage).toBe(1);
  });
  it("empty rows → single empty page (no crash)", () => {
    const p = paginate([], 1, 10);
    expect(p.totalPages).toBe(1);
    expect(p.paged).toEqual([]);
    expect(p.pageEnd).toBe(0);
  });
  it("invalid pageSize falls back to 1", () => {
    expect(paginate(list, 1, 0).paged).toHaveLength(1);
    expect(paginate(list, 1, NaN).paged).toHaveLength(1);
  });
});

describe("isValidRange / hasActiveFilters / collectStatuses", () => {
  it("isValidRange: empty ends are always valid", () => {
    expect(isValidRange("", "")).toBe(true);
    expect(isValidRange("", "2026-01-01")).toBe(true);
  });
  it("isValidRange: from > to invalid", () => {
    expect(isValidRange("2026-05-01", "2026-01-01")).toBe(false);
  });
  it("isValidRange: same day valid", () => {
    expect(isValidRange("2026-01-01", "2026-01-01")).toBe(true);
  });
  it("isValidRange: garbage invalid", () => {
    expect(isValidRange("not-a-date", "2026-01-01")).toBe(false);
  });
  it("hasActiveFilters detects any change", () => {
    expect(hasActiveFilters(EMPTY)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY, kind: "quote" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY, from: "2026-01-01" })).toBe(true);
  });
  it("collectStatuses is unique + sorted", () => {
    expect(collectStatuses(rows)).toEqual(["active", "draft", "sent"]);
    expect(collectStatuses([])).toEqual([]);
  });
});
