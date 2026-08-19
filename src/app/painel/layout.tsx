import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { requireViewer, canEditAnything } from "@/lib/viewer";
import { signOut } from "@/app/login/actions";
import { HeaderMonthControls } from "@/components/header-month-controls";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const showAdminNav = canEditAnything(viewer);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b-[3px] border-yellow bg-[linear-gradient(175deg,#072d69_0%,#041c47_100%)] px-7 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/painel">
              <Image
                src="/logo-tabua-carne-white.png"
                alt="Tábua de Carne"
                width={597}
                height={330}
                className="h-9 w-auto"
              />
            </Link>
            <span className="hidden h-6 w-px bg-white/20 sm:block" />
            <span className="hidden font-mono text-[11px] uppercase tracking-wide text-yellow sm:block">
              Painel Interno
            </span>
            {showAdminNav ? (
              <nav className="ml-4 flex items-center gap-4 font-mono text-xs uppercase tracking-wide text-white/70">
                <Link href="/painel" className="hover:text-white">
                  Painel
                </Link>
                <Link href="/painel/administracao" className="hover:text-white">
                  Administração
                </Link>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <Suspense fallback={null}>
              <HeaderMonthControls />
            </Suspense>
            <div className="hidden text-right sm:block">
              <p className="text-xs text-seafoam">{viewer.fullName}</p>
              <p className="font-mono text-[10px] text-white/50">{viewer.roleLabel}</p>
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
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-7 py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-7 pb-8 text-center text-[11px] text-ink-soft/70">
        Painel de Metas — Tábua de Carne. Dados operacionais integrados via ERP/PDV e lançamento
        manual conferido pela administração.
      </footer>
    </div>
  );
}
