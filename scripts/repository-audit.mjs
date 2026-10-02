import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { isRepositoryFile, reviewedScreenshots } from "./repository-files.mjs";

const root = process.cwd(), included = [], findings = [];
const privateBuckets = new Set(["node_modules", "dist", "sources", "output", "tmp", "screenshots", ".git", ".playwright-cli", "work", ".wrangler"]);
const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["credential", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{70,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/],
  ["credential assignment", /\b(?:CLOUDFLARE_API_TOKEN|API_KEY|API_TOKEN|CLIENT_SECRET|PASSWORD)["']?\s*[:=]\s*["']?[a-zA-Z0-9_./+-]{16,}/],
  ["personal absolute path", /(?:[A-Z]:[\\/](?:Users|Documents)[\\/]|\/(?:Users|home)\/[^\s/]+\/)/i],
  ["non-example email", /\b[A-Z0-9._%+-]+@(?!example\.(?:com|org|net|invalid)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name), file = path.relative(root, full).replaceAll(path.sep, "/");
    if (entry.isDirectory()) { if (!(directory === root && privateBuckets.has(entry.name))) await walk(full); continue; }
    if (!isRepositoryFile(file)) continue;
    if (entry.isSymbolicLink() || !entry.isFile()) { findings.push({ file, issue: "symlink or unsupported file" }); continue; }
    const data = await fs.readFile(full), sha256 = crypto.createHash("sha256").update(data).digest("hex");
    included.push({ file, bytes: data.length, sha256 });
    if (file.startsWith("docs/screenshots/") && file.endsWith(".png")) {
      if (reviewedScreenshots[entry.name] !== sha256) findings.push({ file, issue: "screenshot changed since visual privacy review" });
    } else {
      const content = data.toString("utf8");
      // Exempt only the observed upstream glob deprecation contact, not arbitrary
      // email addresses elsewhere in the lockfile. Keep the literal split so this
      // scanner's own source is not mistaken for a newly supplied email address.
      const reviewedContact = "contacting i" + "@" + "izs.me";
      for (const [issue, pattern] of secretPatterns) {
        const inspected = file === "package-lock.json" && issue === "non-example email"
          ? content.replaceAll(reviewedContact, "contacting [reviewed upstream maintainer]") : content;
        if (pattern.test(inspected)) findings.push({ file, issue });
      }
    }
  }
}
await walk(root);
let hasGit = false;
try {
  hasGit = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().replaceAll("\\", "/").toLowerCase() === root.replaceAll("\\", "/").toLowerCase();
  if (hasGit) for (const file of execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean))
    if (!isRepositoryFile(file)) findings.push({ file, issue: "tracked file outside reviewed repository allowlist" });
} catch { /* No Git metadata is an explicit supported preparation state. */ }
included.sort((a, b) => a.file.localeCompare(b.file));
if (process.argv.includes("--write-manifest")) {
  await fs.mkdir("output", { recursive: true });
  await fs.writeFile("output/repository-review.json", JSON.stringify({ generatedAt: new Date().toISOString(), hasGit, included, findings }, null, 2));
  await fs.writeFile("output/repository-paths.txt", included.map(item => item.file).join("\n") + "\n");
  console.log("Reviewable names, sizes, and SHA-256 values written to ignored output/repository-review.json.");
}
for (const { file, issue } of findings) console.error(`${issue}: ${file} (value redacted)`);
if (findings.length) process.exitCode = 1;
else console.log(`Repository allowlist/privacy scan passed for ${included.length} files. Git initialized: ${hasGit}. No secret values printed. Manual ownership/license/history review remains required.`);
