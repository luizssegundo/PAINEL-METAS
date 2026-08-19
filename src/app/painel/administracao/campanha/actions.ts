"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCampaignItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const itemType = String(formData.get("itemType") ?? "");
  const targetPerSeller = Number(formData.get("targetPerSeller"));
  const unitId = String(formData.get("unitId") ?? "");
  const refMonth = String(formData.get("refMonth") ?? "");
  if (!name || !itemType || !targetPerSeller || targetPerSeller <= 0 || !refMonth) return;

  const supabase = await createClient();
  await supabase.from("campaign_items").insert({
    name,
    item_type: itemType,
    target_per_seller: targetPerSeller,
    unit_id: unitId === "global" ? null : unitId || null,
    ref_month: refMonth,
  });
  revalidatePath("/painel/administracao/campanha");
  revalidatePath("/painel");
}

export async function updateCampaignItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const targetPerSeller = Number(formData.get("targetPerSeller"));
  const active = formData.get("active") === "on";
  if (!id || !name || !targetPerSeller || targetPerSeller <= 0) return;

  const supabase = await createClient();
  await supabase
    .from("campaign_items")
    .update({ name, target_per_seller: targetPerSeller, active })
    .eq("id", id);
  revalidatePath("/painel/administracao/campanha");
  revalidatePath("/painel");
}

export async function deleteCampaignItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("campaign_items").delete().eq("id", id);
  revalidatePath("/painel/administracao/campanha");
  revalidatePath("/painel");
}
