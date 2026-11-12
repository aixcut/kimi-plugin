import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const local = JSON.parse(readFileSync(join(root, "contracts/skill-tool-map.json"), "utf8"));
const canonical = JSON.parse(readFileSync(join(root, "../agent-plugin/codex/contracts/skill-tool-map.json"), "utf8"));
const graph = new Map(local.skills.map((entry) => [entry.skill, entry.requires ?? []]));

const findCycle = () => {
  const visiting = new Set();
  const visited = new Set();
  const visit = (name, path) => {
    if (visiting.has(name)) return [...path, name];
    if (visited.has(name)) return null;
    visiting.add(name);
    for (const dependency of graph.get(name) ?? []) {
      const cycle = visit(dependency, [...path, name]);
      if (cycle) return cycle;
    }
    visiting.delete(name);
    visited.add(name);
    return null;
  };
  for (const name of graph.keys()) {
    const cycle = visit(name, []);
    if (cycle) return cycle;
  }
  return null;
};

test("Kimi Skill dependencies are acyclic", () => {
  assert.equal(findCycle(), null, `dependency cycle: ${JSON.stringify(findCycle())}`);
});

test("shared Kimi Skill dependencies match the canonical Agent Plugin graph", () => {
  const canonicalRequires = new Map(canonical.skills.map((entry) => [entry.skill, entry.requires ?? []]));
  for (const [skill, requires] of graph) {
    if (!canonicalRequires.has(skill)) continue;
    assert.deepEqual([...requires].sort(), [...canonicalRequires.get(skill)].sort(), skill);
  }
});

test("every shared Kimi Skill is reachable from basics", () => {
  const reaches = (name, seen = new Set()) => {
    if (name === "aixcut-basics") return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return (graph.get(name) ?? []).some((dependency) => reaches(dependency, seen));
  };
  for (const skill of graph.keys()) {
    if (skill === "aixcut-host" || !local.skills.find((entry) => entry.skill === skill)?.requires) continue;
    if (canonical.skills.some((entry) => entry.skill === skill)) assert.equal(reaches(skill), true, skill);
  }
});
