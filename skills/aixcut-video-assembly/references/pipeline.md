# Video Assembly: Stage Details

This reference specifies what to read and confirm at each stage. Use the specialist Skills and live Tool Schemas for exact parameters.

After every atomic batch of structural writes, reread the affected `timeline`, `audio`, or `captions` view immediately. Do not reread between the items of a single batch. Do not reuse refs across revisions or wait until export to verify writes.

For multiple versions, call `aixcut_timeline(action="list")`, then duplicate the source timeline. Keep a separate `timeline_id` for each version. For each version, read, edit, reread/review that same timeline, then export. Reuse generated and source media across versions within the same Project.

| Tool | action |
| --- | --- |
| aixcut_timeline(action="list") | — |
| aixcut_timeline(action="history") | — |
| aixcut_timeline(action="receipt") | — |
| aixcut_timeline(action="undo") | — |
| aixcut_timeline(action="redo") | — |
| aixcut_timeline(action="create") | — |
| aixcut_timeline(action="duplicate") | — |
| aixcut_timeline(action="rename") | — |
| aixcut_timeline(action="delete") | — |
| aixcut_timeline(action="reorder") | — |
| aixcut_primary(action="set") | — |
| aixcut_primary(action="add") | — |
| aixcut_primary(action="replace") | — |
| aixcut_primary(action="delete") | — |
| aixcut_primary(action="reorder") | — |
| aixcut_audio(action="add") | — |
| aixcut_audio(action="update") | — |
| aixcut_audio(action="replace") | — |
| aixcut_audio(action="delete") | — |
| aixcut_audio(action="trim") | — |
| aixcut_audio(action="split") | — |
| aixcut_audio(action="move") | — |
| aixcut_audio(action="time") | — |
| aixcut_audio(action="retime") | — |
| aixcut_audio(action="fade") | — |
| aixcut_caption(action="mode") | — |
| aixcut_caption(action="regenerate") | — |
| aixcut_caption(action="set") | — |
| aixcut_caption(action="add") | — |
| aixcut_caption(action="update") | — |
| aixcut_caption(action="delete") | — |
| aixcut_caption(action="split") | — |
| aixcut_caption(action="style") | — |
| aixcut_caption(action="highlight") | — |
| aixcut_generate(action="submit") | — |
| aixcut_generate(action="quote") | — |
| aixcut_generate(action="get") | — |
| aixcut_generate(action="list") | — |
| aixcut_generate(action="cancel") | — |
| aixcut_frontend(action="export_timeline") | — |
| aixcut_frontend(action="export_timeline_status") | — |

## Stage 0: Confirm source readiness

1. Read the Project summary, source list, current timeline, audio tracks, existing voice state, existing music state, and source transcript states before deciding whether any audio should be generated:

```json
{
}
```

2. Do not use an old server-side analysis status to decide whether a local video is available. For `import_local_media`, use `import_status` only until the import is settled, then use the returned `media_id` to match the source in `aixcut_read(view="sources")` and check `transcript_status` plus `transcription_tasks` when speech matters. Active transcription states are `pending`, `queued`, `running`, `processing`, `submitted`, or `retrying`; wait briefly and reread `sources`. Do not keep polling a settled import. For `prompt_add_material`, wait for the user's confirmation and match the uploaded file by `file_name` in `sources`.
3. For videos with speech, verify that source's `transcript_status` is `available` before reading `source_lines`. Import `ready` does not mean ASR is complete. Without speech or a transcript, use `capture_source_frames` or `capture_timeline_frames` as needed for visual evidence.
4. Export the assembled video through `aixcut_frontend(action="export_timeline")`. Do not branch on whether a complete server-side video copy exists.
5. If media is missing or insufficient, ask the user to upload it using the “Local media” flow in `aixcut-timeline-editing`, then wait for the upload to finish.
6. If import is still running, reread `import_status`; if transcription is pending or running, reread `sources`. Do not re-import or substitute other media.

7. Classify the audio request before editing: `preserve-original`, `generate-voice`, `replace-original`, `add-music`, `no-music`, `optional-music`, or `needs-clarification`. Existing correct narration defaults to `preserve-original`; optional or unmentioned music defaults to `optional-music` and therefore remains off until confirmed. A complete assembly request is not permission to synthesize voice or music.

For local media, the Project page must be open and media access must be restored before capture or export.

The conditional order remains visual structure → requested voice only → captions from a real `transcript_status=available` source → confirmed music only → review/export.

## Stage 1: Visual structure and annotations

1. Read `timeline` to inspect existing clips and the target duration.
2. Create a lightweight shot plan before editing. For each shot, record the source ref, source in/out points, output time range, visible subject, and which claims the image can support. Use `capture_source_frames` when needed; do not state specific visual facts without evidence.
3. Choose source ranges and durations to meet the requested total length.
4. Give the sequence a narrative: an engaging opening, a developed middle, and a clear closing action or emotional landing.
5. Read the timeline back and verify there are no unintended gaps or overlaps and the total duration matches. Do not save the shot plan as a Project document unless asked.
6. Classify and place visual annotations before caption generation. Ensure dedicated `art-text` and Motion Graph overlay tracks, pass explicit track refs, and reread `timeline` after every annotation write. A wrong-track annotation must be moved or corrected, never deleted as a substitute.

## Stage 2: Voice script

- Match script length to the available duration. As a rough estimate, Chinese narration uses 4–5 Chinese characters per second; calculate the target length before drafting.
- Give the script a beginning, development, and conclusion; do not simply read asset titles aloud.
- Choose a voice that matches the requested style. If none is specified, select a reasonable default and tell the user.
- Follow `aixcut-voice` for the full workflow.
- Follow the language policy in `aixcut-basics`: the script uses the requested content language, independent of the conversation language.

## Stage 3: Render and place voice audio

Run this stage only when the resolved voice intent is `generate-voice` or `replace-original`. For `preserve-original`, keep the source audio and skip rendering. For `needs-clarification`, ask one concise question before rendering.

1. **Quote and submit:** Follow `aixcut-voice`: read catalog/draft, edit paragraphs, quote selected paragraphs, accept total credits, and submit the exact frozen recovery. Retain every operation identity and returned `jobId`. Poll each known Job with `aixcut_generate(action="get")` until terminal; do not regenerate successful children.
2. **Place audio:** Use published media refs with `aixcut_audio(action="add")` only when placement was requested. Submission itself does not place audio or clear a track. Preserve custom timing and existing clips, confirm target range/track, then reread `timeline` and `audio` for matching source refs.
3. **Transcript:** Reread the placed audio source's `transcript_status`. Only `transcript_status=available` permits automatic captions; report other states and follow the source's recovery guidance without fabricating captions or reimporting media.

An unknown submission resumes the identical frozen recovery; do not create a new operation identity or change scripts while confirming it. Generation, placement, transcript readiness and audio quality have separate evidence.

## Stage 4: Captions

1. Derive narration captions from the transcript of the voice audio that is actually on the timeline. A written script alone does not prove transcription or caption completion.
2. When `transcript_status=available`, call `aixcut_caption(action="regenerate")`, then reread `captions` and check that the text and timing match the voice.
3. If voice audio is not on the timeline, place it and reread `timeline`. For pending transcripts (`MCP_CAPTION_TRANSCRIPT_PENDING`), missing, stale, or empty transcripts, follow the error code. Never fabricate a transcript from the script. Continue other editing if possible, but report why captions were not generated.
4. Captions follow the voice timing, not shot boundaries. Keep each caption to at most two lines and split long sentences at semantic boundaries.
5. After derivation, reread `captions` and check count, first and last times, text, and mode. A manual write switches to manual mode; do not switch back to automatic mode blindly.
6. See `aixcut-captions` for caption-specific details.
7. Confirm the caption track contains only spoken subtitle clips; visual annotations must remain on their dedicated tracks.

## Stage 5: Background music

Run this stage only when the resolved intent is `add-music` and the user has explicitly requested or confirmed adding music. For `no-music` and `optional-music`, do not generate, add, or replace a music clip. If the user has not confirmed an optional choice, keep the stage skipped and report that music remains off.

1. Cover the full video duration with one music clip or divide it into sections.
2. Add fades at both ends using `fade_in_ms` and `fade_out_ms`; see `aixcut-timeline-editing`.
3. When narration is present, read back the music clip ref and call `aixcut_audio(action="update", target="clip:...", volume=0.2–0.4)` so speech remains clear. Normal volume may be used without narration.
4. Confirm that music and voice use parallel audio tracks and mix together.
5. Use beat evidence only when a supported live Tool action returns it. Preserve BPM, confidence, analysis duration, and timestamps as evidence. If no supported action returns beat evidence, report beat alignment as “unable to determine”; do not infer BPM from listening or duration.
6. Read-only analysis does not cut the timeline. Reread the timeline after each beat-based edit.

## Stage 6: Final review

Read the relevant views and verify each item; do not rely on memory.

Compare the result with the agreed script/shot plan and representative visual evidence. Keep full playback/listening explicitly unverified unless the finished video was actually reviewed.

| Check | How to verify | Pass condition |
| --- | --- | --- |
| Total duration | Read `timeline` | Matches the requested duration |
| Visual continuity | Read `timeline` | No unintended gaps or overlaps |
| Voice placement | Read `speech` and `timeline` | Voice segments are ready and matching audio clips exist |
| Caption count | Read `captions` | Count is reasonable and first/last times align with voice |
| Music fades | Read `audio` | Music clips have the requested fades |
| Export readiness | Check `renderability` with `aixcut_review(view="renderability")` | No blocking issues |
| Transcript state | Read the voice audio source | Claim transcript availability only for `available`; report other states as returned |
| Audio intent | Read Project, Timeline, source audio, voice, music, and transcript state | The final structure matches the resolved intent; no unrequested voice or music was generated |
| Full playback | Current MCP cannot prove the exported file was played and heard in full | State “full playback/listening not verified” unless it was actually reviewed |

## Stage 7: Export

Use `aixcut-export` for page export and status polling. The finished file is downloaded by the user's browser and has no server download URL. Report only the filename, size, and format returned by the page.

## Common symptoms

| Symptom | Cause | Recovery |
| --- | --- | --- |
| No sound in export | Voice was rendered but not placed | Return to Stage 3, step 2 |
| Voice exists but captions are missing | Render may be partial, timed out, or not placed; captions also need separate verification | Check per-segment results, placement, and `transcript_status`; regenerate and reread captions only when audio is on the timeline and transcription is available |
| Abrupt music start or end | Music has no fades | Add fades to the music clip |
| Narration is hard to hear | Music volume is too high | Lower music `volume` using `aixcut-timeline-editing` |
| Beat alignment cannot be verified | A supported beat-analysis action returned `unable_to_determine`, or page decoding/authorization failed | Report “unable to determine”; do not invent BPM or beat-matched shots |
| Export fails while the page is open | Page export failed or media access expired | Check `export_timeline_status`; ask the user to click the page to restore access if required |
