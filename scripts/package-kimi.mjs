#!/usr/bin/env node
/**
 * Clean, self-auditing release packager for the Kimi domestic (.cn) plugin.
 *
 * - Excludes dev/test/sync scripts (sync-shared-skills.mjs, skill-contract-closure.mjs,
 *   package-kimi.mjs, tests/, docs/, package.json, .git/) and ensures NO local-media-bridge.mjs.
 * - Verifies version, domestic .cn MCP URL, 5-scenario skill presence, and zero host leakage.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = join(repoRoot, "dist");
const stagingParent = join(distDir, ".staging-kimi");
const topDirName = "aixcut-kimi";
const stagingDir = join(stagingParent, topDirName);

const manifest = JSON.parse(readFileSync(join(repoRoot, "kimi.plugin.json"), "utf8"));
const version = manifest.version;
if (!version) throw new Error("kimi.plugin.json missing version");
if (manifest.mcpServers?.aixcut?.url !== "https://web.aixcut.cn/mcp") {
  throw new Error(`Expected domestic .cn MCP URL, got: ${manifest.mcpServers?.aixcut?.url}`);
}

rmSync(stagingParent, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

for (const file of ["kimi.plugin.json", "SYSTEM.md", "icon.png", "LICENSE"]) {
  cpSync(join(repoRoot, file), join(stagingDir, file));
}
for (const dir of ["assets", "locales", "references", "contracts", "skills"]) {
  cpSync(join(repoRoot, dir), join(stagingDir, dir), { recursive: true });
}

// Copy ONLY runtime helper scripts (no dev/sync/audit scripts, no local-media-bridge.mjs)
const runtimeScripts = [
  "contract-semantics.mjs",
  "download-capture-artifacts.mjs",
  "review-evidence.mjs",
  "schema-validators.mjs",
  "trace-events.mjs",
  "validate-contract.mjs",
  "workflow-evaluation.mjs",
  "workflow-host.mjs",
  "workflow-state.mjs",
  "workflow-trace-adapter.mjs",
];
mkdirSync(join(stagingDir, "scripts"), { recursive: true });
for (const script of runtimeScripts) {
  const src = join(repoRoot, "scripts", script);
  if (!existsSync(src)) throw new Error(`Missing runtime script: ${script}`);
  cpSync(src, join(stagingDir, "scripts", script));
}

// Strict self-audit
const walk = (dir, base = dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full));
  }
  return out;
};

const files = walk(stagingDir);
const violations = [];

if (!existsSync(join(stagingDir, "skills/aixcut-scenarios/SKILL.md"))) {
  violations.push("missing skills/aixcut-scenarios/SKILL.md");
}
for (const forbidden of [
  "scripts/local-media-bridge.mjs",
  "scripts/sync-shared-skills.mjs",
  "scripts/skill-contract-closure.mjs",
  "scripts/package-kimi.mjs",
  "package.json",
]) {
  if (files.includes(forbidden)) violations.push(`forbidden file packaged: ${forbidden}`);
}

const forbiddenPatterns = [
  { name: "local-media-bridge", re: /local-media-bridge/i },
  { name: "NODE_OPTIONS", re: /NODE_OPTIONS/ },
  { name: "<plugin-root>", re: /<plugin-root>/ },
  { name: "WorkBuddy", re: /WorkBuddy/i },
  { name: "Doubao", re: /Doubao/i },
  { name: "codex reference", re: /\bcodex\b/i },
  { name: "gitee.com", re: /gitee\.com/i },
];

for (const rel of files) {
  if (rel.endsWith(".schema.json") || rel === "scripts/schema-validators.mjs" || rel.startsWith("contracts/")) continue;
  if (!/\.(json|md|mjs|js|txt|svg)$/i.test(rel)) continue;
  const content = readFileSync(join(stagingDir, rel), "utf8");
  for (const { name, re } of forbiddenPatterns) {
    if (re.test(content)) violations.push(`${rel}: matched forbidden pattern "${name}"`);
  }
  if (rel.startsWith("skills/") && /import_local_media|MCP_LOCAL_MEDIA_BRIDGE_UNREACHABLE/i.test(content)) {
    violations.push(`${rel}: contains forbidden local-media bridge action/error`);
  }
}

if (violations.length > 0) {
  console.error("Kimi release audit FAILED:\n" + violations.map((v) => `  - ${v}`).join("\n"));
  process.exit(1);
}

const fixed = new Date("2026-01-01T00:00:00Z");
const normalizeTimes = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) normalizeTimes(full);
    utimesSync(full, fixed, fixed);
  }
};
normalizeTimes(stagingDir);

const zipName = `aixcut-kimi-cn-${version}.zip`;
const zipPath = join(distDir, zipName);
rmSync(zipPath, { force: true });
execFileSync("/usr/bin/zip", ["-X", "-q", "-r", zipPath, topDirName], { cwd: stagingParent });

const checksum = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
writeFileSync(`${zipPath}.sha256`, `${checksum}  ${zipName}\n`, "utf8");
rmSync(stagingParent, { recursive: true, force: true });

console.log(`Built & audited ${zipName}: ${files.length} files, ${statSync(zipPath).size} bytes (SHA-256: ${checksum})`);
