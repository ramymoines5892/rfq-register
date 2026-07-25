/**
 * Effective-permission resolver.
 *
 * ── Resolution rule ────────────────────────────────────────────────
 *   effective(user, perm) =
 *      admin_or_owner(user)            ← full bypass
 *   OR perm ∈ user.personal            ← personal override
 *   OR perm ∈ user.jobTitle            ← inherited from job title
 *   OR perm ∈ user.department          ← inherited from department
 *
 * Grants ONLY (no "deny"). Union across all four sources — the moment
 * one source grants a permission, it is granted. Removing a permission
 * from a single source does NOT block the user if another source still
 * grants it. To fully revoke, remove it from every source that grants
 * it (and never grant it as a personal override).
 * ──────────────────────────────────────────────────────────────────
 */

export type PermissionSource = "admin" | "personal" | "job" | "department";

export interface EffectiveInput {
  isAdminOrOwner?: boolean;
  personal?: Iterable<string>;
  job?: Iterable<string>;
  department?: Iterable<string>;
}

export interface EffectiveOutput {
  allowed: boolean;
  /** All sources that grant this permission (empty when not allowed). */
  sources: PermissionSource[];
  /** Highest-priority source, useful for UI badges. Priority: admin > personal > job > department. */
  primary: PermissionSource | null;
}

const PRIORITY: PermissionSource[] = ["admin", "personal", "job", "department"];

function toSet(v?: Iterable<string>): Set<string> {
  return v ? new Set(v) : new Set();
}

/** Resolve a single permission for a user. */
export function resolvePermission(perm: string, input: EffectiveInput): EffectiveOutput {
  const sources: PermissionSource[] = [];
  if (input.isAdminOrOwner) sources.push("admin");
  if (toSet(input.personal).has(perm)) sources.push("personal");
  if (toSet(input.job).has(perm)) sources.push("job");
  if (toSet(input.department).has(perm)) sources.push("department");
  const primary = PRIORITY.find((p) => sources.includes(p)) ?? null;
  return { allowed: sources.length > 0, sources, primary };
}

/** Resolve the full effective set for a user. */
export function resolveEffectiveSet(input: EffectiveInput): Set<string> {
  if (input.isAdminOrOwner) return new Set(["*"]); // sentinel meaning "everything"
  const out = new Set<string>();
  toSet(input.personal).forEach((p) => out.add(p));
  toSet(input.job).forEach((p) => out.add(p));
  toSet(input.department).forEach((p) => out.add(p));
  return out;
}

/** True when the user is allowed to perform `perm`. */
export function isAllowed(perm: string, input: EffectiveInput): boolean {
  return resolvePermission(perm, input).allowed;
}
