import { normalizeName } from "@/lib/import/normalize";

export type CategoryKey = "pratos_principais" | "bebidas" | "entradas_petiscos" | "acompanhamentos" | "sobremesas";

// Subgrupos that never represent a sold product (fees, notes, stock, test data).
export const EXCLUDE_KEYWORDS = [
  "embalage",
  "estoque",
  "diversos",
  "taxa",
  "kids",
  "ponto da carne",
  "teste",
  "obs sanduiche",
  "ifood",
  "compras diversas",
  "outros",
];

// Checked in this order — first match wins. "vinho"/"espumante" must be
// resolved before "sobremesa" so "VINHO SOBREMESA" lands in bebidas, not sobremesas.
const CATEGORY_KEYWORDS: { key: CategoryKey; keywords: string[] }[] = [
  {
    key: "bebidas",
    keywords: [
      "bebida",
      "cafe",
      "cerveja",
      "drink",
      "happy hour",
      "refrigerante",
      "suco",
      "agua",
      "cachaca",
      "destilado",
      "detilado", // recurring ERP typo for "destilado"
      "licor",
      "whisk",
      "vinho",
      "espumante",
      "frisante",
      "garrafa",
      "chopp",
      "chope",
      "aniversariante", // complimentary birthday drinks
    ],
  },
  {
    key: "sobremesas",
    keywords: ["sobremesa", "doce brasa", "picole", "sorvete", "gelado"],
  },
  {
    key: "acompanhamentos",
    keywords: ["acompanhamento", "porcao", "porcoes", "guarnicao", "guarnicoes", "salada", "molho"],
  },
  {
    key: "entradas_petiscos",
    keywords: ["entrada", "petisco", "couvert", "couver", "volante", "rodizio"],
  },
  {
    key: "pratos_principais",
    keywords: [
      "tabua",
      "parrilla",
      "grill chef",
      "trad tabua",
      "prato p/",
      "pratos p/",
      "prato individual",
      "pratos individuais",
      "prato dia a dia",
      "pratos dia a dia",
      "sanduiche",
      "prato crianca",
      "pratos crianca",
      "expresso",
    ],
  },
];

// "garcom.pn - 15" / "caixa.pn-01" / "sem vendedor" come from Ponta Negra's ABC report;
// "caixa-01.mw" carries a unit suffix (Midway).
const GENERIC_SELLER_PATTERN = /^(operador web|(caixa|garcom)(\.pn)? ?- ?\d+(\.[a-z]+)?|sem vendedor)$/;

export function classifySubgrupo(name: string): CategoryKey | null {
  const norm = normalizeName(name);
  if (EXCLUDE_KEYWORDS.some((k) => norm.includes(k))) return null;
  for (const { key, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => norm.includes(k))) return key;
  }
  return null;
}

export function isGenericSeller(name: string): boolean {
  return GENERIC_SELLER_PATTERN.test(normalizeName(name));
}

export function parseBrNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  let normalized = raw.replace(/r\$\s?/gi, "").trim();
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  normalized = normalized.replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : n;
}
