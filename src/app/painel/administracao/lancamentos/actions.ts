"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertRevenueActual(formData: FormData) {
  const unitId = String(formData.get("unitId") ?? "");
  const refMonth = String(formData.get("refMonth") ?? "");
  const amount = Number(formData.get("amount"));
  if (!unitId || !refMonth || Number.isNaN(amount) || amount < 0) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("unit_revenue_actuals")
    .select("id")
    .eq("unit_id", unitId)
    .eq("ref_month", refMonth)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("unit_revenue_actuals")
      .update({ actual_amount: amount, source: "manual" })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("unit_revenue_actuals")
      .insert({ unit_id: unitId, ref_month: refMonth, actual_amount: amount, source: "manual" });
  }
  revalidatePath("/painel/administracao/lancamentos");
  revalidatePath("/painel");
}

const UUID_PAIR = /^qty__([0-9a-f-]{36})__([0-9a-f-]{36})$/;

export async function saveCategorySales(formData: FormData) {
  const refMonth = String(formData.get("refMonth") ?? "");
  if (!refMonth) return;

  const rows: {
    seller_id: string;
    category_id: string;
    items_sold: number;
    ref_month: string;
    source: string;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    const match = key.match(UUID_PAIR);
    if (!match) continue;
    const qty = Number(value);
    if (Number.isNaN(qty) || qty < 0) continue;
    rows.push({
      seller_id: match[1],
      category_id: match[2],
      items_sold: qty,
      ref_month: refMonth,
      source: "manual",
    });
  }
  if (rows.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("seller_category_sales")
    .upsert(rows, { onConflict: "seller_id,category_id,ref_month" });
  revalidatePath("/painel/administracao/lancamentos");
  revalidatePath("/painel");
}

const CAMP_PAIR = /^camp__([0-9a-f-]{36})__([0-9a-f-]{36})$/;

export async function saveCampaignSales(formData: FormData) {
  const rows: { seller_id: string; campaign_item_id: string; qty_sold: number; source: string }[] =
    [];

  for (const [key, value] of formData.entries()) {
    const match = key.match(CAMP_PAIR);
    if (!match) continue;
    const qty = Number(value);
    if (Number.isNaN(qty) || qty < 0) continue;
    rows.push({
      seller_id: match[1],
      campaign_item_id: match[2],
      qty_sold: qty,
      source: "manual",
    });
  }
  if (rows.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("seller_campaign_sales")
    .upsert(rows, { onConflict: "seller_id,campaign_item_id" });
  revalidatePath("/painel/administracao/lancamentos");
  revalidatePath("/painel");
}
