import fs from "node:fs/promises";
import { securityHeaders } from "./security-headers.mjs";
import { legalPaths, pagesRedirects } from "./static-routes.mjs";
const headers = { ...securityHeaders, "Strict-Transport-Security": "max-age=31536000", "X-Content-Type-Options": "nosniff" };
// Pages joins duplicate matching header values: avoid a catch-all Cache-Control.
const lines = ["/*", ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`), "  X-Robots-Tag: noindex", ...["/", "/index.html", "/404.html", "/manifest.webmanifest", ...legalPaths].flatMap(route => [route, "  Cache-Control: no-cache"]), "/assets/*", "  Cache-Control: public, max-age=31536000, immutable", "/sw.js", "  Cache-Control: no-store", "/sw-maintenance.js", "  Cache-Control: no-store", "/vendor/*", "  Cache-Control: no-cache, no-transform", "/vendor/pdf/*.mjs", "  Content-Type: text/javascript; charset=utf-8", "/vendor/ocr/*.wasm", "  Content-Type: application/wasm", "/vendor/ocr/eng.traineddata.gz", "  Content-Type: application/gzip", ""];
await fs.writeFile("dist/_headers", lines.join("\n"));
await fs.writeFile("dist/_redirects", pagesRedirects);
// A top-level 404 disables Pages' all-path SPA fallback, so missing workers/assets
// stay 404. Narrow legal rewrites and canonical hash-route aliases are explicit.
await fs.writeFile("dist/404.html", '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · Semester OS</title><h1>Page not found</h1><p>This address is unavailable.</p><a href="/">Open Semester OS</a></html>\n');
console.log("Cloudflare Pages security headers, narrow route aliases, and missing-asset 404 prepared.");
