"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSeller(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const unitId = String(formData.get("unitId") ?? "");
  if (!name || !unitId) return;

  const supabase = await createClient();
  await supabase.from("sellers").insert({ name, unit_id: unitId });
  revalidatePath("/painel/administracao/vendedores");
}

export async function updateSeller(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!id || !name) return;

  const supabase = await createClient();
  await supabase.from("sellers").update({ name, active }).eq("id", id);
  revalidatePath("/painel/administracao/vendedores");
}
