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

const SOURCE = "import";

type DbCategory = { id: string; name: string };

const CATEGORY_KEY_DETECTORS: Record<CategoryKey, (normalizedDbName: string) => boolean> = {
  pratos_principais: (n) => n.includes("principa"), // matches "principal" and "principais"
  bebidas: (n) => n.includes("bebida"),
  entradas_petiscos: (n) => n.includes("entrada") || n.includes("petisco"),
  acompanhamentos: (n) => n.includes("acompanhamento"),
  sobremesas: (n) => n.includes("sobremesa"),
};

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

  if (parsed.totalRevenue !== null) {
    const { data: existingActual } = await supabase
      .from("unit_revenue_actuals")
      .select("id")
      .eq("unit_id", unit.id)
      .eq("ref_month", refMonth)
      .maybeSingle();

    if (existingActual) {
      await supabase
        .from("unit_revenue_actuals")
        .update({ actual_amount: parsed.totalRevenue, source: SOURCE, external_ref: file.name })
        .eq("id", existingActual.id);
    } else {
      await supabase.from("unit_revenue_actuals").insert({
        unit_id: unit.id,
        ref_month: refMonth,
        actual_amount: parsed.totalRevenue,
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
        items_sold: qty,
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
  const campaignItems = [...(globalCampaignItems ?? []), ...(unitCampaignItems ?? [])].map((c) => ({
    id: c.id,
    norm: normalizeName(c.name),
  }));

  const campaignRows: { seller_id: string; campaign_item_id: string; qty_sold: number; source: string; external_ref: string }[] = [];

  for (const [sellerName, prodMap] of parsed.sellerProductQty) {
    const sellerId = sellerIdByNorm.get(normalizeName(sellerName));
    if (!sellerId) continue;
    for (const [productName, qty] of prodMap) {
      const productNorm = normalizeName(productName);
      const match = campaignItems.find((c) => productNorm.includes(c.norm));
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
    await supabase.from("seller_campaign_sales").upsert([...merged.values()], { onConflict: "seller_id,campaign_item_id" });
  }

  const summaryLines = [
    `${parsed.sellerNames.size} vendedor(es) no arquivo (${newSellerNames.length} novo(s) cadastrado(s) automaticamente).`,
    parsed.totalRevenue !== null
      ? `Faturamento realizado importado: ${formatCurrency(parsed.totalRevenue)}.`
      : "Nenhuma coluna de valor encontrada — faturamento realizado não foi atualizado.",
    `${categoryRows.length} lançamento(s) de vendas por categoria.`,
    `${campaignRows.length} lançamento(s) de vendas de campanha.`,
  ];
  summaryLines.push(...warnings);

  await logImport(viewer.userId, unit.id, refMonth, file.name, summaryLines);

  revalidatePath("/painel/administracao/importar");
  revalidatePath("/painel/administracao/vendedores");
  revalidatePath("/painel/administracao/lancamentos");
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
