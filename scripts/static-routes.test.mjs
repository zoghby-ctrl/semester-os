import { describe, expect, it } from "vitest";
import { legalPaths, pagesRedirects, routeAlias } from "./static-routes.mjs";

describe("Cloudflare Pages static routing", () => {
  it("proxies both legal URL forms to the canonical shell without index.html normalization", () => {
    for (const route of legalPaths) expect(pagesRedirects.split("\n")).toContain(`${route} / 200`);
    expect(pagesRedirects).not.toContain("/index.html");
  });
  it("preserves hash routing for workspace and individual course aliases", () => {
    expect(routeAlias("/today/")).toBe("/#today");
    expect(routeAlias("/courses/CSC2100")).toBe("/#courses/CSC2100");
    expect(pagesRedirects).toContain("/courses/:id /#courses/:id 302");
  });
  it("leaves missing workers, assets and unknown URLs outside the shell fallback", () => {
    for (const route of ["/assets/missing.js", "/vendor/ocr/missing.wasm", "/unknown", "/courses/../private"])
      expect(routeAlias(route)).toBeUndefined();
    expect(pagesRedirects).not.toMatch(/^\/\*\s/m);
  });
});
