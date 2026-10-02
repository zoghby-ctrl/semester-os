import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { securityHeaders } from "./security-headers.mjs";
import { pagesRedirects } from "./static-routes.mjs";

const root = path.resolve("dist"), files = [], findings = [];
async function walk(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name), relative = path.relative(root, full).replaceAll(path.sep, "/");
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) files.push({ file: relative, bytes: (await fs.stat(full)).size });
    else findings.push(`Unsupported file/symlink: ${relative}`);
  }
}
await walk(root);
const required = ["index.html", "404.html", "_headers", "_redirects", "manifest.webmanifest", "sw.js", "sw-maintenance.js", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable.png", "vendor/manifest.json"];
for (const file of required) if (!files.some(item => item.file === file)) findings.push(`Missing required deployment file: ${file}`);
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.webmanifest"), "utf8"));
if (manifest.start_url !== "/" || manifest.scope !== "/" || manifest.display !== "standalone") findings.push("Unexpected PWA start URL, scope, or display");
for (const icon of manifest.icons || []) if (!files.some(item => `/${item.file}` === icon.src)) findings.push(`Missing manifest icon: ${icon.src}`);
const vendor = JSON.parse(await fs.readFile(path.join(root, "vendor/manifest.json"), "utf8"));
const vendorPaths = new Set();
for (const item of vendor.assets || []) {
  if (!/^\/vendor\/(?:ocr|pdf)\/[a-zA-Z0-9.-]+$/.test(item.path)) { findings.push("Invalid vendor manifest path"); continue; }
  vendorPaths.add(item.path.slice(1));
  const body = await fs.readFile(path.join(root, item.path.slice(1)));
  if (body.length !== item.bytes || crypto.createHash("sha256").update(body).digest("hex") !== item.sha256) findings.push(`Vendor asset integrity mismatch: ${item.path}`);
  if (item.path.endsWith(".wasm") && body.subarray(0, 4).toString("hex") !== "0061736d") findings.push(`Invalid WASM asset: ${item.path}`);
  if (item.path.endsWith(".gz") && body.subarray(0, 2).toString("hex") !== "1f8b") findings.push(`Invalid gzip language data: ${item.path}`);
}
if (!vendorPaths.has("vendor/pdf/pdf.worker.min.mjs") || !vendorPaths.has("vendor/ocr/worker.min.js") || !vendorPaths.has("vendor/ocr/eng.traineddata.gz")) findings.push("Missing local PDF/OCR worker/language data");
const allowed = file => required.includes(file) || vendorPaths.has(file)
  || /^vendor\/(?:pdf|tesseract|core|eng)-LICENSE\.txt$/.test(file)
  || /^workbox-[a-zA-Z0-9_-]+\.js$/.test(file)
  || /^assets\/[a-zA-Z0-9_.-]+\.(?:js|css|woff2?|png|svg)$/.test(file);
for (const item of files) {
  if (!allowed(item.file)) findings.push(`Unreviewed deployment file: ${item.file}`);
  if (item.bytes > 25 * 1024 * 1024) findings.push(`Asset exceeds Cloudflare Pages 25 MiB limit: ${item.file}`);
}
if (files.length > 20_000) findings.push("Asset count exceeds Cloudflare Pages Free plan limit");
const headers = await fs.readFile(path.join(root, "_headers"), "utf8");
for (const [name, value] of Object.entries(securityHeaders)) if (!headers.includes(`  ${name}: ${value}\n`)) findings.push(`Missing prepared security header: ${name}`);
if (headers.split("\n").some(line => line.length > 2000)) findings.push("Cloudflare header line limit exceeded");
if (/^\/\*\n(?:(?: {2}|#)[^\n]*\n)* {2}Cache-Control:/m.test(headers)) findings.push("Catch-all cache header would combine with specific Pages cache rules");
if (await fs.readFile(path.join(root, "_redirects"), "utf8") !== pagesRedirects) findings.push("Unexpected broad/missing redirects");
const html = await fs.readFile(path.join(root, "index.html"), "utf8");
if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html)) findings.push("Inline executable script violates prepared CSP");
for (const value of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])) {
  if (/^https?:\/\//.test(value)) findings.push("Unexpected external index asset");
  else if (value.startsWith("/") && !files.some(item => `/${item.file}` === value)) findings.push(`Missing index asset: ${value}`);
}
for (const finding of findings) console.error(finding);
if (findings.length) process.exitCode = 1;
else {
  const largest = [...files].sort((a, b) => b.bytes - a.bytes)[0];
  console.log(`Cloudflare Pages artifact passed: ${files.length} files; largest ${(largest.bytes / 1024 / 1024).toFixed(2)} MiB. Local fonts, manifest/icons, service worker, PDF/OCR/WASM/language hashes, explicit routes, headers, and privacy allowlist checked. Hosted behavior remains unverified.`);
}
