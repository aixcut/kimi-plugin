---
name: aixcut-export
description: "Export an Aixcut Project only after explicit user authorization, using browser rendering for a capable online Project page and headless rendering otherwise. Do not use for editing, voiceover, or captions. Chinese triggers: 导出、渲染、下载成片."
---

# Export from Aixcut

## Conversation guidance

State the export's current status and next step when useful. Continue checks and polling when possible. Distinguish queued, rendering, completed, failed, and unknown; report an export as complete only after its result is available.

## Authorization gate

Finishing an edit is not export authorization. After final review, stop and tell the user they can export manually in the editor or explicitly ask the Agent to export. Do not call either export path until the user asks for the file or confirms an export prompt.

## Tool selection

| Intent | Tool |
| --- | --- |
| Render and download through a capable Project page | `aixcut_frontend(action="export_timeline")`, `aixcut_frontend(action="export_timeline_status")` |
| Submit, inspect or cancel a headless render | `aixcut_export` |
| Read the timeline, sources or captions before exporting | `aixcut_read` |
| Check structure and renderability | `aixcut_review` |
| Probe or recover the Project page | `aixcut_open`, `aixcut_frontend(action="page_status")` |

## Choose the render path after authorization

Never select a path by host name or silently fall back to the other one. Use the available facts:

1. Call `aixcut_frontend(action="page_status")` when a Project page may be available.
2. Use **browser rendering** only when the target Project page is online and its `capabilities` include `export_timeline`.
3. Otherwise use **headless rendering** only when every source required by the render is cloud-readable.
4. If headless inputs are not cloud-readable, stop and explain the missing condition: open the target Project in a browser-capable client, or upload the original sources before retrying.
5. If neither path is available, report the blocker. Do not submit a job that is known to fail.

If the target Project page is offline, call `aixcut_open(target="project", ...)`, open the complete `result.browser_handoff.url` once, and verify `presence_connections >= 1`. Do not retry `export_timeline` before the target page is online. After one handoff attempt, stop and ask the user to open the Project page manually.

Local video is not uploaded in full by default. Browser rendering can use browser-local sources. Headless rendering cannot use a source that exists only in the browser.

## Browser rendering

1. Bind the current inspected timeline revision and pass it as `expected_revision`.
2. Call `aixcut_frontend(action="export_timeline")`. A supplied `timeline_id` does not change the user's current tab.
3. Accepted does not mean complete. Follow `next_action`, then poll `export_timeline_status` until `succeeded` or `failed`.
4. A successful result has `render_mode="browser"` and `delivery.kind="browser-download"`. `delivery.state="dispatched"` means the browser download was triggered; `file_verified=false` means the Agent has not read or validated the local file.
5. Report the filename, byte size, MIME type, and that the file must be checked in the browser download location. Never claim that the file is durably saved or verified.
6. Do not automatically upload the rendered file, download it back, run `ffprobe`, capture frames, or analyze it. Those actions require a later user request.

If the user cannot find the file, check the browser download list and blocked-download notice before considering another export.

## Headless rendering

1. Call `aixcut_export(action="submit")`. Use `kind="frame"` for one still or `kind="export"` with `range`, `output`, and a media `format` for a file.
2. Poll `aixcut_export(action="get", job_id=...)` until terminal.
3. A successful result has `render_mode="headless"` and a short-lived artifact `download_url`. Report its format, content type, byte size, and expiry. Never present it as a permanent link.
4. `cancel` stops a queued or running job; report the returned status instead of assuming it stopped.

## Analysis after export

Export and post-export analysis are separate user intents. The default export path does not verify media content.

If the user later asks to analyze or verify the finished file:

- Headless result: download the artifact using its URL and analyze that file.
- Browser result with a host-provided local path: analyze that path.
- Browser result without a verifiable path: ask the user to upload the finished file, or explicitly authorize a new browser-render-to-library/artifact workflow. Do not silently re-export.

## Error handling

| Error | Meaning and action |
| --- | --- |
| `MCP_EXPORT_ALREADY_RUNNING` | Do not submit again; call `export_timeline_status`. |
| `MCP_EXPORT_INVALID_INPUT` | Correct the format, dimensions, or frame rate and submit again. |
| `MCP_EXPORT_FAILED` | Explain `error_message`; retry once only with a justified parameter change. |
| `MCP_EXPORT_CANCELLED` | Report that the user cancelled the export. Do not retry as a system failure. |
| `MCP_FRONTEND_NOT_BOUND`, `MCP_FRONTEND_CLIENT_OFFLINE`, `MCP_FRONTEND_PAGE_NOT_ACTIVE` | Follow `error.next_action`; perform at most one bounded page handoff and then stop. |
| `CAPTURE_PERMISSION_REQUIRED` | Ask the user to click the Project page once, then retry the original browser-render request. Do not reimport media. |

## Boundaries

- Export does not change timeline content. Do not make unrequested edits.
- Never export to report progress, close an intermediate stage, or verify a partial edit.
- Browser and headless rendering have different source requirements. Do not pretend one path succeeded when the other was required.
- For local media recovery, see `aixcut-timeline-editing`. For a full production workflow, see `aixcut-video-assembly`.

## Completion

Complete only when the chosen path reaches a terminal success: browser status `succeeded` with download dispatched, or headless job `succeeded` with an artifact. Report the actual render mode and delivery state separately.
