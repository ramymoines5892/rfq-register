/**
 * Centralized notification helpers.
 *
 * All modules should call these instead of importing `sonner` directly,
 * so we can swap the underlying toast library or add telemetry in one place.
 */

import { toast } from "sonner";
import { normalizeError } from "@/shared/errors/normalizeError";

export const notify = {
  success(message: string, description?: string) {
    return toast.success(message, description ? { description } : undefined);
  },
  info(message: string, description?: string) {
    return toast(message, description ? { description } : undefined);
  },
  warning(message: string, description?: string) {
    return toast.warning(message, description ? { description } : undefined);
  },
  error(err: unknown, fallback = "حدث خطأ") {
    const { message } = normalizeError(err);
    return toast.error(fallback, { description: message });
  },
  /**
   * Wrap an async operation with automatic loading + success/error toasts.
   * Usage:
   *   await notify.promise(saveThing(), { loading: "...", success: "..." });
   */
  promise<T>(
    p: Promise<T>,
    opts: { loading: string; success: string; error?: string }
  ): Promise<T> {
    toast.promise(p, {
      loading: opts.loading,
      success: opts.success,
      error: (e) => normalizeError(e).message || opts.error || "حدث خطأ",
    });
    return p;
  },
};
