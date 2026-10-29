---
name: aixcut-login
description: "Check the current Aixcut MCP OAuth login state without opening a web page. Use only when the user explicitly asks to sign in, restore authorization, or check login status. Do not use for opening a Project or signing out. Chinese triggers include 登录、恢复授权、检查登录状态."
---

# Check Aixcut MCP Login

## Conversation guidance

Report the server-validated authorization state and the next step in the user's setup. Keep MCP availability, Plugin installation, and Project readiness distinct. If authorization is missing or the grant is inactive, let Kimi clear the stale authorization and complete OAuth; explain what the user will see.

Call `aixcut_login` once with `{}`. Success requires the envelope `status` to be `ok` and the business result `result.status` to be `authenticated`.

## Result handling

- **Already authorized:** the Tool has validated the grant with Aixcut and returns `result.status="authenticated"`.
- **Grant inactive or revoked:** the Tool returns `MCP_AUTH_GRANT_INACTIVE`. Clear the stale authorization through Kimi's plugin controls, reauthorize once, and do not retry the rejected business call with the old token.
- **Authorization missing or expired:** Kimi opens the Aixcut OAuth page and resumes this call after completion. Do not operate the authorization page or call the Tool again.
- **Authorization denied, cancelled, failed, or timed out:** stop and report that login did not complete.

## Constraints

- This Skill does not handle page-opening requests. Use `aixcut-projects` for opening a page.
- Do not add `project_id` or any business argument to `aixcut_login`.
- For other Tools, Kimi resumes the original call when authorization is required; do not call `aixcut_login` first.
