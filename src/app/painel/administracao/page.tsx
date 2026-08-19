import Link from "next/link";

const CARDS = [
  {
    href: "/painel/administracao/usuarios",
    title: "Usuários e acesso",
    description: "Cadastrar usuários, definir unidades liberadas e permissão de edição.",
  },
  {
    href: "/painel/administracao/vendedores",
    title: "Vendedores",
    description: "Cadastro de vendedores por unidade.",
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
    href: "/painel/administracao/lancamentos",
    title: "Lançamentos",
    description: "Faturamento realizado e vendas por vendedor (enquanto a integração com o ERP não está ativa).",
  },
  {
    href: "/painel/administracao/auditoria",
    title: "Auditoria",
    description: "Histórico de alterações filtrável por mês e unidade.",
  },
];

export default function AdministracaoHomePage() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((c) => (
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
