import { redirect } from "next/navigation";

// Lançamentos moved out of the admin area; keep old links working.
export default async function LegacyLancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.mes) qs.set("mes", sp.mes);
  if (sp.unidade) qs.set("unidade", sp.unidade);
  const query = qs.toString();
  redirect(query ? `/painel/lancamentos?${query}` : "/painel/lancamentos");
}
