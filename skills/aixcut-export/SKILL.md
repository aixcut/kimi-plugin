---
name: aixcut-export
description: "Export an Aixcut Project only after explicit user authorization, using browser rendering for a capable online Project page and headless rendering otherwise. Do not use for editing, voiceover, or captions. Chinese triggers: 导出、渲染、下载成片."
---

# Export from Aixcut

## Conversation guidance

After the export prompt opens, stop and let the user export locally. Do not poll, wait for a file, or report render completion unless the user later says the export finished.

## Authorization gate

Finishing an edit is not export authorization. After final review, stop and tell the user they can export manually in the editor or explicitly ask the Agent to export. Do not call either export path until the user asks for the file or confirms an export prompt.

## Tool selection

| Intent | Tool |
| --- | --- |
| Open the local browser export dialog | `aixcut_frontend(action="export_timeline")` |
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

1. Call `aixcut_frontend(action="export_timeline")` only after checking that the Project page is online and advertises `export_timeline`.
2. Stop when the result has `prompt_opened=true`. The page opened the user's export dialog; the Agent's job is finished.
3. Do not call `export_timeline_status`, wait for rendering, inspect the download location, or claim a file exists.
4. If the user later says the export is complete and asks for follow-up, continue from that user message.

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
| `MCP_EXPORT_ALREADY_RUNNING` | The page already has an active export. Tell the user and let them finish it; do not start another or poll automatically. |
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

For local browser export, complete the Agent action when `prompt_opened=true`. The user owns the remaining export and download. Do not wait for a second signal.
