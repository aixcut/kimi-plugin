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
| Acquire source files required by headless rendering | `aixcut_upload_link(action="create")`, `aixcut_upload_link(action="status")` |
| Read the timeline, sources or captions before exporting | `aixcut_read` |
| Check structure and renderability | `aixcut_review` |
| Probe or recover the Project page | `aixcut_open`, `aixcut_frontend(action="page_status")` |

## Choose the render path after authorization

Try the paths in order. Do not ask the user to choose between browser and headless rendering.

1. Try to start or connect the headed browser and open the target Project page.
2. Use **browser rendering** when the page is online and its `capabilities` include `export_timeline`.
3. If the headed browser cannot start, the page cannot be opened, or the capability is unavailable, use **headless rendering**.
   Use headless rendering only when every source required by the render is cloud-readable.
4. Headless rendering requires every source to be cloud-readable. If a required source is missing, call `aixcut_upload_link(action="create")`, present the link or QR, follow the same `upload_id`, and retry the original headless render only after the accepted files have `media_id` values.
5. If neither the headed browser nor headless rendering is available, report the blocker. Do not submit a headless job that is known to lack required cloud-readable sources.

If the target Project page is offline, call `aixcut_open(target="project", ...)`, open the complete `result.browser_handoff.url` once, and verify `presence_connections >= 1`. Do not retry `export_timeline` before the target page is online. After one handoff attempt, stop and ask the user to open the Project page manually.

Local video is not uploaded in full by default. Browser rendering can use browser-local sources. Headless rendering cannot use a source that exists only in the browser, so use the temporary upload link only to acquire the missing cloud-readable originals before retrying headless rendering.

## Browser rendering

1. Bind the current inspected timeline revision and pass it as `expected_revision`.
2. Call `aixcut_frontend(action="export_timeline")`. A supplied `timeline_id` does not change the user's current tab.
3. Accepted does not mean complete. Follow `next_action`, then poll `export_timeline_status` until `succeeded` or `failed`. It does not accept `export_id`: query the current Project page's singleton export runner with `action` and Project context only, and never pass the accepted `export_id` as a parameter.
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
