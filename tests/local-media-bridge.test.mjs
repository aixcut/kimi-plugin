import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { resolveBridgeReuse, writeBridgeState } from "../scripts/local-media-bridge.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/local-media-bridge.mjs", import.meta.url));
const roots = [];
const states = [];
let hostPreload = null;

const createWorkspace = () => {
  const root = mkdtempSync(join(tmpdir(), "aixcut-kimi-local-bridge-"));
  roots.push(root);
  hostPreload = join(root, "host-access-preload.cjs");
  writeFileSync(hostPreload, "// Simulates the host-provided Node access guard.\n");
  return root;
};

const createMediaFile = (root, name, contents = name) => {
  const path = join(root, name);
  writeFileSync(path, contents);
  return path;
};

const createStateFile = (root, name = "bridge.json") => {
  const path = join(root, name);
  states.push(path);
  return path;
};

const runCli = (args, env = process.env) => {
  const childEnv = { ...env };
  if (hostPreload && !String(childEnv.NODE_OPTIONS ?? "").includes(hostPreload)) {
    childEnv.NODE_OPTIONS = [childEnv.NODE_OPTIONS, `--require=${hostPreload}`]
      .filter(Boolean)
      .join(" ");
  }
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
    env: childEnv,
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

const writePriorState = (stateFile, files, { expiresAt, allowedOrigin = null } = {}) => {
  writeBridgeState(stateFile, {
    bridge_policy_version: 2,
    base_url: "http://127.0.0.1:1",
    allowed_origin: allowedOrigin,
    token: "old-token",
    pid: 1_000_000_000,
    started_at: new Date(Date.now() - 120_000).toISOString(),
    expires_at: expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
    log_file: `${stateFile}.log`,
    files: files.map((path, index) => {
      const id = (index + 1).toString(16);
      return {
        id,
        path,
        name: path.split("/").at(-1),
        size: 1,
        url: `http://127.0.0.1:1/media/${id}?token=old-token`,
      };
    }),
  });
};

afterEach(() => {
  for (const stateFile of states.splice(0)) {
    spawnSync(process.execPath, [scriptPath, "--stop", "--state-file", stateFile], {
      encoding: "utf8",
      timeout: 2_000,
    });
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("bridge reuse rejects a previous file set that contains extra files", () => {
  const now = Date.now();
  const state = {
    bridge_policy_version: 2,
    allowed_origin: "https://studio.example",
    expires_at: new Date(now + 60_000).toISOString(),
    files: [
      { id: "a", path: "/tmp/a.mp4", url: "http://127.0.0.1/media/a" },
      { id: "b", path: "/tmp/b.mp4", url: "http://127.0.0.1/media/b" },
    ],
  };

  assert.deepEqual(
    resolveBridgeReuse(state, ["/tmp/b.mp4"], now, "https://studio.example"),
    { reusable: false, reason: "file-set-mismatch" },
  );
});

test("an expired historical file is not added when this invocation authorizes only B", () => {
  const root = createWorkspace();
  const fileA = createMediaFile(root, "a.mp4");
  const fileB = createMediaFile(root, "b.mp4");
  const stateFile = createStateFile(root);
  writePriorState(stateFile, [fileA], { expiresAt: new Date(Date.now() - 1_000).toISOString() });

  const result = runCli([fileB, "--state-file", stateFile]);

  assert.deepEqual(result.files.map((file) => file.path), [fileB]);
});

test("--no-reuse starts with only this invocation's files", () => {
  const root = createWorkspace();
  const fileA = createMediaFile(root, "a.mp4");
  const fileB = createMediaFile(root, "b.mp4");
  const stateFile = createStateFile(root);
  const prior = runCli([fileA, "--state-file", stateFile]);

  const result = runCli([fileB, "--no-reuse", "--state-file", stateFile]);

  assert.deepEqual(result.files.map((file) => file.path), [fileB]);
  const oldUrlResponse = spawnSync(process.execPath, [
    "-e",
    `fetch(${JSON.stringify(prior.files[0].url)}).then((response) => process.exit(response.ok ? 1 : 0)).catch(() => process.exit(0))`,
  ], { encoding: "utf8", timeout: 3_000 });
  assert.equal(oldUrlResponse.status, 0, "--no-reuse must revoke the prior file URL");
});

test("an explicitly reconfirmed exact file can reuse its unexpired bridge", () => {
  const root = createWorkspace();
  const file = createMediaFile(root, "reconfirmed.mp4");
  const stateFile = createStateFile(root);
  const first = runCli([file, "--state-file", stateFile]);
  const second = runCli([file, "--state-file", stateFile]);

  assert.equal(second.reused, true);
  assert.deepEqual(second.files.map((entry) => entry.path), [file]);
  assert.equal(second.files[0].url, first.files[0].url);
});

test("a bridge created under the previous policy is stopped instead of reused", async () => {
  const root = createWorkspace();
  const file = createMediaFile(root, "legacy-policy.mp4");
  const stateFile = createStateFile(root);
  const previous = runCli([file, "--state-file", stateFile]);
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  state.bridge_policy_version = 1;
  writeBridgeState(stateFile, state);

  const current = runCli([file, "--state-file", stateFile]);

  assert.equal(current.reused, false);
  assert.notEqual(current.files[0].url, previous.files[0].url);
  const oldUrlResponse = await fetch(previous.files[0].url).catch(() => null);
  assert.ok(!oldUrlResponse || oldUrlResponse.status !== 200,
    "a bridge from before the host guard must no longer serve files");
});

test("a running bridge with A and B is not reused for a request that authorizes only B", () => {
  const root = createWorkspace();
  const fileA = createMediaFile(root, "a.mp4");
  const fileB = createMediaFile(root, "b.mp4");
  const stateFile = createStateFile(root);
  const origin = "https://studio.example";
  const first = runCli([fileA, fileB, "--allowed-origin", origin, "--state-file", stateFile]);
  const oldUrlA = first.files.find((file) => file.path === fileA).url;

  const second = runCli([fileB, "--allowed-origin", origin, "--state-file", stateFile]);

  assert.deepEqual(second.files.map((file) => file.path), [fileB]);
  const oldUrlResponse = spawnSync(process.execPath, [
    "-e",
    `fetch(${JSON.stringify(oldUrlA)}).then((response) => process.exit(response.ok ? 1 : 0)).catch(() => process.exit(0))`,
  ], { encoding: "utf8", timeout: 3_000 });
  assert.equal(oldUrlResponse.status, 0, "the old A URL must be revoked when its scope is replaced");
});

test("a revoked host permission prevents reuse and stops the previously authorized URL", async () => {
  const root = createWorkspace();
  const file = createMediaFile(root, "revoked-before-reuse.mp4", "secret-bytes");
  const stateFile = createStateFile(root);
  const bridge = runCli([file, "--state-file", stateFile]);
  const preload = join(root, "revoking-host-preload.cjs");
  writeFileSync(
    preload,
    [
      "const fs = require('node:fs');",
      "const target = process.env.BRIDGE_DENY_PATH;",
      "const original = fs.statSync;",
      "fs.statSync = function (path, ...args) {",
      "  if (String(path) === target) {",
      "    const error = new Error('host file permission expired');",
      "    error.code = 'EACCES';",
      "    throw error;",
      "  }",
      "  return original.call(this, path, ...args);",
      "};",
    ].join("\n"),
  );

  const denied = spawnSync(process.execPath, [scriptPath, file, "--state-file", stateFile], {
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      NODE_OPTIONS: `--require=${preload}`,
      BRIDGE_DENY_PATH: file,
    },
  });

  assert.notEqual(denied.status, 0, "the helper must not reuse a URL without current host access");
  const oldUrlResponse = await fetch(bridge.files[0].url).catch(() => null);
  assert.ok(!oldUrlResponse || oldUrlResponse.status !== 200,
    "the previous URL must stop serving after access is revoked");
});

test("the bridge child inherits NODE_OPTIONS from the host process", () => {
  const root = createWorkspace();
  const file = createMediaFile(root, "clip.mp4");
  const stateFile = createStateFile(root);
  const preloadLog = join(root, "preload.log");
  const preload = join(root, "host-preload.cjs");
  writeFileSync(
    preload,
    "require('node:fs').appendFileSync(process.env.BRIDGE_PRELOAD_LOG, 'loaded\\n');\n",
  );

  runCli([file, "--state-file", stateFile], {
    ...process.env,
    NODE_OPTIONS: `--require=${preload}`,
    BRIDGE_PRELOAD_LOG: preloadLog,
  });

  assert.equal(readFileSync(preloadLog, "utf8").trim().split("\n").length, 2,
    "the helper process and its detached file server must both load the host preloader");
});

test("the helper refuses direct file access when no host preload is present", () => {
  const root = createWorkspace();
  const file = createMediaFile(root, "unprotected.mp4");
  const stateFile = createStateFile(root);
  const result = spawnSync(process.execPath, [scriptPath, file, "--state-file", stateFile], {
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /host-controlled file access is unavailable/i);
  assert.equal(existsSync(stateFile), false, "no bridge should be started without host protection");
});

test("a revoked host read disables that file URL instead of retrying through an unprotected path", async () => {
  const root = createWorkspace();
  const file = createMediaFile(root, "revoked.mp4", "secret-bytes");
  const stateFile = createStateFile(root);
  const deniedLog = join(root, "denied.log");
  const preload = join(root, "revoking-host-preload.cjs");
  writeFileSync(
    preload,
    [
      "const fs = require('node:fs');",
      "const target = process.env.BRIDGE_DENY_PATH;",
      "const deniedLog = process.env.BRIDGE_DENIED_LOG;",
      "const original = fs.open;",
      "fs.open = function (path, ...args) {",
      "  if (String(path) === target) {",
      "    fs.appendFileSync(deniedLog, 'denied\\n');",
      "    const error = new Error('host file permission expired');",
      "    error.code = 'EACCES';",
      "    const callback = args.at(-1);",
      "    queueMicrotask(() => callback(error));",
      "    return;",
      "  }",
      "  return original.call(this, path, ...args);",
      "};",
    ].join("\n"),
  );

  const bridge = runCli([file, "--state-file", stateFile], {
    ...process.env,
    NODE_OPTIONS: `--require=${preload}`,
    BRIDGE_DENY_PATH: file,
    BRIDGE_DENIED_LOG: deniedLog,
  });
  const url = bridge.files[0].url;

  const first = await fetch(url);
  assert.equal(first.status, 410);
  const second = await fetch(url);
  assert.equal(second.status, 404);
  assert.equal(readFileSync(deniedLog, "utf8").trim().split("\n").length, 1,
    "the bridge must revoke the URL after the host denies access");

  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  assert.deepEqual(state.files, []);
  assert.equal(existsSync(file), true, "the test source remains present; access was denied by the host proxy");
  appendFileSync(deniedLog, "verified\n");
});

test("--status reports bridge health without disclosing historical file paths or URLs", () => {
  const root = createWorkspace();
  const file = createMediaFile(root, "clip.mp4");
  const stateFile = createStateFile(root);
  runCli([file, "--state-file", stateFile]);

  const status = runCli(["--status", "--state-file", stateFile]);

  assert.equal(status.running, true);
  assert.equal("files" in status, false);
});
