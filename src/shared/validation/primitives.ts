/**
 * Shared zod primitives for bilingual + business validation.
 *
 * Reuses existing text filters and country formats so all modules
 * validate the same way.
 */

import { z } from "zod";
import { hasNonArabic, hasNonEnglish } from "@/lib/textFilters";

const isArabic = (v: string) => v.length === 0 || !hasNonArabic(v);
const isEnglish = (v: string) => v.length === 0 || !hasNonEnglish(v);

const trim = (s: string) => s.trim();

export const nonEmpty = (msg = "مطلوب") =>
  z
    .string()
    .transform(trim)
    .refine((v) => v.length > 0, msg);

export const arabicName = (opts?: { min?: number; max?: number }) =>
  z
    .string()
    .transform(trim)
    .refine((v) => v.length >= (opts?.min ?? 2), "قصير جدًا")
    .refine((v) => v.length <= (opts?.max ?? 120), "طويل جدًا")
    .refine((v) => isArabic(v), "يجب أن يكون بالعربية فقط");

export const englishName = (opts?: { min?: number; max?: number }) =>
  z
    .string()
    .transform(trim)
    .refine((v) => v.length >= (opts?.min ?? 2), "Too short")
    .refine((v) => v.length <= (opts?.max ?? 120), "Too long")
    .refine((v) => isEnglish(v), "English characters only");

export const email = () =>
  z.string().transform(trim).pipe(z.string().email("بريد إلكتروني غير صالح"));

export const optionalEmail = () =>
  z
    .string()
    .transform(trim)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "بريد إلكتروني غير صالح")
    .transform((v) => (v === "" ? null : v))
    .nullable();

/** Loose international phone: digits, spaces, +, -, parentheses; 6–20 chars. */
export const phone = () =>
  z
    .string()
    .transform(trim)
    .refine((v) => /^[+\d][\d\s\-()]{5,19}$/.test(v), "رقم هاتف غير صالح");

export const optionalPhone = () =>
  z
    .string()
    .transform(trim)
    .refine((v) => v === "" || /^[+\d][\d\s\-()]{5,19}$/.test(v), "رقم هاتف غير صالح")
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const url = () =>
  z.string().transform(trim).pipe(z.string().url("رابط غير صالح"));

/** Egyptian national ID (14 digits) — extend per country as needed. */
export const nationalIdEG = () =>
  z
    .string()
    .transform(trim)
    .refine((v) => /^\d{14}$/.test(v), "الرقم القومي يجب أن يكون 14 رقمًا");

export const uuid = () => z.string().uuid("معرّف غير صالح");

export const positiveInt = (msg = "قيمة غير صالحة") =>
  z.coerce.number().int().positive(msg);

export const nonNegativeNumber = (msg = "قيمة غير صالحة") =>
  z.coerce.number().min(0, msg);
