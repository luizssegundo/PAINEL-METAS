import { normalizeName } from "@/lib/import/normalize";
import { classifySubgrupo, isGenericSeller, EXCLUDE_KEYWORDS, type CategoryKey } from "@/lib/import/classify-subgrupo";
import { addProductGroups, type ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";
import type { XmenuClosedSale } from "@/lib/xmenu/client";

export type XmenuReport = ParsedHierarchicalReport & {
  salesCount: number;
  /** Service fee actually charged, per the API (for comparison with the fixed 10% rule). */
  serviceChargeTotal: number;
  paymentsTotal: number;
};

const NO_SELLER = "Sem vendedor";

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function brDate(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/**
 * Turns XMenu closed-register sales into the same shape the PDF/xlsx parsers produce, so the
 * import pipeline (sellers, revenue, categories, campaigns) runs unchanged on API data.
 * Mirrors the "Atendente → Subgrupo → produto" report: seller = item attendant (falling back to
 * the sale's waiter), category = item subgroup.
 */
export function closedSalesToReport(sales: XmenuClosedSale[]): XmenuReport {
  const sellerCategoryQty = new Map<string, Map<CategoryKey, number>>();
  const sellerProductQty = new Map<string, Map<string, number>>();
  const productGroups = new Map<string, Set<string>>();
  const sellerNames = new Set<string>();
  const genericSellerNames = new Set<string>();
  const unmappedSubgrupos = new Set<string>();
  const dates = new Set<string>();
  const warnings: string[] = [];

  let totalRevenue = 0;
  let rowsRead = 0;
  let salesCount = 0;
  let salesWithoutItems = 0;
  let serviceChargeTotal = 0;
  let paymentsTotal = 0;

  for (const sale of sales) {
    if (sale.header?.cancelled) continue;
    salesCount++;
    if (sale.register?.cashDate) dates.add(sale.register.cashDate.slice(0, 10));

    serviceChargeTotal += num(sale.totals?.serviceCharge);
    paymentsTotal += num(sale.totals?.paymentsTotal);

    const items = sale.items ?? [];
    if (items.length === 0) salesWithoutItems++;

    // Revenue without service fee, like the PDF report (items + add-ons).
    const itemsGross =
      sale.totals?.itemsGross ?? items.reduce((acc, i) => acc + num(i.lineTotal) + num(i.additionsTotal), 0);
    totalRevenue += num(itemsGross);

    const fallbackSeller = sale.header?.waiterName?.trim() || null;

    for (const item of items) {
      const productName = item.productName?.trim();
      const qty = num(item.quantity);
      if (!productName || qty === 0) continue;
      rowsRead++;

      const seller = item.attendantName?.trim() || fallbackSeller || NO_SELLER;
      if (isGenericSeller(seller)) {
        genericSellerNames.add(seller);
        continue;
      }
      sellerNames.add(seller);

      const subName = item.subgroupName?.trim() ?? "";
      const category = subName ? classifySubgrupo(subName) : null;
      if (category === null && subName && !EXCLUDE_KEYWORDS.some((k) => normalizeName(subName).includes(k))) {
        unmappedSubgrupos.add(subName);
      }

      if (category) {
        if (!sellerCategoryQty.has(seller)) sellerCategoryQty.set(seller, new Map());
        const catMap = sellerCategoryQty.get(seller)!;
        catMap.set(category, (catMap.get(category) ?? 0) + qty);
      }

      if (!sellerProductQty.has(seller)) sellerProductQty.set(seller, new Map());
      const prodMap = sellerProductQty.get(seller)!;
      prodMap.set(productName, (prodMap.get(productName) ?? 0) + qty);
      addProductGroups(productGroups, productName, item.groupName, item.subgroupName);
    }
  }

  if (salesCount > 0 && salesWithoutItems === salesCount) {
    warnings.push(
      "A API do Xmenu devolveu as vendas sem os itens — vendas por categoria e campanha não puderam ser calculadas.",
    );
  }
  if (unmappedSubgrupos.size > 0) {
    warnings.push(
      `Subgrupos do Xmenu sem categoria reconhecida (não contam em "vendas por categoria"): ${[...unmappedSubgrupos].join(", ")}.`,
    );
  }

  const foundDates = [...dates]
    .sort()
    .map(brDate)
    .filter((d): d is string => d !== null);

  return {
    headerFound: salesCount > 0,
    rowsRead,
    totalRevenue: salesCount > 0 ? Math.round(totalRevenue * 100) / 100 : null,
    revenueIncludesServiceFee: false,
    sellerCategoryQty,
    sellerProductQty,
    productGroups,
    sellerNames,
    genericSellerNames,
    unmappedSubgrupos,
    warnings,
    foundDates,
    salesCount,
    serviceChargeTotal: Math.round(serviceChargeTotal * 100) / 100,
    paymentsTotal: Math.round(paymentsTotal * 100) / 100,
  };
}
