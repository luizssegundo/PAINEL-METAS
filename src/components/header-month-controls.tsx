"use client";

import { useSearchParams } from "next/navigation";
import { MonthSelect } from "@/components/month-select";
import { recentMonths, currentMonthKey, isCurrentMonth } from "@/lib/months";

export function HeaderMonthControls() {
  const searchParams = useSearchParams();
  const monthKey = searchParams.get("mes") ?? currentMonthKey();
  const months = recentMonths(12);

  return (
    <div className="flex items-center gap-3">
      <MonthSelect months={months} value={monthKey} />
      {!isCurrentMonth(monthKey) ? (
        <span className="rounded-full bg-seafoam px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-navy">
          Somente consulta
        </span>
      ) : null}
    </div>
  );
}
