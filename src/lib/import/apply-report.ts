import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CategoryKey, ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";
import { normalizeName } from "@/lib/import/normalize";
import { formatCurrency } from "@/lib/format";

// The ERP report's revenue excludes the 10% service fee; managers track sales with it included.
const SERVICE_FEE_RATE = 0.1;

type Db = SupabaseClient<Database>;
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

/**
 * Loose form for comparing campaign names with report Grupo/Subgrupo names: accents, punctuation
 * and plural "s" dropped, so "Vinhos Tintos" matches "VINHOS TINTOS" and "Vinho" matches
 * "VINHO TAÇA 187ML" / "VINHOS BRANCOS".
 */
function groupMatchForm(text: string): string {
  return normalizeName(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .join(" ");
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

/**
 * Writes a parsed sales report (from a PDF/xlsx upload or from the XMenu API) into the panel:
 * creates missing sellers, sets the month's revenue, and upserts category and campaign sales.
 * `db` is the signed-in user's client for uploads (RLS applies) or the service-role client for
 * the XMenu integration, whose rows use source "erp". Returns the summary lines for the audit log.
 */
export async function applyParsedReport(
  db: Db,
  {
    unitId,
    refMonth,
    parsed,
    source,
    externalRef,
  }: { unitId: string; refMonth: string; parsed: ParsedHierarchicalReport; source: "import" | "erp"; externalRef: string },
): Promise<string[]> {
  const { data: existingSellers } = await db.from("sellers").select("id, name").eq("unit_id", unitId);

  const sellerIdByNorm = new Map((existingSellers ?? []).map((s) => [normalizeName(s.name), s.id]));

  const newSellerNames = [...parsed.sellerNames].filter((n) => !sellerIdByNorm.has(normalizeName(n)));
  if (newSellerNames.length > 0) {
    const { data: created } = await db
      .from("sellers")
      .insert(newSellerNames.map((name) => ({ name, unit_id: unitId })))
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
    const { data: existingActual } = await db
      .from("unit_revenue_actuals")
      .select("id")
      .eq("unit_id", unitId)
      .eq("ref_month", refMonth)
      .maybeSingle();

    if (existingActual) {
      await db
        .from("unit_revenue_actuals")
        .update({ actual_amount: revenueWithFee, source, external_ref: externalRef })
        .eq("id", existingActual.id);
    } else {
      await db.from("unit_revenue_actuals").insert({
        unit_id: unitId,
        ref_month: refMonth,
        actual_amount: revenueWithFee,
        source,
        external_ref: externalRef,
      });
    }
  }

  const { data: categories } = await db.from("product_categories").select("id, name");
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
        source,
        external_ref: externalRef,
      });
    }
  }
  if (categoryRows.length > 0) {
    await db.from("seller_category_sales").upsert(categoryRows, { onConflict: "seller_id,category_id,ref_month" });
  }

  const { data: globalCampaignItems } = await db
    .from("campaign_items")
    .select("id, name, item_type")
    .eq("ref_month", refMonth)
    .eq("active", true)
    .is("unit_id", null);
  const { data: unitCampaignItems } = await db
    .from("campaign_items")
    .select("id, name, item_type")
    .eq("ref_month", refMonth)
    .eq("active", true)
    .eq("unit_id", unitId);
  const campaignItems = [...(globalCampaignItems ?? []), ...(unitCampaignItems ?? [])].map((c) => {
    const norm = normalizeName(c.name);
    return {
      id: c.id,
      norm,
      categoryKey: CAMPAIGN_CATEGORY_MATCH[norm] ?? null,
      aliases: CAMPAIGN_PRODUCT_ALIASES[norm] ?? [norm],
      // "Grupo de produtos" campaigns also match the report's Grupo/Subgrupo (e.g. "VINHOS TINTOS"),
      // since product lines rarely carry the group's name — wine labels never say "vinho".
      groupForm: c.item_type === "grupo_de_produtos" ? groupMatchForm(c.name) : null,
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
      campaignRows.push({ seller_id: sellerId, campaign_item_id: item.id, qty_sold: qty, source, external_ref: externalRef });
    }
  }

  // Product-based campaigns: match by alias substrings (defaults to the campaign's own name), or —
  // for "grupo de produtos" — by the Grupo/Subgrupo the product was listed under. A product line
  // counts toward every campaign it matches (e.g. a red wine for both "Vinhos Tintos" and "Carta de Vinhos").
  const productCampaignItems = campaignItems.filter((c) => !c.categoryKey);
  const groupFormsByProduct = new Map<string, string[]>();
  for (const [productName, groups] of parsed.productGroups) {
    groupFormsByProduct.set(productName, [...groups].map(groupMatchForm));
  }
  for (const [sellerName, prodMap] of parsed.sellerProductQty) {
    const sellerId = sellerIdByNorm.get(normalizeName(sellerName));
    if (!sellerId) continue;
    for (const [productName, qty] of prodMap) {
      const productNorm = normalizeName(productName);
      const productGroupForms = groupFormsByProduct.get(productName) ?? [];
      for (const item of productCampaignItems) {
        const byName = item.aliases.some((alias) => productNorm.includes(alias));
        const byGroup =
          item.groupForm !== null && productGroupForms.some((g) => (" " + g + " ").includes(" " + item.groupForm + " "));
        if (!byName && !byGroup) continue;
        campaignRows.push({
          seller_id: sellerId,
          campaign_item_id: item.id,
          qty_sold: qty,
          source,
          external_ref: externalRef,
        });
      }
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
    await db.from("seller_campaign_sales").upsert(rows, { onConflict: "seller_id,campaign_item_id" });
  }

  const summaryLines = [
    `${parsed.sellerNames.size} vendedor(es) no relatório (${newSellerNames.length} novo(s) cadastrado(s) automaticamente).`,
    parsed.totalRevenue === null || revenueWithFee === null
      ? "Nenhuma coluna de valor encontrada — faturamento realizado não foi atualizado."
      : parsed.revenueIncludesServiceFee
        ? `Faturamento realizado importado: ${formatCurrency(revenueWithFee)} (taxa de serviço já incluída no relatório).`
        : `Faturamento realizado importado: ${formatCurrency(revenueWithFee)} (${formatCurrency(parsed.totalRevenue)} do relatório + 10% de taxa de serviço).`,
    `${categoryRows.length} lançamento(s) de vendas por categoria.`,
    `${campaignRows.length} lançamento(s) de vendas de campanha.`,
  ];
  if (parsed.genericSellerNames.size > 0) {
    summaryLines.push(
      `Contas genéricas (não viram vendedor, mas o faturamento delas entra no total): ${[...parsed.genericSellerNames].join(", ")}.`,
    );
  }
  summaryLines.push(...parsed.warnings);
  return summaryLines;
}

/** Records an import run in the audit log (shown as "Última importação" on the Importar page). */
export async function logImport(
  actorId: string | null,
  unitId: string,
  refMonth: string,
  label: string,
  lines: string[],
) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: actorId,
    unit_id: unitId,
    ref_month: refMonth,
    entity_type: "revenue_actual",
    entity_id: null,
    field_name: `Importação de relatório — ${label}`,
    old_value: null,
    new_value: lines.join(" "),
  });
}
