---
name: aixcut-mcp-logout
description: "Sign out of Aixcut MCP, revoke its OAuth grant, and clear the local credential. Do not use for the Studio website. Chinese triggers: 退出登录、注销、切换账号、清除授权."
---

# Sign Out of Aixcut MCP

## Conversation guidance

Explain that signing out changes authorization and what the user will need to do before the next Aixcut operation. Report completion only after the logout action confirms it.

1. If the session is authorized and `aixcut_logout` is available, call it once with `{}` to revoke the server-side grant. A successful result includes `local_cleanup_required: true`.
2. Clear the local authorization through Kimi's plugin connection controls when local cleanup is required, regardless of whether `aixcut_logout` succeeds, is unavailable, or reports that the server session is already unauthorized. Never print or inspect credential files.
3. Report the two outcomes separately:
   - both succeed: Aixcut MCP is fully signed out;
   - server already unauthorized and local cleanup succeeds: Aixcut MCP is signed out;
   - only one succeeds: say which side remains and do not claim complete logout.

## Constraints

- Do not remove the MCP server configuration. Logout must preserve the `aixcut` server registration.
- If the Tool is unavailable or would open a new authorization page, skip it and perform only the local logout step.
- Do not call `aixcut_logout` more than once or automatically sign in again.
- Do not sign out of the Studio web session unless the user explicitly asks for that separate action.
- Never output, read, or copy OAuth access tokens, refresh tokens, or credential contents.
