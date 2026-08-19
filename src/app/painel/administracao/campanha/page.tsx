import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey, formatMonthLabel, isCurrentMonth } from "@/lib/months";
import { createCampaignItem, updateCampaignItem, deleteCampaignItem } from "./actions";

export default async function CampanhaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const monthKey = sp.mes ?? currentMonthKey();
  const readOnly = !isCurrentMonth(monthKey);

  const viewer = await requireViewer();
  const supabase = await createClient();
  const unitIds = viewer.units.map((u) => u.id);
  const unitNameById = new Map(viewer.units.map((u) => [u.id, u.name]));
  const editableUnits = viewer.units.filter((u) => u.canEdit);

  const [{ data: globalItems }, { data: unitItems }] = await Promise.all([
    supabase
      .from("campaign_items")
      .select("id, name, item_type, target_per_seller, active, unit_id")
      .eq("ref_month", monthKey)
      .is("unit_id", null)
      .order("name"),
    unitIds.length
      ? supabase
          .from("campaign_items")
          .select("id, name, item_type, target_per_seller, active, unit_id")
          .eq("ref_month", monthKey)
          .in("unit_id", unitIds)
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const items = [...(globalItems ?? []), ...(unitItems ?? [])];

  function canEditItem(unitId: string | null) {
    if (readOnly) return false;
    if (unitId === null) return viewer.isAdmin;
    return editableUnits.some((u) => u.id === unitId);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border-navy bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-navy">
            Campanha de vendas — {formatMonthLabel(monthKey)}
          </h2>
          {readOnly ? (
            <span className="rounded-full bg-seafoam px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-navy">
              Somente consulta
            </span>
          ) : null}
        </div>

        <table className="mt-4 w-full text-sm">
          <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Escopo</th>
              <th className="px-3 py-2">Meta/vendedor</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const editable = canEditItem(item.unit_id);
              const scopeLabel = item.unit_id === null ? "Todas as unidades" : (unitNameById.get(item.unit_id) ?? "—");
              return (
                <tr key={item.id} className="border-t border-border-navy-soft">
                  {editable ? (
                    <td colSpan={6} className="px-3 py-2">
                      <form action={updateCampaignItem} className="flex flex-wrap items-center gap-3">
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          name="name"
                          defaultValue={item.name}
                          className="w-40 rounded-md border border-border-navy px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-ink-soft">
                          {item.item_type === "produto_especifico" ? "Produto específico" : "Grupo de produtos"}
                        </span>
                        <span className="text-xs text-ink-soft">{scopeLabel}</span>
                        <input
                          type="number"
                          name="targetPerSeller"
                          min="1"
                          defaultValue={item.target_per_seller}
                          className="w-20 rounded-md border border-border-navy px-2 py-1 text-sm"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                          <input type="checkbox" name="active" defaultChecked={item.active} />
                          Ativo
                        </label>
                        <button
                          type="submit"
                          className="rounded-md bg-navy px-3 py-1 text-xs font-semibold text-white"
                        >
                          Salvar
                        </button>
                      </form>
                      <form action={deleteCampaignItem} className="mt-1">
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="text-xs font-medium text-terracotta underline">
                          Remover
                        </button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-ink">{item.name}</td>
                      <td className="px-3 py-2 text-ink-soft">
                        {item.item_type === "produto_especifico" ? "Produto específico" : "Grupo de produtos"}
                      </td>
                      <td className="px-3 py-2 text-ink-soft">{scopeLabel}</td>
                      <td className="px-3 py-2 font-mono">{item.target_per_seller}</td>
                      <td className="px-3 py-2 text-ink-soft">{item.active ? "Sim" : "Não"}</td>
                      <td className="px-3 py-2" />
                    </>
                  )}
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-soft">
                  Nenhum item de campanha cadastrado para este mês.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!readOnly && editableUnits.length > 0 ? (
        <div className="rounded-lg border border-border-navy bg-white p-5">
          <h2 className="font-serif text-lg font-semibold text-navy">Novo item de campanha</h2>
          <form action={createCampaignItem} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="refMonth" value={monthKey} />
            <div>
              <label className="block text-xs text-ink-soft">Nome</label>
              <input
                name="name"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft">Tipo</label>
              <select
                name="itemType"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              >
                <option value="grupo_de_produtos">Grupo de produtos</option>
                <option value="produto_especifico">Produto específico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-soft">Meta por vendedor</label>
              <input
                type="number"
                name="targetPerSeller"
                min="1"
                required
                className="mt-1 w-24 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft">Escopo</label>
              <select
                name="unitId"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              >
                {viewer.isAdmin ? <option value="global">Todas as unidades</option> : null}
                {editableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-md bg-yellow px-4 py-1.5 text-sm font-bold text-navy">
              Adicionar
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
