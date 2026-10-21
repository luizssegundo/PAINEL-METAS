import Link from "next/link";
import { requireViewer } from "@/lib/viewer";

const CARDS = [
  {
    href: "/painel/administracao/usuarios",
    title: "Usuários e acesso",
    description: "Cadastrar usuários, definir unidades liberadas e permissão de edição.",
    adminOnly: true,
  },
  {
    href: "/painel/administracao/vendedores",
    title: "Vendedores",
    description: "Lista de vendedores por unidade, sincronizada automaticamente pela importação do relatório de vendas.",
  },
  {
    href: "/painel/administracao/metas",
    title: "Metas de faturamento",
    description: "Meta por unidade no mês vigente.",
  },
  {
    href: "/painel/administracao/campanha",
    title: "Campanha de vendas",
    description: "Produtos e metas de campanha do mês.",
  },
  {
    href: "/painel/administracao/importar",
    title: "Importar relatório",
    description: "Envie o relatório de vendas do ERP (.xlsx) para atualizar vendedores, faturamento e vendas — use quando a integração automática não estiver disponível.",
  },
  {
    href: "/painel/administracao/auditoria",
    title: "Auditoria",
    description: "Histórico de alterações filtrável por mês e unidade.",
    adminOnly: true,
  },
];

export default async function AdministracaoHomePage() {
  const viewer = await requireViewer();
  const cards = CARDS.filter((c) => !c.adminOnly || viewer.isAdmin);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="rounded-lg border-t-[3px] border-navy bg-white p-4 shadow-sm hover:shadow-md"
        >
          <p className="font-serif font-semibold text-navy">{c.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{c.description}</p>
        </Link>
      ))}
    </div>
  );
}
