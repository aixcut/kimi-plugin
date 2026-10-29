# 公共编辑编排

## 状态与边界

两个宿主统一采用 `intent → inspect → plan → execute → verify → deliver`。这是 Skill 行为协议，不是常驻调度器；真正的权限、事务、幂等和 revision 约束由原 owner 的服务实现。Core 只分发契约和规则，不持久化 Project、Job、转写或授权。

1. `intent`：判断 `inspect_only / mechanical / local_edit / full_assembly`，只加载一个主 Skill，依赖阶段再加载专业 Skill。用户请求已授权的动作无需重复确认。
2. `inspect`：确认当前 Project、Timeline、可用 capability，读取最小必要 snapshot 和稳定 ref。导入完成与转写完成分别检查；只在转写 `available` 时读取 source lines。
3. `plan`：复杂编辑形成 `EditPlan`，记录保留范围、允许删除范围、ShotPlan、音频角色、字幕、四层验收和调用预算。简单单步操作可使用最小计划。所有计划都绑定 owner 提供的整数 `base_revision`。
4. `execute`：同一 Timeline 的结构性写入串行；同一 frozen snapshot 下同类编辑优先复用既有 batch。独立读取、独立已受理 Job 查询可并行。多服务工作流不宣称是一个事务。
5. `verify`：写后目标 read-back；结构 review、语义核对、合成帧和试听分别记录。旧 revision 的证据失效，只重建受影响部分。
6. `deliver`：说明完成的改动、目标版本、已验证/未能验证层、导出状态以及可恢复任务身份。不要把受理、排队、超时或自评描述为成功成片。

## 计划不变量

- 所有时间使用整数毫秒，范围为半开区间 `[start_ms,end_ms)`；结束必须晚于开始，源范围不得超过 owner 提供的素材时长。
- `base_revision / revision_before / revision_after / last_confirmed_revision` 来自 NLE 的整数 revision，宿主不得自增。`input_version` 是 source owner 提供的 opaque token，不可与 revision 混用。
- `shot_ref` 唯一，依赖必须存在且无环；source ref 必须能在计划 sources 中找到。变速时源时长与输出时长可不同，不能直接强制相等。
- `preserve` 与 `delete_refs` 不相交。`mechanical` 的 `optional_enhancements` 必须为空；不主动增加配音、音乐、B-roll、MG 或导出。
- 删除、覆盖、收费生成、导出及新配音均须位于当前用户授权范围；计划中的 `authorized_actions` 只是范围记录，不是授权凭据，恢复时必须重核。
- 旧 Tool 不接受 client revision 字段时，不把 `base_revision` 塞进旧 schema；沿用 server frozen snapshot，新增参数须先更新权威契约。

## 调用预算与恢复

默认 schema 修正最多 1 次，revision 冲突最多重读重算 2 次，receipt 单轮主动等待预算 60 秒，Job 单轮主动等待预算 60 秒。同一生成目标最多 2 次经预算允许的尝试。服务端 retry-after、用户时限与宿主限制优先。超过预算保存 Checkpoint 并交付可恢复状态，不能据此取消任务或标记失败。

`OperationReceipt` 只记录 owner 能证明的状态：`applied / duplicate / noop / pending / unknown / not_found / rejected / cancelled`。缺失的 identity 和 revision 省略，不随机生成后冒充原任务。`duplicate` 需要请求摘要匹配证据。

遇到 `unknown/not_found`：保留原 mutation ID、idempotency key 和 scope，先查询 `aixcut_read_mutation_receipt`；不存在 receipt 仍不能证明写入失败。按 next_action 等待，预算耗尽仍保留原 identity。禁止换 key 盲重放，禁止未确认前继续依赖写入。此读取入口只在 live catalog 已包含时调用。

Checkpoint 仅保存必要的公开 identity、phase、revision、完成步骤、pending receipt、Job ID 与 source version。宿主支持任务产物文件时可保存；不支持时在当前会话交付结构化恢复摘要，并明确不能保证跨会话恢复。禁止借 MCP 业务文档库存内部 checkpoint，禁止保存 token/cookie、签名 URL、原始素材和内部对象地址。

恢复顺序：重核授权和 scope → 查询原 pending receipt → 读当前 revision → 以原 Job ID/operation identity 查询 → 对比 source version → 重建受影响计划和证据 → 从首个未完成依赖继续。不能恢复时保留事实，不清空 Timeline，不覆盖用户后续修改。

## 转写投影

转写 owner 仍为 Browser/ClipOS Media Transcript 链路，插件不创建 durable transcript 数据库。MCP 只规范 projection 和恢复语义。active 状态按 owner 的 operation/run 查询；`no_audio/empty` 不自动重复转写；等待超时不等于 `stale`；`stale` 仅表示输入/结果版本过期，`interrupted` 需 owner 证据，缺证据使用 `unknown`。
