const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/** Lowercase, accent-stripped, whitespace-collapsed form used to match free-text names loosely. */
export function normalizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
