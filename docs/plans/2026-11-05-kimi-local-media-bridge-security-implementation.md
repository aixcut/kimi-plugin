# Kimi 本机素材桥安全整改实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 Kimi 插件本机素材桥剥离宿主文件保护及自动续用历史文件的问题，同时保留授权有效时的自动导入能力。

**Architecture:** 后台桥继承宿主注入的访问配置，并且只服务本次用户明确授权的文件；权限失效时立即失败关闭，不使用裸文件系统读取兜底。若真实 Kimi 环境无法证明代理有效，则对该次导入改用 `prompt_add_material`。

**状态：** 代码、自动化回归测试和 Skills 已实现；真实 Kimi Work 的宿主代理生命周期验证仍待用户使用新代码手测。未提交、未推送、未重新申请上架。

**Tech Stack:** Node.js 内置 `node:test`、`node:fs`、`node:child_process`；Kimi Plugin Skills 与 Core 文件清单。

---

## 范围与依据

- 基线：`kimi-plugin` `main` / `origin/main` 提交 `c3610c8`。
- Kimi 官方文档没有公开承诺后台文件代理 API；Kimi 本地宿主中观察到注入 `NODE_OPTIONS`。静态整改要求是保留宿主配置，因此必须在真实 Kimi 环境验证它是否覆盖子进程读盘以及授权失效行为。
- 若代理缺失、断连或无法证明受控读取有效，安全回退是 `prompt_add_material`，不能清理配置后直接读盘。
- 本次只改 Kimi 插件；不改/部署 MCP Server，也不更新 WorkBuddy 包。

## Task 1：先补安全回归测试

**Files:**
- Create: `tests/local-media-bridge.test.mjs`
- Modify: `tests/skill-guidance.test.mjs`
- Reference: `scripts/local-media-bridge.mjs`

**Step 1: 写宿主配置测试**

通过测试预加载标记验证：父进程和桥子进程都保留宿主 `NODE_OPTIONS`。另测受控代理缺失或拒绝读取时 helper 明确失败，不得绕过代理继续读成功。

**Step 2: 写文件清单回归测试**

覆盖：旧 A 授权过期、本次只授权 B；已有状态 A、本次带 `--no-reuse` 和 B；旧桥清单 A+B、本次只授权 B；以及当前显式重新授权 A。前三种必须只开放 B，最后一种必须先通过当前宿主授权检查。

**Step 3: 写生命周期与状态输出测试**

验证文件权限失效后对应 URL 失效；`--status` 不输出历史文件路径或 URL；`--stop` 后 URL 不可再取文件。

**Step 4: 运行专项测试确认失败**

Run: `node --test tests/local-media-bridge.test.mjs tests/skill-guidance.test.mjs`

Expected: 现有 `NODE_OPTIONS` 过滤、历史文件并入、旧清单超集复用等问题会使回归测试失败。

## Task 2：保留宿主控制，失效时失败关闭

**Files:**
- Modify: `scripts/local-media-bridge.mjs`
- Modify: `contracts/core/core-manifest.json`
- Test: `tests/local-media-bridge.test.mjs`

**Step 1: 移除子进程环境清理**

删除 `bridgeChildEnv` 对 `NODE_OPTIONS` 的过滤，不在 `spawn` 中传入净化后的环境，让子进程继承宿主访问配置。同步更新旧注释，不能再把脱离代理描述为恢复功能。

**Step 2: 验证受控代理的存在与行为**

启动前要求 `NODE_OPTIONS` 中存在 `--require`、`--import` 或 `-r` preload/import 配置；缺失时不启动桥并返回可让 Skill 转到页面选择的明确错误。子进程不传入自定义 `env`，以继承完整宿主配置。自动化测试覆盖继承和缺少配置时失败关闭；真实 Kimi 宿主下是否注入并持续授权仍需手测。

**Step 3: 授权失效后停止读盘**

每次 helper 调用都在宿主保护下重新检查本次路径。权限撤销、代理断连或任一文件读取失败时，立即撤销对应 URL 并清理状态；若当前重新检查授权失败，则先停止旧桥，防止旧 URL 继续读取。不得捕获异常后切换到不受宿主控制的直接读取路径。

**Step 4: 同步 helper 文件摘要并运行专项测试**

Run: `node --test tests/local-media-bridge.test.mjs`

Expected: 宿主配置在桥子进程中存在；无代理或权限失效时读取失败且无直接访问兜底。

## Task 3：只服务本次明确授权的文件

**Files:**
- Modify: `scripts/local-media-bridge.mjs`
- Modify: `contracts/core/core-manifest.json`
- Test: `tests/local-media-bridge.test.mjs`

**Step 1: 移除历史文件追加**

删除 `carriedOver` 逻辑。新桥清单只能来自本次经宿主权限检查的显式文件参数；磁盘上仍存在或旧状态仍记录都不算授权。

**Step 2: 收紧桥复用条件**

只有策略版本、Origin、桥有效期和文件路径集合完全匹配，且后台 `/health` 返回的有效文件 ID 与状态文件一致时才能复用。旧策略桥不复用。旧桥包含额外 A 而本次只请求 B 时，安全停止旧桥后按 B 启动。`--no-reuse` 停止旧桥，再从本次文件集合启动，不得合并历史文件。

**Step 3: 逐文件处理续用**

Kimi Skill 只可把当前任务中用户明确给出或重新确认的路径交给 helper，不可从旧状态或历史任务自行恢复。每个显式文件都需通过当前宿主读取检查；权限过期或被撤销时拒绝。只有当前再次明确路径且宿主检查通过，才能按本次授权启动新桥。

**Step 4: 收敛状态与旧链接**

`--status` 只提供存活状态、过期时间和文件数量，不泄露历史路径/URL。来源或文件集合变化、使用 `--no-reuse`、权限失效时，撤销旧桥 URL。文件导入全部结算后由 Skill 调用 `--stop`；异常断开仍由 TTL 收尾。

**Step 5: 运行专项测试**

Run: `node --test tests/local-media-bridge.test.mjs`

Expected: A 过期且本次只授权 B、`--no-reuse`、旧清单 A+B 而本次只授权 B 都只开放 B；A 只有在当前重新确认并通过宿主授权检查后才能开放。

## Task 4：同步 Kimi 使用指引和错误处理

**Files:**
- Modify: `skills/aixcut-host/SKILL.md`
- Modify: `skills/aixcut-timeline-editing/SKILL.md`
- Modify: `skills/aixcut-known-errors/SKILL.md`
- Modify: `skills/aixcut-timeline-editing/references/actions.md`
- Modify: `skills/aixcut-timeline-editing/references/frontend-actions.md`
- Test: `tests/skill-guidance.test.mjs`

**Step 1: 明确路径必须来自本次用户授权**

删除从旧状态恢复文件的提示。要续用历史文件时，先逐个询问并取得当前确认；不得因为文件仍存在就自动传给 helper。

**Step 2: 更新权限失败回退**

helper 遇到宿主授权失效、代理不可用或受控能力无法确认时，不清理 `NODE_OPTIONS`、不重试相同失效许可；改为调用 `prompt_add_material`，请用户在 Project 页面重新选择。

**Step 3: 更新桥生命周期说明**

只导入 helper 本轮返回的 URL；导入结算后停止桥。`MCP_LOCAL_MEDIA_BRIDGE_UNREACHABLE` 不再用旧 URL 重试，重新授权后取得新 URL，或直接走页面选择。

**Step 4: 运行 Skill 测试**

Run: `node --test tests/skill-guidance.test.mjs`

Expected: Skill 只传递本轮明确授权的文件，并明确说明权限失效时停止及重新选择。

## Task 5：真实 Kimi 验证与提审

**Files:**
- Review: `scripts/local-media-bridge.mjs`、相关 Skills、测试、`contracts/core/core-manifest.json`

**Step 1: 运行完整插件检查**

Run: `npm run check`

Expected: `node --test tests/*.test.mjs` 全部通过，插件结构、Skills 和 Core 摘要一致。

**Step 2: 在真实 Kimi 会话验证四个审核场景**

- A 授权过期，本次只授权 B：桥只提供 B。
- `--no-reuse`：不带入 A，只提供 B。
- 宿主权限失效：旧 URL 读失败并失效，桥不绕过限制；页面重新选择仍可导入。
- 明确续用 A：逐个重新确认并通过当前权限检查；过期、撤销或范围不匹配则拒绝。

**Step 3: 发布边界审查**

确认只修改 Kimi 插件包。MCP Server 不部署，WorkBuddy 不重打。版本号按提审平台要求确认；提交、推送和重交上架申请仍分别等待用户授权。
