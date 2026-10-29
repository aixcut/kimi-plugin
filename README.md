# Aixcut Kimi Plugin

Kimi 原生 Aixcut 插件，通过 Aixcut MCP 提供视频项目、时间线、字幕、配音、素材生成、核验和导出能力。

## 当前版本

首版面向 Kimi Work 中国站，使用远程 MCP：

```text
https://web.aixcut.cn/mcp
```

## 在 Kimi Work 中测试

1. 打开「插件」→「＋自定义插件」。
2. 导入本仓库或本地插件目录。
3. 在「个人」页签安装 Aixcut。
4. 新建会话，输入 `/` 选择 Aixcut，按提示完成 OAuth。
5. 依次测试打开 Project、读取 Timeline、小范围编辑、字幕、配音、核验和导出。

插件声明使用 Kimi 的 `kimi.plugin.json`、`SKILL.md` 和 `mcpServers` 格式。安装后由 Kimi 负责 MCP OAuth；不要在对话或配置中粘贴访问令牌。

## 目录

- `kimi.plugin.json`：Kimi 插件清单。
- `SYSTEM.md`：插件启用期间的宿主中立工作流规则。
- `skills/`：Aixcut 工作流 Skills 及其 references。
- `references/core/`：共享工作流质量门禁和状态协议。
- `scripts/`：随插件分发的验证和工作流辅助程序。

## 开发检查

```bash
npm test
```

国际站包应将 manifest 中的 MCP URL 改为 `https://web.aixcut.com/mcp`，并单独完成 OAuth、浏览器交接和导出验收后再发布。
