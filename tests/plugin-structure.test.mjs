import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));

test("declares a Kimi-native manifest with an in-repository skill root", () => {
  const manifest = readJson("kimi.plugin.json");

  assert.match(manifest.name, /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*(@[A-Za-z0-9_-]+)?$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(readJson("package.json").version, manifest.version);
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.systemPromptPath, "./SYSTEM.md");
  assert.ok(manifest.interface?.displayName);
  assert.ok(manifest.interface?.shortDescription);
  assert.ok(manifest.interface?.websiteURL);
  assert.equal(manifest.interface?.category, "PRODUCTIVITY");
  assert.deepEqual(manifest.mcpServers, {
    aixcut: { url: "https://web.aixcut.cn/mcp" },
  });
  assert.equal(new URL(manifest.mcpServers.aixcut.url).protocol, "https:");
  assert.equal(new URL(manifest.mcpServers.aixcut.url).pathname, "/mcp");
  const allowed = new Set([
    "name", "version", "description", "keywords", "author", "homepage", "license",
    "skills", "agents", "sessionStart", "systemPrompt", "systemPromptPath",
    "mcpServers", "hooks", "commands", "interface", "skillInstructions",
  ]);
  for (const key of Object.keys(manifest)) assert.ok(allowed.has(key), `unsupported manifest key: ${key}`);
  for (const unsupported of ["tools", "apps", "inject", "configFile"]) {
    assert.equal(unsupported in manifest, false, `unsupported Kimi manifest field: ${unsupported}`);
  }
});

test("keeps every declared path inside the plugin root", () => {
  const manifest = readJson("kimi.plugin.json");
  for (const field of ["skills", "systemPromptPath"]) {
    const value = manifest[field];
    for (const path of Array.isArray(value) ? value : [value]) {
      assert.ok(path.startsWith("./"), `${field} must be relative to the plugin root`);
      assert.ok(!relative(root, join(root, path)).startsWith(".."), `${field} escapes plugin root`);
      assert.ok(existsSync(join(root, path)), `${field} target does not exist: ${path}`);
    }
  }
});

test("ships Kimi-compatible directory Skills with required frontmatter", () => {
  const manifest = readJson("kimi.plugin.json");
  const skillRoot = join(root, manifest.skills);
  const requiredSkills = [
    "aixcut-host",
    "aixcut-basics",
    "aixcut-projects",
    "aixcut-timeline-editing",
    "aixcut-captions",
    "aixcut-generation",
    "aixcut-voice",
    "aixcut-video-assembly",
    "aixcut-export",
    "aixcut-verification",
    "aixcut-known-errors",
  ];

  for (const name of requiredSkills) {
    const file = join(skillRoot, name, "SKILL.md");
    assert.ok(existsSync(file), `missing Skill: ${name}`);
    const source = readFileSync(file, "utf8");
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(frontmatter, `${name} is missing YAML frontmatter`);
    assert.match(frontmatter[1], new RegExp(`^name:\\s*${name}\\s*$`, "m"));
    assert.match(frontmatter[1], /^description:\s*.+$/m);
    const keys = frontmatter[1].split("\n").map((line) => line.split(":", 1)[0].trim()).filter(Boolean);
    assert.deepEqual(keys.sort(), ["description", "name"]);
  }

  const skillNames = readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const source = readFileSync(join(skillRoot, entry.name, "SKILL.md"), "utf8");
      return source.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    });
  assert.equal(new Set(skillNames).size, skillNames.length, "Skill names must be unique");
  assert.ok(skillNames.includes(readJson("kimi.plugin.json").sessionStart?.skill));
});

test("does not ship host-specific Codex or WorkBuddy instructions", () => {
  const forbidden = /open_in_codex|Codex|codex|WorkBuddy|workbuddy|present_files|\.codebuddy-plugin|\.codex-plugin/;
  const files = walk(join(root, "skills")).map((file) => relative(root, file));
  for (const name of ["SYSTEM.md", "README.md", ...files]) {
    assert.doesNotMatch(readFileSync(join(root, name), "utf8"), forbidden, name);
  }
});

test("ships the Core contracts required by the packaged workflow helper", () => {
  for (const name of [
    "contracts/core/edit-plan.schema.json",
    "contracts/core/checkpoint.schema.json",
    "contracts/core/review-evidence.schema.json",
  ]) {
    assert.ok(existsSync(join(root, name)), `missing packaged contract: ${name}`);
  }
});

test("keeps the packaged Core manifest and action contract hashes current", () => {
  const manifest = readJson("contracts/core/core-manifest.json");
  for (const [name, expected] of Object.entries(manifest.files)) {
    assert.equal(sha256(readFileSync(join(root, vendorPath(name)))), expected, `Core hash mismatch: ${name}`);
  }
  const action = readJson("contracts/core/action-contract.json");
  assert.equal(
    sha256(readFileSync(join(root, "contracts/core/mcp-tool-catalog.json"))),
    action.catalog_sha256,
  );
  for (const info of Object.values(action.schemas)) {
    assert.equal(sha256(readFileSync(join(root, vendorPath(info.path)))), info.sha256);
  }
});

test("resolves every relative Markdown link inside the plugin root", () => {
  const files = ["SYSTEM.md", "README.md", ...walk(join(root, "skills")).map((file) => relative(root, file))];
  for (const name of files) {
    const source = readFileSync(join(root, name), "utf8");
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      const absolute = resolve(dirname(join(root, name)), target);
      assert.ok(!relative(root, absolute).startsWith(".."), `${name} links outside plugin root: ${target}`);
      assert.ok(existsSync(absolute), `${name} has a missing link target: ${target}`);
    }
  }
});

test("uses only MCP tool names from the packaged live catalog", () => {
  const catalog = readJson("contracts/core/mcp-tool-catalog.json");
  const allowed = new Set(catalog.tools.map((tool) => tool.name));
  for (const file of walk(join(root, "skills")).filter((path) => path.endsWith(".md"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\baixcut_[a-z_]+\b/g)) {
      assert.ok(
        allowed.has(match[0]),
        `${relative(root, file)} references unknown MCP tool: ${match[0]}`,
      );
    }
  }
});

test("uses declared actions and selectors for every referenced tool", () => {
  const catalog = readJson("contracts/core/mcp-tool-catalog.json");
  const actions = new Map(catalog.tools.map((tool) => [tool.name, new Set(tool.actions)]));
  const selector = { aixcut_open: "target", aixcut_read: "view", aixcut_review: "view" };
  for (const file of walk(join(root, "skills")).filter((path) => path.endsWith(".md"))) {
    const source = readFileSync(file, "utf8");
    for (const [tool, allowed] of actions) {
      const field = selector[tool] || "action";
      for (const match of source.matchAll(new RegExp(`\\b${tool}\\(\\s*${field}="([^"]+)"`, "g"))) {
        assert.ok(allowed.has(match[1]), `${relative(root, file)} uses undeclared ${tool} ${field}: ${match[1]}`);
      }
    }
  }
});

test("does not reference retired MCP tool names outside retirement notes", () => {
  const catalog = readJson("contracts/core/mcp-tool-catalog.json");
  const allowed = new Set(catalog.tools.map((tool) => tool.name));
  const retirementNote = /旧\s*`aixcut_[a-z_]+`\s*Tool 已退役/;
  const files = [
    "SYSTEM.md",
    ...walk(join(root, "skills")),
    ...walk(join(root, "references")),
    ...walk(join(root, "scripts")),
  ].map((file) => relative(root, file));
  const offenders = [];
  for (const name of files) {
    for (const line of readFileSync(join(root, name), "utf8").split("\n")) {
      if (retirementNote.test(line)) continue;
      for (const match of line.matchAll(/\baixcut_[a-z_]+\b/g)) {
        if (!allowed.has(match[0])) offenders.push(`${name}: ${match[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `retired MCP tool names: ${offenders.join(", ")}`);
});

test("names the tool and selector in every structured skill example", () => {
  const offenders = [];
  for (const file of walk(join(root, "skills")).filter((path) => path.endsWith(".md"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)) {
      const info = match[1].trim();
      if (!info.startsWith("json")) continue;
      const label = info.slice(4).trim();
      let body;
      try {
        body = JSON.parse(match[2]);
      } catch {
        continue;
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) continue;
      const name = relative(root, file);
      if (!/^aixcut_[a-z_]+$/.test(label)) {
        offenders.push(`${name}: example block without a Tool name`);
      } else if (!("action" in body || "view" in body || "target" in body)) {
        offenders.push(`${name}: ${label} example without action/view/target`);
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join(", "));
});

test("uses the Kimi skill-directory placeholder for packaged helpers", () => {
  for (const file of walk(join(root, "skills")).filter((path) => path.endsWith(".md"))) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /<plugin-root>/);
    assert.doesNotMatch(source, /(^|[^/])scripts\/(workflow-host|download-capture-artifacts)\.mjs/);
  }
});

test("passes the packaged Skill closure contract", async () => {
  const { validateSkillClosure } = await import(
    new URL("../scripts/skill-contract-closure.mjs", import.meta.url)
  );
  const mapping = readJson("contracts/skill-tool-map.json");
  const result = await validateSkillClosure({
    root,
    mapping,
    catalog: readJson("contracts/core/mcp-tool-catalog.json"),
    skillDirectory: "skills",
  });
  assert.equal(result.skills, mapping.skills.length);
});

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function vendorPath(path) {
  if (path.startsWith("contracts/")) return path.replace(/^contracts\//, "contracts/core/");
  if (path.startsWith("helpers/")) return path.replace(/^helpers\//, "scripts/");
  if (path.startsWith("references/")) return path.replace(/^references\//, "references/core/");
  return path;
}
