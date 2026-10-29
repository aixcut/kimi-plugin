# Frontend Action Reference

This reference covers the complete `aixcut_frontend` action catalog. Every action is called through the model-callable `aixcut_frontend` MCP Tool; the live Tool Schema remains authoritative. Send only fields accepted by the selected action.

## Request shapes

Every call includes `action` and may include `project_id`, `workspace_id`, and `timeout_ms` when supported. Page actions take their fields at the top level; shared file actions (`media.*` and `timeline.*`) keep their operation arguments inside `params`:

```json
{"action":"media.list","params":{}}
```

## Page and Project actions

| Action | Required fields | Optional fields / behavior |
| --- | --- | --- |
| `page_status` | — | Read-only page and Project presence check. |
| `capture_source_frames` | `media_id`, `selections` | `timeout_ms`, `workspace_id`; 1–8 selections, each using `times_ms` or `{start_ms,end_ms,count}`. |
| `capture_timeline_frames` | `selections` | `timeline_id`, `expected_revision`, `timeout_ms`, `workspace_id`; 1–8 selections. |
| `activate_timeline` | `timeline_id` | Switches the active timeline in the bound Project page. |
| `playback_check` | `timeline_id`, `expected_revision`, `start_ms`, `target_ms` | Plays at most 10 seconds and restores the playhead; `target_ms` must follow `start_ms`. |
| `prompt_add_material` | — | Opens the Project media upload area. The user selects files; verify the result with `aixcut_read(view="sources")`. |
| `import_local_media` | Exactly one of `url` or `urls` | `timeout_ms`, `workspace_id`; only use loopback bridge URLs for paths the user explicitly named. Returns `import_ids`, not completion. |
| `import_status` | `import_ids` | `timeout_ms`, `workspace_id`; poll these same IDs until settled; never resend the import. |
| `prompt_add_document` | — | Opens the Project Documents picker. The user selects the document. |
| `list_documents` | — | Lists document IDs, names, and parse status; use to verify uploads and parsing. |
| `export_timeline` | — | `timeline_id`, `expected_revision`, `format`, `width`, `height`, `frame_rate`; returns `export_id`, not a file URL. |
| `export_timeline_status` | — | Checks the browser export started by `export_timeline`; report a file only when succeeded. |

## Shared media and timeline file actions

All fields in this table belong inside `params`. Except `media.list` and `media.add`, `media.*` actions require `media_id` and `expected_file_revision` from a fresh `media.list`/`media.inspect` result. `operation_id` is optional for writes and identifies an operation for recovery; for every `operation.*` action it is required.

| Action | Required action-specific fields | Optional fields / behavior |
| --- | --- | --- |
| `media.list` | — | `scope`; lists available files. |
| `media.inspect` | `media_id`, `expected_file_revision` | `scope`; inspect the current file revision. |
| `media.add` | Exactly one of `artifact_id` or `existing_media_id` | `expected_file_revision` is required with `existing_media_id`; `destination`, `scope`. |
| `media.local_status` | `media_id`, `expected_file_revision` | `scope`; read local-file availability. |
| `media.prepare_local` | `media_id`, `expected_file_revision` | `purpose`, `scope`; prepare a readable local file. |
| `media.bind_local` | `media_id`, `expected_file_revision` | `scope`; waits for the user to select a local file. |
| `media.copy_to_opfs` | `media_id`, `expected_file_revision` | `scope`; copy the file into browser-managed storage. |
| `media.save_to_disk` | `media_id`, `expected_file_revision` | `mode` (`browser-download` or `file-picker`), `suggested_filename`, `bind_after_save`, `scope`; a picker waits for the user's confirmation. |
| `media.upload` | `media_id`, `expected_file_revision` | `scope`; upload the selected file. |
| `media.delete` | `media_id`, `expected_file_revision` | `scope`; may remove a Project binding and timeline references or a Workspace library item. Confirm scope first. |
| `media.delete_cloud` | `media_id`, `expected_file_revision` | `scope`; removes only the managed cloud copy, preserving the Media and its revision/transcript. |
| `media.associate_remote` | `media_id`, `expected_file_revision`, `source_media_id`, `source_file_revision` | `scope`; associates an authorized remote source. |
| `media.resolve_cloud_url` | `media_id`, `expected_file_revision` | `purpose` (`prepare`, `generation`, or `download`), `scope`; returned URL is short-lived. |
| `media.replace_source` | `media_id`, `expected_file_revision` | `scope`; waits for a user picker to select the replacement. |
| `media.extract_audio` | `media_id`, `expected_file_revision` | `track`, `range`, `output`, `destination`, `scope`. |
| `media.analyze` | `media_id`, `expected_file_revision` | `type` (`transcription`), `replace`, `scope`. |
| `media.capture_frame` | `media_id`, `expected_file_revision`, `at_ms` | `destination`, `scope`; saves one JPEG. |
| `timeline.capture_frame` | `timeline_id`, `expected_revision`, `at_ms` | `render_scope`, `destination`, `scope`; captures the current timeline. |
| `media.export_range` | `media_id`, `expected_file_revision`, `range` | `output`, `destination`, `scope`. |
| `timeline.export_range` | `timeline_id`, `expected_revision`, `range` | `render_scope`, `output`, `destination`, `scope`; retain the result in a library, artifact, or disk destination. |

`range` is `{ "start_ms": 0, "end_ms": 5000 }` with `end_ms > start_ms`. `output` and `destination` have strict schemas; use the live Tool Schema rather than adding undocumented fields.

## Operation recovery

| Action | Required fields | Behavior |
| --- | --- | --- |
| `operation.get` | `operation_id` | Read progress/result for the exact operation returned by the write. Poll this action; do not resubmit the write to check status. |
| `operation.cancel` | `operation_id` | Request cancellation of that operation. |
| `operation.retry` | `operation_id` | Retry only when the operation result says it is retryable; preserve its operation identity. |

## Result handling

An accepted file or browser action is not proof that the work completed. Use `operation.get` for file operations, `import_status` for local imports, `export_timeline_status` for page exports, and `list_documents` for Project document upload/parse status. Follow each result's terminal/status fields and do not create duplicate work by resending an accepted request.
