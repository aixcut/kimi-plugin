# Intent Routing and Execution Boundaries

Use this reference after `aixcut-basics` and before selecting a Tool. Inspect existing Project state first when it can answer the question. Do not turn missing information into a fixed questionnaire.

## Choose one route

| Route | Use when | Main Skill |
| --- | --- | --- |
| `inspect_only` | The user asks what exists, why export is blocked, or wants a read-only review | `aixcut-verification` |
| `mechanical` | The requested operation is exact and reversible without creative judgment | The owning domain Skill |
| `local_edit` | The request changes a local visual, audio, layout, effect, or text decision | `aixcut-timeline-editing` or `aixcut-visual-effects` |
| `talking_head` | Spoken content determines the cut, order, or pacing | `aixcut-talking-head` |
| `full_assembly` | Source media becomes a complete video across several dependent stages | `aixcut-video-assembly` |
| `focused_task` | The user asks only for captions, voice, generation, export, or another single domain | The matching specialist Skill |

Select exactly one main route. A specialist Skill used inside that route is not a second main workflow.

## Route and PlanContext

Route is a Skill concept. `plan_context.mode` is a server contract and accepts only `mechanical`, `local_edit`, or `full_assembly`.

| Route | `plan_context.mode` |
| --- | --- |
| `inspect_only` | No write |
| `mechanical` | `mechanical` |
| `local_edit` / `focused_task` | `mechanical` for exact mechanical actions; `local_edit` when creative judgment is present |
| `talking_head` | `mechanical` for filler/pause cleanup; `local_edit` or `full_assembly` for semantic changes or downstream packaging |
| `full_assembly` | `full_assembly` |

Never pass a route name directly as `plan_context.mode`.

## Dependency order

For spoken video, finalize the A-roll before placing captions, B-roll, Motion Graphics, music, or other duration-dependent layers. Visual and audio packaging follows the final speech timing. If an upstream stage changes, rebuild the affected downstream stages and invalidate evidence tied to the old revision.

For general assembly, the default order is: media ready → visual structure → requested voice → captions from a real transcript → requested music → review → export. Export is never an intermediate checkpoint.

## One writer and subagents

The main editor is the single writer for the Project. Keep structural writes on one timeline serial and batch compatible actions from the same frozen snapshot.

Source analysis, story analysis, visual research, and independent review can run in subagents only when the host enforces their tool surface as read-only. Give them the same Project, timeline, revision, and source versions. Their findings must echo that binding; do not join evidence from different revisions. A reviewer receives the user request and the produced evidence, not the author's EditPlan.

Do not enable subagents for a single reversible edit, and never allow multiple agents to mutate one timeline, generate chargeable assets, or export independently.

## Confirmation budget

Separate three boundaries:

- Authorization: paid generation, deletion, overwrite, export, or adding AI voice.
- Editorial confirmation: the A-roll content, first B-roll direction, first Motion Graphics direction, or a material version-structure choice.
- Evidence: read-back, composed frames, playback, and listening. Evidence is not user approval.

An exact mechanical request already authorizes its named range; do not repeat an equivalent confirmation. For a full assembly, use at most three substantive user stops: necessary intake choices, A-roll/story structure, and the first visual direction or batch-spend approval. Aggregate irreversible operations instead of asking once per stage.

## Stop conditions

Pause when the next step is outside the user's requested scope, would overwrite unnamed work, needs unaccepted credits, depends on a missing material choice, or cannot be verified. Otherwise inspect, execute the safe reversible work, and report the result with the next action.
