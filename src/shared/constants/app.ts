/**
 * App-wide constants. Any hardcoded literal used in more than one
 * module belongs here (or in a module-specific constants file if
 * the value is only meaningful inside that module).
 */

export const APP_NAME = "EEC ERP";

/** Default page size for paginated tables. */
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Debounce (ms) for search-as-you-type inputs. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Standard TanStack Query stale times. */
export const STALE_TIME = {
  short: 30_000,        // 30s — live-ish lists
  medium: 5 * 60_000,   // 5m — reference data
  long: 30 * 60_000,    // 30m — settings / lookups
} as const;

/** Supported locales in the UI. */
export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
