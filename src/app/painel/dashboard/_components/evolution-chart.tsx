import { formatCurrency, formatPercent, pctOf } from "@/lib/format";
import { formatMonthLabel } from "@/lib/months";
import type { MonthFigures } from "../data";

const W = 720;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 80 };
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function compactBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return `R$ ${Math.round(value)}`;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= value) return m * step;
  return 10 * step;
}

/**
 * Monthly revenue bars (realizado) with a target tick (meta) per month, January–December.
 * Hovering a month shows its figures through the native SVG tooltip.
 */
export function EvolutionChart({
  months,
  selectedMonthKey,
}: {
  /** Twelve entries, January first. */
  months: { key: string; figures: MonthFigures }[];
  selectedMonthKey: string;
}) {
  const maxValue = niceMax(
    Math.max(0, ...months.flatMap((m) => [m.figures.actual ?? 0, m.figures.target ?? 0])) * 1.05,
  );
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / months.length;
  const barW = Math.min(30, slot * 0.55);
  const y = (v: number) => PAD.top + plotH - (v / maxValue) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxValue);

  return (
    <figure>
      {/* Below ~560px the axis text would shrink unreadably, so the chart scrolls sideways instead. */}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label="Faturamento realizado e meta por mês">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(7 45 105 / 0.1)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-soft font-mono text-[10px]">
                {compactBRL(t)}
              </text>
            </g>
          ))}
  
          {months.map((m, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const { actual, target } = m.figures;
            const isSelected = m.key === selectedMonthKey;
            const pct = actual != null && target ? pctOf(actual, target) : null;
            const tooltip = [
              formatMonthLabel(m.key),
              `Realizado: ${actual != null ? formatCurrency(actual) : "—"}`,
              `Meta: ${target != null ? formatCurrency(target) : "—"}`,
              pct != null ? `Atingimento: ${formatPercent(pct)}` : null,
            ]
              .filter(Boolean)
              .join("\n");
            const barTop = actual != null ? y(actual) : y(0);
            const barH = y(0) - barTop;
            return (
              <g key={m.key}>
                <title>{tooltip}</title>
                {/* Hit target wider than the bar. */}
                <rect x={cx - slot / 2} y={PAD.top} width={slot} height={plotH} fill="transparent" />
                {actual != null && barH > 0 ? (
                  <path
                    d={`M${cx - barW / 2},${y(0)} V${barTop + 4} Q${cx - barW / 2},${barTop} ${cx - barW / 2 + 4},${barTop} H${cx + barW / 2 - 4} Q${cx + barW / 2},${barTop} ${cx + barW / 2},${barTop + 4} V${y(0)} Z`}
                    fill="#072d69"
                    fillOpacity={isSelected ? 1 : 0.55}
                  />
                ) : null}
                {target != null ? (
                  <line
                    x1={cx - barW / 2 - 5}
                    x2={cx + barW / 2 + 5}
                    y1={y(target)}
                    y2={y(target)}
                    stroke="#b6763a"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                ) : null}
                <text
                  x={cx}
                  y={H - 10}
                  textAnchor="middle"
                  className={`font-mono text-[10px] ${isSelected ? "fill-navy font-semibold" : "fill-ink-soft"}`}
                >
                  {MONTH_SHORT[i]}
                </text>
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="rgb(7 45 105 / 0.35)" strokeWidth={1} />
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-navy" /> Realizado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-terracotta" /> Meta
        </span>
        <span>Passe o mouse sobre um mês para ver os valores.</span>
      </figcaption>
    </figure>
  );
}
