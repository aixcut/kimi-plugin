---
name: aixcut-projects
description: "List, create, open, switch, or exit an Aixcut Project. Do not use for timeline edits. Chinese triggers: 打开项目、新建项目、切换项目、退出项目."
---

# Aixcut Projects

## Conversation guidance

State whether the user is selecting, opening, creating, or leaving a Project and what happens next. After an open or create request, verify the page and active Project state before saying the user is ready to edit. If a required choice is missing, ask one concise question and recommend an option.

## Session availability

If the current session has no Aixcut tools because OAuth completed after its tool catalog was created, let Kimi finish authorization and start a new conversation before calling `aixcut_open`. Never use a subprocess, subagent, another MCP client, or a plain Project URL as a substitute; `browser_handoff` is bound to the Kimi session that opens it. If the tools remain unavailable, stop before creating a Project.

## Open a page

Call the one open operation that matches the request:

| Intent | Arguments |
| --- | --- |
| Open Studio | `aixcut_open(target="studio")` |
| Open the Project list | `aixcut_open(target="project_list")` |
| Create and enter a Project | `aixcut_open(target="new_project", title="...", description="optional")` |
| Open a specific Project | `aixcut_open(target="project", project_id="...")` |

When later work needs the editor page (frame capture, page-based export, or asking the user to upload media), use `aixcut_open(target="project")`. Opening Studio or the Project list does not bind editor actions to a Project.

After a successful call, immediately open the complete `result.browser_handoff.url` in Kimi's built-in browser using the host's browser-opening capability. If that capability is unavailable, ask the user to open the returned page in Kimi's built-in browser through the host's normal link flow.

Preserve the URL and its one-time `session_token` exactly. Do not compose a plain Project URL or use `editor_url` for MCP session binding. Do not print or persist the handoff URL.

## After creating a Project

`new_project` creates the Project skeleton synchronously, including the default sequence, video/text/audio tracks, and an empty voice document. It can be read or edited immediately; the page itself may still be opening.

- `result.data.project_id`, `result.data.sequence_id`, and `result.data.project` identify the created Project and sequence.
- `result.page_open_requested: true` means the server requested that the page open; it does not prove the page is connected. A host opening result of `queued` also does not mean it is connected.
- Top-level `next_action` is usually `wait_then_read`. Wait about 5 seconds, then call `aixcut_frontend(action="page_status")` if the next operation needs the page.

Only confirm page presence when the next action needs it. Timeline reads/writes and voice script/settings writes do not require the editor page; voice rendering, frame capture, page export, and user-assisted upload do. Require `presence_connections >= 1` and confirm that the target Project appears in `pages`; a different online Project is not sufficient. If the target is absent, stop and ask the user to open or switch to that Project in this MCP session. Do not call an open operation again or treat `queued` as connected. Once the target is online, retry the original page action at most once.

## Returned data

- `studio` and `project_list`: `result.data.projects` and `result.data.total` describe the current Workspace directory and can answer a listing request directly.
- `project`: `result.data.project` is the same Project summary returned by `aixcut_read(view="project")`; do not read the same summary again.
- `new_project`: creates and initializes the Project synchronously; the returned `project_id`, `sequence_id`, and `project` are the creation result.
- `result.active_project_id` is the current MCP Project. `project` and `new_project` target that Project; `studio` and `project_list` only navigate and do not change it.
- If `active_project_id` is empty, never select the first Project by default. Ask for a Project name or `project_id`, then open that target.
- The page loads business data itself. Treat returned data as facts for this call, not as a replacement for later reads.

## Switch or exit

- When the user explicitly asks to leave the current Project, call `aixcut_exit_project` with no arguments. Do not substitute Studio or the Project list.
- Only an explicit exit clears the current Project. Project tools that omit `project_id` continue using the current value.

## Authentication and constraints

- If authorization is missing, Kimi completes OAuth and resumes the original call. Do not call `aixcut_login` first, repeat `aixcut_open`, or operate the authorization page.
- If authorization is denied, cancelled, fails, or times out, stop and report that the page was not opened.
- Use only the fields declared by the selected open operation. Do not pass arbitrary URLs, `return_to`, undeclared fields, or guessed IDs.
- `title` is required for a new Project. Do not pass `idempotency_key` when creating one; each call creates a new Project.
- Never output, record, or copy a complete returned URL containing `session_token`.
