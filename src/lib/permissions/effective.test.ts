import { describe, it, expect } from "vitest";
import { resolvePermission, resolveEffectiveSet, isAllowed } from "./resolve";

/**
 * API-level effective-permission tests.
 *
 * These simulate the exact shape returned by fetchEffectivePermissions()
 * (own / fromDept / fromJob sets) and verify the resolver produces the
 * final effective outcome + correct source attribution that the audit UI
 * relies on.
 */

describe("effective permissions — mixed inheritance conflicts", () => {
  it("dept grants A, job grants B → both effective from their respective source", () => {
    const input = { department: ["customers.view"], job: ["quotes.create"], personal: [] };
    expect(isAllowed("customers.view", input)).toBe(true);
    expect(isAllowed("quotes.create", input)).toBe(true);
    expect(resolvePermission("customers.view", input).primary).toBe("department");
    expect(resolvePermission("quotes.create", input).primary).toBe("job");
  });

  it("dept and job BOTH grant same perm → sources list both, primary = job", () => {
    const r = resolvePermission("inventory.view", {
      department: ["inventory.view"], job: ["inventory.view"],
    });
    expect(r.allowed).toBe(true);
    expect(r.sources).toEqual(["job", "department"]);
    expect(r.primary).toBe("job");
  });

  it("multiple personal overrides across many perms → all effective, none leak", () => {
    const set = resolveEffectiveSet({
      personal: ["reports.view", "notifications.view", "manage_form_fields"],
      job: ["quotes.view"],
      department: ["customers.view"],
    });
    expect([...set].sort()).toEqual([
      "customers.view", "manage_form_fields", "notifications.view", "quotes.view", "reports.view",
    ]);
    // Missing perm stays denied
    expect(isAllowed("hr.manage", { personal: ["reports.view"] })).toBe(false);
  });

  it("revoking from personal alone leaves user still granted via job (union rule)", () => {
    // BEFORE: personal + job both grant
    const before = { personal: ["quotes.approve"], job: ["quotes.approve"] };
    // AFTER simulated revoke-personal:
    const after  = { personal: [],                 job: ["quotes.approve"] };
    expect(isAllowed("quotes.approve", before)).toBe(true);
    expect(isAllowed("quotes.approve", after)).toBe(true); // still allowed via job
    expect(resolvePermission("quotes.approve", after).primary).toBe("job");
  });

  it("revoking from BOTH personal and job leaves user still granted via department", () => {
    const after = { personal: [], job: [], department: ["quotes.approve"] };
    expect(isAllowed("quotes.approve", after)).toBe(true);
    expect(resolvePermission("quotes.approve", after).primary).toBe("department");
  });

  it("full revoke across every source finally denies", () => {
    const after = { personal: [], job: [], department: [] };
    expect(isAllowed("quotes.approve", after)).toBe(false);
    expect(resolvePermission("quotes.approve", after).sources).toEqual([]);
  });

  it("admin bypass persists even when all explicit sources are empty", () => {
    const r = resolvePermission("inventory.adjust.approve", {
      isAdminOrOwner: true, personal: [], job: [], department: [],
    });
    expect(r.allowed).toBe(true);
    expect(r.primary).toBe("admin");
    expect(resolveEffectiveSet({ isAdminOrOwner: true }).has("*")).toBe(true);
  });

  it("granting personally does NOT remove inheritance badges from job/dept", () => {
    const r = resolvePermission("inventory.view", {
      personal: ["inventory.view"], job: ["inventory.view"], department: ["inventory.view"],
    });
    expect(r.sources).toEqual(["personal", "job", "department"]);
    expect(r.primary).toBe("personal");
  });
});

describe("effective permissions — diff scenarios (before/after)", () => {
  const perm = "customers.edit";

  it("grant personal when nothing else grants → transitions denied → allowed", () => {
    const before = { personal: [], job: [], department: [] };
    const after  = { personal: [perm], job: [], department: [] };
    expect(isAllowed(perm, before)).toBe(false);
    expect(isAllowed(perm, after)).toBe(true);
    expect(resolvePermission(perm, after).primary).toBe("personal");
  });

  it("revoke dept while job still grants → NO effective transition (warn admin)", () => {
    const before = { department: [perm], job: [perm] };
    const after  = { department: [],     job: [perm] };
    const b = resolvePermission(perm, before);
    const a = resolvePermission(perm, after);
    expect(b.allowed).toBe(true);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(a.allowed); // no effective change
    expect(a.sources).toEqual(["job"]);
  });

  it("grant dept when job already grants → sources widen but effective unchanged", () => {
    const before = { department: [],       job: [perm] };
    const after  = { department: [perm],   job: [perm] };
    expect(resolvePermission(perm, before).sources).toEqual(["job"]);
    expect(resolvePermission(perm, after).sources).toEqual(["job", "department"]);
    expect(isAllowed(perm, before)).toBe(isAllowed(perm, after));
  });

  it("full revoke from every source → transitions allowed → denied", () => {
    const before = { personal: [perm], job: [perm], department: [perm] };
    const after  = { personal: [],     job: [],     department: [] };
    expect(isAllowed(perm, before)).toBe(true);
    expect(isAllowed(perm, after)).toBe(false);
  });
});

/**
 * Audit-entry expectations.
 *
 * A single toggle produces exactly one audit row: {actor, scope, target,
 * permission, action ∈ {grant, revoke}}. The tests below encode the mapping
 * so integration tests (or the DB trigger) can be asserted against a stable
 * spec, and to document the "one row per toggle" contract.
 */
type AuditRow = { scope: "department" | "job_title" | "user"; permission: string; action: "grant" | "revoke" };

function expectedAuditFromToggle(
  scope: AuditRow["scope"], perm: string, next: boolean,
): AuditRow {
  return { scope, permission: perm, action: next ? "grant" : "revoke" };
}

describe("audit entries — one row per toggle", () => {
  it("granting a dept permission logs a single grant row", () => {
    expect(expectedAuditFromToggle("department", "customers.view", true))
      .toEqual({ scope: "department", permission: "customers.view", action: "grant" });
  });

  it("revoking a job permission logs a single revoke row", () => {
    expect(expectedAuditFromToggle("job_title", "quotes.approve", false))
      .toEqual({ scope: "job_title", permission: "quotes.approve", action: "revoke" });
  });

  it("personal override toggles log against the user scope", () => {
    expect(expectedAuditFromToggle("user", "reports.view", true).scope).toBe("user");
    expect(expectedAuditFromToggle("user", "reports.view", false).scope).toBe("user");
  });

  it("simulating a full-revoke campaign across 3 sources → 3 audit rows in order", () => {
    const sequence = [
      expectedAuditFromToggle("user", "quotes.approve", false),
      expectedAuditFromToggle("job_title", "quotes.approve", false),
      expectedAuditFromToggle("department", "quotes.approve", false),
    ];
    expect(sequence.map((r) => r.scope)).toEqual(["user", "job_title", "department"]);
    expect(sequence.every((r) => r.action === "revoke")).toBe(true);
    expect(new Set(sequence.map((r) => r.permission))).toEqual(new Set(["quotes.approve"]));
  });
});
