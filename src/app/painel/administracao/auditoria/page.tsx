import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey, formatMonthLabel } from "@/lib/months";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const monthKey = sp.mes ?? currentMonthKey();
  const unitFilter = sp.unidade ?? "all";

  const viewer = await requireViewer();
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, created_at, unit_id, ref_month, entity_type, field_name, old_value, new_value, actor_id")
    .order("created_at", { ascending: false })
    .limit(300);

  if (unitFilter !== "all") {
    query = query.eq("unit_id", unitFilter);
  }

  const { data: rows } = await query;
  const filtered = (rows ?? []).filter((r) => r.ref_month === monthKey || r.ref_month === null);

  const actorIds = Array.from(new Set(filtered.map((r) => r.actor_id).filter(Boolean))) as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorNameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const unitNameById = new Map(viewer.units.map((u) => [u.id, u.name]));

  return (
    <div className="rounded-lg border border-border-navy bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-navy">
          Auditoria — {formatMonthLabel(monthKey)}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/painel/administracao/auditoria?mes=${monthKey}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              unitFilter === "all" ? "bg-navy text-white" : "border border-border-navy bg-white text-navy"
            }`}
          >
            Todas as unidades
          </Link>
          {viewer.units.map((u) => (
            <Link
              key={u.id}
              href={`/painel/administracao/auditoria?mes=${monthKey}&unidade=${u.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                unitFilter === u.id ? "bg-navy text-white" : "border border-border-navy bg-white text-navy"
              }`}
            >
              {u.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">Data/hora</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Campo</th>
              <th className="px-3 py-2">Anterior</th>
              <th className="px-3 py-2">Novo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border-navy-soft">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">{actorNameById.get(r.actor_id ?? "") ?? "—"}</td>
                <td className="px-3 py-2">{r.unit_id ? (unitNameById.get(r.unit_id) ?? "—") : "—"}</td>
                <td className="px-3 py-2">{r.field_name}</td>
                <td className="px-3 py-2 text-ink-soft">{r.old_value ?? "—"}</td>
                <td className="px-3 py-2 font-medium text-ink">{r.new_value ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-soft">
                  Nenhuma alteração registrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
