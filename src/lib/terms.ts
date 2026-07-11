export type TermItem = { title: string; body: string };

export function parseTerms(raw: string | null | undefined): TermItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => x && typeof x === "object")
        .map((x) => ({ title: String(x.title ?? ""), body: String(x.body ?? "") }));
    }
  } catch {
    // legacy free text — treat as single item
  }
  return [{ title: "", body: String(raw) }];
}

export function stringifyTerms(items: TermItem[]): string | null {
  const cleaned = items
    .map((i) => ({ title: i.title.trim(), body: i.body.trim() }))
    .filter((i) => i.title || i.body);
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}

export function formatTermsPlain(items: TermItem[]): string {
  return items
    .map((i) => (i.title ? `• ${i.title}: ${i.body}` : `• ${i.body}`))
    .join("\n");
}

export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    // legacy free text: split by commas / newlines
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function stringifyList(items: string[]): string | null {
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  return cleaned.length ? JSON.stringify(cleaned) : null;
}

