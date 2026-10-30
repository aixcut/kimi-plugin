---
name: aixcut-timeline-editing
description: "Edit Aixcut clips, text, audio, tracks, canvas, and local imports. Do not use for voice scripts, full assembly, or export. Chinese triggers: 剪切、拼接、裁剪、删除片段、加文字、加音乐、轨道、画布、上传素材."
---

# Aixcut Timeline Editing

## Conversation guidance

State what timeline change is underway and what happens next when useful. Read current state and proceed when the request is clear and safe. Ask one question only when a missing decision materially changes the edit. If a local file or browser action requires the user, name the exact action and the condition for continuing.

Use the real MCP Tools. Do not use curl, hand-written JSON as a substitute for a call, direct database writes, or local files to reconstruct a result.

Voice, captions, and export have dedicated Skills: `aixcut-voice`, `aixcut-captions`, and `aixcut-export`.

## Minimal workflow

1. Read every view needed for the requested edit and use only stable returned refs; never guess IDs.
2. Create a fresh UUID v4 `idempotency_key` for each new write intent.
3. Call the narrowest Tool and action matching the intent.
4. Read affected views after a successful write; use `aixcut_review(view="timeline")` or `aixcut_review(view="renderability")` when structure or visual placement needs confirmation.
5. Report the actual result fields when present: `status`, `mutation_id`, `operation_id`, `revision_after`, `created`, `removed`, `ref_map`, and `warnings`.

### Batching writes

- Send one call per published action and track, not one call per element: pass the whole set through `items[]`, or every target through `targets`, in that single call. The add/set operations accept lists.
- Never issue one call per clip, per label, or per segment when one supported call can carry the batch.
- Never merge different actions, different tracks, or different domains into one call; only the live Tool Schema decides what may be combined.
- Do not run structural writes on the same timeline concurrently.
- Reuse the last read while the timeline is unchanged; reread before a position-dependent command and after each atomic batch.

## Multiple timelines and versions

- For versions, A/B variants, aspect-ratio adaptations, or “keep the original and make another”, call `aixcut_timeline(action="list")` first.
- Create a new version with `aixcut_timeline(action="duplicate", source_timeline_id=...)`; use `create` only when the user explicitly wants a blank timeline.
- After selecting a `timeline_id`, include it in every later read, edit, capture, and review for that version. Do not mix refs across timelines.
- Do not create an extra timeline for a single-version request.

## Tool selection

| Intent | Tool |
| --- | --- |
| Read or review | `aixcut_read(view="timeline")`, `aixcut_review(view="timeline")` |
| Main video sequence | `aixcut_primary(action="add")`, `aixcut_primary(action="replace")` |
| Voice segments | `aixcut_speech(action="set")`, `aixcut_speech(action="trim")` |
| Video, image, or Motion Graph clips | `aixcut_clip(action="add")`, `aixcut_clip(action="update")` |
| Regular on-screen text | `aixcut_text(action="add")`, `aixcut_text(action="update")` |
| Music, effects, or placed voice audio | `aixcut_audio(action="add")`, `aixcut_audio(action="update")` |
| Tracks | `aixcut_track(action="ensure")`, `aixcut_track(action="update")` |
| Canvas or full cleanup | `aixcut_project(action="canvas")`, `aixcut_project(action="clear")` |
| Remote browser actions | `aixcut_frontend(action="page_status")`, `aixcut_frontend(action="capture_timeline_frames")` |

Send only fields declared by the selected Tool Schema. Speech operations edit the main voice track; text operations do not edit captions. After a structural change, reread before issuing a position-dependent command.

## Keep visual layers separate

- The caption track is only for text that follows spoken words. Ingredient labels, arrows, circles, callouts, titles, and other visual annotations are not captions.
- Add static or editable text annotations with `aixcut_text(action="add")` on a non-caption text track. For an existing Motion Graph asset, add it with `aixcut_clip(action="add")` on a video overlay track and set that item's `kind` to `motion-graph`; the default `video` kind rejects Motion Graph media. Never target a text or caption track with a Motion Graph.
- Before adding an annotation, read the track list and choose a track whose kind matches the asset. After the write, read back the clip kind and track. If placement fails or lands on the wrong layer, correct or move the requested element; do not silently delete it or count subtitles as a replacement.
- If no supported asset or operation can create the requested animation, report that limitation and preserve it as unfinished work; do not substitute a caption or claim the animation is complete.

### Motion Graph placement protocol

Treat every requested visual annotation as a typed timeline element before writing it:

1. Read `aixcut_read(view="timeline")` and inspect each track's `kind`, `role`, and stable ref. A `role=caption` track is reserved for spoken or user-supplied subtitle text.
2. If the required layer is missing, ensure it before adding content: use `aixcut_track(action="ensure", kind="text", role="art-text", name="Art Text")` for static labels and `aixcut_track(action="ensure", kind="video", role="overlay", name="Motion Graphics")` for animated labels, arrows, circles, and other Motion Graphs.
3. Always pass the returned explicit track ref. Never omit `track` and never rely on the first text or video track. Use `aixcut_text(action="add")` only for static art text; use `aixcut_clip(action="add")` with `kind="motion-graph"` and the explicit video overlay track for an existing Motion Graph asset.
4. Read `timeline` immediately after each annotation write. Confirm the new clip's source, `kind`, `track_id`, and the track's non-caption role before continuing to voice, captions, or export.
5. If an annotation landed on the wrong track, move or correct it with the appropriate clip action and reread. Never delete the requested annotation to hide a placement error, and never count a caption as its replacement.

## Idempotency and result states

- Treat `applied`, `noop`, and `applied_with_warning` according to their literal meanings.
- `duplicate: true` means the UUID replayed an earlier successful write and did not add another change.
- For `status_unknown`, preserve every original parameter and reuse the same UUID.
- Never reuse a UUID for different parameters or intent. A same-key retry against the same project, timeline and action is treated as a replay (`duplicate: true`) even when the re-planned payload drifted; `NLE_IDEMPOTENCY_CONFLICT` means the key was reused for a different target, so check the timeline before redoing with a fresh UUID.

## Canvas, audio, and tracks

- A new Project may start at `0×0`. The first visual write chooses the source dimensions; if none are available, the server falls back to `1920×1080` and returns `MCP_CANVAS_DEFAULTED`. Use `aixcut_project(action="canvas")` for an explicit portrait or other ratio.
- Add music, effects, or rendered voice through `aixcut_audio(action="add")`. Use `fade_in_ms` and `fade_out_ms` for music. Volume is not an add field: after adding, read the created clip ref and call `aixcut_audio(action="update", target="clip:...", volume=0.2–0.4)` when narration must remain clear.
- When the user wants a video's original sound separately, call `aixcut_frontend(action="media.extract_audio", media_id=..., expected_file_revision=...)`, follow `operation.get` until it succeeds, then add the resulting published audio media. Never send a video media ref directly to `aixcut_audio(action="add")`.
- Before adding audio, ensure an audio track exists with `aixcut_track(action="ensure")`. If read-back reports `MCP_TRACK_ENSURE_NOT_APPLIED`, retry once with a new UUID.
- Change track mute or enabled state only after reading the current track state.

### Audio roles and write boundaries

Original/source audio or narration, AI-generated voice, BGM/music, and SFX/sound effects are different audio roles. Keep each role on its separate dedicated track; never treat an AI voice clip as a replacement for original audio unless replacement was explicitly requested.

Before every audio write, read the current timeline and track list, then confirm the target track and the intended start/end range. Read the source audio and existing voice state when deciding whether a human voice already covers that range. Reuse a correct existing narration for edit-only requests and skip new voice placement; this prevents double voice or overlapping narration.

Only add BGM/music when it is explicitly enabled, requested, or confirmed. When music is enabled, place it on its own track with both fade-in and fade-out; after read-back, lower its volume through `aixcut_audio(action="update", target="clip:...", volume=0.2–0.4)` under voice or narration. Leave optional or unmentioned music off until confirmation. SFX follows the same separate-track and range-confirmation rule.

## Local media

There are two supported import paths. Both are asynchronous and an accepted response does not mean that the media is ready.

### Ask the user to upload

Call:

```json
{}
```

A completed response means the upload area is open. Tell the user to select or drag files. After the user confirms upload, read `aixcut_read(view="sources")` and match by `file_name`; do not call `prompt_add_material` again.

### Import an explicit local path

When the user gives local paths, start or reuse the bridge yourself before importing; do not ask the user to start it. Locate the plugin helper and use the Site origin from the connected MCP Server instructions. If either is unavailable, report that specific setup blocker instead of running an incomplete command.

```bash
node "${KIMI_SKILL_DIR}/../../scripts/local-media-bridge.mjs" /absolute/path/a.mp4 /absolute/path/b.mp4 --allowed-origin "<MCP Server Site origin>"
```

The helper checks an existing bridge's health or starts a new one, waits until it is ready, and only then returns URLs. Do not call `aixcut_frontend(action="import_local_media")` until this command succeeds. Never invent the origin, URL, or port. The helper manages its own background process and port, reuses a running bridge when possible, and expires after its TTL; do not wrap it in `screen`, `nohup`, or `&`.

If the helper command fails, inspect its exact error and the reported log file before deciding what to do. Do not ask the user to start the bridge or switch to manual upload after the first failure. Retry the same helper command once for a transient startup or health failure; it will recheck/restart the bridge. Do not retry missing files, unreadable paths, a missing Site origin, or a missing helper—report the specific blocker. Offer manual upload only after the bounded retry fails or a required local capability is unavailable, and explain why.

After the helper succeeds, use the printed `files[].url` values in one `aixcut_frontend(action="import_local_media")` call, with `url` for one file or `urls` for up to eight. A ready bridge does not prove the Project page can fetch it. If import reports bridge-unreachable or URL failures, rerun the helper for only the failed files and retry those once with the new URLs. Report only files that still fail; offer manual upload only after that recovery fails.

The response includes `import_ids`. Poll only those IDs with `import_status`. Follow `next_action.after_seconds`; do not re-import while an item is running. An item is settled only when its status is `ready`, `failed`, or `cancelled`, and its `private_copy` is no longer `copying`.

- On `ready`, use the returned `media_id` directly; do not search `sources` just to rediscover which source was imported.
- On `unknown`, the page no longer tracks the import (for example, after a refresh). Reread `sources` and match by `file_name`.
- Retry `failed` or `cancelled` only when `retryable` is `true`; otherwise report its `error_code` and `error_message`.
- `private_copy=ok` means the complete local copy is saved. `fallback` means the media remains usable, but refresh or page export may fail to access the original; report `private_copy_reason`. Removing a clip from the timeline does not remove this copy. It is released when the source is deleted from the library or the Project is deleted.

ASR is independent of the file import status. Use `import_status` only until each import is settled; it is not the source of transcription status. When the user's task depends on speech or transcript text, call `aixcut_read(view="sources")`, match the source by the returned `media_id`, and check its `transcript_status` and `transcription_tasks`. Active transcription states are `pending`, `queued`, `running`, `processing`, `submitted`, or `retrying`; wait briefly and reread `sources`; do not keep polling the settled import or re-import. If needed to confirm whether transcription should exist, call `aixcut_read(view="source", source=media_id)` and check `has_audio`. Do not wait for ASR when there is no audio or the task only needs visual evidence. Read `source_lines` only after the matching source has `transcript_status=available`; report empty, outdated, or failed transcription instead of fabricating text or re-importing.

For `prompt_add_material`, there is no `import_id`. After the user says the upload is complete, reread `sources` and match by filename. If it has not appeared, wait about 15 seconds and reread; never reopen the prompt to confirm the same upload.

Local video does not require a complete server-side video copy. The browser keeps the original and sends extracted audio for transcription; use `capture_source_frames` or `capture_timeline_frames` for visual evidence. If `CAPTURE_PERMISSION_REQUIRED` occurs, ask the user to click the Project page once and retry the original capture. If the bridge is unreachable, follow the bounded recovery above: rerun the helper for a fresh URL and retry once before offering the manual upload path.

## Captures and visual placement

Use `capture_source_frames` or `capture_timeline_frames` when visual evidence is needed. The result returns temporary JPEG URLs in `result.data.artifacts`. To save them locally, pass the exact JSON Tool result through stdin to `${KIMI_SKILL_DIR}/../../scripts/download-capture-artifacts.mjs <output-directory>`. Report a local path only after the helper succeeds; the remote MCP server does not write files to the local machine.

For `aixcut_clip(action="layout")`, provide exactly one of `preset` or `box`. `box` uses 0–1 canvas ratios; `fit` is `contain`, `cover`, `fill`, or `none`; `opacity` is 0–1. After changing layout, capture one timeline frame and match each composition entry to its ref. Skip capture only when the final visible composition is unchanged; timing edits that change the visible image, subtitle placement or layer relationship require affected timeline frames. Volume and fades need audio evidence; without listening, audio quality is unjudgeable.

The editor does not expose reliable zoom, rotation, or anchor edits. Use `box` dimensions or a supported preset instead.

## Content language

Tool and workflow terms stay in English. Explain confirmations in the user's current conversation language. Text added to the timeline, including overlays and titles, follows the user's requested content or target-audience language; do not infer English from this Skill.

## Authentication and failures

Kimi handles OAuth. Do not call `aixcut_login` first or bypass permissions. For stable error-code recovery, load `aixcut-known-errors`. Report real status and read-back evidence.

Parameter details are in [references/actions.md](references/actions.md).
