import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd(), findings = [];
const rules = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{70,})\b/],
  ["AWS key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["private API credential", /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/],
];
const skip = new Set(["node_modules", ".git", "output", "tmp", "sources", ".playwright-cli"]);
async function scan(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name), relative = path.relative(root, file);
    if (entry.isDirectory()) { if (!skip.has(entry.name)) await scan(file); continue; }
    if (relative.startsWith(`dist${path.sep}`) && file.endsWith(".map")) findings.push({ file: relative, issue: "production source map" });
    if (!/\.(?:[cm]?js|tsx?|json|html|md|ya?ml|toml|txt|env|css)$/.test(entry.name) && !entry.name.startsWith(".env")) continue;
    const contents = await fs.readFile(file, "utf8");
    if (relative !== path.join("scripts", "security-scan.mjs")) for (const [issue, pattern] of rules) if (pattern.test(contents)) findings.push({file:relative,issue});
    if (relative.startsWith(`src${path.sep}`) && !file.endsWith(".test.ts")) {
      if (/dangerouslySetInnerHTML|\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\beval\s*\(|new\s+Function\s*\(/.test(contents)) findings.push({file:relative,issue:"unsafe DOM or code execution API"});
      const variables = [...contents.matchAll(/import\.meta\.env\.([A-Z_]+)/g)].map(m => m[1]);
      if (variables.some(name => !["DEV", "PROD", "MODE", "BASE_URL", "VITE_PROJECT_CONTACT"].includes(name))) findings.push({file:relative,issue:"unreviewed browser environment variable"});
    }
  }
}
await scan(root);
if (findings.length) { for (const finding of findings) console.error(`${finding.issue}: ${finding.file} (value redacted)`); process.exitCode=1; }
else console.log("No matching secrets, unsafe application DOM APIs, unreviewed browser env values, or production source maps found. Pattern scan is not a security guarantee.");
