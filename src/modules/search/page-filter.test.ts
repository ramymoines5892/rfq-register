import { describe, it, expect } from "vitest";
import { filterPages, type PageEntry } from "./page-filter";
import type { Access } from "@/hooks/useAccess";

const PAGES: PageEntry[] = [
  { to: "/", labelAr: "لوحة التحكم", labelEn: "Dashboard", keywords: "home overview", group: "data" },
  { to: "/customers", labelAr: "العملاء", labelEn: "Customers", keywords: "clients عملاء", group: "data" },
  { to: "/settings", labelAr: "الإعدادات", labelEn: "Settings", keywords: "preferences", group: "settings", when: (a) => a.isAdmin },
  { to: "/settings/trash", labelAr: "سلة المحذوفات", labelEn: "Trash", keywords: "recycle", group: "settings", when: (a) => a.canViewTrash },
];

const admin: Access = { ready: true, isAdmin: true, isOwner: false, canViewTrash: true, canManageFormFields: true, canManageNotifications: true, canManageSemanticSearch: true } as unknown as Access;
const user: Access = { ready: true, isAdmin: false, isOwner: false, canViewTrash: false, canManageFormFields: false, canManageNotifications: false, canManageSemanticSearch: false } as unknown as Access;
const loading: Access = { ready: false } as unknown as Access;

describe("filterPages", () => {
  it("shows all allowed pages when query is empty (admin)", () => {
    const out = filterPages(PAGES, "", false, admin);
    expect(out.map((p) => p.to)).toEqual(["/", "/customers", "/settings", "/settings/trash"]);
  });
  it("hides gated pages for a non-admin", () => {
    const out = filterPages(PAGES, "", false, user);
    expect(out.map((p) => p.to)).toEqual(["/", "/customers"]);
  });
  it("only ungated pages before access hydrates", () => {
    expect(filterPages(PAGES, "", false, loading).map((p) => p.to)).toEqual(["/", "/customers"]);
  });
  it("matches English label", () => {
    expect(filterPages(PAGES, "dash", false, admin).map((p) => p.to)).toEqual(["/"]);
  });
  it("matches Arabic label when ar=true", () => {
    expect(filterPages(PAGES, "العملاء", true, admin).map((p) => p.to)).toEqual(["/customers"]);
  });
  it("matches keywords case-insensitively", () => {
    expect(filterPages(PAGES, "CLIENTS", false, admin).map((p) => p.to)).toEqual(["/customers"]);
  });
  it("matches route path fragment", () => {
    expect(filterPages(PAGES, "/settings/trash", false, admin).map((p) => p.to)).toEqual(["/settings/trash"]);
  });
  it("returns empty when nothing matches", () => {
    expect(filterPages(PAGES, "zzz-nope", false, admin)).toEqual([]);
  });
  it("gated matches are still filtered out for non-admins even with matching query", () => {
    expect(filterPages(PAGES, "trash", false, user)).toEqual([]);
  });
});
