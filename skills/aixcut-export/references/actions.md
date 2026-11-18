# Export Action Reference

Project export tries the headed browser first. When the Project page is online and supports `export_timeline`, use browser rendering. If the browser cannot start or the page capability is unavailable, use headless rendering when every source is cloud-readable. If a required source is missing from cloud storage, acquire it through a temporary upload link before retrying headless rendering.

## Common fields

- `project_id`: optional; omitted means the current Project.
- `workspace_id`: optional; usually omitted.
- `timeout_ms`: optional page-action wait limit; usually omitted.
- Tool inputs are strict objects. Extra fields are rejected.

## Actions

| Tool | action | Required fields besides `action` | Optional fields | Behavior |
| --- | --- | --- | --- | --- |
| aixcut_frontend(action="export_timeline") | — | — | `timeline_id`, `expected_revision`, `format`, `width`, `height`, `frame_rate`, `timeout_ms`, `workspace_id` | Render and download from the open Project page. A supplied `timeline_id` does not switch the current page tab. Returns when accepted. |
| aixcut_frontend(action="export_timeline_status") | — | — | `timeout_ms`, `workspace_id` | Read browser export status from the page. |
| `aixcut_export(action="submit")` | `kind` | — | `range`, `output`, `format`, `time_ms`, `idempotency_key` | Submit a headless frame or media render. Poll with `aixcut_export(action="get")`. |
| `aixcut_upload_link(action="create")` | — | — | — | Create a temporary upload link for sources missing from cloud storage |
| `aixcut_upload_link(action="status")` | — | `upload_id` | — | Follow the same upload link until accepted files have `media_id` |

## Submit example

```json aixcut_frontend
{
  "action": "export_timeline",
  "timeline_id": "00000000-0000-4000-8000-000000000001",
  "expected_revision": 12,
  "format": "mp4",
  "width": 1920,
  "height": 1080,
  "frame_rate": 30
}
```

```json aixcut_frontend
{"action":"export_timeline_status"}
```

## Result fields

The accepted result has no file URL. Status results can contain:

| Field | Available when | Meaning |
| --- | --- | --- |
| `export_id` | After acceptance | Export identifier. |
| `state` | Always | `idle`, `running`, `succeeded`, or `failed`. |
| `format`, `width`, `height`, `frame_rate` | After acceptance | Actual output settings. |
| `render_mode` | Always after acceptance | `browser` for page rendering; `headless` is returned by `aixcut_export`. |
| `delivery` | Browser status | `browser-download` with `state` `pending` or `dispatched` and `file_verified: false`. |
| `file_name`, `byte_size`, `mime_type`, `elapsed_ms` | On `succeeded` | Downloaded filename, size, MIME type, and elapsed time. |
| `error_code`, `error_message` | On `failed` | Failure details. |

`format` defaults to `mp4`; omitted dimensions and frame rate use the timeline canvas and frame rate.

Headless success returns a short-lived `result.data.artifacts[].download_url`. A browser `succeeded` result only means the download was dispatched; it does not prove that the file was written to disk or verified.
