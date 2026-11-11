---
name: aixcut-visual-effects
description: "Edit Aixcut effects, transitions, masks, groups, composition nodes, components, generators, object motion and keyframes. Use for visual finishing and structural clip relationships. Do not use for basic clip trimming, captions or export. Chinese triggers: 特效、转场、蒙版、分组、关键帧、动画、生成器、组件节点."
---

# AIXcut Visual Effects

Read before writing. Use `aixcut_read` views `effect`, `transition`, `mask`, `group`, `node`, `component`, `generator`, `motion` or `keyframe` to obtain stable refs. Query `*_catalog` before choosing a package, preset or parameter. Never guess a preset id or parameter name.

Every mutation call is one atomic Zero batch. Use a new `idempotency_key` for each new change. If a result is `status_unknown`, read `mutation_receipt` with the original key before any retry.

Use `aixcut_effect` on one clip. Reorder only with the complete effect list for that owner. Prefer `add`, `update`, and `delete` when identity matters; use `set` only when replacing the owner's complete list.

Use `aixcut_transition` only between contiguous clips on the same track. Transition duration must fit both the clips and available source handles. Read back and use returned `adjustments`; do not silently present a shortened transition as the requested duration.

Use `aixcut_mask` with exactly one source: built-in `preset`, `source_clip`, or `path`. Coordinate spaces are semantic (`clip`, `source`, `composition`) and must not be replaced by guessed storage keys.

Use `aixcut_group` when clips must follow an anchor. The anchor must be a member. Deleting a group does not delete its clips.

Use `aixcut_node`, `aixcut_component` and `aixcut_motion` for authored composition structure. Definitions are property data, not executable code. Composition writes must preserve the existing component type and schema version unless the complete Contract upgrade is explicit.

Use `aixcut_generator` for source-free generated clips. Catalog availability is real capability information: an empty catalog means the capability is unavailable in this Project, not an invitation to invent a preset.

Use `aixcut_keyframe` for relational animation tracks. The owner, property type, base value and keyframe value must agree. Use `aixcut_motion` for authored phase programs.

After a structural write, read the affected domain again and verify the returned refs and relationships. Structural review cannot prove visual quality: use timeline frames and continuous playback for final visual acceptance.
