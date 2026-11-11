# Visual Effects Actions

All mutation rows use `action` as the discriminator and require a UUID `idempotency_key`. The action tables below are the complete ownership map for this Skill.

| Tool | action | Input and effect |
|---|---|---|
| aixcut_effect | add | Add one effect or an `items` batch to a resolved clip owner. |
| aixcut_effect | update | Patch one effect by stable `target`; omitted fields stay unchanged. |
| aixcut_effect | set | Replace the complete effect list for `owner`; empty items clears it. |
| aixcut_effect | delete | Delete one explicitly selected effect. |
| aixcut_effect | reorder | Set the complete effect order for one owner with `ids`. |
| aixcut_transition | add | Add one transition across an adjacent, contiguous cut. |
| aixcut_transition | update | Patch one transition's preset, duration, alignment, easing or parameters. |
| aixcut_transition | set | Define or clear the transition for one clip pair. |
| aixcut_transition | delete | Delete one explicitly selected transition. |
| aixcut_mask | add | Add a shape, path or clip-matte mask to a clip. |
| aixcut_mask | update | Patch one mask while preserving its explicit source. |
| aixcut_mask | set | Replace the complete mask list for one clip. |
| aixcut_mask | delete | Delete one explicitly selected mask. |
| aixcut_mask | reorder | Set the complete mask order for one clip. |
| aixcut_group | add | Create a clip group and its members atomically. |
| aixcut_group | update | Patch one group's metadata, anchor or payload. |
| aixcut_group | set | Replace the complete set of clip groups. |
| aixcut_group | delete | Delete one group while retaining its clips. |
| aixcut_node | add | Add an authored node under a composition group. |
| aixcut_node | update | Patch one existing authored node. |
| aixcut_node | set | Replace one authored node definition. |
| aixcut_node | delete | Delete one authored node and its descendants. |
| aixcut_node | move | Reparent or reorder a node without changing its definition. |
| aixcut_component | add | Add one complete clip or track component. |
| aixcut_component | update | Patch one component payload or schema metadata. |
| aixcut_component | set | Replace the complete component list for one owner. |
| aixcut_component | delete | Delete one explicitly selected component. |
| aixcut_generator | add | Add a source-free generated clip and its binding component. |
| aixcut_generator | update | Patch a generator binding, parameters or clip timing. |
| aixcut_generator | set | Replace all generators on one video track. |
| aixcut_generator | delete | Delete one generated clip. |
| aixcut_motion | set | Set one authored motion phase from a complete definition. |
| aixcut_motion | update | Patch an existing motion phase. |
| aixcut_motion | delete | Delete one motion phase. |
| aixcut_motion | reset | Remove phase overrides from one motion phase. |
| aixcut_motion | clear | Clear all authored object motion on one clip. |
| aixcut_keyframe | add | Add one keyframe and create its track when needed. |
| aixcut_keyframe | update | Patch one keyframe. |
| aixcut_keyframe | set | Replace all keyframes for one owner property. |
| aixcut_keyframe | delete | Delete one explicitly selected keyframe. |

| Tool | action | Input and effect |
|---|---|---|
| aixcut_frontend | capture_timeline_frames | Capture representative frames from the edited timeline. |
| aixcut_frontend | playback_check | Check the edited timeline plays through the requested range. |

## Read Views

Read `effect`, `transition`, `mask`, `group`, `node`, `component`, `generator`, `motion` and `keyframe` after writes. Read `effect_catalog`, `transition_catalog`, `mask_catalog`, `generator_catalog`, `motion_catalog` and `keyframe_catalog` before choosing capabilities.
