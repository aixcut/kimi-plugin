import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const timelineSkill = readFileSync(
  join(root, "skills/aixcut-timeline-editing/SKILL.md"),
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
