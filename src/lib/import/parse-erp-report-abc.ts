import type ExcelJS from "exceljs";
import { normalizeName } from "@/lib/import/normalize";
import { classifySubgrupo, isGenericSeller, parseBrNumber, EXCLUDE_KEYWORDS, type CategoryKey } from "@/lib/import/classify-subgrupo";
import type { ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";

const TITLE_RE = /^relatorio de abc de vendas/;
const PERIODO_RE = /Per[ií]odo:\s*\[(\d{2}\/\d{2}\/\d{4})\s*\S+\s*(\d{2}\/\d{2}\/\d{4})\]/i;
const SELLER_CODE_RE = /^\d+\s*-\s*/;

// Columns of the "Relatório de ABC de Vendas" export (Ponta Negra's system).
const COL_NUM = 1;
const COL_PRODUCT = 4;
const COL_QTY = 6;
const COL_REVENUE = 7;

// Ponta Negra's "PRATOS" subgroup mixes mains, sides and desserts, so it is split by product name.
// Checked in order — "dia a dia" must win over "pacoca" ("DIA A DIA PAÇOCA" is a main).
const PRATOS_PRODUCT_KEYWORDS: { key: CategoryKey; keywords: string[] }[] = [
  { key: "pratos_principais", keywords: ["dia a dia", "kids"] },
  {
    key: "sobremesas",
    keywords: [
      "sorvete",
      "brigadeiro",
      "cocada",
      "petit gateau",
      "pudim",
      "cartola",
      "papaia",
      "gelado",
      "doce",
      "queijo c/ mel",
      "queijo com mel",
    ],
  },
  {
    key: "acompanhamentos",
    keywords: [
      "arroz",
      "feijao",
      "farofa",
      "batata",
      "macaxeira",
      "pirao",
      "pure",
      "legume",
      "salada",
      "vinagrete",
      "pacoca",
    ],
  },
];

function classifyPratosProduct(productNorm: string): CategoryKey {
  for (const { key, keywords } of PRATOS_PRODUCT_KEYWORDS) {
    if (keywords.some((k) => productNorm.includes(k))) return key;
  }
  return "pratos_principais";
}

/** "001 - COZINHA >> 03 - PRATOS" -> "PRATOS" */
function subgroupName(grupo: string): string {
  const last = grupo.split(">>").pop() ?? grupo;
  return last.trim().replace(SELLER_CODE_RE, "");
}

/**
 * Shared state for the "Relatório de ABC de Vendas" (Ponta Negra's system, quebra Vendedor > Grupo > produto),
 * fed either from the spreadsheet or from the PDF text. Its revenue already contains the
 * "TAXA DE SERVICO" line, so the import must not add the fee again.
 */
function createAbcAccumulator() {
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
  let currentSubgroup = "";
  let currentCategory: CategoryKey | null = null;

  return {
    /** Handles "Filtros:", "Vendedor:" and "Grupo:" lines; returns false for anything else. */
    handleHeaderText(text: string): boolean {
      if (text.includes("Filtros:")) {
        const m = text.match(PERIODO_RE);
        if (m && foundDates.length === 0) foundDates.push(m[1], m[2]);
        return true;
      }
      if (text.startsWith("Vendedor:")) {
        headerFound = true;
        currentSeller = text.slice("Vendedor:".length).trim().replace(SELLER_CODE_RE, "");
        currentSellerIsGeneric = isGenericSeller(currentSeller);
        if (currentSellerIsGeneric) genericSellerNames.add(currentSeller);
        else sellerNames.add(currentSeller);
        currentCategory = null;
        return true;
      }
      if (text.startsWith("Grupo:")) {
        currentSubgroup = subgroupName(text.slice("Grupo:".length));
        currentCategory = classifySubgrupo(currentSubgroup);
        return true;
      }
      return false;
    },

    addProduct(productName: string, qty: number, valor: number) {
      if (!currentSeller) return;
      rowsRead++;
      totalRevenue += valor;

      if (currentSellerIsGeneric) return;

      const productNorm = normalizeName(productName);
      // Auto rodízio (and its desserts) stays out of every category for now.
      let category: CategoryKey | null = null;
      if (!productNorm.includes("rodizio")) {
        category = currentCategory ?? (normalizeName(currentSubgroup) === "pratos" ? classifyPratosProduct(productNorm) : null);
        if (category === null && !EXCLUDE_KEYWORDS.some((k) => normalizeName(currentSubgroup).includes(k))) {
          unmappedSubgrupos.add(currentSubgroup);
        }
      }

      if (category) {
        if (!sellerCategoryQty.has(currentSeller)) sellerCategoryQty.set(currentSeller, new Map());
        const catMap = sellerCategoryQty.get(currentSeller)!;
        catMap.set(category, (catMap.get(category) ?? 0) + qty);
      }

      if (!sellerProductQty.has(currentSeller)) sellerProductQty.set(currentSeller, new Map());
      const prodMap = sellerProductQty.get(currentSeller)!;
      prodMap.set(productName, (prodMap.get(productName) ?? 0) + qty);
    },

    finish(): ParsedHierarchicalReport {
      const warnings: string[] = [];
      if (!headerFound) {
        warnings.push('Nenhuma seção "Vendedor:" encontrada — o layout pode ser diferente do esperado.');
      }
      if (unmappedSubgrupos.size > 0) {
        warnings.push(
          `Subgrupos do relatório sem categoria reconhecida (não contam em "vendas por categoria"): ${[...unmappedSubgrupos].join(", ")}.`,
        );
      }
      return {
        headerFound,
        rowsRead,
        totalRevenue: rowsRead > 0 ? Math.round(totalRevenue * 100) / 100 : null,
        revenueIncludesServiceFee: true,
        sellerCategoryQty,
        sellerProductQty,
        sellerNames,
        genericSellerNames,
        unmappedSubgrupos,
        warnings,
        foundDates,
      };
    },
  };
}

export function isAbcVendasWorkbook(workbook: ExcelJS.Workbook): boolean {
  const sheet = workbook.worksheets[0];
  return Boolean(sheet && TITLE_RE.test(normalizeName(sheet.getRow(1).getCell(1).text)));
}

/** Spreadsheet export: every cell comes as rich text with Brazilian number formatting. */
export function parseAbcVendasWorkbook(workbook: ExcelJS.Workbook): ParsedHierarchicalReport {
  const acc = createAbcAccumulator();
  for (const sheet of workbook.worksheets) {
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const aText = row.getCell(COL_NUM).text.trim();
      if (acc.handleHeaderText(aText) || !/^\d+$/.test(aText)) continue;

      const productName = row.getCell(COL_PRODUCT).text.trim();
      const qty = parseBrNumber(row.getCell(COL_QTY).text);
      const valor = parseBrNumber(row.getCell(COL_REVENUE).text);
      if (!productName || qty === null || valor === null) continue;
      acc.addProduct(productName, qty, valor);
    }
  }
  return acc.finish();
}

const PRODUCT_CODE_RE = /^\d{14}$/;
const QTY_RE = /^-?[\d.]+,\d{3}$/;
const MONEY_RE = /^-?[\d.]+,\d{2}$/;
// In the PDF text layer each product row becomes one value per line, always in this order:
// custo, markup, faturamento, quantidade, imp. estadual, imp. federal, lucro, partic., acum.,
// <código de 14 dígitos>, produto, prc. médio, margem, num. Offsets are relative to the código line.
const PDF_REVENUE_OFFSET = -7;
const PDF_QTY_OFFSET = -6;
const PDF_PRODUCT_OFFSET = 1;

export function isAbcVendasText(lines: string[]): boolean {
  const first = lines.find((l) => l.trim());
  return Boolean(first && TITLE_RE.test(normalizeName(first)));
}

/** PDF export, as extracted by pdf-parse (one value per line). */
export function parseAbcVendasLines(rawLines: string[]): ParsedHierarchicalReport {
  const acc = createAbcAccumulator();
  const lines = rawLines.map((l) => l.trim());
  let skipped = 0;
  for (let i = 0; i < lines.length; i++) {
    if (acc.handleHeaderText(lines[i]) || !PRODUCT_CODE_RE.test(lines[i])) continue;

    const qtyText = lines[i + PDF_QTY_OFFSET] ?? "";
    const revenueText = lines[i + PDF_REVENUE_OFFSET] ?? "";
    const productName = lines[i + PDF_PRODUCT_OFFSET] ?? "";
    if (!QTY_RE.test(qtyText) || !MONEY_RE.test(revenueText) || !productName) {
      skipped++;
      continue;
    }
    acc.addProduct(productName, parseBrNumber(qtyText)!, parseBrNumber(revenueText)!);
  }
  const result = acc.finish();
  if (skipped > 0) {
    result.warnings.push(
      `${skipped} linha(s) de produto do PDF não puderam ser lidas e ficaram fora do total — confira ou envie o relatório em .xlsx.`,
    );
  }
  return result;
}
