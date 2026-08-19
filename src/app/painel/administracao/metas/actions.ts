"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertRevenueTarget(formData: FormData) {
  const unitId = String(formData.get("unitId") ?? "");
  const refMonth = String(formData.get("refMonth") ?? "");
  const amount = Number(formData.get("amount"));
  if (!unitId || !refMonth || !amount || amount <= 0) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("unit_revenue_targets")
    .select("id")
    .eq("unit_id", unitId)
    .eq("ref_month", refMonth)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("unit_revenue_targets")
      .update({ target_amount: amount })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("unit_revenue_targets")
      .insert({ unit_id: unitId, ref_month: refMonth, target_amount: amount });
  }

  revalidatePath("/painel/administracao/metas");
  revalidatePath("/painel");
}
