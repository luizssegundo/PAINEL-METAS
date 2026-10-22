import { createClient } from "@/lib/supabase/server";
import type { ViewerUnit } from "@/lib/viewer";

const NIL_ID = "00000000-0000-0000-0000-000000000000";

/** Month key ("2026-08-01") shifted by `delta` months. */
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export type MonthFigures = { actual: number | null; target: number | null };

export type UnitYearSeries = {
  id: string;
  name: string;
  /** Keyed by month key; only months with data are present. */
  byMonth: Map<string, MonthFigures>;
};

/**
 * Revenue actuals and targets per unit from December of the previous year (so January
 * can compare against its previous month) through December of `year`.
 */
export async function loadYearSeries(year: number, units: ViewerUnit[]): Promise<UnitYearSeries[]> {
  const supabase = await createClient();
  const unitIds = units.length ? units.map((u) => u.id) : [NIL_ID];
  const from = `${year - 1}-12-01`;
  const to = `${year}-12-01`;

  const [{ data: actuals }, { data: targets }] = await Promise.all([
    supabase
      .from("unit_revenue_actuals")
      .select("unit_id, ref_month, actual_amount")
      .in("unit_id", unitIds)
      .gte("ref_month", from)
      .lte("ref_month", to),
    supabase
      .from("unit_revenue_targets")
      .select("unit_id, ref_month, target_amount")
      .in("unit_id", unitIds)
      .gte("ref_month", from)
      .lte("ref_month", to),
  ]);

  const series = new Map<string, UnitYearSeries>(
    units.map((u) => [u.id, { id: u.id, name: u.name, byMonth: new Map() }]),
  );
  const cell = (unitId: string, monthKey: string): MonthFigures | null => {
    const s = series.get(unitId);
    if (!s) return null;
    if (!s.byMonth.has(monthKey)) s.byMonth.set(monthKey, { actual: null, target: null });
    return s.byMonth.get(monthKey)!;
  };
  for (const a of actuals ?? []) {
    const c = cell(a.unit_id, a.ref_month);
    if (c) c.actual = Number(a.actual_amount);
  }
  for (const t of targets ?? []) {
    const c = cell(t.unit_id, t.ref_month);
    if (c) c.target = Number(t.target_amount);
  }
  return [...series.values()];
}

/** Sum of actuals/targets across units for one month; null when no unit has the figure. */
export function sumMonth(series: UnitYearSeries[], monthKey: string): MonthFigures {
  let actual: number | null = null;
  let target: number | null = null;
  for (const s of series) {
    const m = s.byMonth.get(monthKey);
    if (m?.actual != null) actual = (actual ?? 0) + m.actual;
    if (m?.target != null) target = (target ?? 0) + m.target;
  }
  return { actual, target };
}
