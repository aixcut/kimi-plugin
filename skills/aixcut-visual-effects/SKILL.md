---
name: aixcut-visual-effects
description: "Edit Aixcut effects, transitions, masks, groups, composition nodes, components, generators, object motion and keyframes. Use for visual finishing and structural clip relationships. Do not use for basic clip trimming, captions or export. Chinese triggers: 特效、转场、蒙版、分组、关键帧、动画、生成器、组件节点."
---

# AIXcut Visual Effects

Read before writing. Use `aixcut_read` views `effect`, `transition`, `mask`, `group`, `node`, `component`, `generator`, `motion` or `keyframe` to obtain stable refs. Query `*_catalog` before choosing a package, preset or parameter. Never guess a preset id or parameter name.

Catalog reads are summary pages by default: use `offset` and `limit`, follow `has_more`/`next_offset`, and request at most 200 ids in one `ids` lookup only when the full definitions are needed. Never ask for a full unbounded catalog.

Every mutation call is one atomic Zero batch. Use a new `idempotency_key` for each new change. If a result is `status_unknown`, read `mutation_receipt` with the original key before any retry.

## Tool selection

| Intent | Tool |
| --- | --- |
| Read the current effects, transitions, masks, groups, nodes, components, generators, motion or keyframes | `aixcut_read(view="effect")` and the matching domain view |
| Look up available presets and parameters | `aixcut_read(view="effect_catalog")` and the matching `*_catalog` view |
| Add, patch, delete or reorder effects on one clip | `aixcut_effect` |
| Add, patch, delete or set a transition across a cut | `aixcut_transition` |
| Add, patch, delete or reorder masks on one clip | `aixcut_mask` |
| Group clips that must follow an anchor | `aixcut_group` |
| Author composition nodes | `aixcut_node` |
| Attach or patch clip and track components | `aixcut_component` |
| Create a source-free generated clip | `aixcut_generator` |
| Author or clear object motion phases | `aixcut_motion` |
| Add, patch, replace or delete keyframes | `aixcut_keyframe` |
| Capture frames or check playback after a structural write | `aixcut_frontend` |

Use `aixcut_effect` on one clip. Reorder only with the complete effect list for that owner. Prefer `add`, `update`, and `delete` when identity matters; use `set` only when replacing the owner's complete list.

Use `aixcut_transition` only between contiguous clips on the same track. Transition duration must fit both the clips and available source handles. Read back and use returned `adjustments`; do not silently present a shortened transition as the requested duration.

Use `aixcut_mask` with exactly one source: built-in `preset`, `source_clip`, or `path`. Coordinate spaces are semantic (`clip`, `source`, `composition`) and must not be replaced by guessed storage keys.

Use `aixcut_group` when clips must follow an anchor. The anchor must be a member. Deleting a group does not delete its clips.

Use `aixcut_node`, `aixcut_component` and `aixcut_motion` for authored composition structure. Definitions are property data, not executable code. Composition writes must preserve the existing component type and schema version unless the complete Contract upgrade is explicit.

`aixcut_motion` applies only to a real video clip without composition content. A text clip, image composition, or any clip carrying `composition`/`text-content` is rejected with `MCP_MOTION_CLIP_UNSUPPORTED` before a JSONB write is attempted. Use the text clip's own composition animation model for those clips.

Use `aixcut_generator` for source-free generated clips. Catalog availability is real capability information: an empty catalog means the capability is unavailable in this Project, not an invitation to invent a preset.

Use `aixcut_keyframe` for relational animation tracks. The owner may be a clip or an `fx:`, `mask:` or `trn:` ref from read; the owner, property type, base value and keyframe value must agree, and the written `owner_kind` follows the ref you pass. Use `aixcut_motion` for authored phase programs.

## Ref prefixes

Read views and create results return the canonical prefix; write calls also accept the historical aliases in the third column.

| Object | Canonical ref | Also accepted |
| --- | --- | --- |
| Clip | `clip:<uuid>` | `tl:` |
| Track | `track:<uuid>` | `track-component:` for track components |
| Timeline | `timeline:<uuid>` | `sequence:` |
| Effect | `fx:<uuid>` | `effect:`, `nle_effect_instances:` |
| Transition | `trn:<uuid>` | `transition:`, `nle_transitions:` |
| Mask | `mask:<uuid>` | — |
| Keyframe | `kf:<uuid>` | `keyframe:`, `nle_keyframes:` |
| Animation track | `anim:<uuid>` | `animation-track:`, `nle_animation_tracks:` |
| Group | `group:<uuid>` | — |
| Component | `component:<uuid>` | — |

A ref that a create result returned is always usable on the matching update or delete; never rewrite it into another prefix by hand.

After a structural write, read the affected domain again and verify the returned refs and relationships. Structural review cannot prove visual quality: use timeline frames and continuous playback for final visual acceptance.

Animated effects, transitions, motion, and keyframes need evidence from at least two moments across the animated range: a single frame cannot show whether motion, easing, direction, or timing is correct. Capture two or more sampled moments, report the timestamps you used, and mark motion quality `unjudgeable` when only one still frame was checked.
