# Timeline Editing Tool Actions

This reference lists fields for each action. Follow the main Skill for workflow, idempotency, and completion rules.

## Common fields

- `project_id`: Optional; defaults to the active Project.
- `idempotency_key`: Optional; the server generates one when omitted. Reuse it only for an identical retry. A new write intent needs a new key.
- `target` / `targets`: Stable refs or IDs returned by a read operation such as `aixcut_read(view="clips")`; never guess UUIDs.
- `items`: Array whose item fields are checked by the live Tool Schema.
- `timeline_id`: Target timeline UUID. Include it in every read, edit, capture, and review for multi-version work; omit only for a single version using the default timeline.
- `plan_context`: Required on the protected actions marked in the Required column. Pass it at the Tool's top level, not inside `params`. Build it from the latest read with `project_id`, `timeline_id`, `base_revision`, `mode`, `preserve`, `delete_refs`, and the exact `authorized_actions`; the `aixcut-basics` Skill documents the workflow host contract.
- Every Tool accepts a strict object. Send only fields listed here; extra fields are rejected.

## Frontend request shapes

`aixcut_frontend` has two input shapes; follow the live action schema rather than moving fields between them:

- Shared file actions (`media.*` and `timeline.*`, including `timeline.export_range`) keep `action` at the top level and put action-specific fields inside `params`. For example, `media.list` takes an empty `params` object.
- Fixed page actions use top-level fields as declared by their action schema. This includes `page_status`, `playback_check`, frame capture, Project document actions, and `export_timeline` / `export_timeline_status`; do not wrap these fields in `params`.

```json aixcut_frontend
{"action":"media.list","params":{}}
```

```json aixcut_frontend
{
  "action":"playback_check",
  "timeline_id":"00000000-0000-4000-8000-000000000001",
  "expected_revision":12,
  "start_ms":0,
  "target_ms":2000
}
```

Replace the playback example's timeline ID and revision with values from the current Project. `playback_check` uses `target_ms`, not `end_ms`.

## Field groups

| Group | Fields |
| --- | --- |
| Time | `source_start_ms`, `start_ms`, `duration_ms`, `end_ms`, `at_ms`, `to_ms`, `rate` |
| Columns | `enabled`, `label`, `kind`, `volume`, `values` |
| Fades | `fade_in_ms`, `fade_out_ms` |
| Text | `text`, `style`, `highlight_ranges`, `x`, `y` |
| Target | `target`, `targets` |
| Track | `track` |

Fields must match the clip type. Invalid combinations are rejected rather than silently stored in an unused location:

| Field | Applicable types | Stored as |
| --- | --- | --- |
| `style` | Text and captions | The Composition text node's `style`; keys must come from the allowlist below |
| `highlight_ranges` | Text and captions | Highlighted character ranges of the text node; each item is a `{ start, end }` range |
| `x`, `y` | Text and captions | Position as a 0–1 canvas ratio |
| `volume` | Audio and video | Playback volume from 0 to 1 |
| `values` | All | Column overrides; unknown column names are rejected |

Text and captions are stored as a Composition author tree, so `style` is folded into the text node's own `style`. The allowlist is closed:

| Category | Style keys |
| --- | --- |
| Typography | `typography` object (`font`, `sizePx`, `lineHeight`, `letterSpacingPx`, `wordSpacingPx`, `language`, `textCase`, `direction`, `features`, `baselineShiftPx`), or the shorthand keys `fontSize`, `lineHeight`, `letterSpacing`, `maxWidth`, `textAlign` |
| Appearance | `appearance` object (`fill`, `strokes`, `shadows`, `glow`), or the shorthand keys `color`, `strokeColor`, `strokeWidth`, `shadowColor`, `shadowBlur`, `shadowOffsetX`, `shadowOffsetY` |
| Placement and highlight | `x`, `y`, `highlightStyle` (`color` only) |

The shorthands map into the objects: `fontSize` → `typography.sizePx`, `lineHeight` → `typography.lineHeight`, `letterSpacing` → `typography.letterSpacingPx`. `textAlign` accepts `left` / `center` / `right` / `justify` and is normalized to `start` / `center` / `end` / `justify`. `highlightStyle.color` recolors existing highlight marks.

Omit `style` to preserve existing styles; the keys you pass are merged. A single key cannot be cleared: `aixcut_style(action="reset")` restores the default style for the clip's purpose.

## Visual layout

Use `aixcut_layout` to place picture clips. `update` changes one clip, `set` places a whole batch in one call, and `reset` returns clips to automatic centered placement.

| Field | Meaning |
| --- | --- |
| `preset` | `full`, `left-half`, `right-half`, `lower-third`, `pip-top-left`, `pip-top-right`, `pip-bottom-left`, or `pip-bottom-right` |
| `box` | `{ x, y, width, height }` in 0–1 canvas ratios; `x` and `y` are the top-left corner |
| `fit` | `contain` (default), `cover`, `fill`, or `none` |
| `opacity` | Opacity from 0 to 1 |
| `rotation` | Rotation in degrees |
| `scale` | A positive number, or `{ x, y }` |
| `crop` | `{ top, right, bottom, left }` ratios cropped from each edge |

`preset` and `box` are mutually exclusive. Omit both to change only `fit`, `opacity`, `rotation`, `scale`, or `crop` and keep the clip's current placement. Picture-in-picture presets include a 4% margin; fine-tune with a ratio box such as `box: { x: 0.62, y: 0.62, width: 0.34, height: 0.34 }`.

Read `aixcut_read(view="layout")` before changing layout; `layout_catalog` lists the named placements and the accepted ranges. A preset may look like `{ "preset": "pip-bottom-right", "fit": "contain", "opacity": 1 }`; a custom placement has a `box`; `{ "auto": true }` means automatic placement is still active. Do not reverse-engineer stored pixels.

`aixcut_clip(action="layout")` keeps its older contract: exactly one of `preset` or `box`, plus `fit` and `opacity` only. Use `aixcut_layout` for rotation, scale, crop, batches, and reset.

After a layout change, call `aixcut_frontend(action="capture_timeline_frames")` once. Match its `composition` entries (clip ref, time range, `visual_position`) to the visible elements and adjust if the subject or captions are covered. Captures are unnecessary for timing, volume, fade, or caption-text-only changes.

## Text style

Use `aixcut_style` for text and caption styling: `update` merges properties into one clip, `set` applies the same merge to several clips in one batch, and `reset` restores the purpose default style. Read `aixcut_read(view="style")` first and `style_catalog` for the closed key allowlist. For a Composition with several text nodes, pass `node_id` from the read.

## Batch arrangement

Use `aixcut_arrange` when several clips change together. Every call is one atomic batch, so a rejected item rolls back the whole change.

| Action | Required (besides `action`) | Description |
| --- | --- | --- |
| `delete` | `targets` | Delete the listed clips and the effects, masks, transitions and keyframes they own |
| `duplicate` | `items` (`target`, optional `to_ms`, `track`) | Copy several clips to their own start offsets |
| `move` | `items` (`target`, `to_ms` or `track`) | Move several clips to new times or same-kind tracks |
| `close_gaps` | `track` | Push one track's clips together so no gaps remain |
| `delete_before` | `track`, `at_ms` | Delete everything before the playhead on one track |
| `delete_after` | `track`, `at_ms` | Delete everything after the playhead on one track |

A clip crossing the playhead is trimmed, not deleted. Duplicating or moving to another track requires the same kind of track.

## Audio separation

`aixcut_audio(action="detach_audio", targets=[...])` moves a video clip's source audio onto an audio track: the audio becomes its own editable clip and the video keeps its picture without sound. `aixcut_audio(action="restore_audio", targets=[...])` re-enables the video's own audio and **keeps** the separated clip. Both are idempotent — separating an already separated clip writes nothing.

## Fades

| Field | Meaning | Unit |
| --- | --- | --- |
| `fade_in_ms` | Fade-in duration at clip start | milliseconds |
| `fade_out_ms` | Fade-out duration at clip end | milliseconds |

Pass only the field needed; omitted means 0. Audio clips map to `audioFadeInMs`/`audioFadeOutMs`, and video clips map to `videoFadeInMs`/`videoFadeOutMs`; callers do not provide storage keys. Text and caption clips reject fades. Their `purpose` is assigned from the target track (`caption` or `art-text`). For music covering the full video, set both fades.

```json aixcut_clip
{
  "action": "fade",
  "idempotency_key": "b7f0c2a4-9d31-4e6b-8c2f-1a5d3e7b9c01",
  "target": "clip:12",
  "fade_in_ms": 300,
  "fade_out_ms": 500
}
```

## Batched item fields

For `aixcut_text(action="add")`, per-item `start_ms` and `duration_ms` belong in each `items[]` entry. The optional top-level `start_ms` is an action-level initial offset; use item fields when entries need their own start or duration. The live schema remains authoritative.

```json aixcut_text
{
  "action":"add",
  "items":[{"text":"标题","start_ms":0,"duration_ms":1500}]
}
```

## Action table

| Tool | action | Required (besides `action`) | Optional | Description |
| --- | --- | --- | --- | --- |
| aixcut_primary(action="set") | — | `items` | — | Replace the primary video track |
| aixcut_primary(action="add") | — | `items` | — | Append to the primary video track |
| aixcut_primary(action="replace") | — | `target`, `source` | Time fields | Replace a primary clip source |
| aixcut_primary(action="delete") | — | — | `target` or `targets` | Delete primary clips |
| aixcut_primary(action="reorder") | — | `order` | — | Reorder all primary clips; `order` is the complete list |
| aixcut_speech(action="set") | — | `items` | — | Replace the speech sequence |
| aixcut_speech(action="insert") | — | `items` | — | Append to the speech sequence |
| aixcut_speech(action="delete") | — | — | Target | Delete speech clips |
| aixcut_speech(action="replace") | — | `target`, `source` | Time fields | Replace a speech clip source |
| aixcut_speech(action="trim") | — | — | Target and time fields | Trim speech clips; without a target, trim all video clips |
| aixcut_speech(action="reset") | — | — | Target | Restore a speech clip to its full source range |
| aixcut_clip(action="add") | — | `items` | `kind`, `start_ms`, track | Add video, image, or Motion Graph clips |
| aixcut_clip(action="duplicate") | — | `target` | `start_ms` | Duplicate a clip and its components |
| aixcut_clip(action="replace") | — | `target`, `source` | — | Replace a clip source |
| aixcut_clip(action="delete") | — | `target` | — | Delete a clip and its components |
| aixcut_clip(action="trim") | — | `target` | Time fields | Trim a clip within its source range |
| aixcut_clip(action="split") | — | `target` | `at_ms`, `char_index`, `to_ms` | Split a clip into two |
| aixcut_clip(action="move") | — | `target` | Track, time, columns | Move a clip to another time or track |
| aixcut_clip(action="time") | — | `target` | Track, time, columns | Change a clip’s timeline position |
| aixcut_clip(action="retime") | — | `target` | `rate` | Change playback rate without changing timeline duration |
| aixcut_clip(action="fade") | — | `target` | Fade fields | Update clip fades |
| aixcut_clip(action="layout") | — | `target` | `preset` or `box`, `fit`, `opacity` | Set visual placement and size |
| aixcut_clip(action="update") | — | `target` | Columns, time, fades | Update clip fields and overrides |
| aixcut_clip(action="set") | — | `track`, `items` | — | Replace every clip on one track |
| aixcut_clip(action="reorder") | — | `track`, `order` | — | Set the complete clip order for one track |
| aixcut_clip(action="cut") | — | `target`, `source_start_ms`, `end_ms` | — | Remove a source range and keep both remaining sides |
| aixcut_text(action="add") | — | `items` | `start_ms`, track | Add text clips |
| aixcut_text(action="set") | — | `track`, `items` | — | Replace every text clip on one track |
| aixcut_text(action="update") | — | `target` | Columns, time, text | Update text fields and content |
| aixcut_text(action="delete") | — | `target` | — | Delete a text clip |
| aixcut_text(action="split") | — | `target` | `at_ms`, `char_index`, `to_ms` | Split text by time or character position |
| aixcut_text(action="style") | — | `target` | Text fields | Update text style, highlights, or position |
| aixcut_text(action="duplicate") | — | `target` | `start_ms` | Duplicate a text clip |
| aixcut_text(action="move") | — | `target` | Track, time, columns | Move text to another time or track |
| aixcut_text(action="merge") | — | `targets` | `separator` | Merge text clips into their real timeline window |
| aixcut_audio(action="add") | — | `items` | `start_ms`, `duration_ms`, fades, track | Add audio clips; top-level values are item defaults |
| aixcut_audio(action="set") | — | `track`, `items` | — | Replace every audio clip on one track |
| aixcut_audio(action="update") | — | `target` | Columns, time, `volume` | Update audio fields and volume |
| aixcut_audio(action="replace") | — | `target`, `source` | — | Replace an audio source |
| aixcut_audio(action="delete") | — | `target` | — | Delete an audio clip |
| aixcut_audio(action="trim") | — | `target` | Time fields | Trim an audio clip |
| aixcut_audio(action="split") | — | `target` | `at_ms`, `to_ms` | Split an audio clip |
| aixcut_audio(action="move") | — | `target` | Track, time, columns | Move an audio clip |
| aixcut_audio(action="time") | — | `target` | Track, time, columns | Change an audio clip’s timeline position |
| aixcut_audio(action="retime") | — | `target` | `rate` | Change playback rate without changing timeline duration |
| aixcut_audio(action="fade") | — | `target` | Fade fields | Update audio fades |
| aixcut_audio(action="reorder") | — | `track`, `order` | — | Set the complete audio clip order for one track |
| aixcut_audio(action="duplicate") | — | `target` | `start_ms` | Duplicate one audio clip with its design |
| aixcut_audio(action="cut") | — | `target`, `source_start_ms`, `end_ms` | — | Remove a source range from an audio clip |
| aixcut_audio(action="detach_audio") | — | `targets` | — | Move a video clip's source audio onto an audio track |
| aixcut_audio(action="restore_audio") | — | `targets` | — | Re-enable the video clip's own audio, keeping the separated clip |
| aixcut_layout(action="update") | — | `target` | `preset` or `box`, `fit`, `opacity`, `rotation`, `scale`, `crop` | Place one picture clip |
| aixcut_layout(action="set") | — | `items` | — | Place several clips in one atomic batch |
| aixcut_layout(action="reset") | — | `targets` | — | Return clips to automatic centered placement |
| aixcut_style(action="update") | — | `target`, `style` | `node_id` | Merge style properties into one clip |
| aixcut_style(action="set") | — | `items` | — | Apply the same style merge to several clips |
| aixcut_style(action="reset") | — | `targets` | `node_id` | Restore the purpose default style |
| aixcut_arrange(action="delete") | — | `targets` | — | Delete several clips and everything they own |
| aixcut_arrange(action="duplicate") | — | `items` | — | Copy several clips to their own start offsets |
| aixcut_arrange(action="move") | — | `items` | — | Move several clips to new times or same-kind tracks |
| aixcut_arrange(action="close_gaps") | — | `track` | — | Push a track's clips together so no gaps remain |
| aixcut_arrange(action="delete_before") | — | `track`, `at_ms` | — | Delete everything before the playhead on one track |
| aixcut_arrange(action="delete_after") | — | `track`, `at_ms` | — | Delete everything after the playhead on one track |
| aixcut_track(action="ensure") | — | — | `kind`, `role`, `name` | Ensure a track exists |
| aixcut_track(action="update") | — | — | `target`, track, `kind`, `role`, `name`, `enabled`, `locked`, `muted` | Update editable track fields |
| aixcut_track(action="reorder") | — | `order` | — | Set the complete track order |
| aixcut_track(action="cleanup") | — | — | — | Remove eligible empty tracks |
| aixcut_track(action="clear") | — | — | `target`, track | Clear clips while keeping the track |
| aixcut_track(action="delete") | — | — | `target`, track | Delete a track and its clips/components |
| aixcut_project(action="canvas") | — | — | `preset`, `width`, `height`, `fps` | Update canvas settings; explicit dimensions take precedence |
| aixcut_project(action="clear") | — | — | — | Delete all clips and voice segments from the active Project |
| aixcut_project(action="update") | — | `title` | — | Rename the Project |
| aixcut_timeline(action="list") | — | — | — | List independent Project timelines |
| aixcut_timeline(action="history") | — | — | — | Read the Project edit stack |
| aixcut_timeline(action="receipt") | — | `idempotency_key` | — | Check the original creation/duplication request after a lost confirmation |
| aixcut_timeline(action="undo") | — | `operation_id` | — | Undo only the Project stack head |
| aixcut_timeline(action="redo") | — | `operation_id` | — | Redo only the Project stack head |
| aixcut_timeline(action="create") | — | — | `name`, `source_timeline_id` | Create blank or source-copied timeline |
| aixcut_timeline(action="duplicate") | — | `source_timeline_id` | `name` | Duplicate a timeline as a new version |
| aixcut_timeline(action="rename") | — | `timeline_id`, `name` | — | Rename a timeline |
| aixcut_timeline(action="delete") | — | `timeline_id` | — | Delete a timeline; retain at least one |
| aixcut_timeline(action="reorder") | — | `timeline_ids` | — | Reorder timelines using the complete list |
| aixcut_timeline(action="update") | — | `timeline_id` | `name`, `preset`, `width`, `height`, `fps` | Update one version's name, canvas or frame rate |
| aixcut_timeline(action="clear") | — | `timeline_id` | — | Remove every clip from one version, keeping its tracks |
| aixcut_frontend(action="capture_source_frames") | — | `media_id`, `selections` | `timeout_ms`, `workspace_id` | Capture 1–8 JPEG frames from a source |
| aixcut_frontend(action="capture_timeline_frames") | — | `selections` | `timeline_id`, `expected_revision`, `timeout_ms`, `workspace_id` | Capture 1–8 JPEG frames from a timeline |
| aixcut_frontend(action="prompt_add_material") | — | — | `timeout_ms`, `workspace_id` | Show the user upload area |

For Kimi local-media uploads, use only `prompt_add_material`. It opens the upload area but does not confirm completion and returns no import ID; wait for the user, then reread `aixcut_read(view="sources")` and match the file by `file_name`. User selection in the Project upload area is the only Kimi route for local files.

Page export uses `aixcut_frontend(action="export_timeline")` and `aixcut_frontend(action="export_timeline_status")`, but belongs to `aixcut-export` and is not listed here.

## Complete request examples

```json aixcut_clip
{
  "action": "trim",
  "idempotency_key": "8c1f0b6e-3d2a-4c9f-9d5c-6a1b2c3d4e5f",
  "target": "clip:3",
  "source_start_ms": 1200,
  "duration_ms": 2400
}
```
c9f-9d5c-6a1b2c3d4e5f",
  "target": "clip:3",
  "source_start_ms": 1200,
  "duration_ms": 2400
}
```
