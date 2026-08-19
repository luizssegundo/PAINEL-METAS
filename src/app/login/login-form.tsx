"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-md bg-yellow py-2.5 text-sm font-bold text-navy transition-opacity disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block font-mono text-[11px] uppercase tracking-wide text-seafoam"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border-0 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-yellow"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block font-mono text-[11px] uppercase tracking-wide text-seafoam"
        >
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border-0 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-yellow"
        />
      </div>
      {state.error ? <p className="text-[12px] font-medium text-yellow">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
