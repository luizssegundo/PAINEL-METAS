export function formatCurrency(value: number): string {
  return "R$ " + Math.round(value).toLocaleString("pt-BR");
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + "%";
}

export function pctOf(real: number, meta: number): number {
  return meta ? (real / meta) * 100 : 0;
}

export type Tier = "hit" | "mid" | "low";

export function tierFromPercent(percent: number, midThreshold = 80): Tier {
  if (percent >= 100) return "hit";
  if (percent >= midThreshold) return "mid";
  return "low";
}

export const TIER_CLASSES: Record<Tier, { badge: string; bar: string; text: string }> = {
  hit: {
    badge: "bg-yellow/35 text-[#6b5400]",
    bar: "bg-[linear-gradient(90deg,#c9a300,#FFDF00)]",
    text: "text-yellow",
  },
  mid: {
    badge: "bg-seafoam/55 text-[#0a5245]",
    bar: "bg-[linear-gradient(90deg,#6fa89c,#BDDED7)]",
    text: "text-[#0a5245]",
  },
  low: {
    badge: "bg-terracotta/20 text-[#7a4a1f]",
    bar: "bg-[linear-gradient(90deg,#8f5a2a,#B6763A)]",
    text: "text-terracotta",
  },
};
