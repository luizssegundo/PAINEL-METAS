import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey, formatMonthLabel, isCurrentMonth } from "@/lib/months";
import { formatCurrency } from "@/lib/format";
import { upsertRevenueActual, saveCategorySales, saveCampaignSales } from "./actions";

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const monthKey = sp.mes ?? currentMonthKey();
  const readOnly = !isCurrentMonth(monthKey);

  const viewer = await requireViewer();
  const editableUnits = viewer.units.filter((u) => u.canEdit);
  const unitId = sp.unidade ?? editableUnits[0]?.id ?? viewer.units[0]?.id;
  const unit = viewer.units.find((u) => u.id === unitId);
  const canEditUnit = Boolean(unit?.canEdit) && !readOnly;

  if (!unit) {
    return <p className="text-sm text-ink-soft">Nenhuma unidade disponível para lançamento.</p>;
  }

  const supabase = await createClient();

  const [{ data: actual }, { data: categories }, { data: sellers }, { data: globalItems }, { data: unitItems }] =
    await Promise.all([
      supabase
        .from("unit_revenue_actuals")
        .select("actual_amount")
        .eq("unit_id", unit.id)
        .eq("ref_month", monthKey)
        .maybeSingle(),
      supabase.from("product_categories").select("id, name, sort_order").order("sort_order"),
      supabase.from("sellers").select("id, name").eq("unit_id", unit.id).eq("active", true).order("name"),
      supabase
        .from("campaign_items")
        .select("id, name, target_per_seller")
        .eq("ref_month", monthKey)
        .eq("active", true)
        .is("unit_id", null),
      supabase
        .from("campaign_items")
        .select("id, name, target_per_seller")
        .eq("ref_month", monthKey)
        .eq("active", true)
        .eq("unit_id", unit.id),
    ]);

  const campaignItems = [...(globalItems ?? []), ...(unitItems ?? [])];
  const sellerIds = (sellers ?? []).map((s) => s.id);

  const { data: catSalesRows } =
    sellerIds.length && categories?.length
      ? await supabase
          .from("seller_category_sales")
          .select("seller_id, category_id, items_sold")
          .eq("ref_month", monthKey)
          .in("seller_id", sellerIds)
      : { data: [] };
  const catSalesMap = new Map(
    (catSalesRows ?? []).map((r) => [`${r.seller_id}__${r.category_id}`, r.items_sold]),
  );

  const { data: campSalesRows } =
    sellerIds.length && campaignItems.length
      ? await supabase
          .from("seller_campaign_sales")
          .select("seller_id, campaign_item_id, qty_sold")
          .in("seller_id", sellerIds)
          .in(
            "campaign_item_id",
            campaignItems.map((c) => c.id),
          )
      : { data: [] };
  const campSalesMap = new Map(
    (campSalesRows ?? []).map((r) => [`${r.seller_id}__${r.campaign_item_id}`, r.qty_sold]),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">
          Lançamento manual — use apenas enquanto a integração com o ERP/PDV não está ativa.
        </p>
        <div className="flex flex-wrap gap-2">
          {viewer.units.map((u) => (
            <Link
              key={u.id}
              href={`/painel/administracao/lancamentos?mes=${monthKey}&unidade=${u.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                u.id === unit.id ? "bg-navy text-white" : "border border-border-navy bg-white text-navy"
              }`}
            >
              {u.name}
            </Link>
          ))}
        </div>
      </div>

      {readOnly ? (
        <span className="inline-block rounded-full bg-seafoam px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-navy">
          Somente consulta — {formatMonthLabel(monthKey)}
        </span>
      ) : null}

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Faturamento realizado</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Valor atual: <span className="font-mono">{formatCurrency(Number(actual?.actual_amount ?? 0))}</span>
        </p>
        {canEditUnit ? (
          <form action={upsertRevenueActual} className="mt-3 flex items-end gap-3">
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="refMonth" value={monthKey} />
            <div>
              <label className="block text-xs text-ink-soft">Novo valor realizado</label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                required
                className="mt-1 w-48 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <button type="submit" className="rounded-md bg-yellow px-4 py-1.5 text-sm font-bold text-navy">
              Salvar
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Itens vendidos por categoria</h2>
        <form action={saveCategorySales} className="mt-3">
          <input type="hidden" name="refMonth" value={monthKey} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Vendedor</th>
                  {(categories ?? []).map((c) => (
                    <th key={c.id} className="px-3 py-2 text-center">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sellers ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border-navy-soft">
                    <td className="px-3 py-2 font-medium text-ink">{s.name}</td>
                    {(categories ?? []).map((c) => (
                      <td key={c.id} className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          name={`qty__${s.id}__${c.id}`}
                          defaultValue={catSalesMap.get(`${s.id}__${c.id}`) ?? 0}
                          disabled={!canEditUnit}
                          className="w-16 rounded-md border border-border-navy px-1.5 py-1 text-center text-sm disabled:bg-table-head"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {(sellers ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={(categories ?? []).length + 1} className="px-3 py-4 text-center text-ink-soft">
                      Nenhum vendedor cadastrado nesta unidade.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {canEditUnit && (sellers ?? []).length > 0 ? (
            <button
              type="submit"
              className="mt-3 rounded-md bg-navy px-4 py-1.5 text-sm font-semibold text-white"
            >
              Salvar vendas por categoria
            </button>
          ) : null}
        </form>
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Vendas de campanha</h2>
        {campaignItems.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Nenhum item de campanha aplicável a esta unidade neste mês.</p>
        ) : (
          <form action={saveCampaignSales} className="mt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-3 py-2">Vendedor</th>
                    {campaignItems.map((c) => (
                      <th key={c.id} className="px-3 py-2 text-center">
                        {c.name} <span className="text-ink-soft">(meta {c.target_per_seller})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(sellers ?? []).map((s) => (
                    <tr key={s.id} className="border-t border-border-navy-soft">
                      <td className="px-3 py-2 font-medium text-ink">{s.name}</td>
                      {campaignItems.map((c) => (
                        <td key={c.id} className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            name={`camp__${s.id}__${c.id}`}
                            defaultValue={campSalesMap.get(`${s.id}__${c.id}`) ?? 0}
                            disabled={!canEditUnit}
                            className="w-16 rounded-md border border-border-navy px-1.5 py-1 text-center text-sm disabled:bg-table-head"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {(sellers ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={campaignItems.length + 1} className="px-3 py-4 text-center text-ink-soft">
                        Nenhum vendedor cadastrado nesta unidade.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {canEditUnit && (sellers ?? []).length > 0 ? (
              <button
                type="submit"
                className="mt-3 rounded-md bg-navy px-4 py-1.5 text-sm font-semibold text-white"
              >
                Salvar vendas de campanha
              </button>
            ) : null}
          </form>
        )}
      </section>
    </div>
  );
}
