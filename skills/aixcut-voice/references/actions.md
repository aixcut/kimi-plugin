# Speech Action Reference

The `aixcut-voice` Skill keeps its user-facing name. Its MCP workflow uses the published speech generation operations. The live Tool Schema is authoritative.

| Tool | action | Required fields | Meaning |
| --- | --- | --- | --- |
| aixcut_generate(action="catalog") | — | `kind="speech"` | Discover current ready voice profiles and selectable models. |
| aixcut_generate(action="speech_read") | — | — | Read ordered paragraph numbers and effective settings. |
| aixcut_generate(action="speech_edit") | — | `operation` | Atomically add, update, delete or move paragraphs. |
| aixcut_generate(action="speech_quote") | — | exactly one of `segments` or `all=true` | Quote 1–50 nonempty paragraphs and freeze their recovery identities. |
| aixcut_generate(action="speech_submit") | — | `recovery` | Submit the exact frozen recovery after its quoted price is accepted. |
| aixcut_audio(action="add") | — | media ref | Place explicitly requested published speech audio on the timeline. |
| aixcut_generate(action="get") | — | `job_id` | Read each returned Job until terminal. |

## Paragraph edits

Read before using paragraph numbers; refresh after changed order or conflicts. `items` is one batch. For add, provide `text` or structured `content`; optional `after=0` means the beginning. For update, each item has a returned `segment` number and changed settings or content. Delete takes returned paragraph numbers. Move takes `segment` and `after`; never invent UUIDs or use voice profile ordinals from another session.

`voice` is a ready voice identity from `catalog(kind="speech")`. `speed` is 0.5–2, `preview_volume` is 0–100, and emotion must be supported by the live schema/model. `inherit` clears a per-paragraph override for supported settings. `all=true` applies only to supported update/delete forms. A speech draft mutation does not require the Project page; browser placement and preview still require an active bound page.

Read the draft:

```json
{}
```

Quote selected paragraph numbers only after reading the current ordered draft:

```json
{"segments":[1,2]}
```

## Submit and recover

Keep the exact `result.data.recovery` returned by `speech_quote`; after its total credits are accepted, supply it unchanged as `recovery` in `speech_submit`. Do not reconstruct its `operation_id`, input or per-item accepted credit amounts. A stale/changed quote requires a new quote and acceptance, rather than altering the frozen one.

Submission returns per-paragraph `operationId`, `jobId`, status and any published media identity. On `submission_unknown` or a lost submit response, retry only the identical `recovery`; it preserves the original operation identities. Never mint a new quote, edit the paragraph, or create a new identity merely to escape an unknown outcome. Record and continue each known `jobId` with `get`; failed and unknown children remain separately visible. Respect returned polling delays and stop at terminal. Generation success, timeline placement and transcript availability are separate facts.

## Placement

Submit has no `place=true` flag. Wait for published media identities, then use `aixcut_audio(action="add")` through the timeline editing Skill for explicitly requested placement. Protect existing clips; do not clear and rebuild the dedicated voice track by default. Confirm the target track and range, then reread `timeline`, `audio`, and `sources`.

Automatic captions require the actually placed source to report `transcript_status=available`; a script or a successful Job is not transcription evidence.
