---
name: aixcut-captions
description: "Create, edit, split, and style Aixcut captions and sync them with voice or speech. Do not use for voice synthesis or full assembly. Chinese triggers: 字幕、台词、高亮、双语字幕、字幕不同步."
---

# Aixcut Captions

## Conversation guidance

State the caption task's current status and next step when useful. Continue safe work with the information already available. Ask only for a missing choice that materially changes the captions, and ask one question at a time. Distinguish an accepted update from captions verified by reading the Project back.

Caption content belongs to this Skill. Do not edit captions with the generic text Tool. The caption track may contain only real spoken words or user-provided subtitle copy. Visual annotations such as ingredient labels, arrows, callouts, titles, dashed or dotted circles, animated highlights, and Motion Graphs belong to their dedicated visual tracks and must never be represented as captions.

The caption track contains spoken or user-supplied subtitle copy only. Ingredient labels, arrows, callouts, titles, dashed or dotted circles, and Motion Graphs are separate visual elements; do not add them as captions or treat them as satisfied by subtitle text.

## Determine the caption source first

| Video type | Caption source | Action |
| --- | --- | --- |
| Narrated video (visuals + voiceover) | Transcript of the voiceover audio already placed on the timeline | Confirm the audio source has `transcript_status=available`, call `aixcut_caption(action="regenerate")`, then read the result back. |
| Talking-head video | The speech script/transcript | Captions may be derived from the speech track. |
| User supplied copy | The user's copy | Use that copy and align timing to the visuals or voiceover. |

Visual source clips usually do not have a usable transcript. For narrated videos, read the transcript for the voiceover audio. A saved voice script is not proof that transcription finished; do not copy the script and present it as ASR output.

## Short path

1. Read `aixcut_read(view="captions")` for current captions and stable refs. Also read `speech` or `timeline` to confirm the voiceover audio is placed.
2. For narration, reread the audio source's `transcript_status`. Regenerate only when it is `available`; if pending, wait and reread; report missing, outdated, or empty transcripts accurately.
3. Read `captions` again to confirm the count, first/last timing, and that generated text came from the transcript.
4. Before reporting captions complete, verify the caption track has no Motion Graph, `art-text`, or other visual annotation clips. Those elements must remain on their dedicated tracks.

## Choose the content language

Use the language the user requested for the finished captions, not the language of this Skill or the conversation by default. Preserve supplied wording unless translation is requested. If the user asks for translated subtitles, translate the source transcript into the explicit target language; if they ask for bilingual captions, preserve both languages in the requested format. Ask only when the target language is unclear and materially affects the result. Apply the shared language policy from `aixcut-basics`.

## Source rules

- A voice script is not ASR. Confirm the voiceover is placed and its transcript is `available`, then regenerate from the actual transcript.
- For a talking-head transcript, derive captions from the speech track; do not copy it manually.
- If neither source exists, create or confirm the intended copy with the user. Never invent captions.

## Timing

- Align captions to speech, not to visual cuts alone.
- Keep each caption to at most two lines. Split long sentences at punctuation or semantic boundaries.
- Do not leave gaps or overlaps between adjacent captions after splitting.
- If voiceover placement changes, rebuild or realign captions too.

## Writing and editing

- Replace the whole track with the set action; append new captions with the add action.
- Use the corresponding action for wording, splitting, styling, and highlights.
- Use a new `idempotency_key` for each structural write and reread after each one. Position edits require the latest ref.
- See [references/actions.md](references/actions.md) for fields and actions.

## Writes switch captions to manual mode

Writing or editing captions changes the caption track to manual mode, so the browser no longer rebuilds it from the transcript. This is expected; manual captions must be protected from automatic replacement.

- To resume automatic following, confirm with the user first. `aixcut_caption(action="mode", mode="auto")` rebuilds the entire track from the transcript and overwrites manual captions.
- Read `aixcut_read(view="captions").mode`; do not rely on memory.
- Do not switch back to `auto` after a write unless the user asks; it would make the new captions eligible for replacement.

## Do not rebuild an already valid track

- Do not regenerate captions that the server already derived and that still match the current voice and timeline. Rebuilding an unchanged, still-valid track only adds latency.
- Reread `captions` and its `mode` before deciding. When the existing captions are current, report them and skip the rebuild.
- When the voice audio or its timing changed, rebuild as usual.

## Boundaries

- Do not use a generic text Tool for captions.
- Automatic derivation failure is a warning; report it and do not claim captions were created.
- While transcription is pending, do not rerender the voiceover or reimport audio. Reread the state and preserve errors such as `MCP_CAPTION_TRANSCRIPT_PENDING`.
- Do not edit the transcript to change caption wording; transcript edits are for recognition corrections.

## Completion

Confirm the copy matches the request, timing and count align with the audio, and read-back shows the correct result. Report the count, first/last timing, and new revision.
