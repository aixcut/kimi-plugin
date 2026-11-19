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
| aixcut_frontend(action="export_timeline") | — | — | `timeline_id`, `expected_revision`, `format`, `width`, `height`, `frame_rate`, `timeout_ms`, `workspace_id` | Open the user-facing export dialog in the online Project page. Returns `prompt_opened=true`; do not poll or wait for a file. |
| aixcut_frontend(action="export_timeline_status") | — | — | `timeout_ms`, `workspace_id` | Manual status read only when the user explicitly asks about an export they started. |

`export_timeline` fields are top-level. Never wrap them in `params`; `params` belongs to shared `media.*` and `timeline.*` frontend actions, not to page export.
| `aixcut_export(action="submit")` | `kind` | — | `range`, `output`, `format`, `time_ms`, `idempotency_key` | Submit a headless frame or media render. Poll with `aixcut_export(action="get")`. |
| `aixcut_upload_link(action="create")` | — | — | — | Create a temporary upload link for sources missing from cloud storage |
| `aixcut_upload_link(action="status")` | — | `upload_id` | — | Follow the same upload link until accepted files have `media_id` |

## Submit example

```json aixcut_frontend
{
  "action": "export_timeline"
}
```

## Result fields

The export prompt result contains:

| Field | Available when | Meaning |
| --- | --- | --- |
| `state` | Always | `awaiting_user_confirmation` after the dialog opens. |
| `prompt_opened` | Always | `true` means the Agent action is complete and the user owns the export. |
| `action_selector` | Always | Selector for the export entry associated with the opened dialog. |

Do not convert this result into a render job, poll `export_timeline_status`, or claim that a file exists. Continue only if the user later reports the export result.
