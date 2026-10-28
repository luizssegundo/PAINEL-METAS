import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { acceptsReports, currentMonthKey, formatMonthLabel, isCurrentMonth } from "@/lib/months";
import { importReport } from "./actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const monthKey = sp.mes ?? currentMonthKey();
  // Current month, or the previous one until day 5 (closing the month's results).
  const editableNow = acceptsReports(monthKey);

  const viewer = await requireViewer();
  const editableUnits = viewer.units.filter((u) => u.canEdit);
  const unitId = sp.unidade ?? editableUnits[0]?.id ?? viewer.units[0]?.id;
  const unit = viewer.units.find((u) => u.id === unitId);
  // Admins can also load past months (historical import).
  const canImport = Boolean(unit?.canEdit) && (editableNow || viewer.isAdmin);

  if (!unit) {
    return <p className="text-sm text-ink-soft">Nenhuma unidade disponível para importação.</p>;
  }

  const supabase = await createClient();
  const { data: lastImport } = await supabase
    .from("audit_log")
    .select("created_at, actor_id, new_value")
    .eq("unit_id", unit.id)
    .eq("ref_month", monthKey)
    .like("field_name", "Importação de relatório%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let actorName: string | null = null;
  if (lastImport?.actor_id) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", lastImport.actor_id)
      .maybeSingle();
    actorName = actor?.full_name ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">
          Envie aqui o relatório de vendas exportado do sistema (PDF ou .xlsx) — vendedores, faturamento realizado e
          vendas por categoria/campanha são lidos automaticamente do arquivo. Use apenas quando a integração
          automática com o ERP não estiver disponível. O relatório precisa ter o detalhamento por dia ("Data Caixa:"),
          começando no dia 01 do mês vigente — arquivos sem data ou de outro mês são rejeitados automaticamente.
          Para Ponta Negra, envie o &quot;Relatório de ABC de Vendas&quot; (PDF ou .xlsx, quebra por Vendedor e Grupo): o
          período do filtro deve começar no dia 01 do mês, e a taxa de serviço já vem incluída no relatório.
        </p>
        <div className="flex flex-wrap gap-2">
          {viewer.units.map((u) => (
            <Link
              key={u.id}
              href={`/painel/administracao/importar?mes=${monthKey}&unidade=${u.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                u.id === unit.id ? "bg-navy text-white" : "border border-border-navy bg-white text-navy"
              }`}
            >
              {u.name}
            </Link>
          ))}
        </div>
      </div>

      {!isCurrentMonth(monthKey) ? (
        <span className="inline-block rounded-full bg-seafoam px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-navy">
          {editableNow ? "Fechamento do mês (até o dia 05)" : viewer.isAdmin ? "Carga histórica" : "Somente consulta"} —{" "}
          {formatMonthLabel(monthKey)}
        </span>
      ) : null}

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Importar relatório — {unit.name}</h2>

        {lastImport ? (
          <div className="mt-2 rounded-md bg-table-head p-3 text-xs text-ink-soft">
            <p className="font-semibold text-ink">
              Última importação: {new Date(lastImport.created_at).toLocaleString("pt-BR")}
              {actorName ? ` — ${actorName}` : ""}
            </p>
            <p className="mt-1">{lastImport.new_value}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Nenhuma importação registrada para {formatMonthLabel(monthKey)} ainda.</p>
        )}

        {canImport ? (
          <form action={importReport} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="refMonth" value={monthKey} />
            <div>
              <label className="block text-xs text-ink-soft">Arquivo (PDF ou .xlsx)</label>
              <input
                type="file"
                name="file"
                accept=".pdf,.xlsx"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <ConfirmSubmitButton
              confirmMessage={`Confirma o envio deste relatório para ${unit.name}? Os dados de vendedores, faturamento e vendas do mês serão atualizados.`}
              className="rounded-md bg-yellow px-4 py-1.5 text-sm font-bold text-navy"
            >
              Importar relatório
            </ConfirmSubmitButton>
          </form>
        ) : !unit.canEdit ? (
          <p className="mt-4 text-sm text-ink-soft">Você não tem permissão de edição para esta unidade.</p>
        ) : null}
      </section>
    </div>
  );
}
