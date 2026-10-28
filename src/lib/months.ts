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

// Managers can still send the previous month's report up to this day of the next month,
// so the closed month gets its final numbers. Must match app_month_accepts_reports() in the DB.
const REPORT_GRACE_DAY = 5;
// Brazil has no DST, so a fixed offset gives the local (Natal/Mossoró) date.
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** True while managers may still send reports for `monthKey`: the current month, or the previous one until day 5. */
export function acceptsReports(monthKey: string): boolean {
  if (isCurrentMonth(monthKey)) return true;
  const local = new Date(Date.now() - BRAZIL_OFFSET_MS);
  const localKey = (offset: number) => {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + offset, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  };
  if (monthKey === localKey(0)) return true;
  return monthKey === localKey(-1) && local.getUTCDate() <= REPORT_GRACE_DAY;
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
