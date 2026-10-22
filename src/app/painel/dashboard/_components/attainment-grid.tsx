import { formatCurrency, formatPercent, pctOf, tierFromPercent, TIER_CLASSES } from "@/lib/format";
import { formatMonthLabel } from "@/lib/months";
import type { MonthFigures } from "../data";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type AttainmentRow = {
  id: string;
  name: string;
  /** One entry per displayed month, same order as `monthKeys`. */
  months: MonthFigures[];
  ytd: MonthFigures;
};

function Cell({ figures, label, className = "" }: { figures: MonthFigures; label: string; className?: string }) {
  const { actual, target } = figures;
  if (actual == null || !target) {
    return (
      <td className={`px-1.5 py-1.5 text-center font-mono text-[11px] text-ink-soft/60 ${className}`} title={`${label}: sem dados`}>
        —
      </td>
    );
  }
  const pct = pctOf(actual, target);
  const tier = tierFromPercent(pct);
  return (
    <td className={`px-1 py-1 text-center ${className}`}>
      <span
        className={`block rounded px-1 py-1 font-mono text-[11px] font-semibold ${TIER_CLASSES[tier].badge}`}
        title={`${label}\nRealizado: ${formatCurrency(actual)}\nMeta: ${formatCurrency(target)}`}
      >
        {formatPercent(pct)}
      </span>
    </td>
  );
}

/** Units × months grid of "% da meta", plus the year-to-date column. */
export function AttainmentGrid({
  rows,
  monthKeys,
  partialMonthKey,
}: {
  rows: AttainmentRow[];
  monthKeys: string[];
  /** The month still in progress, flagged so its low % isn't read as a miss. */
  partialMonthKey: string | null;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-2 py-2 text-left">Unidade</th>
              {monthKeys.map((k) => (
                <th key={k} className="px-1 py-2 text-center">
                  {MONTH_SHORT[Number(k.slice(5, 7)) - 1]}
                  {k === partialMonthKey ? "*" : ""}
                </th>
              ))}
              <th className="border-l border-border-navy px-2 py-2 text-center">Ano</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === "grupo" ? "border-t-2 border-border-navy" : "border-t border-border-navy-soft"}>
                <td className={`whitespace-nowrap px-2 py-1.5 text-ink ${r.id === "grupo" ? "font-semibold" : "font-medium"}`}>{r.name}</td>
                {r.months.map((m, i) => (
                  <Cell key={monthKeys[i]} figures={m} label={`${r.name} — ${formatMonthLabel(monthKeys[i])}`} />
                ))}
                <Cell figures={r.ytd} label={`${r.name} — acumulado do ano`} className="border-l border-border-navy" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block rounded px-1.5 font-mono text-[10px] font-semibold ${TIER_CLASSES.hit.badge}`}>≥100%</span>
          Bateu a meta
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-block rounded px-1.5 font-mono text-[10px] font-semibold ${TIER_CLASSES.mid.badge}`}>80–99%</span>
          Perto da meta
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-block rounded px-1.5 font-mono text-[10px] font-semibold ${TIER_CLASSES.low.badge}`}>&lt;80%</span>
          Abaixo de 80%
        </span>
        <span>“Ano” = acumulado de janeiro até o mês selecionado.</span>
        {partialMonthKey && monthKeys.includes(partialMonthKey) ? <span>* Mês em andamento: valores parciais.</span> : null}
      </div>
    </div>
  );
}
