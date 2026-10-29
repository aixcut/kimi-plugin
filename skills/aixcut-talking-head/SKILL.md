---
name: aixcut-talking-head
description: "Edit speech-led videos such as interviews, courses, or podcasts, especially to remove mistakes and pauses. Do not use for music montages or full assembly. Chinese triggers: 口播、访谈、课程、播客、去口癖."
---

# Speech-Led Editing in Aixcut

## Conversation guidance

State the current editing stage and next step when useful. Reuse the user's stated editing intent and continue safe inspection or cleanup. Pause only for a choice that materially changes the edit or an operation with important risk. Verify speech and caption state before reporting completion.

## Short path

1. Read `aixcut_read(view="source_lines")` in pages. The default is 200 rows; follow `next_offset` until `has_more=false` to get the full speech text and timing. Do not request all `word-time` data at once.
2. After identifying the lines to edit, use `selectors` with `include=["word-time"]` for word-level timing; request at most 50 rows per page.
3. Apply the requested edit with the appropriate published speech operation.
4. Captions follow the primary speech track. When needed, synchronize or regenerate them with `aixcut_caption(action="regenerate")`.
5. Read back `timeline` or `speech` to confirm the result.

## Required order

Speech timing anchors downstream work. Keep this order:

1. Finalize speech structure: remove mistakes, filler, pauses, and repeated takes.
2. After speech is final, adjust visuals: add/remove B-roll or overlays.
3. After visuals are final, update captions so their timing follows the final speech.
4. Add music and sound effects last, fitting them to the final duration.

If an upstream stage changes, revisit dependent stages. Read back after each major stage.

## Speech actions

| Intent | action |
| --- | --- |
| Replace the full speech sequence | `set` |
| Insert new speech | `insert` |
| Remove a mistake, filler, or full line | `delete` |
| Replace a clip's source | `replace` (requires `source` and `target`) |
| Shorten a pause or trim a clip | `trim` |
| Restore the original speech | `reset` |

`delete` and `trim` accept `target` or `targets` and can process several ranges. Deletion or trimming changes later positions; reread after each structural change.

## Boundaries

- Speech operations edit only the primary speech track. Use `aixcut_clip(action="add")` for B-roll and visuals, and `aixcut_audio(action="add")` for music or sound effects.
- Do not use text operations to edit captions.
- Use a fresh UUID for each batch. Do not reuse one key across distinct batches.

## Common misses

- Do not create captions before the speech edit is final; speech changes can invalidate caption timing.
- Reread after every structural speech change because later positions move.
- If visuals are replaced or trimmed, realign captions to the final speech rather than changing speech alone.

## Completion

Confirm the speech reflects the request, read-back positions are correct, and captions align. Report how many segments were removed and added, plus the new revision. Use `aixcut_review(view="timeline")` when visual verification is needed.

## Semantic and natural speech gate

Select takes by semantic units: record a preserve list for negation, conditions, numbers, names, required steps and the intended claim. When multiple retakes exist, choose the complete correct take before removing filler. Keep natural breaths and meaningful pauses; inspect the audio seam at each join after trimming. Without listening evidence, seam quality remains unjudgeable. Optional B-roll, music and overlays remain off during mechanical speech cleanup unless requested. If a speech operation or transcript state is unknown, preserve its identity and read the current state before continuing; do not reapply the edit with a new UUID.
