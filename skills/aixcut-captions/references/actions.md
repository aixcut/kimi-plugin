# Caption Action Reference

This reference maps each published caption operation to its fields. Source selection, timing, and completion criteria are defined in the main Skill.

## Common fields

- `project_id`: optional; omitted means the current Project.
- `idempotency_key`: optional; the server creates and returns one when omitted. Reuse it only when retrying an identical request; use a new key for a new write intent.
- `target`: a stable ref or ID returned by `aixcut_read(view="clips")`; never guess IDs.
- `items`: array of captions, with each item validated by the server Schema.
- Every Tool uses a strict object; send only fields listed here.
- `style` accepts editor text-style keys only. See the timeline-editing action reference for valid keys.

## Actions

| Tool | action | Required besides `action` | Optional | Description |
| --- | --- | --- | --- | --- |
| aixcut_caption(action="mode") | — | `mode` | — | Set caption mode: `auto` follows the primary video track and rebuilds all captions, replacing manual content; `manual` allows direct editing. |
| aixcut_caption(action="regenerate") | — | — | — | Rebuild the caption track from video-clip transcripts. If no transcript exists, it returns an empty result with a warning. |
| aixcut_caption(action="set") | — | `items` | — | Replace all captions. |
| aixcut_caption(action="add") | — | `items` | `start_ms` | Append captions; if no start is supplied, append at the end. |
| aixcut_caption(action="update") | — | `target` | `text`, `values`, `style`, `highlight_ranges`, `x`, `y`, `enabled`, `duration_ms` | Update one caption's fields or content. |
| aixcut_caption(action="delete") | — | `target` | — | Delete one caption. |
| aixcut_caption(action="split") | — | `target` | `at_ms`, `char_index`, `to_ms` | Split one caption into two by time or character position. |
| aixcut_caption(action="style") | — | `target` | `style`, `highlight_ranges`, `x`, `y` | Update caption style or position. |
| aixcut_caption(action="highlight") | — | `target` | `highlight_ranges` | Set highlights as an array of `{ start, end }` character ranges. |
| aixcut_caption(action="merge") | — | `targets` | `separator` | Merge captions into their real timeline window. |
| aixcut_caption(action="sync") | — | — | — | Re-sync the caption track to the primary speech track. |
| aixcut_caption(action="move") | — | `target` | `to_ms` | Move one caption to a new start time. |
| aixcut_caption(action="duplicate") | — | `target` | `start_ms` | Duplicate one caption. |

## Caption mode

- Manual writes, wording changes, splits, deletions, styling, and highlights switch the track to `manual`; no additional `mode` action is needed.
- `regenerate` does not change the mode; it rebuilds the track from transcripts.
- Use `mode="auto"` only when restoring automatic following. It rebuilds all captions and overwrites manual content.
- Read the current mode from `aixcut_read(view="captions")`; the value is `auto` or `manual`.

## Full replacement example

These Chinese captions are deliberate user-facing content; the tool reference remains English:

```json aixcut_caption
{
  "action": "set",
  "idempotency_key": "7d3f0b6e-3d2a-4c9f-9d5c-6a1b2c3d4e5f",
  "items": [
    { "text": "Some views are waiting for you along the way.", "start_ms": 0, "duration_ms": 3200 },
    { "text": "At dawn, the first light passes through the forest canopy.", "start_ms": 3200, "duration_ms": 3600 }
  ]
}
```

## Append example

`add` appends caption items and takes no top-level `text`; a call that passes text outside `items` is rejected. Pass `start_ms` on the action to place the appended captions, or on each item to time them individually:

```json aixcut_caption
{
  "action": "add",
  "idempotency_key": "9c1a4e02-6f77-4a30-8f0e-2b7d51c4a9d3",
  "start_ms": 0,
  "items": [
    { "text": "Caption appended to the existing track.", "duration_ms": 2000 }
  ]
}
```
