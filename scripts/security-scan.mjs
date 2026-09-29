#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
let failed = false;

function fail(message) {
  console.error(`SECURITY FAIL: ${message}`);
  failed = true;
}

function trackedFiles() {
  const out = execSync("git ls-files", { cwd: root, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

const files = trackedFiles();

for (const file of files) {
  if (file === ".env" || /(^|\/)\.env\./.test(file) && !file.endsWith(".env.example")) {
    fail(`tracked env file: ${file}`);
  }
  if (
    (file.endsWith(".credentials") || /\/\.credentials$/.test(file)) &&
    !file.endsWith(".credentials.template")
  ) {
    fail(`tracked credentials file: ${file}`);
  }
}

const secretPatterns = [
  /LINKEDIN_CAMPAIGNS_TOKEN\s*=\s*['"]?[A-Za-z0-9._-]{20,}/,
  /LINKEDIN_POSTS_TOKEN\s*=\s*['"]?[A-Za-z0-9._-]{20,}/,
  /Authorization\s*[:=]\s*['"]?Bearer\s+[A-Za-z0-9._-]{20,}/i,
  /client_secret\s*[:=]\s*['"][^'"]+['"]/i,
];

const skip = new Set([
  ".env.example",
  "scripts/security-scan.mjs",
  "docs/authentication.md",
  "docs/security.md",
  "README.md",
  "CHANGELOG.md",
]);

for (const file of files) {
  if (skip.has(file)) continue;
  if (!/\.(md|ts|js|mjs|json|yml|yaml|py|sh|txt)$/i.test(file)) continue;
  const abs = resolve(root, file);
  if (!existsSync(abs)) continue;
  const text = readFileSync(abs, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      // allow obvious placeholders
      if (/YOUR_|CHANGEME|placeholder|example\.com|token-value-|Bearer \[REDACTED\]/i.test(text)) {
        continue;
      }
      fail(`possible secret material in ${file} matching ${pattern}`);
    }
  }
}

// Detect insecure Authorization logging in MCP server source
const loggerFiles = files.filter((f) => f.startsWith("mcp-server/src/"));
for (const file of loggerFiles) {
  const text = readFileSync(resolve(root, file), "utf8");
  if (/console\.(log|error|info|warn)\([^)]*Authorization/i.test(text)) {
    fail(`possible Authorization header logging in ${file}`);
  }
  if (/headers\.authorization/.test(text) && /console\./.test(text) && !/redact/i.test(text)) {
    // soft signal only when both present without redact helpers nearby
    if (!text.includes("redact")) {
      fail(`Authorization may be logged without redaction in ${file}`);
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log("Security scan passed.");
