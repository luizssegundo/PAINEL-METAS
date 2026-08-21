import ExcelJS from "exceljs";
import { normalizeName } from "@/lib/import/normalize";
import { classifySubgrupo, isGenericSeller, parseBrNumber, EXCLUDE_KEYWORDS, type CategoryKey } from "@/lib/import/classify-subgrupo";
import type { ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";

export type { CategoryKey, ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";

function cellText(value: ExcelJS.CellValue): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parses the same "Atendente: / Grupo: / Subgrupo: / código produto qtd valor unidade"
 * hierarchical report as the PDF export, but read directly from the spreadsheet's
 * columns (Código, Produto, Quantidade, Valor, Unidade) instead of a text line.
 */
export async function parseErpReportXlsxHierarchical(buffer: Buffer): Promise<ParsedHierarchicalReport> {
  const warnings: string[] = [];
  const sellerCategoryQty = new Map<string, Map<CategoryKey, number>>();
  const sellerProductQty = new Map<string, Map<string, number>>();
  const sellerNames = new Set<string>();
  const genericSellerNames = new Set<string>();
  const unmappedSubgrupos = new Set<string>();
  const foundDates: string[] = [];

  let totalRevenue = 0;
  let rowsRead = 0;
  let headerFound = false;
  let currentSeller: string | null = null;
  let currentSellerIsGeneric = false;
  let currentCategory: CategoryKey | null = null;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  for (const sheet of workbook.worksheets) {
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const aText = cellText(row.getCell(1).value);

      if (aText.startsWith("Data Caixa:")) {
        const m = aText.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) foundDates.push(m[1]);
        continue;
      }

      if (aText.startsWith("Atendente:")) {
        headerFound = true;
        currentSeller = aText.slice("Atendente:".length).trim();
        currentSellerIsGeneric = isGenericSeller(currentSeller);
        if (currentSellerIsGeneric) genericSellerNames.add(currentSeller);
        else sellerNames.add(currentSeller);
        currentCategory = null;
        continue;
      }

      if (aText.startsWith("Grupo:")) {
        currentCategory = null;
        continue;
      }

      if (aText.startsWith("Subgrupo:")) {
        const subName = aText.slice("Subgrupo:".length).trim();
        currentCategory = classifySubgrupo(subName);
        if (currentCategory === null && !EXCLUDE_KEYWORDS.some((k) => normalizeName(subName).includes(k))) {
          unmappedSubgrupos.add(subName);
        }
        continue;
      }

      const productName = cellText(row.getCell(2).value);
      if (!productName || !currentSeller) continue;

      const qty = parseBrNumber(row.getCell(3).value);
      const valor = parseBrNumber(row.getCell(4).value);
      if (qty === null || valor === null) continue;

      rowsRead++;
      totalRevenue += valor;

      if (currentSellerIsGeneric) continue;

      if (currentCategory) {
        if (!sellerCategoryQty.has(currentSeller)) sellerCategoryQty.set(currentSeller, new Map());
        const catMap = sellerCategoryQty.get(currentSeller)!;
        catMap.set(currentCategory, (catMap.get(currentCategory) ?? 0) + qty);
      }

      if (!sellerProductQty.has(currentSeller)) sellerProductQty.set(currentSeller, new Map());
      const prodMap = sellerProductQty.get(currentSeller)!;
      prodMap.set(productName, (prodMap.get(productName) ?? 0) + qty);
    }
  }

  if (!headerFound) {
    warnings.push('Nenhuma seção "Atendente:" encontrada — o layout pode ser diferente do esperado.');
  }
  if (unmappedSubgrupos.size > 0) {
    warnings.push(
      `Subgrupos do relatório sem categoria reconhecida (não contam em "vendas por categoria"): ${[...unmappedSubgrupos].join(", ")}.`,
    );
  }

  return {
    headerFound,
    rowsRead,
    totalRevenue: rowsRead > 0 ? totalRevenue : null,
    sellerCategoryQty,
    sellerProductQty,
    sellerNames,
    genericSellerNames,
    unmappedSubgrupos,
    warnings,
    foundDates,
  };
}
