import { describe, expect, it } from "vitest";
import { ECUAdapter, GenericAdapter, getUniversityAdapter, matchCourseCodes } from "./index";
describe("University boundaries", () => {
  it("recognizes ECU conventions without a hardcoded course catalog", () => {
    expect(matchCourseCodes(ECUAdapter,"CSC2105 INF 2101 BSC1301 CSC9999")).toEqual(["CSC2105","INF2101","BSC1301","CSC9999"]);
    expect(matchCourseCodes(ECUAdapter,"CSC210S")).toEqual([]);
  });
  it("handles unknown universities explicitly through the generic adapter", () => {
    expect(matchCourseCodes(GenericAdapter,"MATH-101 COMP20")).toEqual(["MATH-101","COMP20"]);
    expect(getUniversityAdapter("generic").id).toBe("generic");
    expect(() => getUniversityAdapter("unregistered")).toThrow("supported");
  });
  it("interprets days and session types without guessing absent values", () => {
    expect(ECUAdapter.weekday("THURSDAY")).toBe(4); expect(ECUAdapter.weekday("Saturday")).toBe(6);
    expect(ECUAdapter.weekday("unknown")).toBeNull(); expect(ECUAdapter.sessionType("Tutorial B411")).toBe("tutorial");
    expect(ECUAdapter.sessionType("CSC2105 A403")).toBeNull();
  });
  it("keeps repeated recognition deterministic", () => {
    for(let i=0;i<5;i++) expect(matchCourseCodes(ECUAdapter,"CSC2105")).toEqual(["CSC2105"]);
  });
});
