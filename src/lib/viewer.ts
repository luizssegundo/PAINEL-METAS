import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ViewerUnit = { id: string; name: string; location: string | null; canEdit: boolean };

export type Viewer = {
  userId: string;
  email: string | null;
  fullName: string;
  roleLabel: string;
  isAdmin: boolean;
  allUnits: boolean;
  hasProfile: boolean;
  units: ViewerUnit[];
};

export const requireViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role_label, is_admin, all_units, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) {
    return {
      userId: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? user.email ?? "Usuário",
      roleLabel: profile?.role_label ?? "Sem perfil vinculado",
      isAdmin: false,
      allUnits: false,
      hasProfile: Boolean(profile),
      units: [],
    };
  }

  const { data: allUnitsRows } = await supabase
    .from("units")
    .select("id, name, location")
    .eq("active", true)
    .order("name");

  let units: ViewerUnit[] = [];
  if (profile.all_units || profile.is_admin) {
    units = (allUnitsRows ?? []).map((u) => ({ ...u, canEdit: true }));
  } else {
    const { data: grants } = await supabase
      .from("profile_units")
      .select("unit_id, can_edit")
      .eq("profile_id", user.id);
    const grantMap = new Map((grants ?? []).map((g) => [g.unit_id, g.can_edit]));
    units = (allUnitsRows ?? [])
      .filter((u) => grantMap.has(u.id))
      .map((u) => ({ ...u, canEdit: grantMap.get(u.id) ?? false }));
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    roleLabel: profile.role_label,
    isAdmin: profile.is_admin,
    allUnits: profile.all_units,
    hasProfile: true,
    units,
  };
});

export function canEditAnything(viewer: Viewer): boolean {
  return viewer.isAdmin || viewer.units.some((u) => u.canEdit);
}
