"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseErpReportPdf } from "@/lib/import/parse-erp-report-pdf";
import { parseErpReportXlsxHierarchical } from "@/lib/import/parse-erp-report-xlsx-hierarchical";
import type { CategoryKey, ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";
import { normalizeName } from "@/lib/import/normalize";
import { formatCurrency } from "@/lib/format";
import { acceptsReports, formatMonthLabel } from "@/lib/months";

const SOURCE = "import";

// The ERP report's revenue excludes the 10% service fee; managers track sales with it included.
const SERVICE_FEE_RATE = 0.1;

type DbCategory = { id: string; name: string };

const CATEGORY_KEY_DETECTORS: Record<CategoryKey, (normalizedDbName: string) => boolean> = {
  pratos_principais: (n) => n.includes("principa"), // matches "principal" and "principais"
  bebidas: (n) => n.includes("bebida"),
  entradas_petiscos: (n) => n.includes("entrada") || n.includes("petisco"),
  acompanhamentos: (n) => n.includes("acompanhamento"),
  sobremesas: (n) => n.includes("sobremesa"),
};

// Campaign items whose name doesn't literally appear on a product line — either
// because it names a whole product category, or because it covers several SKUs
// whose ERP names vary/typo across units. Keyed by the campaign item's normalized name.
const CAMPAIGN_CATEGORY_MATCH: Record<string, CategoryKey> = {
  sobremesas: "sobremesas",
};
const CAMPAIGN_PRODUCT_ALIASES: Record<string, string[]> = {
  "vinho do tabua": [
    "tabua de carne classico", // covers "CAB SAUV" / "CABERNET SAUVIGNON" / the "CARBENERT" ERP typo
    "tabua de carne reserva malbec",
  ],
};

function parseBrDate(raw: string): { day: number; month: number; year: number } | null {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
}

function resolveCategoryKeyToId(categories: DbCategory[]): Map<CategoryKey, string> {
  const result = new Map<CategoryKey, string>();
  for (const category of categories) {
    const norm = normalizeName(category.name);
    for (const key of Object.keys(CATEGORY_KEY_DETECTORS) as CategoryKey[]) {
      if (!result.has(key) && CATEGORY_KEY_DETECTORS[key](norm)) {
        result.set(key, category.id);
      }
    }
  }
  return result;
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
  const supabase = await createClient();

  const parsed: ParsedHierarchicalReport = isPdf
    ? await parseErpReportPdf(buffer)
    : await parseErpReportXlsxHierarchical(buffer);

  const warnings = [...parsed.warnings];
  if (parsed.genericSellerNames.size > 0) {
    warnings.push(
      `Contas genéricas (não viram vendedor, mas o faturamento delas entra no total): ${[...parsed.genericSellerNames].join(", ")}.`,
    );
  }

  if (!parsed.headerFound || parsed.rowsRead === 0) {
    await logImport(viewer.userId, unit.id, refMonth, file.name, [
      "Nenhum dado reconhecido no arquivo — nenhuma alteração foi feita.",
      ...warnings,
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

  const { data: existingSellers } = await supabase
    .from("sellers")
    .select("id, name")
    .eq("unit_id", unit.id);

  const sellerIdByNorm = new Map((existingSellers ?? []).map((s) => [normalizeName(s.name), s.id]));

  const newSellerNames = [...parsed.sellerNames].filter((n) => !sellerIdByNorm.has(normalizeName(n)));
  if (newSellerNames.length > 0) {
    const { data: created } = await supabase
      .from("sellers")
      .insert(newSellerNames.map((name) => ({ name, unit_id: unit.id })))
      .select("id, name");
    for (const s of created ?? []) sellerIdByNorm.set(normalizeName(s.name), s.id);
  }

  const revenueWithFee =
    parsed.totalRevenue === null
      ? null
      : parsed.revenueIncludesServiceFee
        ? parsed.totalRevenue
        : Math.round(parsed.totalRevenue * (1 + SERVICE_FEE_RATE) * 100) / 100;

  if (revenueWithFee !== null) {
    const { data: existingActual } = await supabase
      .from("unit_revenue_actuals")
      .select("id")
      .eq("unit_id", unit.id)
      .eq("ref_month", refMonth)
      .maybeSingle();

    if (existingActual) {
      await supabase
        .from("unit_revenue_actuals")
        .update({ actual_amount: revenueWithFee, source: SOURCE, external_ref: file.name })
        .eq("id", existingActual.id);
    } else {
      await supabase.from("unit_revenue_actuals").insert({
        unit_id: unit.id,
        ref_month: refMonth,
        actual_amount: revenueWithFee,
        source: SOURCE,
        external_ref: file.name,
      });
    }
  }

  const { data: categories } = await supabase.from("product_categories").select("id, name");
  const categoryIdByKey = resolveCategoryKeyToId(categories ?? []);

  const categoryRows: { seller_id: string; category_id: string; items_sold: number; ref_month: string; source: string; external_ref: string }[] = [];
  for (const [sellerName, catMap] of parsed.sellerCategoryQty) {
    const sellerId = sellerIdByNorm.get(normalizeName(sellerName));
    if (!sellerId) continue;
    for (const [key, qty] of catMap) {
      const categoryId = categoryIdByKey.get(key);
      if (!categoryId) continue;
      categoryRows.push({
        seller_id: sellerId,
        category_id: categoryId,
        // Weighed items come with fractional quantities; the column stores whole items.
        items_sold: Math.round(qty),
        ref_month: refMonth,
        source: SOURCE,
        external_ref: file.name,
      });
    }
  }
  if (categoryRows.length > 0) {
    await supabase.from("seller_category_sales").upsert(categoryRows, { onConflict: "seller_id,category_id,ref_month" });
  }

  const { data: globalCampaignItems } = await supabase
    .from("campaign_items")
    .select("id, name")
    .eq("ref_month", refMonth)
    .eq("active", true)
    .is("unit_id", null);
  const { data: unitCampaignItems } = await supabase
    .from("campaign_items")
    .select("id, name")
    .eq("ref_month", refMonth)
    .eq("active", true)
    .eq("unit_id", unit.id);
  const campaignItems = [...(globalCampaignItems ?? []), ...(unitCampaignItems ?? [])].map((c) => {
    const norm = normalizeName(c.name);
    return {
      id: c.id,
      norm,
      categoryKey: CAMPAIGN_CATEGORY_MATCH[norm] ?? null,
      aliases: CAMPAIGN_PRODUCT_ALIASES[norm] ?? [norm],
    };
  });

  const campaignRows: { seller_id: string; campaign_item_id: string; qty_sold: number; source: string; external_ref: string }[] = [];

  // Category-wide campaigns (e.g. "Sobremesas"): sum the seller's whole category total
  // rather than matching a single product line.
  for (const item of campaignItems) {
    if (!item.categoryKey) continue;
    for (const [sellerName, catMap] of parsed.sellerCategoryQty) {
      const sellerId = sellerIdByNorm.get(normalizeName(sellerName));
      const qty = catMap.get(item.categoryKey);
      if (!sellerId || !qty) continue;
      campaignRows.push({ seller_id: sellerId, campaign_item_id: item.id, qty_sold: qty, source: SOURCE, external_ref: file.name });
    }
  }

  // Product-based campaigns: match by alias substrings (defaults to the campaign's own name).
  const productCampaignItems = campaignItems.filter((c) => !c.categoryKey);
  for (const [sellerName, prodMap] of parsed.sellerProductQty) {
    const sellerId = sellerIdByNorm.get(normalizeName(sellerName));
    if (!sellerId) continue;
    for (const [productName, qty] of prodMap) {
      const productNorm = normalizeName(productName);
      const match = productCampaignItems.find((c) => c.aliases.some((alias) => productNorm.includes(alias)));
      if (!match) continue;
      campaignRows.push({
        seller_id: sellerId,
        campaign_item_id: match.id,
        qty_sold: qty,
        source: SOURCE,
        external_ref: file.name,
      });
    }
  }
  if (campaignRows.length > 0) {
    // Multiple product lines can map to the same campaign item for a seller — sum before upsert.
    const merged = new Map<string, { seller_id: string; campaign_item_id: string; qty_sold: number; source: string; external_ref: string }>();
    for (const row of campaignRows) {
      const key = `${row.seller_id}__${row.campaign_item_id}`;
      const prev = merged.get(key);
      merged.set(key, prev ? { ...row, qty_sold: prev.qty_sold + row.qty_sold } : row);
    }
    const rows = [...merged.values()].map((row) => ({ ...row, qty_sold: Math.round(row.qty_sold) }));
    await supabase.from("seller_campaign_sales").upsert(rows, { onConflict: "seller_id,campaign_item_id" });
  }

  const summaryLines = [
    `${parsed.sellerNames.size} vendedor(es) no arquivo (${newSellerNames.length} novo(s) cadastrado(s) automaticamente).`,
    parsed.totalRevenue === null || revenueWithFee === null
      ? "Nenhuma coluna de valor encontrada — faturamento realizado não foi atualizado."
      : parsed.revenueIncludesServiceFee
        ? `Faturamento realizado importado: ${formatCurrency(revenueWithFee)} (taxa de serviço já incluída no relatório).`
        : `Faturamento realizado importado: ${formatCurrency(revenueWithFee)} (${formatCurrency(parsed.totalRevenue)} do relatório + 10% de taxa de serviço).`,
    `${categoryRows.length} lançamento(s) de vendas por categoria.`,
    `${campaignRows.length} lançamento(s) de vendas de campanha.`,
  ];
  summaryLines.push(...warnings);

  await logImport(viewer.userId, unit.id, refMonth, file.name, summaryLines);

  revalidatePath("/painel/administracao/importar");
  revalidatePath("/painel/administracao/vendedores");
  revalidatePath("/painel/lancamentos");
  revalidatePath("/painel");
}

async function logImport(actorId: string, unitId: string, refMonth: string, fileName: string, lines: string[]) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: actorId,
    unit_id: unitId,
    ref_month: refMonth,
    entity_type: "revenue_actual",
    entity_id: null,
    field_name: `Importação de relatório — ${fileName}`,
    old_value: null,
    new_value: lines.join(" "),
  });
}
