/**
 * Cross-domain type primitives.
 *
 * Modules should extend these instead of redeclaring their own
 * Id / timestamp shapes.
 */

import type { Database } from "@/integrations/supabase/types";

/** UUID string. Nominal alias for readability at call sites. */
export type Id = string;

/** ISO-8601 timestamp string as returned by Supabase. */
export type IsoTimestamp = string;

export interface Timestamped {
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
}

export interface OwnedByUser {
  owner_id: Id;
}

export interface CompanyScoped {
  company_id: Id;
}

export interface BranchScoped {
  branch_id: Id | null;
}

/** Generic paginated response envelope. */
export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Discriminated union for service returns where you want to preserve errors. */
export type ApiResult<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/** Convenience: shorthand for a public-schema row type. */
export type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Convenience: shorthand for a public-schema insert type. */
export type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/** Convenience: shorthand for a public-schema update type. */
export type Update<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Enum shorthand. */
export type Enum<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
