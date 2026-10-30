# Export Action Reference

Project export uses `aixcut_frontend(action="export_timeline")` and `aixcut_frontend(action="export_timeline_status")`; do not submit a server-side render job.

## Common fields

- `project_id`: optional; omitted means the current Project.
- `workspace_id`: optional; usually omitted.
- `timeout_ms`: optional page-action wait limit; usually omitted.
- Tool inputs are strict objects. Extra fields are rejected.

## Actions

| Tool | action | Required fields besides `action` | Optional fields | Behavior |
| --- | --- | --- | --- | --- |
| aixcut_frontend(action="export_timeline") | — | — | `timeline_id`, `expected_revision`, `format`, `width`, `height`, `frame_rate`, `timeout_ms`, `workspace_id` | Render and download from the open Project page. A supplied `timeline_id` does not switch the current page tab. Returns when accepted. |
| aixcut_frontend(action="export_timeline_status") | — | — | `timeout_ms`, `workspace_id` | Read export status from the page. |

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
{
  "action": "export_timeline_status"
}
```

## Result fields

The accepted result has no file URL. Status results can contain:

| Field | Available when | Meaning |
| --- | --- | --- |
| `export_id` | After acceptance | Export identifier. |
| `state` | Always | `idle`, `running`, `succeeded`, or `failed`. |
| `format`, `width`, `height`, `frame_rate` | After acceptance | Actual output settings. |
| `file_name`, `byte_size`, `mime_type`, `elapsed_ms` | On `succeeded` | Downloaded filename, size, MIME type, and elapsed time. |
| `error_code`, `error_message` | On `failed` | Failure details. |

`format` defaults to `mp4`; omitted dimensions and frame rate use the timeline canvas and frame rate.
