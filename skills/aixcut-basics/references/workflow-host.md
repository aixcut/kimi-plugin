# 可执行计划与恢复

宿主通过 `${KIMI_SKILL_DIR}` 解析插件内的 Core 路径，并提供可写 `<workflow-directory>`。Core 不选择项目、不保存授权；没有宿主存储时交付恢复摘要，明确不能保证跨会话恢复。

1. 按包内 `${KIMI_SKILL_DIR}/../../contracts/core/edit-plan.schema.json` 建立完整 EditPlan；`node ${KIMI_SKILL_DIR}/../../scripts/workflow-host.mjs validate-plan` 从 stdin 接收 `{plan}`，只有 `ok:true` 才执行。
2. 每次计划内时间轴写入携带最小 `plan_context`：

```text
{"plan_id":"plan_1","project_id":"实际项目","timeline_id":"实际时间轴","base_revision":7,"mode":"mechanical","preserve":["clip:keep"],"delete_refs":[],"authorized_actions":["本次计划授权的编辑动作"]}
```

`base_revision` 来自最近 read。不要自增；每批写后读回，用实际 revision 更新下一批。preserve 表示不可修改的对象。generic update 不能绕过 source/kind/track 保护；计划中的动作列表不是用户授权。

3. 调用 `create`，stdin 为 `{plan,host:"kimi",phase:"execute",lastConfirmedRevision,completedSteps,pendingMutations,jobIds,nextStep}`；返回 `{checkpoint}`。随后 `save --directory <workflow-directory>` 接收 `{checkpoint}`。pendingMutations 只保存公开身份、状态和 next_action，不含原始音频、URL 或凭据。
4. 生成与原 receipt 查询可携带 `workflow_binding:{plan_id,timeline_id,base_revision}`。这是 `origin:caller` 的关联标记，不能证明服务端持久保存或用户授权。保存原 mutation_id、operation_id、job_id；语音恢复保留原 frozen recovery 和接受的报价，只能沿原身份恢复。完整冻结恢复数据属于宿主受控会话产物，不能塞入 Checkpoint。
5. `resume --directory <workflow-directory>` 接收 `{plan_id,current:{project_id,timeline_id,revision,source_versions?}}`。未知、pending 和 not_found 回执阻断依赖写入；先查原 mutation receipt 或原 Job，再更新 Checkpoint。revision/source 漂移先重读和重算。恢复查询不因旧 timeline revision 被禁止；新落轨仍需重新计划。
6. `gate` 接收 `{evidence,current:{project_id,timeline_id,revision},deliverable:"report"|"export"|"quality"}`。report 可以诚实说明缺口；export 需要当前结构证据；quality 需要四层通过。任何 fail 或 hard_failure 都阻断交付。门禁只校验输入与绑定，不代替真实看图、播放或试听。
