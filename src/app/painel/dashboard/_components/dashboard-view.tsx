import Link from "next/link";
import { formatMonthLabel, isCurrentMonth } from "@/lib/months";
import { formatCurrency, formatPercent, pctOf, tierFromPercent, TIER_CLASSES } from "@/lib/format";
import { shiftMonth, sumMonth, type MonthFigures, type UnitYearSeries } from "../data";
import { EvolutionChart } from "./evolution-chart";
import { AttainmentGrid, type AttainmentRow } from "./attainment-grid";

function variation(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function VariationBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-soft">—</span>;
  const up = value >= 0;
  return (
    <span className={`font-mono font-semibold ${up ? "text-[#0a5245]" : "text-[#7a4a1f]"}`}>
      {up ? "▲" : "▼"} {formatPercent(Math.abs(value))}
    </span>
  );
}

/** Year-to-date sums over the months (Jan..selected) that already have a realizado. */
function yearToDate(series: UnitYearSeries[], monthKeys: string[]): MonthFigures {
  let actual: number | null = null;
  let target: number | null = null;
  for (const key of monthKeys) {
    for (const s of series) {
      const m = s.byMonth.get(key);
      if (m?.actual == null) continue;
      actual = (actual ?? 0) + m.actual;
      if (m.target != null) target = (target ?? 0) + m.target;
    }
  }
  return { actual, target };
}

export function DashboardView({
  allSeries,
  monthKey,
  selectedUnitId,
}: {
  allSeries: UnitYearSeries[];
  monthKey: string;
  selectedUnitId: string | null;
}) {
  const year = Number(monthKey.slice(0, 4));
  const prevMonthKey = shiftMonth(monthKey, -1);
  const partial = isCurrentMonth(monthKey);
  const multiUnit = allSeries.length > 1;
  const selected = allSeries.find((s) => s.id === selectedUnitId) ?? null;
  const scope = selected ? [selected] : allSeries;
  const scopeLabel = selected ? selected.name : multiUnit ? "Todas as unidades" : allSeries[0].name;

  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
  const monthsToDate = yearMonths.filter((k) => k <= monthKey);

  const current = sumMonth(scope, monthKey);
  const previous = sumMonth(scope, prevMonthKey);
  const ytd = yearToDate(scope, monthsToDate);
  const pctMonth = current.actual != null && current.target ? pctOf(current.actual, current.target) : null;
  const pctYtd = ytd.actual != null && ytd.target ? pctOf(ytd.actual, ytd.target) : null;
  const unitsOnTarget = allSeries.filter((s) => {
    const m = s.byMonth.get(monthKey);
    return m?.actual != null && m.target && m.actual >= m.target;
  }).length;
  const unitsWithTarget = allSeries.filter((s) => s.byMonth.get(monthKey)?.target).length;

  // The grid shows every month up to the last one with data (and at least up to the selected month).
  const lastDataMonth = yearMonths.filter((k) => allSeries.some((s) => s.byMonth.get(k)?.actual != null)).pop() ?? monthKey;
  const gridMonths = yearMonths.filter((k) => k <= (lastDataMonth > monthKey ? lastDataMonth : monthKey));
  const gridRows: AttainmentRow[] = allSeries.map((s) => ({
    id: s.id,
    name: s.name,
    months: gridMonths.map((k) => s.byMonth.get(k) ?? { actual: null, target: null }),
    ytd: yearToDate([s], monthsToDate),
  }));
  if (allSeries.length > 1) {
    gridRows.push({
      id: "grupo",
      name: "Grupo",
      months: gridMonths.map((k) => sumMonth(allSeries, k)),
      ytd: yearToDate(allSeries, monthsToDate),
    });
  }

  const unitHref = (id: string | null) => (id ? `/painel/dashboard?mes=${monthKey}&unidade=${id}` : `/painel/dashboard?mes=${monthKey}`);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-serif text-3xl font-semibold text-navy">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {scopeLabel} — {formatMonthLabel(monthKey)} comparado a {formatMonthLabel(prevMonthKey)}
          {partial ? " · mês em andamento, valores parciais" : ""}
        </p>

        {multiUnit ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={unitHref(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${!selected ? "bg-navy text-white" : "border border-border-navy bg-white text-navy"}`}
            >
              Todas
            </Link>
            {allSeries.map((s) => (
              <Link
                key={s.id}
                href={unitHref(s.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${selected?.id === s.id ? "bg-navy text-white" : "border border-border-navy bg-white text-navy"}`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border-navy bg-white p-5">
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">Realizado no mês</p>
            <p className="mt-1 font-serif text-[26px] font-semibold text-navy">
              {current.actual != null ? formatCurrency(current.actual) : "—"}
            </p>
            <p className="text-xs text-ink-soft">
              {formatMonthLabel(prevMonthKey)}: {previous.actual != null ? formatCurrency(previous.actual) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border-navy bg-white p-5">
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">Variação vs mês anterior</p>
            <p className="mt-1 font-serif text-[26px] font-semibold">
              <VariationBadge value={variation(current.actual, previous.actual)} />
            </p>
            <p className="text-xs text-ink-soft">
              {current.actual != null && previous.actual != null
                ? `${current.actual >= previous.actual ? "+" : "−"} ${formatCurrency(Math.abs(current.actual - previous.actual))}`
                : "Sem dados para comparar"}
            </p>
          </div>
          <div className="rounded-lg border border-border-navy bg-white p-5">
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">Atingimento da meta</p>
            <p className={`mt-1 font-serif text-[26px] font-semibold ${pctMonth != null && pctMonth >= 100 ? "text-[#6b5400]" : "text-navy"}`}>
              {pctMonth != null ? formatPercent(pctMonth) : "—"}
            </p>
            <p className="text-xs text-ink-soft">Meta: {current.target != null ? formatCurrency(current.target) : "não cadastrada"}</p>
          </div>
          <div className="rounded-lg border border-border-navy bg-white p-5">
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">Acumulado do ano</p>
            <p className={`mt-1 font-serif text-[26px] font-semibold ${pctYtd != null && pctYtd >= 100 ? "text-[#6b5400]" : "text-navy"}`}>
              {pctYtd != null ? formatPercent(pctYtd) : "—"}
            </p>
            <p className="text-xs text-ink-soft">
              {ytd.actual != null ? formatCurrency(ytd.actual) : "—"} de {ytd.target != null ? formatCurrency(ytd.target) : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold text-navy">Mês atual x mês anterior</h2>
          {multiUnit ? (
            <p className="text-xs text-ink-soft">
              Unidades na meta em {formatMonthLabel(monthKey)}: <span className="font-semibold text-ink">{unitsOnTarget} / {unitsWithTarget}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2">Unidade</th>
                <th className="px-3 py-2 text-right">{formatMonthLabel(prevMonthKey)}</th>
                <th className="px-3 py-2 text-right">{formatMonthLabel(monthKey)}</th>
                <th className="px-3 py-2 text-right">Variação</th>
                <th className="px-3 py-2 text-right">Meta</th>
                <th className="px-3 py-2">% da meta</th>
              </tr>
            </thead>
            <tbody>
              {allSeries.map((s) => {
                const cur = s.byMonth.get(monthKey) ?? { actual: null, target: null };
                const prev = s.byMonth.get(prevMonthKey) ?? { actual: null, target: null };
                const pct = cur.actual != null && cur.target ? pctOf(cur.actual, cur.target) : null;
                const tier = pct != null ? tierFromPercent(pct) : null;
                return (
                  <tr key={s.id} className={`border-t border-border-navy-soft ${selected?.id === s.id ? "bg-table-head/60" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                      <Link href={unitHref(selected?.id === s.id ? null : s.id)} className="hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-ink-soft">{prev.actual != null ? formatCurrency(prev.actual) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-ink">{cur.actual != null ? formatCurrency(cur.actual) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <VariationBadge value={variation(cur.actual, prev.actual)} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-ink-soft">{cur.target != null ? formatCurrency(cur.target) : "—"}</td>
                    <td className="px-3 py-2.5">
                      {pct != null && tier ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border-navy-soft">
                            <div className={`h-full ${TIER_CLASSES[tier].bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${TIER_CLASSES[tier].badge}`}>
                            {formatPercent(pct)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-xl font-semibold text-navy">Evolução em {year} — {scopeLabel}</h2>
        <p className="mb-3 mt-1 text-xs text-ink-soft">Faturamento realizado por mês e a meta de cada mês.</p>
        <EvolutionChart
          months={yearMonths.map((k) => ({ key: k, figures: sumMonth(scope, k) }))}
          selectedMonthKey={monthKey}
        />
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-xl font-semibold text-navy">Atingimento da meta — {year}</h2>
        <p className="mb-3 mt-1 text-xs text-ink-soft">Quanto % da meta cada unidade conseguiu em cada mês.</p>
        <AttainmentGrid rows={gridRows} monthKeys={gridMonths} partialMonthKey={gridMonths.find((k) => isCurrentMonth(k)) ?? null} />
      </section>
    </div>
  );
}
