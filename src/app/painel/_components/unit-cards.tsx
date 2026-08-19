import Link from "next/link";
import { formatCurrency, formatPercent, tierFromPercent, TIER_CLASSES } from "@/lib/format";
import type { UnitSummary } from "../data";

export function UnitCards({
  units,
  monthKey,
  selectedUnitId,
}: {
  units: UnitSummary[];
  monthKey: string;
  selectedUnitId: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {units.map((u) => {
        const tier = tierFromPercent(u.pct);
        const isSelected = u.id === selectedUnitId;
        const href = isSelected
          ? `/painel?mes=${monthKey}`
          : `/painel?mes=${monthKey}&unidade=${u.id}`;
        return (
          <Link
            key={u.id}
            href={href}
            className={`rounded-lg border-t-[3px] border-navy bg-white p-4 shadow-sm transition ${
              isSelected ? "ring-2 ring-navy" : "hover:shadow-md"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-serif font-semibold text-navy">{u.name}</p>
                <p className="text-xs text-ink-soft">{u.location}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_CLASSES[tier].badge}`}
              >
                {formatPercent(u.pct)}
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border-navy-soft">
              <div
                className={`h-full ${TIER_CLASSES[tier].bar}`}
                style={{ width: `${Math.min(100, u.pct)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-soft">
              <span>Realizado: {formatCurrency(u.actual)}</span>
              <span>Meta: {formatCurrency(u.target)}</span>
            </div>
          </Link>
        );
      })}
      {units.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhuma unidade liberada para o seu usuário.</p>
      ) : null}
    </div>
  );
}
