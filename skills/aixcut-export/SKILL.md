---
name: aixcut-export
description: "Export an Aixcut Project as MP4, MOV, or WebM and check the page-based export status and result. Use when the user asks to export, render, download, or check an export. Do not use for editing, voiceover, or captions. Chinese triggers include 导出、渲染、下载成片."
---

# Export from Aixcut

## Conversation guidance

State the export's current status and next step when useful. Continue checks and polling when possible. Distinguish queued, rendering, completed, failed, and unknown; report an export as complete only after its result is available.

There is one export path: the open Project page renders the timeline in the browser and downloads the finished file to the user's computer.

Local video is not uploaded in full. If it has audio, the browser may upload extracted audio for transcription; visual understanding uses on-demand `capture_source_frames` or `capture_timeline_frames`. Do not require a full cloud copy or server-side render job.

## Workflow

1. Call `aixcut_frontend(action="export_timeline")`. Pass `timeline_id` to export a non-current version; the page reads that timeline without changing the user's current tab. The call returns `export_id` and the actual `format`, `width`, `height`, and `frame_rate`. It does not return a file URL; the browser downloads the file.
2. Accepted does not mean complete. Wait for top-level `next_action.after_seconds`, then call `aixcut_frontend(action="export_timeline_status")` until `state` is `succeeded` or `failed`.
3. `succeeded` means the file was handed to the browser download flow. Report `file_name`, `byte_size`, `mime_type`, and `elapsed_ms`; do not promise a server download link.
4. If the user cannot find the file, check the browser download list and blocked-download notice before considering another export.
5. If the user wants a different format, resolution, or frame rate, submit one new `export_timeline` request. Only one export can run on a page at once; while one is active, query its status instead of submitting again.

Before export, bind the current inspected timeline revision and pass it as `expected_revision` to `export_timeline`. Run the packaged Core `workflow-host.mjs gate` with `{evidence,current:{project_id,timeline_id,revision},deliverable:"export"}` before submitting export. Report export success only if the page status succeeded and current structural evidence still passes the gate; this gate does not prove playback or listening.

The target Project page must be open and initialized. If it is offline or bound to another Project, ask the user to open the target page. If uncertain, call `aixcut_frontend(action="page_status")`.

Local media also requires browser file-access permission. If export or frame capture returns `CAPTURE_PERMISSION_REQUIRED`, ask the user to click anywhere on the Project page and retry the same request. Do not reimport the media.

## Error handling

| Error | Meaning and action |
| --- | --- |
| `MCP_EXPORT_ALREADY_RUNNING` | Do not submit again; call `export_timeline_status`. |
| `MCP_EXPORT_INVALID_INPUT` | Correct the format, dimensions, or frame rate and submit again. |
| `MCP_EXPORT_FAILED` | Explain `error_message`; retry once only with a justified parameter change. |
| `MCP_EXPORT_CANCELLED` | Report that the user cancelled the export. Do not retry as a system failure. |
| `MCP_FRONTEND_NOT_BOUND` | Ask the user to open the Aixcut Project page. |
| `MCP_FRONTEND_CLIENT_OFFLINE` | Do not reopen the Project automatically. Ask the user to open the target Project in this MCP session, then check `page_status`; retry export at most once after it is online. |
| `MCP_FRONTEND_PAGE_NOT_ACTIVE` | Ask the user to switch the online page to the target Project. |

## Boundaries

- Export does not change timeline content. Do not make unrequested edits.
- The finished file does not pass through MCP. Do not promise a later server link.
- For local media and asynchronous recovery, see `aixcut-timeline-editing`. For a full production workflow, see `aixcut-video-assembly`.

## Completion

Complete only when `export_timeline_status` reports `state: "succeeded"`. Report the filename, format, resolution, duration, and file size.
