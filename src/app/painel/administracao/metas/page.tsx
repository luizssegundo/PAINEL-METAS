import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey, formatMonthLabel, isCurrentMonth } from "@/lib/months";
import { formatCurrency } from "@/lib/format";
import { upsertRevenueTarget } from "./actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function MetasPage({
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

  const { data: targets } = unitIds.length
    ? await supabase
        .from("unit_revenue_targets")
        .select("unit_id, target_amount")
        .eq("ref_month", monthKey)
        .in("unit_id", unitIds)
    : { data: [] };

  const targetByUnit = new Map((targets ?? []).map((t) => [t.unit_id, Number(t.target_amount)]));

  return (
    <div className="rounded-lg border border-border-navy bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-navy">
          Metas de faturamento — {formatMonthLabel(monthKey)}
        </h2>
        {readOnly ? (
          <span className="rounded-full bg-seafoam px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-navy">
            Somente consulta
          </span>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Meta atual</th>
              {!readOnly ? <th className="px-3 py-2 text-right">Nova meta</th> : null}
            </tr>
          </thead>
          <tbody>
            {viewer.units.map((u) => {
              const current = targetByUnit.get(u.id) ?? 0;
              return (
                <tr key={u.id} className="border-t border-border-navy-soft">
                  <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{u.name}</td>
                  <td className="px-3 py-2.5 font-mono whitespace-nowrap">{formatCurrency(current)}</td>
                  {!readOnly ? (
                    <td className="px-3 py-2.5 text-right">
                      {u.canEdit ? (
                        <form action={upsertRevenueTarget} className="flex justify-end gap-2">
                          <input type="hidden" name="unitId" value={u.id} />
                          <input type="hidden" name="refMonth" value={monthKey} />
                          <input
                            type="number"
                            name="amount"
                            min="0.01"
                            step="0.01"
                            required
                            placeholder={String(current || "")}
                            className="w-28 rounded-md border border-border-navy px-2 py-1 text-right text-sm sm:w-36"
                          />
                          <ConfirmSubmitButton
                            confirmMessage={`Confirma a nova meta de faturamento para ${u.name}?`}
                            successMessage="Meta atualizada com sucesso!"
                            className="rounded-md bg-navy px-3 py-1 text-xs font-semibold text-white"
                          >
                            Salvar
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <span className="text-xs text-ink-soft">Sem permissão de edição</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
