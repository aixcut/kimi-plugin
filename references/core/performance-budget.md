# 调用和评测预算

评测记录模型调用、MCP 服务受理、Provider 等待、页面操作和用户等待的独立耗时，不能把 Provider 变快全部归因于插件。失败任务已经消耗的 credits 和等待必须计入。

相同 `scope/params/revision` 且没有恢复价值的读取算重复读取；写后 read-back、receipt 确认和必要 Job poll 是必要调用。相同写入的第二次调用必须带原 idempotency/operation identity 和恢复原因，否则计为重复写入并阻断门禁。unknown 永远先读原 receipt，不换 key 重放。

开发期每个 case 至少三次用于发现问题；小于五次的 P95 仅描述，标记 `stable=false`。发布候选建议每个宿主累积至少 30 个有效 run，覆盖短剪、口播、配音、复杂多镜头和完整成片及故障注入。质量门禁优先于调用降幅：不能因为少一次读取而删除结构 read-back、真实合成帧或试听。
