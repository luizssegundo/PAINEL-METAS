import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer, canEditAnything } from "@/lib/viewer";

const SECTIONS = [
  { href: "/painel/administracao/usuarios", label: "Usuários e acesso" },
  { href: "/painel/administracao/vendedores", label: "Vendedores" },
  { href: "/painel/administracao/metas", label: "Metas de faturamento" },
  { href: "/painel/administracao/campanha", label: "Campanha de vendas" },
  { href: "/painel/administracao/importar", label: "Importar relatório" },
  { href: "/painel/administracao/lancamentos", label: "Lançamentos" },
  { href: "/painel/administracao/auditoria", label: "Auditoria" },
];

export default async function AdministracaoLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  if (!canEditAnything(viewer)) {
    redirect("/painel");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy">Administração</h1>
        <div className="mt-1 h-0.5 w-9 bg-yellow" />
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-border-navy pb-4">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-full border border-border-navy bg-white px-3.5 py-1.5 text-xs font-medium text-navy hover:bg-table-head"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
