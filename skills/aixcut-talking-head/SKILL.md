---
name: aixcut-talking-head
description: "Edit speech-led videos such as interviews, courses, or podcasts, especially to remove mistakes and pauses. Do not use for music montages or full assembly. Chinese triggers: 口播、访谈、课程、播客、去口癖."
---

# Speech-Led Editing in Aixcut

When source media must be assembled into a new timeline, use `full_assembly` from the first plan. `mechanical` is only for exact cleanup on an already assembled timeline; do not start with it and switch modes later.

## Conversation guidance

State the current editing stage and next step when useful. Reuse the user's stated editing intent and continue safe inspection or cleanup. Pause only for a choice that materially changes the edit or an operation with important risk. Verify speech and caption state before reporting completion.

## Short path

1. Read `aixcut_read(view="source_lines")` in pages. The default is 200 rows; follow `next_offset` until `has_more=false` to get the full speech text and timing. Do not request all `word-time` data at once.
2. After identifying the lines to edit, use `selectors` with `include=["word-time"]` for word-level timing; request at most 50 rows per page.
3. Apply the requested edit with the appropriate published speech operation.
4. Captions follow the primary speech track. When needed, synchronize or regenerate them with `aixcut_caption(action="regenerate")`.
5. Read back `timeline` or `speech` to confirm the result.

## Tool selection

| Intent | Tool |
| --- | --- |
| Read speech text and timing | `aixcut_read(view="source_lines")`, `aixcut_read(view="speech")` |
| Remove, trim, replace or reorder speech segments | `aixcut_speech` |
| Find a phrase's timing or fix a misheard word | `aixcut_transcript` |
| Synchronize, regenerate or restyle captions | `aixcut_caption` |
| Add or replace B-roll and overlays | `aixcut_clip` |
| Add music or sound effects | `aixcut_audio` |
| Check the result before reporting | `aixcut_review` |

## Required order

Speech timing anchors downstream work. Treat the selected and cleaned speech as the A-roll master. Keep this order:

1. Finalize speech structure: remove mistakes, filler, pauses, and repeated takes.
2. After the A-roll is final, adjust visuals: add/remove B-roll or overlays.
3. After visuals are final, update captions so their timing follows the final speech; titles, callouts, and Motion Graphs stay on visual tracks.
4. Add music and sound effects last, fitting them to the final duration and keeping speech intelligible.

If an upstream stage changes, revisit dependent stages. Read back after each major stage.

## Single-camera visual coverage

When the speech comes from one fixed camera or one fixed two-shot, do not treat
the source as two-shot-only. For an interview or podcast edit, a stable
speaker-focused reframe is the normal single-camera substitute for a real
single-camera angle.

- A speaker-focused reframe is not a fabricated camera angle. When the user
  requires speaker-picture sync, it is the required fallback unless the
  reframed image quality is unusable. Do not skip it merely because the source
  has no real camera cuts.
- Missing diarization does not waive speaker-picture sync. Infer the speaker
  from the question/answer structure and representative frames, then keep a
  two-shot where identity is genuinely uncertain.
- Derive at most one stable framing box per speaker from the visible source
  composition. Keep the speaker's full head, natural headroom, and shoulders.
- Prefer the widest safe crop that excludes the other speaker. If the crop must
  be enlarged more than 1.5x to the output height, verify final-revision frames
  and report the sharpness tradeoff instead of treating it as a quality pass.
- Use the speaker-focused framing for substantive question or answer turns.
  Keep the full two-shot for the opening, closing, natural interaction, and
  turns where the speaker is uncertain.
- A visually distinct shot must change composition, not only the source time.
  Clips that keep the same framing count as one visual shot even when the
  timeline contains several clips.
- Build the speaker map from question/answer structure and at most one
  representative face frame per distinct speaker. Do not sample every line,
  compare mouth motion, perform lip-reading, or run exhaustive frame analysis.
  If identity remains uncertain, keep the two-shot.
- Before completion, verify every speaker-focused shot shows the correct
  speaker, keeps natural headroom, and does not clip another person's body into
  the frame.

## Speech actions

| Intent | action |
| --- | --- |
| Find a spoken phrase with exact timing and word indexes | `aixcut_transcript` `find` |
| Fix a misheard word in the transcript | `aixcut_transcript` `update` |
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
- Do not delete a correct line because ASR misheard or misrecognized a word; fix the transcript with `aixcut_transcript(action="update")` instead of cutting the segment.
- Reread after every structural speech change because later positions move.
- If visuals are replaced or trimmed, realign captions to the final speech rather than changing speech alone.

## Completion

Confirm the speech reflects the request, read-back positions are correct, and captions align. Report how many segments were removed and added, plus the new revision. Use `aixcut_review(view="timeline")` when visual verification is needed.

## Semantic and natural speech gate

Select takes by semantic units: record a preserve list for negation, conditions, numbers, names, required steps and the intended claim. When multiple retakes exist, choose the complete correct take before removing filler. Keep natural breaths and meaningful pauses; inspect the audio seam at each join after trimming. Without listening evidence, seam quality remains unjudgeable. Optional B-roll, music and overlays remain off during mechanical speech cleanup unless requested. If a speech operation or transcript state is unknown, preserve its identity and read the current state before continuing; do not reapply the edit with a new UUID.
