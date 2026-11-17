import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyParsedReport, logImport } from "@/lib/import/apply-report";
import { formatCurrency } from "@/lib/format";
import { fetchClosedSales, XmenuApiError } from "@/lib/xmenu/client";
import { closedSalesToReport } from "@/lib/xmenu/to-report";

export const XMENU_IMPORT_LABEL = "Xmenu (API)";

// Brazil has no DST, so a fixed offset gives the local (Natal/Mossoró/João Pessoa) date.
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

export type XmenuSyncResult = { ok: boolean; lines: string[] };

/**
 * Pulls a unit's month from the XMenu API (closed registers, day 01 → today or month end) and
 * writes it exactly like a report upload would. Always records the outcome in the audit log.
 */
export async function syncUnitMonthFromXmenu({
  unitId,
  storeId,
  refMonth,
  actorId,
}: {
  unitId: string;
  storeId: string;
  refMonth: string;
  actorId: string | null;
}): Promise<XmenuSyncResult> {
  const [year, month] = refMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const todayLocal = new Date(Date.now() - BRAZIL_OFFSET_MS);
  const today = new Date(Date.UTC(todayLocal.getUTCFullYear(), todayLocal.getUTCMonth(), todayLocal.getUTCDate()));
  const last = monthEnd < today ? monthEnd : today;

  const finish = async (ok: boolean, lines: string[]) => {
    await logImport(actorId, unitId, refMonth, XMENU_IMPORT_LABEL, lines);
    return { ok, lines };
  };

  if (first > today) {
    return finish(false, ["Mês ainda não começou — nada a importar do Xmenu."]);
  }

  let sales;
  try {
    sales = await fetchClosedSales(storeId, first, last);
  } catch (err) {
    const msg = err instanceof XmenuApiError ? err.message : `Falha ao consultar o Xmenu: ${String(err)}`;
    return finish(false, [`${msg} Nenhuma alteração foi feita.`]);
  }

  const report = closedSalesToReport(sales);

  if (report.salesCount === 0) {
    return finish(false, [
      "O Xmenu não retornou vendas de caixas fechados neste mês — nenhuma alteração foi feita.",
      ...report.warnings,
    ]);
  }

  const outOfMonth = report.foundDates.find((d) => {
    const [, mm, yyyy] = d.split("/").map(Number);
    return mm !== month || yyyy !== year;
  });
  if (outOfMonth) {
    return finish(false, [
      `O Xmenu devolveu vendas fora do mês (data do caixa ${outOfMonth}) — importação cancelada por segurança. Nenhuma alteração foi feita.`,
    ]);
  }

  const lines = await applyParsedReport(createAdminClient(), {
    unitId,
    refMonth,
    parsed: report,
    source: "erp",
    externalRef: XMENU_IMPORT_LABEL,
  });

  const period =
    report.foundDates.length > 0
      ? `${report.foundDates[0]} a ${report.foundDates[report.foundDates.length - 1]}`
      : "sem data de caixa";
  lines.unshift(`${report.salesCount} venda(s) de caixas fechados (${period}).`);
  lines.push(
    `Conferência: taxa de serviço cobrada no Xmenu ${formatCurrency(report.serviceChargeTotal)}; total de pagamentos ${formatCurrency(report.paymentsTotal)}.`,
  );

  return finish(true, lines);
}
