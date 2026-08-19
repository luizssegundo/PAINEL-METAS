"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { MonthOption } from "@/lib/months";

export function MonthSelect({ months, value }: { months: MonthOption[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(monthKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", monthKey);
    params.delete("unidade");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border-0 bg-white px-3 py-1.5 font-mono text-xs font-medium text-ink outline-none"
    >
      {months.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
