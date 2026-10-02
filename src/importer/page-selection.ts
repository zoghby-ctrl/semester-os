export const MAX_SELECTED_PAGES = 20;
export const MAX_PDF_PAGES = 500;

export function parsePageSelection(value: string): number[] | undefined {
  if (!value.trim()) return undefined;
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/);
    if (!match) throw new Error("Enter PDF page numbers such as 2 or 2-4, 7.");
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > MAX_PDF_PAGES) throw new Error("Choose page numbers from 1 to 500, with ranges in ascending order.");
    if (end - start + 1 > MAX_SELECTED_PAGES) throw new Error("Select at most 20 PDF pages at a time.");
    for (let page = start; page <= end; page++) pages.add(page);
    if (pages.size > MAX_SELECTED_PAGES) throw new Error("Select at most 20 PDF pages at a time.");
  }
  return [...pages].sort((a, b) => a - b);
}

export function selectedPdfPages(count: number, selected?: number[]) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PDF_PAGES) throw new Error("Choose a PDF with at most 500 pages, or export the relevant pages first.");
  if (!selected && count > MAX_SELECTED_PAGES) throw new Error("This PDF has more than 20 pages. Choose the relevant PDF page numbers before reading it.");
  const pages = selected ?? Array.from({length: count}, (_, i) => i + 1);
  if (!pages.length || pages.length > MAX_SELECTED_PAGES || pages.some(p => !Number.isInteger(p) || p < 1 || p > count)) throw new Error(`Choose up to 20 pages within this PDF's ${count} pages.`);
  return [...new Set(pages)].sort((a, b) => a - b);
}
