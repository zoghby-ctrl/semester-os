import { describe, expect, it } from "vitest";
import { parsePageSelection, selectedPdfPages } from "./page-selection";
import { validateExtractionPages } from "./validation";

describe("Bounded PDF page selection", () => {
  it("uses all short PDF pages and sorts/deduplicates explicit ranges", () => {
    expect(parsePageSelection(" ")).toBeUndefined();
    expect(parsePageSelection("7, 2-4, 3")).toEqual([2,3,4,7]);
    expect(selectedPdfPages(3)).toEqual([1,2,3]);
    expect(selectedPdfPages(200, [101,100,101])).toEqual([100,101]);
  });
  it("rejects malformed, oversized, reversed, and out-of-document selections", () => {
    for (const input of ["0", "1-21", "3-1", "1,", "1.5", "2e2", "501", "-1", "1-20,21"]) expect(()=>parsePageSelection(input)).toThrow();
    for (const [count,pages] of [[21,undefined],[501,[1]],[5,[6]],[5,[]],[5,[NaN]],[5,[1.5]]] as const) expect(()=>selectedPdfPages(count, pages ? [...pages] : undefined)).toThrow();
  });
  it("preserves original page numbers beyond 20 without increasing output limits", () => {
    const page = {page:101,source:"synthetic-plan.pdf",method:"pdf-text" as const,width:100,height:100,text:"",words:[],blocks:[]};
    expect(validateExtractionPages([page])[0].page).toBe(101);
    expect(()=>validateExtractionPages(Array.from({length:21},()=>page))).toThrow();
    expect(()=>validateExtractionPages([{...page,page:501}])).toThrow();
  });
});
