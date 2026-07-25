/**
 * Shared configuration for the Organization tab bar. Consumed by both the
 * main Organization hub (`/organization`) and the Settings > Organization
 * view (`/settings/organization`) so ordering, defaults, and labels stay in
 * lockstep across the app.
 *
 * Canonical order: Branches → Departments & Jobs → Employees.
 */

export type OrgTabId = "branches" | "structure" | "employees";

/** Canonical rendering order. Do not reorder without design sign-off. */
export const ORG_TAB_IDS: readonly OrgTabId[] = [
  "branches",
  "structure",
  "employees",
] as const;

/** The tab shown when no `?tab=` query param is present. */
export const DEFAULT_ORG_TAB: OrgTabId = "branches";

export const ORG_TABS_META: Record<
  OrgTabId,
  { ar: string; en: string; iconKey: "landmark" | "building2" | "users2" }
> = {
  branches:  { ar: "الفروع",              en: "Branches",           iconKey: "landmark"  },
  structure: { ar: "الأقسام والوظائف",   en: "Departments & Jobs", iconKey: "building2" },
  employees: { ar: "الموظفون",            en: "Employees",          iconKey: "users2"    },
};

/** Coerce any URL search value into a valid tab id, falling back to default. */
export function parseOrgTab(value: unknown): OrgTabId {
  return typeof value === "string" && (ORG_TAB_IDS as readonly string[]).includes(value)
    ? (value as OrgTabId)
    : DEFAULT_ORG_TAB;
}
