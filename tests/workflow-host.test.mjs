import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const helper = join(root, "scripts", "workflow-host.mjs");

const plan = {
  schema_version: "1.0.0",
  plan_id: "plan_kimi_1",
  project_id: "project_1",
  timeline_id: "timeline_1",
  base_revision: 4,
  intent: "generation",
  mode: "local_edit",
  scope: {
    source_refs: [],
    target_refs: [],
    preserve: [],
    delete_refs: [],
    optional_enhancements: [],
    authorized_actions: ["aixcut_generate.submit"],
  },
  budget: { max_calls: 10, max_retries: 1, max_wait_ms: 60000 },
  acceptance: [{ layer: "structure", check: "read back" }],
};

function run(command, body, directory) {
  const args = [helper, command];
  if (directory) args.push("--directory", directory);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    input: JSON.stringify(body),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("creates, saves, and resumes a Kimi-owned checkpoint", () => {
  const directory = mkdtempSync(join(tmpdir(), "aixcut-kimi-workflow-"));
  try {
    const created = run("create", {
      plan,
      host: "kimi",
      phase: "execute",
      lastConfirmedRevision: 4,
      completedSteps: ["inspect"],
      pendingMutations: [],
      jobIds: [],
      nextStep: "verify",
    });

    assert.equal(created.ok, true);
    assert.equal(created.checkpoint.host, "kimi");
    assert.equal(created.checkpoint.plan_id, plan.plan_id);

    const saved = run("save", { checkpoint: created.checkpoint }, directory);
    assert.equal(saved.persisted, true);
    const stored = JSON.parse(readFileSync(join(directory, "plan_kimi_1.json"), "utf8"));
    assert.equal(stored.host, "kimi");

    const resumed = run(
      "resume",
      {
        plan_id: plan.plan_id,
        current: { project_id: plan.project_id, timeline_id: plan.timeline_id, revision: 4 },
      },
      directory,
    );
    assert.equal(resumed.ok, true);
    assert.equal(resumed.next_step, "verify");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
