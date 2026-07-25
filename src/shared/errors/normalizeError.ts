/**
 * Centralized error normalization.
 *
 * Every thrown value (Supabase PostgrestError, native Error, string,
 * unknown object) is coerced into a stable `AppError` shape so callers
 * — toasts, logs, error boundaries — can rely on `message` and `code`.
 */

export type AppErrorCode =
  | "unknown"
  | "network"
  | "auth"
  | "permission"
  | "validation"
  | "not_found"
  | "conflict"
  | "server";

export interface AppError {
  code: AppErrorCode;
  message: string;
  /** Original error, useful for logging / debugging. */
  cause?: unknown;
  /** Optional field-level details (e.g. from zod). */
  details?: Record<string, string>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function mapPostgrestCode(pgCode?: string): AppErrorCode {
  if (!pgCode) return "server";
  // https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (pgCode === "23505") return "conflict";       // unique_violation
  if (pgCode === "23503") return "conflict";       // foreign_key_violation
  if (pgCode === "23502" || pgCode === "23514") return "validation";
  if (pgCode === "42501") return "permission";     // insufficient_privilege
  if (pgCode === "PGRST116") return "not_found";
  if (pgCode.startsWith("PGRST")) return "server";
  return "server";
}

export function normalizeError(err: unknown): AppError {
  if (err == null) {
    return { code: "unknown", message: "حدث خطأ غير متوقع" };
  }

  if (typeof err === "string") {
    return { code: "unknown", message: err };
  }

  if (isRecord(err)) {
    // Supabase PostgrestError shape
    const anyErr = err as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
      status?: number;
      name?: string;
    };

    // Auth errors
    if (anyErr.name === "AuthApiError" || anyErr.status === 401) {
      return { code: "auth", message: anyErr.message ?? "Unauthorized", cause: err };
    }

    if (anyErr.code) {
      return {
        code: mapPostgrestCode(anyErr.code),
        message: anyErr.message ?? anyErr.details ?? "Server error",
        cause: err,
      };
    }

    if (anyErr.message) {
      return { code: "unknown", message: anyErr.message, cause: err };
    }
  }

  return { code: "unknown", message: "حدث خطأ غير متوقع", cause: err };
}

/** Convenience: extract a user-safe message from any thrown value. */
export function errorMessage(err: unknown): string {
  return normalizeError(err).message;
}
