import type { UnitSummary, SellerRow, CampaignItemRow } from "../data";

function campTier(qty: number, target: number): "hit" | "mid" | "low" {
  const p = target ? (qty / target) * 100 : 0;
  if (p >= 100) return "hit";
  if (p >= 70) return "mid";
  return "low";
}

const CAMP_BADGE: Record<"hit" | "mid" | "low", string> = {
  hit: "bg-yellow/35 text-[#6b5400]",
  mid: "bg-seafoam/55 text-[#0a5245]",
  low: "bg-terracotta/20 text-[#7a4a1f]",
};
const CAMP_TEXT: Record<"hit" | "mid" | "low", string> = {
  hit: "text-yellow",
  mid: "text-[#0a5245]",
  low: "text-terracotta",
};

export function CampaignSection({
  units,
  sellers,
  campaignItems,
  campaignSales,
  selectedUnitId,
}: {
  monthKey: string;
  units: UnitSummary[];
  sellers: SellerRow[];
  campaignItems: CampaignItemRow[];
  campaignSales: Map<string, Map<string, number>>;
  selectedUnitId: string | null;
}) {
  function unitActual(unitId: string, itemId: string) {
    return sellers
      .filter((s) => s.unitId === unitId)
      .reduce((sum, s) => sum + (campaignSales.get(s.id)?.get(itemId) ?? 0), 0);
  }
  function unitSellerCount(unitId: string) {
    return sellers.filter((s) => s.unitId === unitId).length;
  }
  function itemAppliesToUnit(item: CampaignItemRow, unitId: string) {
    return item.unitId === null || item.unitId === unitId;
  }

  if (campaignItems.length === 0) {
    return (
      <section>
        <h2 className="font-serif text-xl font-semibold text-navy">Campanha de vendas do mês</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Nenhum item de campanha cadastrado para este mês.
        </p>
      </section>
    );
  }

  if (!selectedUnitId) {
    return (
      <section>
        <h2 className="font-serif text-xl font-semibold text-navy">Campanha de vendas do mês</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border-navy bg-white">
          <table className="w-full text-sm">
            <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-2">Produto</th>
                {units.map((u) => (
                  <th key={u.id} className="px-4 py-2 text-center">
                    {u.name}
                  </th>
                ))}
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {campaignItems.map((item) => {
                let totalQty = 0;
                let totalTarget = 0;
                return (
                  <tr key={item.id} className="border-t border-border-navy-soft">
                    <td className="px-4 py-2.5 font-medium text-ink">{item.name}</td>
                    {units.map((u) => {
                      if (!itemAppliesToUnit(item, u.id)) {
                        return (
                          <td key={u.id} className="px-4 py-2.5 text-center text-ink-soft">
                            —
                          </td>
                        );
                      }
                      const qty = unitActual(u.id, item.id);
                      const target = unitSellerCount(u.id) * item.targetPerSeller;
                      totalQty += qty;
                      totalTarget += target;
                      const tier = campTier(qty, target);
                      return (
                        <td key={u.id} className="px-4 py-2.5 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${CAMP_BADGE[tier]}`}
                          >
                            {qty}/{target}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {totalQty}/{totalTarget}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const unit = units.find((u) => u.id === selectedUnitId);
  const applicableItems = campaignItems.filter((item) => itemAppliesToUnit(item, selectedUnitId));
  const unitSellers = sellers.filter((s) => s.unitId === selectedUnitId);

  return (
    <section>
      <h2 className="font-serif text-xl font-semibold text-navy">
        Campanha de vendas — {unit?.name}
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {applicableItems.map((item) => {
          const qty = unitActual(selectedUnitId, item.id);
          const target = unitSellers.length * item.targetPerSeller;
          const tier = campTier(qty, target);
          return (
            <div key={item.id} className="rounded-lg border border-border-navy bg-white p-4">
              <p className="text-sm font-medium text-ink">{item.name}</p>
              <p className={`mt-1 font-mono text-lg font-semibold ${CAMP_TEXT[tier]}`}>
                {qty}/{target}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border-navy bg-white">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-2">Vendedor</th>
              {applicableItems.map((item) => (
                <th key={item.id} className="px-4 py-2 text-center">
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {unitSellers.map((s) => (
              <tr key={s.id} className="border-t border-border-navy-soft">
                <td className="px-4 py-2.5 font-medium text-ink">{s.name}</td>
                {applicableItems.map((item) => (
                  <td key={item.id} className="px-4 py-2.5 text-center font-mono">
                    {campaignSales.get(s.id)?.get(item.id) ?? 0}
                  </td>
                ))}
              </tr>
            ))}
            {unitSellers.length === 0 ? (
              <tr>
                <td
                  colSpan={applicableItems.length + 1}
                  className="px-4 py-6 text-center text-sm text-ink-soft"
                >
                  Nenhum vendedor cadastrado nesta unidade.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
