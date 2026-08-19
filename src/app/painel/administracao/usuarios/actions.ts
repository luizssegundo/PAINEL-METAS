"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createUser(formData: FormData) {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) return;

  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleLabel = String(formData.get("roleLabel") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const isAdmin = formData.get("isAdmin") === "on";
  const allUnits = formData.get("allUnits") === "on";
  const unitIds = formData.getAll("units").map(String);
  const editUnitIds = new Set(formData.getAll("editUnits").map(String));

  if (!fullName || !roleLabel || !email || password.length < 8) return;

  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created?.user) {
    console.error("createUser: falha ao criar usuário no Supabase Auth", error);
    return;
  }

  const newUserId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: newUserId,
    full_name: fullName,
    role_label: roleLabel,
    is_admin: isAdmin,
    all_units: allUnits,
  });
  if (profileError) {
    console.error("createUser: falha ao criar perfil", profileError);
    return;
  }

  if (!allUnits && unitIds.length) {
    await admin.from("profile_units").insert(
      unitIds.map((unitId) => ({
        profile_id: newUserId,
        unit_id: unitId,
        can_edit: editUnitIds.has(unitId),
      })),
    );
  }

  await admin.from("audit_log").insert({
    actor_id: viewer.userId,
    unit_id: null,
    ref_month: null,
    entity_type: "user",
    entity_id: newUserId,
    field_name: "Novo usuário",
    old_value: null,
    new_value: `${fullName} (${roleLabel})`,
  });

  revalidatePath("/painel/administracao/usuarios");
}

export async function updateUserPermissions(formData: FormData) {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) return;

  const userId = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleLabel = String(formData.get("roleLabel") ?? "").trim();
  const isAdmin = formData.get("isAdmin") === "on";
  const allUnits = formData.get("allUnits") === "on";
  const active = formData.get("active") === "on";
  const unitIds = formData.getAll("units").map(String);
  const editUnitIds = new Set(formData.getAll("editUnits").map(String));
  if (!userId || !fullName || !roleLabel) return;

  const admin = createAdminClient();

  const { data: before } = await admin
    .from("profiles")
    .select("full_name, role_label, is_admin, active")
    .eq("id", userId)
    .maybeSingle();

  await admin
    .from("profiles")
    .update({ full_name: fullName, role_label: roleLabel, is_admin: isAdmin, all_units: allUnits, active })
    .eq("id", userId);

  await admin.from("profile_units").delete().eq("profile_id", userId);
  if (!allUnits && unitIds.length) {
    await admin.from("profile_units").insert(
      unitIds.map((unitId) => ({
        profile_id: userId,
        unit_id: unitId,
        can_edit: editUnitIds.has(unitId),
      })),
    );
  }

  if (before) {
    await admin.from("audit_log").insert({
      actor_id: viewer.userId,
      unit_id: null,
      ref_month: null,
      entity_type: "user",
      entity_id: userId,
      field_name: `Usuário: ${fullName}`,
      old_value: `${before.role_label}${before.is_admin ? " [admin]" : ""}${!before.active ? " [inativo]" : ""}`,
      new_value: `${roleLabel}${isAdmin ? " [admin]" : ""}${!active ? " [inativo]" : ""}`,
    });
  }

  revalidatePath("/painel/administracao/usuarios");
}
