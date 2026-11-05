---
name: aixcut-host
description: "Kimi host adapter for Aixcut OAuth, built-in browser handoff, local media, workflow storage, and export delivery. Load before the first Aixcut MCP call."
---

# Aixcut Kimi Host

This Skill owns the boundary between Kimi and the Aixcut MCP server. Load it before the first Aixcut call in a conversation.

## Connection and authorization

- `kimi.plugin.json` declares the single remote MCP server named `aixcut`. Kimi owns OAuth, credential storage, refresh, and revocation.
- Never request, print, store, or pass an access token. Do not ask for a second endpoint or connect through another MCP client.
- Connection readiness requires the `aixcut` MCP server to expose its tools. Kimi owns OAuth, but it does not resume a turn that is already waiting: when authorization is required, tell the user to finish it in the browser and then send one more message, and continue the interrupted request on that message.
- If OAuth completed but tools are still absent, ask the user to start a new Kimi conversation or reload the plugin. Do not substitute a subprocess, another agent, or a plain Project URL.
- For `MCP_AUTH_GRANT_INACTIVE`, use Kimi's plugin connection controls to clear the stale authorization and authorize once. Never repeat the business call with the inactive grant.
- For logout, call `aixcut_logout` once when available, then use Kimi's plugin controls to remove the local authorization if the host reports that local cleanup is required. Preserve the plugin and MCP declaration.

## Built-in browser handoff

- `aixcut_open` returns a complete, single-use `result.browser_handoff.url`. Open that exact URL in Kimi's built-in browser using the host's browser-opening capability.
- If no browser-opening capability is available, show the user the non-secret action to open the Aixcut page in Kimi's built-in browser. Never shell out to the system browser and never launch a separate browser automation client.
- Preserve the full handoff URL while opening it. Do not print, quote, persist, or reuse the URL because it contains a one-time session token. Display only `result.editor_url` when a clean Project link is useful.
- A handoff request being accepted proves only that the host received it. Wait for the returned interval, then call `aixcut_frontend` with `page_status` before any frame capture, page export, or user-assisted upload.
- Continue a page-dependent action only when `presence_connections >= 1` and the target Project appears in `pages`. A different online Project is not sufficient.

## Local media and files

- Use the local media bridge only for paths the user explicitly named or reconfirmed in the current task. Never infer paths from a previous task, bridge state, or files merely still present on disk.
- The bridge helper runs only when `NODE_OPTIONS` contains the host-provided preload/import configuration. It preserves that configuration in its detached child and never falls back to an unprotected filesystem read. If the host configuration is absent, access is denied, or its file proxy is unavailable, use `aixcut_frontend(action="prompt_add_material")` and let the user select the files in the Project page.
- Each helper invocation's file list is the complete authorization scope. It may reuse a bridge only when the current host check succeeds for every explicitly supplied file, the origin and expiry are valid, and the old file set exactly matches. A changed file set or `--no-reuse` stops the old bridge before opening only this invocation's files; never carry or infer historical files.
- When the user's import calls have all settled, run the helper with `--stop` to revoke its URLs. Do not stop the bridge while an import is still running.

- When the user explicitly supplies a local file path and Kimi can execute the packaged Node helper, run:

```bash
node "${KIMI_SKILL_DIR}/../../scripts/local-media-bridge.mjs" <absolute-paths> --allowed-origin "<MCP server site origin>"
```

- Use only the URLs printed by that helper. If the helper is unavailable or the bridge cannot be reached from the bound Project page, open the Project material prompt and let the user choose the file there. Never scan the user's filesystem or invent a URL.
- A hosted MCP server cannot read a path on the user's computer. Project documents must be selected through the Project Documents panel, then confirmed by reading the document list.
- Captured frames are temporary until the packaged download helper writes them to a user-approved directory.

## Workflow storage

- When the Core helper creates a Checkpoint, pass `host: "kimi"` and use a writable directory owned by the current Kimi conversation. Only `persisted: true` confirms cross-turn storage.
- If no such directory is available, report the workflow as non-durable. Do not invent a local path or claim a Checkpoint was saved.

## Export delivery

- Aixcut export runs in the bound Project page and hands the finished file to the browser download flow. MCP does not return a server download URL.
- Report the export filename, format, dimensions, byte size, and host download state. Present a local file only when Kimi provides a verified path.
