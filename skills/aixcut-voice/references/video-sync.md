# Voiceover and Visual Alignment

Use this workflow whenever the user asks for voiceover, narration, explanation, or script changes while visuals already exist or may change. Do not treat it as an audio-only task.

## Choose the timing anchor and protect original sound

Before choosing a timing anchor, inspect the timeline's original/source audio and existing voice coverage. Protect and preserve original sound by default; a new voice render or replacement must be explicitly requested and must target a confirmed range and track. If the user only asks for visual editing and the existing narration is correct, reuse that audio.


| Situation | Anchor | Approach |
| --- | --- | --- |
| Visuals are final and voiceover is being added | Visuals | Write one voice segment per visual segment, matching its duration. |
| Script is final while visuals are not arranged or may change | Voiceover | Write and render the script first, use actual segment durations, then arrange visuals to fit. |

Ask the user if the anchor is unclear. Choosing incorrectly causes rework: changing voiceover after visuals are final requires visual rearrangement; changing visuals after voiceover is final may require rerecording.

## When visuals anchor the edit

1. Read `timeline` for each visual's start and end time.
2. Write the script by segment. As a rough fit, allow about 4–5 Chinese characters per second or use an equivalent natural speaking rate for the target language. Do not force a long sentence into a short shot; a brief pause is better.
3. Use one voice segment per visual segment so each can be tuned independently.
4. Render and place each voice segment at the matching visual start.
5. Read `timeline` again and confirm no segment spills into the next visual.

## When voiceover anchors the edit

1. Finalize and render the script to get each segment's actual duration.
2. Arrange visual durations to match the voice segments.
3. Read voice state again after arranging visuals and confirm total duration still matches.

## After visuals change

Trimming, reordering, or deleting visuals can invalidate voice placement. Then:

1. Read `timeline` and `speech` to list current visuals and voice segments.
2. Identify which segments still align and which do not.
3. Reposition only voice segments that are misaligned, using the new visual starts.
4. If total visual duration changed, edit the script as needed; do not pad it artificially.
5. Read back and confirm the result.

Captions follow voice timing. If voice placement changes, rebuild or realign captions too.

## Common failures

| Symptom | Cause | Recovery |
| --- | --- | --- |
| Narration does not match the visuals | Visual edits were not followed by voice repositioning | Reposition to the new visual starts and update captions. |
| A sentence continues after the shot changes | Script length was guessed instead of fitted to shot duration | Rewrite to fit a natural speaking rate for the requested language. |
| Total voice and video lengths differ | The edit switched between visual-anchored and voice-anchored timing | Choose one anchor and realign the dependent track. |
| The ending has picture with no sound | Voiceover is shorter than the visuals | Add an appropriate closing segment or shorten the visuals to fit. |
