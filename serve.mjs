import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { securityHeaders } from "./scripts/security-headers.mjs";
import { legalPaths, routeAlias } from "./scripts/static-routes.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT must be an integer between 1024 and 65535.");
const url = `http://127.0.0.1:${port}`;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
  if (!["GET", "HEAD"].includes(req.method || "")) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  try {
    const requested = decodeURIComponent(new URL(req.url || "/", url).pathname);
    const alias = routeAlias(requested);
    if (alias) {
      res.writeHead(302, { Location: alias, "Cache-Control": "no-cache" });
      res.end();
      return;
    }
    const file = path.resolve(root, "." + requested.replaceAll("\\", "/"));
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let target = file;
    try {
      if ((await stat(target)).isDirectory())
        target = path.join(target, "index.html");
    } catch {
      if (legalPaths.includes(requested))
        target = path.join(root, "index.html");
      else {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
    }
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": target.includes(path.sep + "assets" + path.sep)
        ? "public, max-age=31536000, immutable"
        : ["/sw.js", "/sw-maintenance.js"].includes(requested) ? "no-store"
          : requested.startsWith("/vendor/") ? "no-cache, no-transform" : "no-cache",
      "Content-Length": body.length,
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(400);
    res.end(
      "Could not load this file. Build the app first with npm run build.",
    );
  }
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. If Semester OS is already running, open ${url}. Otherwise stop the other process or set PORT.`
      : error.message,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    `\nSemester OS is ready: ${url}\nKeep this window open. Press Ctrl+C to stop.\n`,
  );
  if (process.argv.includes("--open")) {
    const command =
      process.platform === "win32"
        ? "rundll32"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    const args =
      process.platform === "win32"
        ? ["url.dll,FileProtocolHandler", url]
        : [url];
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    child.on("error", () => console.log(`Open ${url} in your browser.`));
    child.unref();
  }
});
