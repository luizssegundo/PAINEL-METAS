import "server-only";

// XMenu Data API (NetControll) — read-only, v2. Docs:
// https://aws.netcontroll.com.br/XMenuDataApi/PublicApi/docs/index.html
const DEFAULT_BASE_URL = "https://aws.netcontroll.com.br/XMenuDataApi/PublicApi";

// Transactional routes reject periods longer than 15 days; 14-day windows stay safely under it.
const MAX_WINDOW_DAYS = 14;
// closed-sales caps a page at 200 records.
const PAGE_SIZE = 200;
// Safety net against an endless hasMore loop (200 × 200 = 40k sales per window).
const MAX_PAGES_PER_WINDOW = 200;

export type XmenuClosedSale = {
  register?: { cashDate?: string | null } | null;
  header?: {
    saleId?: number;
    waiterName?: string | null;
    operatorName?: string | null;
    cancelled?: boolean | null;
  } | null;
  totals?: {
    itemsGross?: number | null;
    serviceCharge?: number | null;
    paymentsTotal?: number | null;
  } | null;
  items?: XmenuSaleItem[] | null;
};

export type XmenuSaleItem = {
  productName?: string | null;
  groupName?: string | null;
  subgroupName?: string | null;
  quantity?: number | null;
  lineTotal?: number | null;
  additionsTotal?: number | null;
  attendantName?: string | null;
  operatorName?: string | null;
};

type ApiEnvelope<T> = {
  data?: T[] | null;
  pagination?: { hasMore?: boolean | null } | null;
};

export class XmenuApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function config() {
  const token = process.env.XMENU_API_TOKEN?.trim().replace(/^Bearer\s+/i, "");
  if (!token) throw new XmenuApiError("XMENU_API_TOKEN não está configurada no servidor.");
  const baseUrl = (process.env.XMENU_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { token, baseUrl };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Splits [first, last] (inclusive, UTC dates) into windows of at most MAX_WINDOW_DAYS days. */
function dateWindows(first: Date, last: Date): { from: string; to: string }[] {
  const windows: { from: string; to: string }[] = [];
  let start = first;
  while (start <= last) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + MAX_WINDOW_DAYS - 1);
    const windowEnd = end > last ? last : end;
    windows.push({ from: `${isoDate(start)}T00:00:00`, to: `${isoDate(windowEnd)}T23:59:59` });
    start = new Date(windowEnd);
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return windows;
}

async function getPage<T>(url: URL, token: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const retryAfter = res.headers.get("retry-after");
    const hint =
      res.status === 401
        ? "token inválido ou sem o escopo ClosedSalesRead"
        : res.status === 403
          ? "loja não autorizada no token, ou token bloqueado temporariamente"
          : res.status === 429
            ? `limite de consultas atingido${retryAfter ? ` (tente de novo em ${retryAfter}s)` : ""}`
            : "erro na API";
    throw new XmenuApiError(`XMenu respondeu HTTP ${res.status} — ${hint}. ${body.slice(0, 300)}`.trim(), res.status);
  }
  return (await res.json()) as ApiEnvelope<T>;
}

/**
 * Every non-cancelled sale from closed cash registers whose cash date ("Data Caixa") falls in
 * [first, last], with items. Requests run one at a time to stay gentle with the store's POS.
 */
export async function fetchClosedSales(storeId: string, first: Date, last: Date): Promise<XmenuClosedSale[]> {
  const { token, baseUrl } = config();
  const sales: XmenuClosedSale[] = [];

  for (const window of dateWindows(first, last)) {
    for (let page = 0; page < MAX_PAGES_PER_WINDOW; page++) {
      const url = new URL(`${baseUrl}/v2/stores/${encodeURIComponent(storeId)}/cash-registers/closed-sales`);
      url.searchParams.set("date_field", "cash_date");
      url.searchParams.set("from", window.from);
      url.searchParams.set("to", window.to);
      url.searchParams.set("include", "items");
      url.searchParams.set("detail", "full");
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(page * PAGE_SIZE));

      const body = await getPage<XmenuClosedSale>(url, token);
      const rows = body.data ?? [];
      sales.push(...rows);
      if (!body.pagination?.hasMore || rows.length === 0) break;
    }
  }

  return sales;
}
