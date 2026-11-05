import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const timelineSkill = readFileSync(
  join(root, "skills/aixcut-timeline-editing/SKILL.md"),
  "utf8",
);
const hostSkill = readFileSync(join(root, "skills/aixcut-host/SKILL.md"), "utf8");
const knownErrorsSkill = readFileSync(join(root, "skills/aixcut-known-errors/SKILL.md"), "utf8");
const timelineActions = readFileSync(
  join(root, "skills/aixcut-timeline-editing/references/actions.md"),
  "utf8",
);
const frontendActions = readFileSync(
  join(root, "skills/aixcut-timeline-editing/references/frontend-actions.md"),
  "utf8",
);
const conversationGuidance = readFileSync(
  join(root, "skills/aixcut-basics/references/conversation-guidance.md"),
  "utf8",
);
const assemblyGuidance = [
  "skills/aixcut-video-assembly/SKILL.md",
  "skills/aixcut-video-assembly/references/pipeline.md",
]
  .map((file) => readFileSync(join(root, file), "utf8"))
  .join("\n");

test("music volume guidance names the update action and target", () => {
  assert.match(
    timelineSkill,
    /aixcut_audio\(action="update",[^)]*target[^)]*volume/i,
    "volume is only accepted by aixcut_audio update, so the Skill must not imply it belongs on add",
  );
});

test("video-derived audio guidance uses media.extract_audio", () => {
  assert.match(
    timelineSkill,
    /aixcut_frontend\(action="media\.extract_audio"/,
    "a video source must be converted to an audio media item before aixcut_audio add",
  );
  assert.match(
    timelineSkill,
    /action="media\.extract_audio", params=\{media_id/,
    "extract_audio arguments must be nested under params",
  );
  assert.match(
    timelineSkill,
    /action="operation\.get", params=\{operation_id/,
    "operation polling must nest operation_id under params",
  );
});

test("assembly guidance names the audio update action for music volume", () => {
  assert.match(assemblyGuidance, /aixcut_audio\(action="update",[^)]*target[^)]*volume/i);
  assert.match(assemblyGuidance, /volume/i);
});

test("tool examples do not contain empty argument slots", () => {
  const files = [
    "skills/aixcut-timeline-editing/SKILL.md",
    "skills/aixcut-timeline-editing/references/actions.md",
    "skills/aixcut-timeline-editing/references/frontend-actions.md",
  ];
  for (const file of files) {
    assert.doesNotMatch(readFileSync(join(root, file), "utf8"), /,\s*,/, file);
  }
});

test("Kimi local media guidance uses only the user-selected Project upload flow", () => {
  const guidance = [
    hostSkill,
    timelineSkill,
    knownErrorsSkill,
    timelineActions,
    frontendActions,
    conversationGuidance,
    assemblyGuidance,
  ].join("\n");

  assert.match(hostSkill, /only supported local-media route is .*prompt_add_material/i);
  assert.match(timelineSkill, /one supported local-media route/i);
  assert.match(timelineSkill, /\{"action":"prompt_add_material"\}/);
  assert.match(timelineSkill, /select or drag files/i);
  assert.match(timelineSkill, /wait for confirmation\. Then read `?aixcut_read\(view="sources"\)`?/i);
  assert.match(timelineSkill, /match [^.]{0,40}by `?file_name`?/i);
  assert.match(timelineActions, /For Kimi local-media uploads, use only `prompt_add_material`/i);
  assert.match(frontendActions, /`prompt_add_material`.*user selects files/i);
  assert.match(knownErrorsSkill, /prompt_add_material/);
  assert.match(conversationGuidance, /completed user-selected upload/i);

  assert.doesNotMatch(
    guidance,
    /local-media-bridge|local media bridge|import_local_media|MCP_LOCAL_MEDIA_BRIDGE_UNREACHABLE|NODE_OPTIONS|--no-reuse/i,
  );
  assert.doesNotMatch(assemblyGuidance, /import_status for local imports|import_local_media/i);
});
