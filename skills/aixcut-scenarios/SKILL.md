---
name: aixcut-scenarios
description: "Scenario playbooks for Aixcut video production: talking-head, livestream clips, e-commerce feed ads, TVC commercials, and matrix batch variants. Use to route scenario-specific structure, pacing, compliance checks, and offline planning. Chinese triggers: 直播切片、电商信息流、带货短视频、TVC、品牌广告、矩阵批量、多版本分发."
---

# Aixcut 五大剪辑场景工作流

本 Skill 负责把业务场景映射到可执行的剪辑结构、视觉/声画规范、合规底线和 Aixcut 工具链。先识别场景，再只读取对应的一份工作流参考文档，不把所有场景混在一起执行。

## 场景路由

| 业务场景 | 优先读取 | 协同专业 Skill |
| --- | --- | --- |
| 口播精剪（访谈 / 课程 / 播客 / 观点表达） | 直接使用 `aixcut-talking-head` | `aixcut-captions`、`aixcut-timeline-editing`、`aixcut-verification` |
| 直播切片（长直播高光拆条 / 卖点切条） | [直播切片工作流](references/livestream-clips.md) | `aixcut-talking-head`、`aixcut-timeline-editing`、`aixcut-captions`、`aixcut-verification` |
| 电商信息流（竖屏带货 / 投放转化短片） | [电商信息流工作流](references/ecommerce-feed.md) | `aixcut-video-assembly`、`aixcut-timeline-editing`、`aixcut-visual-effects`、`aixcut-captions`、`aixcut-voice` |
| TVC 品牌广告（品牌片 / 产品概念片） | [TVC 品牌广告工作流](references/tvc-commercial.md) | `aixcut-video-assembly`、`aixcut-generation`、`aixcut-voice`、`aixcut-visual-effects`、`aixcut-verification` |
| 矩阵批量生产（多账号 / 多卖点 / 多画幅版本） | [矩阵批量工作流](references/matrix-batch.md) | `aixcut-video-assembly`、`aixcut-timeline-editing`、`aixcut-verification`、`aixcut-export` |

## 通用剪辑底线（适用于全部场景）

1. **视觉与表达优先级**：`可读 > 信息 > 情绪 > 装饰`。用户明确指定慢节奏、安静、极简或原样保留时，用户风格优先于默认节奏。
2. **字幕与安全区**：字幕必须在目标设备上一眼读完，放不下就重分句或分行，不盲目缩字号；主画面主体（人脸、产品、操作区）和文字必须避开抖音、视频号、小红书等平台的上下左右 UI 遮挡区。
3. **克制包装**：一个画面同一时刻最多一处视觉强调；花字只给关键词、价格或核心卖点，不把整句字幕做成花字。
4. **事实与合规底线**：所有商品参数、价格、活动时间、品牌承诺以用户确认资料为准；生成画面和图形可用于概念解释，不得冒充实拍或实测证据；排查广告法极限词（如「全网第一」「绝对」「100% 有效」等）和过期活动信息。
5. **真实工具、素材上传与导出边界**：所有时间线写入必须通过 Aixcut MCP 工具完成并回读核验；本地素材一律通过项目页面选文件上传（`prompt_add_material`）或临时上传链接（`aixcut_upload_link`），绝不启动本地 HTTP 桥接服务。默认交付可编辑时间线；用户要求导出时，走 `aixcut-export` 打开编辑器导出弹窗（可在弹窗内选择导出视频、音频、动态图形、XML、Aixcut 工程或剪映工程），或对云端就绪素材使用无头渲染。

## 未连接或未授权时的降级交付

当 Aixcut MCP 尚未连接或用户尚未完成 OAuth 授权，而用户已经给出了具体的剪辑场景需求时：

1. 不直接停止或让用户空等；先按对应场景参考文档，基于用户给出的素材、卖点或脚本，交付一份**结构化、可直接落地的剪辑方案**（例如候选切片策略、黄金 3 秒钩子与分镜表、节奏与字幕/配乐建议、矩阵差异化表、缺失素材清单）。
2. 同时用一句简洁说明提示用户在 Kimi 插件连接中完成 Aixcut 授权并回复一条消息，随后即可将方案直接建入 Aixcut 可编辑时间线。
