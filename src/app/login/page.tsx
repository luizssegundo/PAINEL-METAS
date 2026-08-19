import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Painel de Metas",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(175deg,#072d69_0%,#041c47_100%)] px-4 py-12">
      <div className="w-full max-w-[380px] rounded-[10px] border border-yellow/25 bg-white/[0.06] px-[34px] py-[38px]">
        <Image
          src="/logo-tabua-carne-white.png"
          alt="Tábua de Carne"
          width={597}
          height={330}
          priority
          className="mb-[22px] h-10 w-auto"
        />
        <h1 className="font-serif text-[22px] font-semibold text-white">Painel de Metas</h1>
        <p className="mt-1 text-[13px] text-seafoam">Acesso restrito à equipe Tábua de Carne</p>
        <LoginForm />
        <p className="mt-6 text-center text-[11.5px] text-white/45">
          Acesso via Supabase Auth. Esqueceu a senha? Fale com o administrador do sistema.
        </p>
      </div>
    </main>
  );
}
