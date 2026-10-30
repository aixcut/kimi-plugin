# Timeline Editing Tool Actions

This reference lists fields for each action. Follow the main Skill for workflow, idempotency, and completion rules.

## Common fields

- `project_id`: Optional; defaults to the active Project.
- `idempotency_key`: Optional; the server generates one when omitted. Reuse it only for an identical retry. A new write intent needs a new key.
- `target` / `targets`: Stable refs or IDs returned by a read operation such as `aixcut_read(view="clips")`; never guess UUIDs.
- `items`: Array whose item fields are checked by the live Tool Schema.
- `timeline_id`: Target timeline UUID. Include it in every read, edit, capture, and review for multi-version work; omit only for a single version using the default timeline.
- Every Tool accepts a strict object. Send only fields listed here; extra fields are rejected.

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
| `style` | Text and captions | `textData.styleOverrides`; keys must come from the allowlist below |
| `highlight_ranges` | Text and captions | `textData.highlightRanges`; each item is a `{ start, end }` character range |
| `x`, `y` | Text and captions | Position as a 0–1 canvas ratio |
| `volume` | Audio and video | Playback volume from 0 to 1 |
| `values` | All | Column overrides; unknown column names are rejected |

The `style` allowlist is closed:

| Category | Style keys |
| --- | --- |
| Typography | `fontSize`, `fontFamily`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `maxWidth`, `textAlign` |
| Color and stroke | `color`, `strokeColor`, `strokeWidth`, `backgroundColor`, `shadowColor`, `shadowBlur`, `shadowOffsetX`, `shadowOffsetY` |
| Position and appearance | `x`, `y`, `appearance`, `highlightStyle`, `transform`, `animation` |

Omit `style` to preserve existing styles. Include only keys to change; omitted keys are not reset.

## Visual layout

Use `aixcut_clip(action="layout")` and provide exactly one of `preset` or `box`:

| Field | Meaning |
| --- | --- |
| `preset` | `full`, `left-half`, `right-half`, `lower-third`, `pip-top-left`, `pip-top-right`, `pip-bottom-left`, or `pip-bottom-right` |
| `box` | `{ x, y, width, height }` in 0–1 canvas ratios; `x` and `y` are the top-left corner |
| `fit` | `contain` (default), `cover`, `fill`, or `none` |
| `opacity` | Opacity from 0 to 1; omitted means preserve the current value |

`preset` and `box` are mutually exclusive. Picture-in-picture presets include a 4% margin; fine-tune with a ratio box such as `box: { x: 0.62, y: 0.62, width: 0.34, height: 0.34 }`.

Read `visual_position` before changing layout. A preset may look like `{ "preset": "pip-bottom-right", "fit": "contain", "opacity": 1 }`; a custom placement has a `box`; `{ "auto": true }` means automatic placement is still active. Do not reverse-engineer stored pixels.

After a layout change, call `aixcut_frontend(action="capture_timeline_frames")` once. Match its `composition` entries (clip ref, time range, `visual_position`) to the visible elements and adjust if the subject or captions are covered. Captures are unnecessary for timing, volume, fade, or caption-text-only changes.

Zoom, rotation, and anchor controls are not exposed because preview and export would diverge. Change size with `box.width`/`height` or another preset.

## Fades

| Field | Meaning | Unit |
| --- | --- | --- |
| `fade_in_ms` | Fade-in duration at clip start | milliseconds |
| `fade_out_ms` | Fade-out duration at clip end | milliseconds |

Pass only the field needed; omitted means 0. Audio clips map to `audioFadeInMs`/`audioFadeOutMs`, and video clips map to `videoFadeInMs`/`videoFadeOutMs`; callers do not provide storage keys. Text and caption clips reject fades. Their `purpose` is assigned from the target track (`caption` or `art-text`). For music covering the full video, set both fades.

```json aixcut_audio
{
  "action": "fade",
  "idempotency_key": "b7f0c2a4-9d31-4e6b-8c2f-1a5d3e7b9c01",
  "target": "clip:12",
  "fade_in_ms": 300,
  "fade_out_ms": 500
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
| aixcut_text(action="add") | — | `items` | `start_ms`, track | Add text clips |
| aixcut_text(action="update") | — | `target` | Columns, time, text | Update text fields and content |
| aixcut_text(action="delete") | — | `target` | — | Delete a text clip |
| aixcut_text(action="split") | — | `target` | `at_ms`, `char_index`, `to_ms` | Split text by time or character position |
| aixcut_text(action="style") | — | `target` | Text fields | Update text style, highlights, or position |
| aixcut_text(action="duplicate") | — | `target` | `start_ms` | Duplicate a text clip |
| aixcut_text(action="move") | — | `target` | Track, time, columns | Move text to another time or track |
| aixcut_audio(action="add") | — | `items` | `start_ms`, `duration_ms`, fades, track | Add audio clips; top-level values are item defaults |
| aixcut_audio(action="update") | — | `target` | Columns, time, `volume` | Update audio fields and volume |
| aixcut_audio(action="replace") | — | `target`, `source` | — | Replace an audio source |
| aixcut_audio(action="delete") | — | `target` | — | Delete an audio clip |
| aixcut_audio(action="trim") | — | `target` | Time fields | Trim an audio clip |
| aixcut_audio(action="split") | — | `target` | `at_ms`, `to_ms` | Split an audio clip |
| aixcut_audio(action="move") | — | `target` | Track, time, columns | Move an audio clip |
| aixcut_audio(action="time") | — | `target` | Track, time, columns | Change an audio clip’s timeline position |
| aixcut_audio(action="retime") | — | `target` | `rate` | Change playback rate without changing timeline duration |
| aixcut_audio(action="fade") | — | `target` | Fade fields | Update audio fades |
| aixcut_track(action="ensure") | — | — | `kind`, `role`, `name` | Ensure a track exists |
| aixcut_track(action="update") | — | — | `target`, track, `kind`, `role`, `name`, `enabled`, `locked`, `muted` | Update editable track fields |
| aixcut_track(action="clear") | — | — | `target`, track | Clear clips while keeping the track |
| aixcut_track(action="delete") | — | — | `target`, track | Delete a track and its clips/components |
| aixcut_project(action="canvas") | — | — | `preset`, `width`, `height`, `fps` | Update canvas settings; explicit dimensions take precedence |
| aixcut_project(action="clear") | — | — | — | Delete all clips and voice segments from the active Project |
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
| aixcut_frontend(action="capture_source_frames") | — | `media_id`, `selections` | `timeout_ms`, `workspace_id` | Capture 1–8 JPEG frames from a source |
| aixcut_frontend(action="capture_timeline_frames") | — | `selections` | `timeline_id`, `expected_revision`, `timeout_ms`, `workspace_id` | Capture 1–8 JPEG frames from a timeline |
| aixcut_frontend(action="import_local_media") | — | `url` or `urls` | `timeout_ms`, `workspace_id` | Import 1–8 local assets; returns `import_ids` |
| aixcut_frontend(action="import_status") | — | `import_ids` | `timeout_ms`, `workspace_id` | Check imports until settled and `private_copy` is not `copying` |
| aixcut_frontend(action="prompt_add_material") | — | — | `timeout_ms`, `workspace_id` | Show the user upload area |

`import_local_media` and `prompt_add_material` both return acceptance, not completed library ingestion. The first returns `import_ids` for `import_status`; the second has no import ID and must be confirmed by rereading `aixcut_read(view="sources")`. A batch uses `url` for one file or `urls` for up to eight; per-file failures appear in `failures`.

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

```json aixcut_frontend
{
  "action": "prompt_add_material"
}
```
