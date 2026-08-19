import Link from "next/link";
import { TIER_CLASSES, type Tier } from "@/lib/format";
import type { SellerRow } from "../data";

function tierByRank(i: number, n: number): Tier {
  if (i < Math.ceil(n / 3)) return "hit";
  if (i < Math.ceil((2 * n) / 3)) return "mid";
  return "low";
}

export function RankingSection({
  monthKey,
  categories,
  sellers,
  categorySales,
  selectedUnitId,
  selectedCategoryId,
}: {
  monthKey: string;
  categories: { id: string; name: string }[];
  sellers: SellerRow[];
  categorySales: Map<string, Map<string, number>>;
  selectedUnitId: string | null;
  selectedCategoryId: string;
}) {
  const filteredSellers = selectedUnitId
    ? sellers.filter((s) => s.unitId === selectedUnitId)
    : sellers;

  const rows = filteredSellers
    .map((s) => {
      const sales = categorySales.get(s.id);
      const items =
        selectedCategoryId === "all"
          ? Array.from(sales?.values() ?? []).reduce((a, b) => a + b, 0)
          : (sales?.get(selectedCategoryId) ?? 0);
      return { ...s, items };
    })
    .sort((a, b) => b.items - a.items);

  const maxItems = rows.length ? rows[0].items : 0;

  function chipHref(catId: string) {
    const params = new URLSearchParams();
    params.set("mes", monthKey);
    if (selectedUnitId) params.set("unidade", selectedUnitId);
    if (catId !== "all") params.set("categoria", catId);
    return `/painel?${params.toString()}`;
  }

  return (
    <section>
      <h2 className="font-serif text-xl font-semibold text-navy">Ranking de vendedores</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={chipHref("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            selectedCategoryId === "all"
              ? "bg-navy text-white"
              : "border border-border-navy bg-white text-navy"
          }`}
        >
          Todos
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={chipHref(c.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectedCategoryId === c.id
                ? "bg-navy text-white"
                : "border border-border-navy bg-white text-navy"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border-navy bg-white">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="w-12 px-4 py-2">#</th>
              <th className="px-4 py-2">Vendedor</th>
              <th className="px-4 py-2">Volume</th>
              <th className="px-4 py-2 text-right">Itens</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tier = tierByRank(i, rows.length);
              return (
                <tr key={r.id} className="border-t border-border-navy-soft">
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${TIER_CLASSES[tier].badge}`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{r.name}</p>
                    {!selectedUnitId ? <p className="text-xs text-ink-soft">{r.unitName}</p> : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-border-navy-soft">
                      <div
                        className={`h-full ${TIER_CLASSES[tier].bar}`}
                        style={{ width: `${maxItems ? (r.items / maxItems) * 100 : 0}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{r.items}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-soft">
                  Nenhum dado de vendas lançado para este mês ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
