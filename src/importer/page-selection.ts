import { z } from "zod";
import { contextSuggestionSchema } from "../lib/domain";
import type { AcademicContext, ExtractionPage } from "./types";
import { detectAcademicContext, suggestionConflicts } from "./academic-context";
import { getUniversityAdapter, matchCourseCodes } from "../universities";

export const MAX_SELECTED_PAGES = 20;
export const MAX_PDF_PAGES = 500;
const pageNumber=z.number().int().min(1).max(MAX_PDF_PAGES);
export const materialPlanReviewSchema=z.object({
  explicit:z.boolean(), selectedPages:z.array(pageNumber).max(20), usedPages:z.array(pageNumber).max(20),
  suggestedPages:z.array(pageNumber).max(20), acknowledged:z.boolean(),
  candidates:z.array(z.object({page:pageNumber,source:z.string().max(255),
    detected:z.array(contextSuggestionSchema).max(16), matchingCodes:z.array(z.string().max(40)).max(100),
    conflicts:z.array(z.string().max(500)).max(16), score:z.number().finite(),
  })).max(20),
});
export type MaterialPlanReview=z.infer<typeof materialPlanReviewSchema>;

export function reviewMaterialPlanPages(pages: ExtractionPage[], context: AcademicContext, courseCodes: string[], explicitPages?: number[]): MaterialPlanReview {
  const adapter=getUniversityAdapter(context.adapterId);
  const candidates=pages.map(page=>{
    const detected=detectAcademicContext(page,"material-plan");
    const conflicts=detected.filter(s=>suggestionConflicts(s,context)).map(s=>s.id);
    const matches=detected.filter(s=>!!context[s.key]?.trim() && !suggestionConflicts(s,context));
    const matchingCodes=[...new Set(matchCourseCodes(adapter,page.text).filter(code=>courseCodes.includes(code)))];
    // Explicit context is a filter, never evidence of the page's level/term.
    const score=conflicts.length ? -1 : matches.length*10+matchingCodes.length;
    return {page:page.page,source:page.source,detected,conflicts,matchingCodes,score};
  });
  const best=Math.max(0,...candidates.map(c=>c.score));
  const suggestedPages=best>0 ? candidates.filter(c=>c.score===best).map(c=>c.page) : [];
  // Without a positive heading/code match, preserve uncertain pages for review.
  const usedPages=explicitPages ?? (suggestedPages.length ? suggestedPages : candidates.filter(c=>c.score>=0).map(c=>c.page));
  return {explicit:!!explicitPages,selectedPages:explicitPages??pages.map(p=>p.page),usedPages,
    suggestedPages,candidates,acknowledged:false};
}

export function planSelectionConflicts(review: MaterialPlanReview) {
  return review.candidates.filter(c=>review.usedPages.includes(c.page) && c.conflicts.length);
}
export function reassessPlanReview(review:MaterialPlanReview,context:AcademicContext):MaterialPlanReview {
  const candidates=review.candidates.map(c=>{
    const conflicts=c.detected.filter(s=>suggestionConflicts(s,context)).map(s=>s.id);
    const matches=c.detected.filter(s=>!!context[s.key]?.trim() && !suggestionConflicts(s,context));
    return {...c,conflicts,score:conflicts.length?-1:matches.length*10+c.matchingCodes.length};
  });
  const best=Math.max(0,...candidates.map(c=>c.score));
  return {...review,candidates,suggestedPages:best>0?candidates.filter(c=>c.score===best).map(c=>c.page):[],acknowledged:false};
}

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
