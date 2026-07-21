// Script-restricted text filters for bilingual inputs.
// Strips characters that don't belong to the target script, while allowing
// digits, whitespace, and common punctuation so users can still type numbers,
// separators, and symbols inside a company name or address.

const SHARED = /[0-9\s.,\-_&()'"/\\:;!?@#+*%$]/;
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN = /[A-Za-z]/;

export function filterArabic(input: string): string {
  return Array.from(input ?? "")
    .filter((ch) => ARABIC.test(ch) || SHARED.test(ch))
    .join("");
}

export function filterEnglish(input: string): string {
  return Array.from(input ?? "")
    .filter((ch) => LATIN.test(ch) || SHARED.test(ch))
    .join("");
}
