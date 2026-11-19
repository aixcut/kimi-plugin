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
const basicsSkill = readFileSync(
  join(root, "skills/aixcut-basics/SKILL.md"),
  "utf8",
);
const projectsSkill = readFileSync(
  join(root, "skills/aixcut-projects/SKILL.md"),
  "utf8",
);
const captionsReference = readFileSync(
  join(root, "skills/aixcut-captions/references/actions.md"),
  "utf8",
);
const assemblyGuidance = [
  "skills/aixcut-video-assembly/SKILL.md",
  "skills/aixcut-video-assembly/references/pipeline.md",
]
  .map((file) => readFileSync(join(root, file), "utf8"))
  .join("\n");
const exportSkill = readFileSync(
  join(root, "skills/aixcut-export/SKILL.md"),
  "utf8",
);

test("music volume guidance names the update action and target", () => {
  assert.match(
    timelineSkill,
    /aixcut_audio\(action="update",[^)]*target[^)]*volume/i,
    "volume is only accepted by aixcut_audio update, so the Skill must not imply it belongs on add",
  );
});

test("new deliverables require an explicit Project choice", () => {
  for (const skill of [basicsSkill, projectsSkill]) {
    assert.match(skill, /new standalone|new video|new deliverable/i);
    assert.match(skill, /active_project_id/);
    assert.match(skill, /ask/i);
  }
  assert.match(projectsSkill, /never silently.*active Project/i);
});

test("created or duplicated timelines are activated and verified", () => {
  for (const skill of [timelineSkill, assemblyGuidance]) {
    assert.match(skill, /create|duplicate/i);
    assert.match(skill, /activate_timeline/);
    assert.match(skill, /verify|read back|status.*ready/i);
  }
});

test("exports require authorization and capability-based renderer choice", () => {
  assert.match(exportSkill, /authorization gate/i);
  assert.match(exportSkill, /capabilities.*export_timeline/is);
  assert.match(exportSkill, /headless rendering.*only when.*cloud-readable/is);
  assert.match(exportSkill, /prompt_opened=true/i);
  assert.match(exportSkill, /Do not call `export_timeline_status`/i);
  assert.match(exportSkill, /user owns the remaining export/i);
  assert.doesNotMatch(exportSkill, /analyze_music_beats/);
  assert.match(assemblyGuidance, /no automatic BPM|has none/i);
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
  assert.match(timelineSkill, /wait for the user's confirmation[\s\S]{0,200}read `?aixcut_read\(view="sources"\)`?/i);
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

test("local media guidance ends the turn before the user confirms the upload", () => {
  assert.match(
    timelineSkill,
    /end (?:your )?turn and wait for the user's confirmation/i,
    "prompt_add_material must be followed by an ended turn; polling sources before the user confirms wasted a round in acceptance",
  );
});

test("caption add guidance shows the items array form", () => {
  assert.match(
    captionsReference,
    /```json aixcut_caption[\s\S]*?"action":\s*"add"[\s\S]*?"items"\s*:\s*\[[\s\S]*?```/,
    "caption add only accepts items[]; a worked example prevents a rejected first call",
  );
});

test("word highlights and revision recovery stay batch-first", () => {
  const basics = readFileSync(join(root, "skills/aixcut-basics/SKILL.md"), "utf8");
  const captions = readFileSync(join(root, "skills/aixcut-captions/SKILL.md"), "utf8");
  const actions = readFileSync(join(root, "skills/aixcut-captions/references/actions.md"), "utf8");
  const timeline = readFileSync(join(root, "skills/aixcut-timeline-editing/SKILL.md"), "utf8");

  assert.match(basics, /successful write invalidates.*plan_context/is);
  assert.match(basics, /rebuild `plan_context` before the next mutation/i);
  assert.match(captions, /complete sequence in one `set` or `add` call/i);
  assert.match(captions, /each item carries its own `duration_ms` and `highlight_ranges`/i);
  assert.match(actions, /`highlight_ranges`/);
  assert.match(timeline, /no `audio` component.*nothing to mute/is);
});

test("project-level writes require explicit targets and the right action shapes", () => {
  const projects = readFileSync(join(root, "skills/aixcut-projects/SKILL.md"), "utf8");
  const timeline = readFileSync(join(root, "skills/aixcut-timeline-editing/references/actions.md"), "utf8");
  const exportRef = readFileSync(join(root, "skills/aixcut-export/references/actions.md"), "utf8");

  assert.match(projects, /Do not edit any Project before `new_project` returns/i);
  assert.match(projects, /canvas also requires the returned `timeline_id`/i);
  assert.match(projects, /Canvas, clear, and rename operations require their target `project_id` explicitly/i);
  assert.match(timeline, /aixcut_style\(action="set"\)[\s\S]*items/i);
  assert.match(timeline, /Never send `items` or `targets` to `update`/i);
  assert.match(timeline, /text tool has no `time` action/i);
  assert.match(timeline, /do not use a `values` wrapper/i);
  assert.match(exportRef, /Never wrap them in `params`/i);
});
