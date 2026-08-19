import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { createSeller, updateSeller } from "./actions";

export default async function VendedoresPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const unitIds = viewer.units.map((u) => u.id);

  const { data: sellers } = unitIds.length
    ? await supabase
        .from("sellers")
        .select("id, name, unit_id, active")
        .in("unit_id", unitIds)
        .order("name")
    : { data: [] };

  const editableUnits = viewer.units.filter((u) => u.canEdit);

  return (
    <div className="space-y-8">
      {viewer.units.map((unit) => {
        const unitSellers = (sellers ?? []).filter((s) => s.unit_id === unit.id);
        return (
          <section key={unit.id} className="rounded-lg border border-border-navy bg-white p-5">
            <h2 className="font-serif text-lg font-semibold text-navy">{unit.name}</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Ativo</th>
                  {unit.canEdit ? <th className="px-3 py-2 text-right">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {unitSellers.map((s) => (
                  <tr key={s.id} className="border-t border-border-navy-soft">
                    {unit.canEdit ? (
                      <>
                        <td className="px-3 py-2" colSpan={3}>
                          <form action={updateSeller} className="flex items-center gap-3">
                            <input type="hidden" name="id" value={s.id} />
                            <input
                              name="name"
                              defaultValue={s.name}
                              className="flex-1 rounded-md border border-border-navy px-2 py-1 text-sm"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                              <input type="checkbox" name="active" defaultChecked={s.active} />
                              Ativo
                            </label>
                            <button
                              type="submit"
                              className="rounded-md bg-navy px-3 py-1 text-xs font-semibold text-white"
                            >
                              Salvar
                            </button>
                          </form>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-ink">{s.name}</td>
                        <td className="px-3 py-2 text-ink-soft">{s.active ? "Sim" : "Não"}</td>
                      </>
                    )}
                  </tr>
                ))}
                {unitSellers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-ink-soft">
                      Nenhum vendedor cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        );
      })}

      {editableUnits.length > 0 ? (
        <section className="rounded-lg border border-border-navy bg-white p-5">
          <h2 className="font-serif text-lg font-semibold text-navy">Novo vendedor</h2>
          <form action={createSeller} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-ink-soft">Nome</label>
              <input
                name="name"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft">Unidade</label>
              <select
                name="unitId"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              >
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
        </section>
      ) : null}
    </div>
  );
}
