const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export type MonthOption = { key: string; label: string };

/** First-of-month date key, e.g. "2026-08-01", based on the server clock. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function isCurrentMonth(monthKey: string): boolean {
  return monthKey === currentMonthKey();
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]}/${year}`;
}

/** Last `count` months (oldest first), ending on the current month. */
export function recentMonths(count = 6): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    options.push({ key, label: formatMonthLabel(key) });
  }
  return options;
}
