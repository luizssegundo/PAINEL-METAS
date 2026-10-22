import { normalizeName } from "@/lib/import/normalize";
import { classifySubgrupo, isGenericSeller, parseBrNumber, EXCLUDE_KEYWORDS, type CategoryKey } from "@/lib/import/classify-subgrupo";

export type { CategoryKey } from "@/lib/import/classify-subgrupo";

export type ParsedHierarchicalReport = {
  headerFound: boolean;
  rowsRead: number;
  totalRevenue: number | null;
  /** True when the report's revenue already contains the service fee (so the import must not add it). */
  revenueIncludesServiceFee?: boolean;
  /** Real (non-generic) seller name -> category key -> items sold. */
  sellerCategoryQty: Map<string, Map<CategoryKey, number>>;
  /** Real (non-generic) seller name -> product name -> quantity (used for campaign matching). */
  sellerProductQty: Map<string, Map<string, number>>;
  /** Distinct real seller names found. */
  sellerNames: Set<string>;
  /** Distinct generic account names found (excluded from vendedores, still count toward revenue). */
  genericSellerNames: Set<string>;
  unmappedSubgrupos: Set<string>;
  warnings: string[];
  /** "Data Caixa:" lines found, as raw "DD/MM/YYYY" strings, in file order. */
  foundDates: string[];
};

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const ATENDENTE_RE = new RegExp(`^Atendente:\\s*(.+?)\\s+${NUM}\\s+R\\$`, "i");
const GRUPO_RE = new RegExp(`^Grupo:\\s*(.+?)\\s+${NUM}\\s+R\\$`, "i");
const SUBGRUPO_RE = new RegExp(`^Subgrupo:\\s*(.+?)\\s+${NUM}\\s+R\\$`, "i");
const PRODUCT_RE = new RegExp(`^\\d+\\s+(.+)\\s+(${NUM})\\s+(${NUM})\\s+\\S+$`);
const DATA_CAIXA_RE = /^Data Caixa:\s*(\d{2}\/\d{2}\/\d{4})/i;

/**
 * Parses the "Atendente: / Grupo: / Subgrupo: / <código> <produto> <qtd> <valor> <unidade>"
 * hierarchical report as extracted from a PDF text layer (one logical line per array entry).
 */
export function parseHierarchicalLines(lines: Iterable<string>): ParsedHierarchicalReport {
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

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^C[oó]digo\s+Produto\s+Quantidade\s+Valor\s+Unidade$/i.test(line)) continue;

    const dataCaixaMatch = line.match(DATA_CAIXA_RE);
    if (dataCaixaMatch) {
      foundDates.push(dataCaixaMatch[1]);
      continue;
    }

    const atendenteMatch = line.match(ATENDENTE_RE);
    if (atendenteMatch) {
      headerFound = true;
      currentSeller = atendenteMatch[1].trim();
      currentSellerIsGeneric = isGenericSeller(currentSeller);
      if (currentSellerIsGeneric) genericSellerNames.add(currentSeller);
      else sellerNames.add(currentSeller);
      currentCategory = null;
      continue;
    }

    if (GRUPO_RE.test(line)) {
      currentCategory = null;
      continue;
    }

    const subgrupoMatch = line.match(SUBGRUPO_RE);
    if (subgrupoMatch) {
      const subName = subgrupoMatch[1].trim();
      currentCategory = classifySubgrupo(subName);
      if (currentCategory === null && !EXCLUDE_KEYWORDS.some((k) => normalizeName(subName).includes(k))) {
        unmappedSubgrupos.add(subName);
      }
      continue;
    }

    if (line.includes("R$")) {
      // Grand-total row or other subtotal line — not a product line, nothing to extract.
      continue;
    }

    const productMatch = line.match(PRODUCT_RE);
    if (!productMatch || !currentSeller) continue;

    const productName = productMatch[1].trim();
    const qty = parseBrNumber(productMatch[2]);
    const valor = parseBrNumber(productMatch[3]);
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
