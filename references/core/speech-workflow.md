# 公共配音流程

`aixcut-voice` 是用户触发 Skill 名称，保留。旧 `aixcut_voice` Tool 已退役；`aixcut_speech` 仍是现有口播时间线编辑工具，与配音生成不同。

## 最短路径

1. 使用 `aixcut_generate(action="speech_read")` 查看编号段落和有效设置；选择声线时用 `catalog(kind="speech")` 返回的稳定 voice ref，不猜内部 ID。
2. 使用 `speech_edit(operation="add|update|delete|move")` 批量修改明确段落。文本编辑无需先生成音频；段落顺序冲突先重读重新定位，不盲用旧编号。
3. 选定 `segments` 或 `all=true` 调用 `speech_quote`，保留完整 frozen `recovery`、每段原 operation identity 与总价。先核实当前授权和费用范围；已授权范围内继续，新增费用超出范围才请用户决定。
4. 使用 `speech_submit(recovery=原报价返回对象)`，不重建 operation ID、input 或 accepted price。受理只表示提交，不表示音频完成或已经放在时间线。
5. 从返回的 Job ID 使用 `get` 查询，缺失 Job ID 先 `list` 按原 operation identity 恢复。按 owner 的 `terminal/retry_after_seconds/next_action` 有界轮询，终态停止。
6. 成功且正式素材可读后，再用当前 placement Tool 按稳定 ref 放入目标 Timeline。写后 read-back，并检查音频、段落顺序和字幕时间。生成资产与实际 placement 分开汇报。

## 不确定提交和部分成功

- `submission_unknown` 保留原 frozen recovery。先查询已存在 Job；需要恢复提交时，只能重用原 recovery。不得重新 quote 生成新 operation identity 后冒充恢复。
- frozen recovery 是执行恢复材料，只有契约允许且宿主任务产物具备适当保护时保存；否则留在当前会话，丢失时明确缺少材料，不能假装跨会话恢复成功。
- 部分成功分别记录每段 Job、素材、placement、receipt 和错误；已完成段落不重做。跨段任务不宣称原子事务。
- `rejected`、报价变更、权限缺失等按照稳定错误修正或交由用户决定；不能把 Provider 超时当作新收费提交许可。
- Job 取消后不自动再提交；超过等待预算不自动取消。

## 字幕与原声

字幕以正式 transcript 或已生成音频的真实时间信息派生，不能用配音脚本编造实测词时间。`import_status=ready` 不表示 ASR 可用。口播精剪保留语义单元、否定、条件、数字、人名、retake 正确版本和自然气口；仅以静音长度删除会破坏表达。

没有试听能力时音频验收标记 `unjudgeable`，没有 source lines 时语义完整性同样标记未能判定；不能以 Tool 成功替代音频质量结论。
