import { requireViewer } from "@/lib/viewer";
import { currentMonthKey } from "@/lib/months";
import { loadYearSeries } from "./data";
import { DashboardView } from "./_components/dashboard-view";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const monthKey = sp.mes ?? currentMonthKey();

  const viewer = await requireViewer();
  if (!viewer.hasProfile || viewer.units.length === 0) {
    return <p className="text-sm text-ink-soft">Nenhuma unidade liberada para o seu usuário.</p>;
  }

  const allSeries = await loadYearSeries(Number(monthKey.slice(0, 4)), viewer.units);
  return <DashboardView allSeries={allSeries} monthKey={monthKey} selectedUnitId={sp.unidade ?? null} />;
}
