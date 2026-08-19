import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { createUser, updateUserPermissions } from "./actions";

export default async function UsuariosPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect("/painel/administracao");

  const supabase = await createClient();
  const [{ data: profiles }, { data: grants }, { data: units }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role_label, is_admin, all_units, active")
      .order("full_name"),
    supabase.from("profile_units").select("profile_id, unit_id, can_edit"),
    supabase.from("units").select("id, name").order("name"),
  ]);

  const grantsByProfile = new Map<string, { unit_id: string; can_edit: boolean }[]>();
  for (const g of grants ?? []) {
    if (!grantsByProfile.has(g.profile_id)) grantsByProfile.set(g.profile_id, []);
    grantsByProfile.get(g.profile_id)!.push(g);
  }
  const unitNameById = new Map((units ?? []).map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Usuários cadastrados</h2>
        <div className="mt-3 space-y-2">
          {(profiles ?? []).map((p) => {
            const userGrants = grantsByProfile.get(p.id) ?? [];
            const scopeText = p.all_units
              ? "Todas as unidades"
              : userGrants.length
                ? userGrants
                    .map((g) => `${unitNameById.get(g.unit_id) ?? "?"}${g.can_edit ? "" : " (consulta)"}`)
                    .join(", ")
                : "Nenhuma unidade";
            return (
              <details key={p.id} className="rounded-md border border-border-navy-soft">
                <summary className="cursor-pointer list-none px-3 py-2.5 hover:bg-table-head">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium text-ink">{p.full_name}</span>{" "}
                      <span className="text-xs text-ink-soft">— {p.role_label}</span>
                      {p.is_admin ? (
                        <span className="ml-2 rounded-full bg-yellow/35 px-2 py-0.5 text-[10px] font-semibold text-[#6b5400]">
                          ADMIN
                        </span>
                      ) : null}
                      {!p.active ? (
                        <span className="ml-2 rounded-full bg-terracotta/20 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
                          INATIVO
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink-soft">{scopeText}</span>
                  </span>
                </summary>
                <div className="border-t border-border-navy-soft px-3 py-3">
                  <form action={updateUserPermissions} className="space-y-3">
                    <input type="hidden" name="userId" value={p.id} />
                    <div className="flex flex-wrap gap-3">
                      <div>
                        <label className="block text-xs text-ink-soft">Nome</label>
                        <input
                          name="fullName"
                          defaultValue={p.full_name}
                          className="mt-1 rounded-md border border-border-navy px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-soft">Cargo</label>
                        <input
                          name="roleLabel"
                          defaultValue={p.role_label}
                          className="mt-1 rounded-md border border-border-navy px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-ink-soft">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" name="isAdmin" defaultChecked={p.is_admin} /> Administrador
                        do sistema
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" name="allUnits" defaultChecked={p.all_units} /> Acesso a
                        todas as unidades
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" name="active" defaultChecked={p.active} /> Ativo
                      </label>
                    </div>
                    <div>
                      <p className="text-xs text-ink-soft">
                        Unidades liberadas (ignorado se &quot;todas as unidades&quot; marcado)
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {(units ?? []).map((u) => {
                          const grant = userGrants.find((g) => g.unit_id === u.id);
                          return (
                            <span
                              key={u.id}
                              className="flex items-center gap-2 rounded-md border border-border-navy-soft px-2 py-1"
                            >
                              <label className="flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  name="units"
                                  value={u.id}
                                  defaultChecked={Boolean(grant)}
                                />{" "}
                                {u.name}
                              </label>
                              <label className="flex items-center gap-1 text-[10px] text-ink-soft">
                                <input
                                  type="checkbox"
                                  name="editUnits"
                                  value={u.id}
                                  defaultChecked={grant?.can_edit ?? false}
                                />{" "}
                                editar
                              </label>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Salvar
                    </button>
                  </form>
                </div>
              </details>
            );
          })}
          {(profiles ?? []).length === 0 ? (
            <p className="text-sm text-ink-soft">Nenhum usuário cadastrado.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border-navy bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">Novo usuário</h2>
        <form action={createUser} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-ink-soft">Nome</label>
              <input
                name="fullName"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft">Cargo</label>
              <input
                name="roleLabel"
                required
                placeholder="Ex.: Gerente — Mossoró"
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft">E-mail</label>
              <input
                type="email"
                name="email"
                required
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft">Senha provisória</label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                className="mt-1 rounded-md border border-border-navy px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-ink-soft">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="isAdmin" /> Administrador do sistema
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="allUnits" /> Acesso a todas as unidades
            </label>
          </div>
          <div>
            <p className="text-xs text-ink-soft">
              Unidades liberadas (ignorado se &quot;todas as unidades&quot; marcado)
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              {(units ?? []).map((u) => (
                <span
                  key={u.id}
                  className="flex items-center gap-2 rounded-md border border-border-navy-soft px-2 py-1"
                >
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="units" value={u.id} /> {u.name}
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-ink-soft">
                    <input type="checkbox" name="editUnits" value={u.id} /> editar
                  </label>
                </span>
              ))}
            </div>
          </div>
          <button type="submit" className="rounded-md bg-yellow px-4 py-1.5 text-sm font-bold text-navy">
            Cadastrar usuário
          </button>
        </form>
      </section>
    </div>
  );
}
