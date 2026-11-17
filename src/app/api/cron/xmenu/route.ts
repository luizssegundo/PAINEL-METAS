import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncUnitMonthFromXmenu } from "@/lib/xmenu/sync";

// Several units × several API pages, run one after another.
export const maxDuration = 300;

// Brazil has no DST, so a fixed offset gives the local date.
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;
// Same grace period as acceptsReports(): the previous month keeps updating until day 5.
const REPORT_GRACE_DAY = 5;

function monthsToSync(): string[] {
  const local = new Date(Date.now() - BRAZIL_OFFSET_MS);
  const key = (offset: number) => {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + offset, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  };
  return local.getUTCDate() <= REPORT_GRACE_DAY ? [key(-1), key(0)] : [key(0)];
}

/**
 * Daily XMenu sync, called by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is rejected.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: units, error } = await createAdminClient()
    .from("units")
    .select("id, name, xmenu_store_id")
    .eq("active", true)
    .not("xmenu_store_id", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: { unit: string; month: string; ok: boolean; lines: string[] }[] = [];
  for (const unit of units ?? []) {
    const storeId = unit.xmenu_store_id?.trim();
    if (!storeId) continue;
    for (const refMonth of monthsToSync()) {
      try {
        const r = await syncUnitMonthFromXmenu({ unitId: unit.id, storeId, refMonth, actorId: null });
        results.push({ unit: unit.name, month: refMonth, ...r });
      } catch (err) {
        results.push({ unit: unit.name, month: refMonth, ok: false, lines: [String(err)] });
      }
    }
  }

  revalidatePath("/painel", "layout");
  return Response.json({ results });
}
