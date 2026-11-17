"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseErpReportPdf } from "@/lib/import/parse-erp-report-pdf";
import { parseErpReportXlsxHierarchical } from "@/lib/import/parse-erp-report-xlsx-hierarchical";
import type { ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";
import { applyParsedReport, logImport } from "@/lib/import/apply-report";
import { acceptsReports, formatMonthLabel } from "@/lib/months";
import { syncUnitMonthFromXmenu } from "@/lib/xmenu/sync";

function parseBrDate(raw: string): { day: number; month: number; year: number } | null {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
}

function revalidateImportedData() {
  revalidatePath("/painel/administracao/importar");
  revalidatePath("/painel/administracao/vendedores");
  revalidatePath("/painel/lancamentos");
  revalidatePath("/painel/dashboard");
  revalidatePath("/painel");
}

export async function importReport(formData: FormData) {
  const viewer = await requireViewer();

  const unitId = String(formData.get("unitId") ?? "");
  const refMonth = String(formData.get("refMonth") ?? "");
  const file = formData.get("file");

  const unit = viewer.units.find((u) => u.id === unitId && u.canEdit);
  if (!unit || !refMonth || !(file instanceof File) || file.size === 0) return;
  // Older months are only open to admins (historical load).
  if (!acceptsReports(refMonth) && !viewer.isAdmin) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.name.toLowerCase().endsWith(".pdf");

  const parsed: ParsedHierarchicalReport = isPdf
    ? await parseErpReportPdf(buffer)
    : await parseErpReportXlsxHierarchical(buffer);

  if (!parsed.headerFound || parsed.rowsRead === 0) {
    await logImport(viewer.userId, unit.id, refMonth, file.name, [
      "Nenhum dado reconhecido no arquivo — nenhuma alteração foi feita.",
      ...parsed.warnings,
    ]);
    revalidatePath("/painel/administracao/importar");
    return;
  }

  const [expectedYear, expectedMonth] = refMonth.split("-").map(Number);

  if (parsed.foundDates.length === 0) {
    await logImport(viewer.userId, unit.id, refMonth, file.name, [
      'Arquivo rejeitado — não contém informação de data ("Data Caixa:"). Exporte o relatório do sistema com o detalhamento por dia e envie novamente. Nenhuma alteração foi feita.',
    ]);
    revalidatePath("/painel/administracao/importar");
    return;
  }

  const firstDate = parseBrDate(parsed.foundDates[0]);
  if (!firstDate || firstDate.day !== 1) {
    await logImport(viewer.userId, unit.id, refMonth, file.name, [
      `Arquivo rejeitado — o relatório deve começar no dia 01 do mês. Primeira data encontrada no arquivo: ${parsed.foundDates[0]}. Nenhuma alteração foi feita.`,
    ]);
    revalidatePath("/painel/administracao/importar");
    return;
  }

  const outOfMonthDate = parsed.foundDates
    .map(parseBrDate)
    .find((d) => d && (d.month !== expectedMonth || d.year !== expectedYear));
  if (outOfMonthDate) {
    const formatted = `${String(outOfMonthDate.day).padStart(2, "0")}/${String(outOfMonthDate.month).padStart(2, "0")}/${outOfMonthDate.year}`;
    await logImport(viewer.userId, unit.id, refMonth, file.name, [
      `Arquivo rejeitado — contém datas fora do mês vigente (${formatMonthLabel(refMonth)}). Data encontrada: ${formatted}. Envie o relatório correspondente a este mês. Nenhuma alteração foi feita.`,
    ]);
    revalidatePath("/painel/administracao/importar");
    return;
  }

  const supabase = await createClient();
  const summaryLines = await applyParsedReport(supabase, {
    unitId: unit.id,
    refMonth,
    parsed,
    source: "import",
    externalRef: file.name,
  });

  await logImport(viewer.userId, unit.id, refMonth, file.name, summaryLines);
  revalidateImportedData();
}

/** "Puxar do Xmenu" button: same permission rules as a report upload. */
export async function pullFromXmenu(formData: FormData) {
  const viewer = await requireViewer();

  const unitId = String(formData.get("unitId") ?? "");
  const refMonth = String(formData.get("refMonth") ?? "");

  const unit = viewer.units.find((u) => u.id === unitId && u.canEdit);
  if (!unit || !refMonth) return;
  if (!acceptsReports(refMonth) && !viewer.isAdmin) return;

  // Writes go through the service-role client (source "erp" is reserved for the integration),
  // so the permission checks above are the gate.
  const { data: unitRow } = await createAdminClient()
    .from("units")
    .select("xmenu_store_id")
    .eq("id", unit.id)
    .maybeSingle();
  const storeId = unitRow?.xmenu_store_id?.trim();
  if (!storeId) return;

  await syncUnitMonthFromXmenu({ unitId: unit.id, storeId, refMonth, actorId: viewer.userId });
  revalidateImportedData();
}
