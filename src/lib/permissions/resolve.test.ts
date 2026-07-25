import { describe, it, expect } from "vitest";
import { resolvePermission, resolveEffectiveSet, isAllowed } from "./resolve";

describe("permission resolver — union rule", () => {
  it("denies when no source grants", () => {
    expect(isAllowed("customers.view", {})).toBe(false);
    const r = resolvePermission("customers.view", {});
    expect(r.allowed).toBe(false);
    expect(r.sources).toEqual([]);
    expect(r.primary).toBeNull();
  });

  it("grants when only department grants", () => {
    const r = resolvePermission("customers.view", { department: ["customers.view"] });
    expect(r.allowed).toBe(true);
    expect(r.sources).toEqual(["department"]);
    expect(r.primary).toBe("department");
  });

  it("grants when only job grants", () => {
    const r = resolvePermission("quotes.approve", { job: ["quotes.approve"] });
    expect(r.allowed).toBe(true);
    expect(r.primary).toBe("job");
  });

  it("grants when only personal grants", () => {
    const r = resolvePermission("reports.view", { personal: ["reports.view"] });
    expect(r.allowed).toBe(true);
    expect(r.primary).toBe("personal");
  });

  it("admin/owner bypass always wins", () => {
    const r = resolvePermission("hr.manage", { isAdminOrOwner: true });
    expect(r.allowed).toBe(true);
    expect(r.primary).toBe("admin");
    // even without any grants elsewhere
    expect(resolveEffectiveSet({ isAdminOrOwner: true }).has("*")).toBe(true);
  });
});

describe("permission resolver — conflicts", () => {
  it("dept grants + personal absent → allowed (dept wins over silence)", () => {
    // Personal override is grant-only; removing a permission personally does NOT block inherited grants.
    expect(isAllowed("inventory.view", { department: ["inventory.view"], personal: [] })).toBe(true);
  });

  it("job grants + dept absent → allowed", () => {
    expect(isAllowed("quotes.edit", { job: ["quotes.edit"] })).toBe(true);
  });

  it("all three grant → allowed, sources include personal, job, department in priority order", () => {
    const r = resolvePermission("customers.edit", {
      personal: ["customers.edit"],
      job: ["customers.edit"],
      department: ["customers.edit"],
    });
    expect(r.allowed).toBe(true);
    expect(r.sources).toEqual(["personal", "job", "department"]);
    expect(r.primary).toBe("personal");
  });

  it("dept grants + job grants → allowed with both sources listed", () => {
    const r = resolvePermission("warehouses.view", {
      job: ["warehouses.view"],
      department: ["warehouses.view"],
    });
    expect(r.sources).toEqual(["job", "department"]);
    expect(r.primary).toBe("job");
  });

  it("admin bypass overrides missing grants everywhere else", () => {
    const r = resolvePermission("hr.manage", {
      isAdminOrOwner: true,
      personal: [],
      job: [],
      department: [],
    });
    expect(r.allowed).toBe(true);
    expect(r.primary).toBe("admin");
  });

  it("no source overlaps → only granted perms are effective", () => {
    const set = resolveEffectiveSet({
      personal: ["reports.view"],
      job: ["quotes.view"],
      department: ["customers.view"],
    });
    expect([...set].sort()).toEqual(["customers.view", "quotes.view", "reports.view"]);
  });

  it("duplicate grants across sources are deduplicated in effective set", () => {
    const set = resolveEffectiveSet({
      personal: ["customers.view"],
      job: ["customers.view"],
      department: ["customers.view"],
    });
    expect([...set]).toEqual(["customers.view"]);
  });

  it("removing from personal alone does NOT revoke when dept still grants (documents union semantics)", () => {
    // Simulates: admin toggled off the personal checkbox but the department still grants it.
    // Expected behaviour → user KEEPS access. UI must warn admins to remove from every source.
    const before = isAllowed("quotes.view", {
      personal: ["quotes.view"],
      department: ["quotes.view"],
    });
    const after = isAllowed("quotes.view", {
      personal: [],
      department: ["quotes.view"],
    });
    expect(before).toBe(true);
    expect(after).toBe(true);
  });
});
