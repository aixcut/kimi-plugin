# 公共成片质量门禁

`ReviewEvidence` 对目标 Project、Timeline 和整数 revision 绑定证据。四层分别使用 `pass / fail / unjudgeable`；`unjudgeable` 必须写明能力或证据缺口。不得把工具成功、结构 review 或模型自评当作最终声画通过。

| 层 | 证据与检查 |
| --- | --- |
| structure | 当前 snapshot、refs、duration、范围、轨道、placement 和 renderability；必要写后 read-back |
| semantic | source lines 与 preserve list，关键观点、否定、条件、数值、人名、操作步骤和 B-roll 对应意图 |
| visual | 目标 Timeline/revision 的真实 composed frame，记录 artifact ref、timestamp；素材缩略图不能替代合成帧 |
| audio | 实际试听，记录 `listened=true` 和检查片段；没有试听不能标记 pass，没有测量不能编造 LUFS |

硬失败包括缺素材、错误片段、语义反转、黑帧/遮挡、对白不可懂、字幕失配和错误目标版本。`hard_failures` 不为空时禁止 deliver，无论其他层评分多高。

## 按任务检查

- 机械剪辑：保留范围、主体裁切、duration、原声完整性。默认不加配音、音乐、B-roll、MG。
- 口播：先以语义单元挑正确 take，再检查气口、接缝和字幕同步；不改写用户未要求改写的观点。
- 生成：brief 忠实度、角色/商品一致性、reference/anchor、动作和声画匹配。两次失败后检查原因，转 reference/edit 或报告能力边界，不无限改 prompt 重试。
- 字幕：正式 transcript、真实时序、断句、读速、遮挡和画幅安全区。
- MG：真实可编辑资产、表达收益、遮挡；至少两个不同时刻采样才能证明动画变化，单帧只能证明存在。
- 导出：用户确实请求、目标版本/格式/分辨率、最终导出状态以及可用交付结果；排队不等于已下载。

## 采样范围与结论

覆盖开场、被改镜头内部、关键转场、字幕/叠加层变化、画幅变化、可疑黑帧附近和结尾；采样随变化规模增加并受预算约束。音频试听覆盖开头、修改接缝、对白音乐重叠和结尾。

抽样通过只支持已采样区间结论，不证明全片无问题；未连续播放或完整听检时交付明确局部覆盖范围。`pass` 表示所列 checks 在记录范围内通过，不隐含全片认证。

验收 A/B 不向评分者暴露新旧方案标签，随机成对顺序，保留结构化评分理由，并用人工抽样校准模型评分。新增复合操作前先在至少三个真实黄金任务中确认重复调用瓶颈与 owner/revision/原子边界，不能为了少调用删除 read-back 或声画验收。
