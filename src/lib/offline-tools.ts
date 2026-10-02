import { z } from "zod";
const manifestSchema = z.object({ revision: z.string().regex(/^[a-f0-9]{16}$/), assets: z.array(z.object({ path: z.string().regex(/^\/vendor\/(ocr|pdf)\/[A-Za-z0-9.-]+$/), bytes: z.number().int().positive().max(25 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1).max(20) });
const manifestUrl = "/vendor/manifest.json";
export async function offlineToolsReady() {
  if (!("caches" in window)) return false;
  for (const name of await caches.keys()) {
    if (!name.startsWith("semester-import-")) continue;
    const cache = await caches.open(name), response = await cache.match(manifestUrl);
    if (!response) continue;
    const result = manifestSchema.safeParse(await response.json()); if (!result.success) continue;
    if (name !== `semester-import-${result.data.revision}`) continue;
    if ((await Promise.all(result.data.assets.map(a => cache.match(a.path)))).every(Boolean)) return true;
  }
  return false;
}
export async function prepareOfflineTools(signal: AbortSignal, progress: (message: string) => void) {
  if (!("caches" in window) || !navigator.serviceWorker) throw new Error("Offline tools need a secure production build in a supported browser.");
  const response = await fetch(manifestUrl, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Offline tools could not be downloaded. Reconnect and try again.");
  const manifest = manifestSchema.parse(await response.json());
  const total = manifest.assets.reduce((n, a) => n + a.bytes, 0);
  if (total > 40 * 1024 * 1024) throw new Error("The offline tool download exceeds its resource limit.");
  const cache = await caches.open(`semester-import-${manifest.revision}`);
  for (const [i, asset] of manifest.assets.entries()) {
    progress(`Preparing offline tools · ${i + 1} of ${manifest.assets.length}`);
    const file = await fetch(asset.path, { cache: "no-store", signal });
    if (!file.ok || file.headers.get("Content-Type")?.includes("text/html")) throw new Error("An offline tool is unavailable. Check the deployment and try again.");
    const data = await file.arrayBuffer();
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), b => b.toString(16).padStart(2, "0")).join("");
    if (data.byteLength !== asset.bytes || digest !== asset.sha256) throw new Error("An offline tool failed its integrity check. Reconnect and try again.");
    await cache.put(asset.path, new Response(data, { headers: file.headers }));
  }
  await cache.put(manifestUrl, new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }));
  progress("Import tools are ready for offline use.");
}
