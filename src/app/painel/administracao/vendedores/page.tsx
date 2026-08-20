import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { setSellerActive } from "./actions";

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

  return (
    <div className="space-y-8">
      <p className="text-xs font-medium text-ink-soft">
        Os vendedores são cadastrados automaticamente a partir da importação do relatório de vendas do ERP — não é
        necessário adicioná-los manualmente aqui. Use os controles abaixo apenas para desativar um vendedor que não
        deve mais aparecer no painel (ex.: desligamento).
      </p>
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
                    <td className="px-3 py-2 text-ink">{s.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{s.active ? "Sim" : "Não"}</td>
                    {unit.canEdit ? (
                      <td className="px-3 py-2 text-right">
                        <form action={setSellerActive}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                          <button
                            type="submit"
                            className="rounded-md border border-border-navy px-3 py-1 text-xs font-semibold text-navy"
                          >
                            {s.active ? "Desativar" : "Ativar"}
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {unitSellers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-ink-soft">
                      Nenhum vendedor importado ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
