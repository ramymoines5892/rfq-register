import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORG_TAB,
  ORG_TABS_META,
  ORG_TAB_IDS,
  parseOrgTab,
  type OrgTabId,
} from "./tabs";

/**
 * These assertions lock in the canonical ordering and default of the
 * Organization tab bar. Both the main hub (`/organization`) and the legacy
 * Settings > Organization view (`/settings/organization`) consume this
 * module, so a change here propagates everywhere.
 */
describe("Organization tab config", () => {
  it("orders tabs Branches → Departments & Jobs → Employees", () => {
    expect(ORG_TAB_IDS).toEqual(["branches", "structure", "employees"]);
  });

  it("defaults to the Branches tab", () => {
    expect(DEFAULT_ORG_TAB).toBe("branches");
  });

  it("has bilingual labels for every tab", () => {
    for (const id of ORG_TAB_IDS) {
      const meta = ORG_TABS_META[id];
      expect(meta.ar.length).toBeGreaterThan(0);
      expect(meta.en.length).toBeGreaterThan(0);
      expect(meta.iconKey).toBeDefined();
    }
  });

  it("labels the second tab 'Departments & Jobs' (English)", () => {
    expect(ORG_TABS_META.structure.en).toBe("Departments & Jobs");
  });

  it("parseOrgTab preserves valid ids", () => {
    for (const id of ORG_TAB_IDS) {
      expect(parseOrgTab(id)).toBe(id);
    }
  });

  it("parseOrgTab falls back to the default for missing/invalid values", () => {
    const invalid: unknown[] = [undefined, null, "", "unknown", 42, {}, []];
    for (const v of invalid) {
      expect(parseOrgTab(v)).toBe(DEFAULT_ORG_TAB);
    }
  });

  it("exposes every id in the metadata map (no orphans)", () => {
    const metaIds = Object.keys(ORG_TABS_META) as OrgTabId[];
    expect(new Set(metaIds)).toEqual(new Set(ORG_TAB_IDS));
  });
});
