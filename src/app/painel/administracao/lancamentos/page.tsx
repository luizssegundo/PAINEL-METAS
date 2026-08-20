import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey } from "@/lib/months";
import { formatCurrency } from "@/lib/format";

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const monthKey = sp.mes ?? currentMonthKey();

  const viewer = await requireViewer();
  const editableUnits = viewer.units.filter((u) => u.canEdit);
  const unitId = sp.unidade ?? editableUnits[0]?.id ?? viewer.units[0]?.id;
  const unit = viewer.units.find((u) => u.id === unitId);

  if (!unit) {
    return <p className="text-sm text-ink-soft">Nenhuma unidade disponível.</p>;
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
          Estes valores são preenchidos pela importação do relatório do ERP.{" "}
          <Link href={`/painel/administracao/importar?mes=${monthKey}&unidade=${unit.id}`} className="underline">
            Importar relatório
          </Link>
          .
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

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Faturamento realizado</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Valor atual: <span className="font-mono">{formatCurrency(Number(actual?.actual_amount ?? 0))}</span>
        </p>
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Itens vendidos por categoria</h2>
        <div className="mt-3 overflow-x-auto">
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
                      {catSalesMap.get(`${s.id}__${c.id}`) ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
              {(sellers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={(categories ?? []).length + 1} className="px-3 py-4 text-center text-ink-soft">
                    Nenhum vendedor nesta unidade.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Vendas de campanha</h2>
        {campaignItems.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Nenhum item de campanha aplicável a esta unidade neste mês.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
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
                        {campSalesMap.get(`${s.id}__${c.id}`) ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
                {(sellers ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={campaignItems.length + 1} className="px-3 py-4 text-center text-ink-soft">
                      Nenhum vendedor nesta unidade.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
