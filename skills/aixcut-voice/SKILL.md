---
name: aixcut-voice
description: "Write voiceover scripts, select a voice, synthesize speech, and optionally place it on the timeline. Do not use for music or visual assembly. Chinese triggers: 配音、旁白、解说、口播文案、换音色."
---

# Aixcut Voiceover

Follow the packaged shared [speech workflow](../../references/core/speech-workflow.md) for frozen recovery, per-child Job continuation and transcript boundaries.

## Conversation guidance

State whether the script, voice selection, rendering, or timeline placement is in progress and what happens next. Follow the requested content language and preserve supplied copy unless translation or rewriting is requested. Pause for consequential voice or script choices, unaccepted generation cost, or overwrite risk; verify the rendered and placed audio before reporting completion.

Voice scripts and voice profiles are stored in the Project Voice document. Rendered audio is linked back to its voice segments. Timeline placement is a separate optional step.

## Audio intent and evidence

Before rendering, read the current `timeline`, audio tracks and clips, source media transcription state, and existing voice segments or rendered voice audio. Use `aixcut_read(view="timeline")`, `aixcut_read(view="sources")`, and `aixcut_generate(action="speech_read")` as needed; do not infer intent from the presence of this Skill alone.

- If an existing source voice, speech, or narration is correct and the user only asks to edit visuals, timing, or captions, reuse the existing audio and skip voice render and placement.
- `speech_quote` freezes the selected paragraphs and price without submitting. `speech_submit` accepts that frozen recovery and submits generation; it does not replace original or source audio by default.
- Render and place only when the user explicitly requests new AI voice or explicitly requests replacing the original voice. A request to edit a timeline alone is not such a request.
- Before any placement, identify the target track and requested start/end range. Keep original speech, AI voice, music, and sound effects on their intended tracks; do not create a second human voice over a correct source narration.

## Workflow

1. Read the current timeline, audio tracks and clips, source transcript state, and existing voice before deciding whether rendering is needed. Call `aixcut_generate(action="catalog", kind="speech")` for current ready voice identities and selectable models, then `aixcut_generate(action="speech_read")` for ordered paragraphs and effective settings.
2. Use `aixcut_generate(action="speech_edit")` with `operation=add|update|delete|move` to update scripts or settings. These script and settings document writes do not require the Project page. Refresh the ordered draft before using paragraph numbers after conflicts or external edits.
3. Only for explicitly requested new narration or replacement, call `aixcut_generate(action="speech_quote")` with `segments` or `all=true`. Preserve its frozen recovery object and total credits; submit `aixcut_generate(action="speech_submit")` with exactly that recovery after the quoted charge is accepted.
4. Retain each per-paragraph operation identity and Job ID (`jobId`). Read each known Job with `aixcut_generate(action="get")` at returned intervals until terminal and published media are available. `submission_unknown` is not failure: retry only the identical frozen recovery, preserving operation identities. Never re-quote or generate a fresh identity to recover a lost response.
5. Place audio only if requested, using `aixcut_audio(action="add")` and published media refs through `aixcut-timeline-editing`; confirm target track and range first. Submission has no placement flag and never clears an existing voice track. Read back timeline/audio and source transcript status. Report generation, placement, transcript and listening evidence separately.

Voice rendering uses durable Jobs after the user's accepted quote. A bound Project page is required for timeline preview, placement that needs browser media, frame capture and export; it is not a prerequisite for the server speech draft/quote/submit flow. A disconnect does not cancel a submitted Job. A timeout leaves the outcome unknown: recover with the exact frozen recovery and original operation identities. Use a new request only for a separately authorized regeneration or corrected, definitively rejected input.

## Script language and voice

- Write the voice script in the user's requested content language or audience language. Conversation language does not determine voice language.
- Preserve user-provided scripts unless asked to translate or rewrite. If the user asks for translation, translate into the explicit target language before rendering; do not silently translate.
- If the script language is unclear and changes the result, ask one concise question before rendering. Do not use an English prompt or Skill as a reason to switch the spoken language to English.
- Apply the shared language policy from `aixcut-basics`.
- Voice identities must come from ready profiles in `aixcut_generate(action="catalog", kind="speech")`; never reuse another session's ordinal.
- Use the voice the user names. Otherwise, use the document default.
- Split multi-part scripts at natural pauses. Each segment renders separately and is placed in order.
- Speed and emotion values must be among those listed in the action reference.

## Boundaries

- `speech_submit` does not edit the timeline by default; timeline placement is a separate edit step.
- `speech_submit` never replaces original source audio unless the user explicitly requests replacement; generated audio is only bound to the requested AI voice segments until placement is requested.
- Keep original/source speech, AI-generated voice, BGM/music, and SFX on separate intended tracks. Confirm the track and time range before writing so a correct source narration is not doubled.
- Failed, rejected, submitted and unknown segments are reported individually. Never regenerate successful children to recover another child; fix definitively rejected inputs only, and retain unknown operation identities.
- After the server accepts a Job, rendering may continue even if the browser disconnects; disconnecting does not cancel generated audio.
- Never write `audio_status`, `audio_media_id`, or `audio_synthesis_hash` manually; the voice Job owns those links.
- See [references/actions.md](references/actions.md) for parameters.

## Completion

Check each segment Job and published audio. For synthesis-only requests, report audio assets; for requested placement, confirm matching clips with a timeline read. Without actual listening evidence, mark audio quality `unjudgeable`.
