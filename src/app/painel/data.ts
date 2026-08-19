import { createClient } from "@/lib/supabase/server";
import { pctOf } from "@/lib/format";
import type { ViewerUnit } from "@/lib/viewer";

const NIL_ID = "00000000-0000-0000-0000-000000000000";

export type UnitSummary = {
  id: string;
  name: string;
  location: string | null;
  canEdit: boolean;
  target: number;
  actual: number;
  pct: number;
};

export type SellerRow = { id: string; name: string; unitId: string; unitName: string };

export type CampaignItemRow = {
  id: string;
  name: string;
  itemType: string;
  targetPerSeller: number;
  unitId: string | null;
};

export type DashboardData = {
  categories: { id: string; name: string }[];
  unitSummaries: UnitSummary[];
  sellers: SellerRow[];
  categorySales: Map<string, Map<string, number>>;
  campaignItems: CampaignItemRow[];
  campaignSales: Map<string, Map<string, number>>;
};

export async function loadDashboardData(
  monthKey: string,
  units: ViewerUnit[],
): Promise<DashboardData> {
  const supabase = await createClient();
  const unitIds = units.map((u) => u.id);
  const unitIdsOrNil = unitIds.length ? unitIds : [NIL_ID];
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  const [
    { data: targets },
    { data: actuals },
    { data: categories },
    { data: sellersData },
  ] = await Promise.all([
    supabase
      .from("unit_revenue_targets")
      .select("unit_id, target_amount")
      .eq("ref_month", monthKey)
      .in("unit_id", unitIdsOrNil),
    supabase
      .from("unit_revenue_actuals")
      .select("unit_id, actual_amount")
      .eq("ref_month", monthKey)
      .in("unit_id", unitIdsOrNil),
    supabase.from("product_categories").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("sellers")
      .select("id, name, unit_id")
      .eq("active", true)
      .in("unit_id", unitIdsOrNil),
  ]);

  const targetByUnit = new Map((targets ?? []).map((t) => [t.unit_id, Number(t.target_amount)]));
  const actualByUnit = new Map((actuals ?? []).map((a) => [a.unit_id, Number(a.actual_amount)]));

  const unitSummaries: UnitSummary[] = units.map((u) => {
    const target = targetByUnit.get(u.id) ?? 0;
    const actual = actualByUnit.get(u.id) ?? 0;
    return {
      id: u.id,
      name: u.name,
      location: u.location,
      canEdit: u.canEdit,
      target,
      actual,
      pct: pctOf(actual, target),
    };
  });

  const sellers: SellerRow[] = (sellersData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    unitId: s.unit_id,
    unitName: unitNameById.get(s.unit_id) ?? "",
  }));
  const sellerIds = sellers.map((s) => s.id);
  const sellerIdsOrNil = sellerIds.length ? sellerIds : [NIL_ID];

  const { data: catSales } = await supabase
    .from("seller_category_sales")
    .select("seller_id, category_id, items_sold")
    .eq("ref_month", monthKey)
    .in("seller_id", sellerIdsOrNil);

  const categorySales = new Map<string, Map<string, number>>();
  for (const row of catSales ?? []) {
    if (!categorySales.has(row.seller_id)) categorySales.set(row.seller_id, new Map());
    categorySales.get(row.seller_id)!.set(row.category_id, row.items_sold);
  }

  const [{ data: globalCampaignItems }, { data: unitCampaignItems }] = await Promise.all([
    supabase
      .from("campaign_items")
      .select("id, name, item_type, target_per_seller, unit_id")
      .eq("ref_month", monthKey)
      .eq("active", true)
      .is("unit_id", null),
    supabase
      .from("campaign_items")
      .select("id, name, item_type, target_per_seller, unit_id")
      .eq("ref_month", monthKey)
      .eq("active", true)
      .in("unit_id", unitIdsOrNil),
  ]);

  const campaignItems: CampaignItemRow[] = [
    ...(globalCampaignItems ?? []),
    ...(unitCampaignItems ?? []),
  ].map((c) => ({
    id: c.id,
    name: c.name,
    itemType: c.item_type,
    targetPerSeller: c.target_per_seller,
    unitId: c.unit_id,
  }));
  const campaignItemIds = campaignItems.map((c) => c.id);

  const campaignSales = new Map<string, Map<string, number>>();
  if (campaignItemIds.length) {
    const { data: campSales } = await supabase
      .from("seller_campaign_sales")
      .select("seller_id, campaign_item_id, qty_sold")
      .in("seller_id", sellerIdsOrNil)
      .in("campaign_item_id", campaignItemIds);
    for (const row of campSales ?? []) {
      if (!campaignSales.has(row.seller_id)) campaignSales.set(row.seller_id, new Map());
      campaignSales.get(row.seller_id)!.set(row.campaign_item_id, row.qty_sold);
    }
  }

  return {
    categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name })),
    unitSummaries,
    sellers,
    categorySales,
    campaignItems,
    campaignSales,
  };
}
