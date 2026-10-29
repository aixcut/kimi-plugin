---
name: aixcut-basics
description: "Shared Aixcut MCP rules for context, read-before-write, stable refs, idempotency, async jobs, envelopes, and host boundaries. Load as fallback when no specialist Skill applies; do not use instead of a specialist workflow. Chinese triggers: 项目、时间轴、字幕、配音、生成、导出、报错."
---

# Aixcut MCP Basics

Load with the relevant specialist Skill. Follow [language](references/language.md), [conversation guidance](references/conversation-guidance.md), and [ownership](references/model.md).

Kimi owns plugin installation and updates through its plugin center. Do not run package-manager or marketplace commands from this Skill. After the user updates the plugin, start a new conversation before relying on newly loaded Skills or MCP tools.

The release package supplies shared Core policy at [orchestration](../../references/core/orchestration.md) and [workflow boundaries](../../references/core/workflow-boundaries.md). Use these for phase budgets, Checkpoint recovery, state ownership and host fallbacks; live schemas and current user authorization remain authoritative.

Inspect `active_project_id`. If empty, ask for a Project name or `project_id`; never choose the first listed Project.

Read before writes; use returned refs. Reuse read evidence while Project, timeline, and revision are unchanged. Reread after writes, warnings, conflicts, or external changes; refresh before position-dependent commands.

Keep independent read calls parallel. Structural writes on the same timeline stay serial. Group the same action on the same track into one call using `items[]` or `targets`. Only the live Tool Schema decides what may be combined. Read affected views after each atomic batch.

Reuse `idempotency_key` only for identical, explicitly permitted retries. For `status_unknown`, confirm the receipt before taking any dependent write. For `async`, follow `job_id` and `next_action` until terminal. Business fields are in `result`; `noop` is final, `applied_with_warning` requires reporting warnings.

Kimi handles OAuth; do not call `aixcut_login` first. Never use curl, direct database writes, invented server paths or results, bypass permissions, or expose tokens. Verify responses before reporting success.

## Intent and recovery contract

For every request use the short state machine `intent → inspect → plan → execute → verify → deliver`. Mechanical edits remain narrow: do not add voice, music, B-roll, Motion Graphics, or export unless explicitly requested. An assembly request may expand scope only after its `EditPlan` names the requested stages.

When a mutation returns `status_unknown`, preserve its original `idempotency_key`/`mutation_id` and query `aixcut_read(view="mutation_receipt")` with that identity. Treat `pending`, `unknown`, and `not_found` as unresolved until the receipt says `applied`, `duplicate`, `noop`, or `rejected`; never create a new key merely because a response was lost. Save a `Checkpoint` containing Project, timeline, revision, mutation identity and next action before leaving a recoverable stage.

Use the packaged Core executable `node ${KIMI_SKILL_DIR}/../../scripts/workflow-host.mjs`. Validate the EditPlan before structural writes, attach `plan_context` to each planned mutation, and follow [executable workflow](references/workflow-host.md). After each atomic batch, create and save a Checkpoint with `save --directory <host-owned-workflow-directory>` and `{checkpoint}` on stdin; only `persisted: true` confirms cross-turn storage. On resume, inspect the current Project/timeline/revision first, then pass `{plan_id,current:{project_id,timeline_id,revision}}` to `resume --directory <same-directory>`. Follow `next_step`; never replay `completed_steps`. Without an available host-owned directory, the helper returns `persisted: false` and the workflow is not durable across sessions.

Use the default repair budget: at most one schema correction, at most two revision-conflict read/replan cycles, and at most two provider attempts for one generation target. Save a Checkpoint when the budget is exhausted and deliver the recoverable state.
