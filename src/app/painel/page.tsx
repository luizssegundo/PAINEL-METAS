import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { loadDashboardData } from "./data";
import { currentMonthKey, formatMonthLabel } from "@/lib/months";
import { formatCurrency, formatPercent, pctOf } from "@/lib/format";
import { UnitCards } from "./_components/unit-cards";
import { RankingSection } from "./_components/ranking-section";
import { CampaignSection } from "./_components/campaign-section";

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string; categoria?: string }>;
}) {
  const sp = await searchParams;
  const monthKey = sp.mes ?? currentMonthKey();
  const selectedUnitId = sp.unidade ?? null;
  const selectedCategoryId = sp.categoria ?? "all";

  const viewer = await requireViewer();

  if (!viewer.hasProfile) {
    return (
      <div className="rounded-lg border border-terracotta/40 bg-terracotta/10 p-6 text-sm text-ink">
        Sua conta foi autenticada, mas ainda não tem um perfil cadastrado no sistema. Peça a um
        administrador para vincular seu acesso.
      </div>
    );
  }

  const data = await loadDashboardData(monthKey, viewer.units);

  const totalActual = data.unitSummaries.reduce((sum, u) => sum + u.actual, 0);
  const totalTarget = data.unitSummaries.reduce((sum, u) => sum + u.target, 0);
  const totalPct = pctOf(totalActual, totalTarget);
  const unitsOnTarget = data.unitSummaries.filter((u) => u.target > 0 && u.pct >= 100).length;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-serif text-3xl font-semibold text-navy">
          Metas de Vendas & Faturamento
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Acompanhamento por unidade, vendedor e campanha — {formatMonthLabel(monthKey)}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 rounded-lg border border-border-navy bg-white p-6 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
              Faturamento realizado
            </p>
            <p className="mt-1 font-serif text-[27px] font-semibold text-navy">
              {formatCurrency(totalActual)}
            </p>
            <p className="text-xs text-ink-soft">Meta: {formatCurrency(totalTarget)}</p>
          </div>
          <div className="sm:border-l sm:border-border-navy sm:pl-6">
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
              % da meta
            </p>
            <p
              className={`mt-1 font-serif text-[27px] font-semibold ${totalPct >= 100 ? "text-yellow" : "text-navy"}`}
            >
              {formatPercent(totalPct)}
            </p>
            <p className="text-xs text-ink-soft">Grupo Tábua de Carne</p>
          </div>
          <div className="sm:border-l sm:border-border-navy sm:pl-6">
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink-soft">
              Unidades na meta
            </p>
            <p className="mt-1 font-serif text-[27px] font-semibold text-navy">
              {unitsOnTarget} / {data.unitSummaries.length}
            </p>
            <p className="text-xs text-ink-soft">Bateram 100% ou mais</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-navy">
            Unidades{" "}
            <span className="text-base font-normal text-ink-soft">
              ({data.unitSummaries.length})
            </span>
          </h2>
          {selectedUnitId ? (
            <Link href={`/painel?mes=${monthKey}`} className="text-xs font-medium text-navy underline">
              Ver todas as unidades liberadas
            </Link>
          ) : null}
        </div>
        <UnitCards units={data.unitSummaries} monthKey={monthKey} selectedUnitId={selectedUnitId} />
      </section>

      <RankingSection
        monthKey={monthKey}
        categories={data.categories}
        sellers={data.sellers}
        categorySales={data.categorySales}
        selectedUnitId={selectedUnitId}
        selectedCategoryId={selectedCategoryId}
      />

      <CampaignSection
        monthKey={monthKey}
        units={data.unitSummaries}
        sellers={data.sellers}
        campaignItems={data.campaignItems}
        campaignSales={data.campaignSales}
        selectedUnitId={selectedUnitId}
      />
    </div>
  );
}
