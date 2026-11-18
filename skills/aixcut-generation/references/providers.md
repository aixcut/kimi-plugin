# Generation Provider Reference

This reference lists parameters only. Follow the main Skill for polling, terminal-state handling, and placement.

## Common fields

- `project_id`: optional; omitted means the current Project.
- `idempotency_key`: optional for `aixcut_generate(action="submit")`; the server creates and returns one if omitted. Reuse it only when retrying the same submission.
- `provider` and `model`: use server defaults when omitted; override only when explicitly requested.
- `prompt` is always a top-level field. Never put it inside `input`.
- `input`: model-specific options only. Unknown fields are rejected before a paid Provider call.

## Kinds and default providers

| kind | Default provider | Default model | Use |
| --- | --- | --- | --- |
| `image` | `image2` | `gpt-image-2` | Generate or edit an image. |
| `video` | server mapping | catalog model | Text-to-video or reference-to-video; choose a model enabled by `catalog`. |
| `music` | `minimax` | `music-3.0` | Processed by the server as audio. |

Defaults come from server configuration and may vary by environment. Pass `kind`, `model` and `prompt` at the top level.

## `input` parameters

### `image2`

| Key | Required | Description |
| --- | --- | --- |
| `mode` | No | `generate` by default, or `edit`. |
| `reference_images` | Required for `edit` | 1–10 reference image URLs. |
| `size` | No | Explicit size such as `1024x1024`, `auto`, or a tier; combinations with `ratio`/`image_size` are resolved, not rejected. |
| `ratio` / `aspect_ratio` | No | `16:9`, `9:16`, `1:1`, `4:5`, `3:4`, or `4:3`; `ratio` is an alias. |
| `image_size` | No | `1K`, `2K`, or `4K`. |
| `purpose` | No | `cover` makes an omitted `quality` default to `high`. |
| `quality` | No | `auto`, `low`, `medium`, or `high`; defaults to `medium` unless `purpose=cover`. |
| `style` | No | Advisory style hint; put the concrete style in the prompt for best results. |
| `background` | No | Background option passed to the image model. |

### `video`

| Key | Required | Description |
| --- | --- | --- |
| `mode` | No | `full_reference` or `first_last_frame`; use a scenario exposed by the selected catalog model. |
| `references` | Depends on scenario | Ordered `{ role, media_id, expected_file_revision }` entries, or the catalog-issued `reference_handle`. `role` is `reference`, `first_frame`, or `last_frame`. |
| `aspect_ratio` | No | One of the selected model's catalog ratios. |
| `resolution` | No | One of the selected model's catalog resolutions. |
| `duration_seconds` | No | One of the selected model's catalog durations, or `-1` only when smart duration is enabled. |
| `output_format` | No | `mp4` for current adapters. |
| `generate_audio` | No | Boolean; availability depends on the model's `audio_policy`. |
| `negative_prompt` | No | Optional negative prompt. |

Do not pass legacy URL fields such as `first_frame_url`, `last_frame_url`, `ref_image_urls`, `ref_audio_urls`, or `audio`. The service resolves project media from `references` and rejects obsolete fields.

### `minimax`

| Key | Required | Description |
| --- | --- | --- |
| `lyrics` | No | Lyrics in the requested song language. Do not translate supplied lyrics unless requested. |
| `instrumental` | No | Defaults to instrumental; set `false` for a sung song. |
| `format` | No | Defaults to `mp3`; also supports `wav` and `pcm`. |
| `sample_rate` | No | Defaults to 44100. |
| `bitrate` | No | Defaults to 256000. |
| `watermark` / `lyrics_optimizer` | No | Explicitly set `true` to enable. |

## Actions

| Tool | action | Required fields | Optional fields | Behavior |
| --- | --- | --- | --- | --- |
| aixcut_generate(action="quote") | — | — | `kind`, `prompt`, `name`, `provider`, `model`, `input` | Estimate credits and validate generation permission; creates no Job. |
| aixcut_timeline(action="list") | — | — | — | List version timelines. |
| aixcut_timeline(action="history") | — | — | — | Read the Project edit stack. |
| aixcut_timeline(action="receipt") | — | `idempotency_key` | — | Check the original request after lost confirmation. |
| aixcut_timeline(action="undo") | — | `operation_id` | — | Undo only the Project stack head. |
| aixcut_timeline(action="redo") | — | `operation_id` | — | Redo only the Project stack head. |
| aixcut_timeline(action="create") | — | — | `name`, `source_timeline_id` | Create an empty timeline or copy one. |
| aixcut_timeline(action="duplicate") | — | `source_timeline_id` | `name` | Duplicate a complete timeline. |
| aixcut_timeline(action="rename") | — | `timeline_id`, `name` | — | Rename a version. |
| aixcut_timeline(action="delete") | — | `timeline_id` | — | Delete a version. |
| aixcut_timeline(action="reorder") | — | `timeline_ids` | — | Set version order. |
| aixcut_generate(action="submit") | — | `idempotency_key` | `accepted_quoted_credits`, `kind`, `prompt`, `name`, `provider`, `model`, `input` | Submit one generation Job; returns `status: "async"` and `job_id`. |
| aixcut_generate(action="get") | — | `job_id` | — | Read one generation Job. |
| aixcut_generate(action="list") | — | — | `limit` | List recent Jobs in the current Project. |
| aixcut_generate(action="cancel") | — | `job_id` | — | Cancel a running Job. |

## Job fields

Polling returns an envelope with these top-level fields:

| Field | Description |
| --- | --- |
| `status` | `async` indicates an asynchronous task. |
| `job_id` | Pass this value unchanged when polling. |
| `terminal` | Stop polling when true. |
| `phase` | `queued`, `submitting`, `provider_waiting`, `materializing`, `finalizing`, `succeeded`, `failed`, `cancelled`, or `submission_unknown`. |
| `next_action` | While unfinished, wait `after_seconds`, then call `aixcut_generate(action="get")` with the same `job_id`; the server advances work. |
| `retryable` | Present only on failure. `true` means retrying the same request later may work; `false` means fix parameters or configuration first. |

Job details are in `result.data.job`, including `id`, `status`, `phase`, `error_code`, and artifact details.

## Request examples

This video prompt intentionally requests Chinese spoken dialogue even though the parameter guidance is in English:

```json aixcut_generate
{
  "action": "submit",
  "idempotency_key": "d4c8a1f2-6e30-4b7d-9a15-3c9f7e0b4d28",
  "kind": "video",
  "prompt": "A calm sunrise over the ocean, slow camera push-in. A woman says in Mandarin Chinese: ‘新的一天，从海边开始。’",
  "provider": "kling",
  "input": {
    "mode": "full_reference",
    "duration_seconds": 5,
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "generate_audio": false
  }
}
```

```json aixcut_generate
{
  "action": "get",
  "job_id": "7a2f5c91-4b8e-4d36-9f21-58c0e7a3b904"
}
```
