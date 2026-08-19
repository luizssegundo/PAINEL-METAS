import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function PainelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role_label, is_admin, all_units")
    .eq("id", user.id)
    .single();

  const { data: units } = await supabase
    .from("units")
    .select("id, name, location")
    .order("name");

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b-[3px] border-yellow bg-[linear-gradient(175deg,#072d69_0%,#041c47_100%)] px-7 py-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-tabua-carne-white.png"
              alt="Tábua de Carne"
              width={597}
              height={330}
              className="h-9 w-auto"
            />
            <span className="font-mono text-[11px] uppercase tracking-wide text-yellow">
              Painel Interno
            </span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full bg-seafoam px-4 py-1.5 text-xs font-semibold text-navy"
            >
              Sair
            </button>
          </form>
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold">Metas de Vendas & Faturamento</h1>
      </header>

      <section className="mx-auto max-w-5xl px-7 py-10">
        {profile ? (
          <div className="rounded-lg border border-border-navy bg-white p-5">
            <p className="text-sm text-ink-soft">Logado como</p>
            <p className="font-serif text-xl font-semibold text-navy">
              {profile.full_name} — {profile.role_label}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {profile.is_admin ? "Administrador do sistema. " : ""}
              {profile.all_units ? "Acesso a todas as unidades." : "Acesso definido por unidade."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-terracotta/40 bg-terracotta/10 p-5 text-sm text-ink">
            Sua conta foi autenticada, mas ainda não tem um perfil cadastrado no sistema. Peça a
            um administrador para vincular seu acesso.
          </div>
        )}

        <h2 className="mt-10 font-serif text-xl font-semibold text-navy">Unidades cadastradas</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(units ?? []).map((u) => (
            <li key={u.id} className="rounded-lg border-t-[3px] border-navy bg-white p-4 shadow-sm">
              <p className="font-serif font-semibold text-navy">{u.name}</p>
              <p className="text-xs text-ink-soft">{u.location}</p>
            </li>
          ))}
        </ul>
        {(units ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            Nenhuma unidade visível — isso é esperado se o seu perfil ainda não tem acesso
            liberado a nenhuma loja.
          </p>
        ) : null}
      </section>
    </main>
  );
}
