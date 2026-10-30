# Generation Provider Reference

This reference lists parameters only. Follow the main Skill for polling, terminal-state handling, and placement.

## Common fields

- `project_id`: optional; omitted means the current Project.
- `idempotency_key`: optional for `aixcut_generate(action="submit")`; the server creates and returns one if omitted. Reuse it only when retrying the same submission.
- `provider` and `model`: use server defaults when omitted; override only when explicitly requested.
- `input`: provider-specific parameters. Unknown keys may be ignored by the provider rather than rejected.

## Kinds and default providers

| kind | Default provider | Default model | Use |
| --- | --- | --- | --- |
| `image` | `image2` | `gpt-image-2` | Generate or edit an image. |
| `video` | `kling` | `kling-3` | Text-to-video or image-to-video; `kling-v3` is a compatibility alias. |
| `music` | `minimax` | `music-2.5+` | Processed by the server as audio. |

Defaults come from server configuration and may vary by environment. `kind` may also appear in `input.kind` or `input.media_type`; the first non-empty value is used.

## `input` parameters

### `image2`

| Key | Required | Description |
| --- | --- | --- |
| `prompt` | Yes | Image generation or editing prompt. Follow the requested content language for visible text; state it explicitly when needed. |
| `mode` | No | `generate` by default, or `edit`. |
| `reference_images` | Required for `edit` | Array of reference image URLs. |
| `size` | No | For example, `1536x864`. |
| `aspect_ratio` | No | `16:9`, `9:16`, `1:1`, `4:3`, or `3:4`; converted to dimensions when `size` is omitted. |
| `quality` | No | Defaults to `medium`. |
| `background` | No | Passed through as a background parameter. |

### `kling`

| Key | Required | Description |
| --- | --- | --- |
| `prompt` | Yes | Video prompt. Include target language for dialogue or visible text. |
| `mode` | No | ClipOS unified mode; MCP uses `full_reference` when omitted. Use a supported mode for first/last-frame references. |
| `first_frame_url` | Required for `i2v` | First-frame image URL. |
| `last_frame_url` | No | Last-frame image URL. |
| `aspect_ratio` | No | Defaults to `16:9`. |
| `resolution` | No | Defaults to `720p`. |
| `duration_seconds` | No | Defaults to 5. |
| `generate_audio` | No | Defaults to `false`. |
| `negative_prompt` | No | Negative prompt. |
| `audio` | No | Explicitly set `false` to disable audio. |

### `seedance`

| Key | Required | Description |
| --- | --- | --- |
| `prompt` | Yes | Video prompt. Include target language for dialogue or visible text. |
| `first_frame_url` / `last_frame_url` | No | First/last-frame references. |
| `ref_image_urls` | No | Array of reference image URLs. |
| `ref_audio_urls` | No | Array of reference audio URLs. |
| `aspect_ratio` | No | Defaults to `16:9`. |
| `duration_seconds` | No | Defaults to 5. |
| `audio` | No | Explicitly set `false` to disable audio. |
| `watermark` | No | Explicitly set `true` to add a watermark. |

### `minimax`

| Key | Required | Description |
| --- | --- | --- |
| `prompt` | No | Music description. |
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
