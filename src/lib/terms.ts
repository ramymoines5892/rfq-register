export type TermItem = {
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
};

export function emptyTerm(): TermItem {
  return { title_ar: "", title_en: "", body_ar: "", body_en: "" };
}

export function parseTerms(raw: string | null | undefined): TermItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => x && typeof x === "object")
        .map((x): TermItem => {
          // New bilingual shape
          if ("title_ar" in x || "title_en" in x || "body_ar" in x || "body_en" in x) {
            return {
              title_ar: String(x.title_ar ?? x.title ?? ""),
              title_en: String(x.title_en ?? x.title ?? ""),
              body_ar: String(x.body_ar ?? x.body ?? ""),
              body_en: String(x.body_en ?? x.body ?? ""),
            };
          }
          // Legacy {title, body}
          const title = String(x.title ?? "");
          const body = String(x.body ?? "");
          return {
            title_ar: title,
            title_en: title,
            body_ar: body,
            body_en: body,
          };
        });
    }
  } catch {
    // Legacy free-text — treat as a single body in both languages.
    const s = String(raw);
    return [{ title_ar: "", title_en: "", body_ar: s, body_en: s }];
  }
  return [];
}

export function stringifyTerms(items: TermItem[]): string | null {
  const cleaned = items
    .map((i) => ({
      title_ar: i.title_ar.trim(),
      title_en: i.title_en.trim(),
      body_ar: i.body_ar.trim(),
      body_en: i.body_en.trim(),
    }))
    .filter((i) => i.title_ar || i.title_en || i.body_ar || i.body_en);
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}

export function formatTermsPlain(items: TermItem[], lang: "ar" | "en" = "ar"): string {
  return items
    .map((i) => {
      const title = lang === "ar" ? i.title_ar || i.title_en : i.title_en || i.title_ar;
      const body = lang === "ar" ? i.body_ar || i.body_en : i.body_en || i.body_ar;
      return title ? `• ${title}: ${body}` : `• ${body}`;
    })
    .join("\n");
}

/** Bilingual payment-terms list: parallel arrays kept per language. */
export type BiListItem = { ar: string; en: string };

export function parseBiList(rawAr: string | null | undefined, rawEn: string | null | undefined): BiListItem[] {
  const ar = parseSingleList(rawAr);
  const en = parseSingleList(rawEn);
  const n = Math.max(ar.length, en.length);
  const out: BiListItem[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ ar: ar[i] ?? "", en: en[i] ?? "" });
  }
  return out;
}

function parseSingleList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function stringifyBiList(items: BiListItem[]): { ar: string | null; en: string | null } {
  const cleaned = items
    .map((i) => ({ ar: i.ar.trim(), en: i.en.trim() }))
    .filter((i) => i.ar || i.en);
  if (cleaned.length === 0) return { ar: null, en: null };
  return {
    ar: JSON.stringify(cleaned.map((i) => i.ar || i.en)),
    en: JSON.stringify(cleaned.map((i) => i.en || i.ar)),
  };
}

/** Back-compat: some legacy callers still expect parseList/stringifyList over a single column. */
export function parseList(raw: string | null | undefined): string[] {
  return parseSingleList(raw);
}
export function stringifyList(items: string[]): string | null {
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  return cleaned.length ? JSON.stringify(cleaned) : null;
}
