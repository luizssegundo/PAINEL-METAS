// Import the internal implementation directly, bypassing pdf-parse's index.js —
// its top-level debug/self-test block (`if (!module.parent) { ... }`) misfires
// under Next.js bundling and crashes on module load trying to read a test fixture.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  buffer: Buffer,
) => Promise<{ text: string }>;
import { parseHierarchicalLines, type ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";
import { isAbcVendasText, parseAbcVendasLines } from "@/lib/import/parse-erp-report-abc";

export type { CategoryKey, ParsedHierarchicalReport } from "@/lib/import/parse-erp-report-hierarchical";

export async function parseErpReportPdf(buffer: Buffer): Promise<ParsedHierarchicalReport> {
  const { text } = await pdfParse(buffer);
  const lines = text.split(/\r?\n/);
  if (isAbcVendasText(lines)) return parseAbcVendasLines(lines);
  return parseHierarchicalLines(lines);
}
