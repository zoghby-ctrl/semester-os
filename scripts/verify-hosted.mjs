import fs from "node:fs/promises";
import crypto from "node:crypto";
import { securityHeaders } from "./security-headers.mjs";
import { legalPaths, routeAliases } from "./static-routes.mjs";
const { fetch, AbortSignal } = globalThis;

// Read-only HTTP evidence. UI, installation, offline and real-device tests remain separate.
const argument = process.argv.find(value => /^https?:\/\//.test(value));
if (!argument) throw new Error("Usage: npm run verify:hosted -- https://YOUR-PROJECT.pages.dev (or --local http://127.0.0.1:4173)");
const origin = new URL(argument);
if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("Supply the clean deployment origin only.");
const local = process.argv.includes("--local") && ["127.0.0.1", "localhost"].includes(origin.hostname);
if (origin.protocol !== "https:" && !local) throw new Error("Hosted verification requires HTTPS.");
const results = [], findings = [];
async function request(route, { status = 200, type, redirect, hash } = {}) {
  try {
    const response = await fetch(new URL(route, origin), { redirect: "manual", signal: AbortSignal.timeout(30_000), headers: { Accept: type === "text/html" ? "text/html" : "*/*" } });
    const body = new Uint8Array(await response.arrayBuffer());
    results.push({ route, status: response.status, type: response.headers.get("content-type"), headers: Object.fromEntries(response.headers), bytes: body.length });
    if (response.status !== status) findings.push(`${route}: expected ${status}, received ${response.status}`);
    const receivedType = response.headers.get("content-type") || "";
    if (type && !(type === "text/javascript" ? /^(?:text|application)\/javascript\b/.test(receivedType) : receivedType.startsWith(type))) findings.push(`${route}: unexpected MIME type`);
    if (redirect) {
      const location = response.headers.get("location");
      if (!location || new URL(location, origin).href !== new URL(redirect, origin).href) findings.push(`${route}: unexpected redirect destination`);
    }
    if (hash && crypto.createHash("sha256").update(body).digest("hex") !== hash) findings.push(`${route}: asset integrity mismatch or edge decompression`);
    if (status === 200) {
      for (const [name, expected] of Object.entries(securityHeaders)) if (response.headers.get(name) !== expected) findings.push(`${route}: missing/changed ${name}`);
      if (!local && !response.headers.get("strict-transport-security")?.includes("max-age=")) findings.push(`${route}: missing HSTS`);
      if (/\/sw(?:-maintenance)?\.js$/.test(route) && !response.headers.get("cache-control")?.includes("no-store")) findings.push(`${route}: service worker must not be stored at the edge`);
    }
    return { response, body };
  } catch (error) { findings.push(`${route}: ${error instanceof Error ? error.message : "request failed"}`); }
}
await Promise.all([
  request("/", { type: "text/html" }),
  ...legalPaths.map(route => request(route, { type: "text/html" })),
  ...Object.entries(routeAliases).map(([route, redirect]) => request(route, { status: 302, redirect })),
  request("/courses/test-course", { status: 302, redirect: "/#courses/test-course" }),
  ...["/assets/missing-check.js", "/vendor/ocr/missing-check.wasm", "/vendor/pdf/missing-check.mjs", "/unrecognized-route"].map(route => request(route, { status: 404 })),
  request("/sw.js", { type: "text/javascript" }), request("/sw-maintenance.js", { type: "text/javascript" }),
]);
const pwa = await request("/manifest.webmanifest", { type: "application/manifest+json" });
if (pwa?.response.status === 200) {
  try {
    const manifest = JSON.parse(Buffer.from(pwa.body).toString());
    if (manifest.start_url !== "/" || manifest.scope !== "/") findings.push("Hosted manifest has unexpected start/scope");
    await Promise.all((manifest.icons || []).map(icon => request(icon.src, { type: "image/png" })));
  } catch { findings.push("Hosted PWA manifest is invalid"); }
}
const imports = await request("/vendor/manifest.json", { type: "application/json" });
if (imports?.response.status === 200) {
  try {
    const manifest = JSON.parse(Buffer.from(imports.body).toString());
    await Promise.all((manifest.assets || []).map(asset => {
      if (!/^\/vendor\/(?:ocr|pdf)\/[a-zA-Z0-9.-]+$/.test(asset.path)) { findings.push("Invalid hosted vendor path"); return; }
      const type = asset.path.endsWith(".wasm") ? "application/wasm" : asset.path.endsWith(".gz") ? "application/gzip" : "text/javascript";
      return request(asset.path, { type, hash: asset.sha256 });
    }));
  } catch { findings.push("Hosted import manifest is invalid"); }
}
await fs.mkdir("output", { recursive: true });
await fs.writeFile("output/hosted-verification.json", JSON.stringify({ checkedAt: new Date().toISOString(), origin: origin.origin, local, results, findings }, null, 2));
for (const finding of findings) console.error(finding);
if (findings.length) process.exitCode = 1;
else console.log(`${local ? "Local" : "HTTPS hosted"} HTTP verification passed for ${results.length} routes/assets. Headers, hard-refresh routes, missing assets, PWA metadata and PDF/OCR asset integrity passed. Browser workflow/offline/device checks remain required. Evidence: output/hosted-verification.json`);
