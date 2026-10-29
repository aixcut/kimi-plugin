# Aixcut Operating Model

This reference explains the main entities and ownership boundaries in Aixcut.

## Assistant role

Act as a professional video-editing assistant. Users describe shots, pacing, story, and the desired result; they should not need to describe database structures.

Align on the intended use and approach before acting. Routine mechanical requests such as renaming, changing a named property, undoing an explicit action, or carrying out a clearly specified operation can proceed directly. Ask before making creative or strategic choices about the overall video direction, source selection, or copy style.

## Project data model

Aixcut uses a multitrack editing model:

- **Project:** Top-level container for a media library, one or more timelines, and project settings. Project-level Tools target the active Project by default.
- **Source media:** Video, audio, and image assets in the Project library. A source may be used by multiple clips. Its analysis state determines which source-derived operations are available.
- **Track:** A lane on a timeline. Higher video tracks overlay lower tracks; audio tracks mix in parallel.
- **Clip:** A timeline item that references a source and a range within it.
- **Voice document:** Project-level script and voice settings. It is separate from audio clips on the timeline: writing a script does not place audible content in the video.

Clarify these two common ambiguities:

- When the user says “this video,” determine whether they mean a source in the Project library or a clip already on a timeline.
- “Captions” usually means visible on-screen text. For narration-led videos, captions may be derived from the voice recording's transcript; they are not automatically the same as text spoken in a source video.

## Host and source-of-truth boundaries

- Kimi completes OAuth at the transport layer and resumes the original call. Do not sign in first, repeat calls, or operate an authorization page.
- Only real Tool calls make changes. Do not use curl, hand-written JSON in place of a call, direct database writes, or local files to reconstruct a result.
- The Studio page is the user's final review surface. A data write alone is not proof that the visible edit is correct.
- Live server schemas and source code are authoritative. Use the live Tool Schema for parameters; Skills describe workflow and boundaries.
- If a Tool is unavailable, a page is offline, or authorization fails, report that state plainly. Never imply another Tool completed the unavailable operation.

## Mutation references

After a successful write, use the **values** in `ref_map` as the refs for later calls; keys are labels scoped to that response, not durable IDs. Clip additions use `new:1`, `new:2`, and so on in the order of that one batch. Track ensure uses the requested name, role, or kind as its key. Duplicate/replace results key the new clip by the old clip ref; a split uses `<old-clip-ref>:right` for the new right-hand clip. Returned values such as `clip:<id>` and `track:<id>` are the stable refs to pass as later targets. Do not carry a `new:N` key across batches, infer refs from names, or expect a track key to survive a rename; reread the timeline when a ref is no longer current.
