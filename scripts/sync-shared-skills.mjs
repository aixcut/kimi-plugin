#!/usr/bin/env node
// 从 agent-plugin 共享 Skill 源生成 Kimi 的业务 Skill。
//
// 共享源写的是 Codex 宿主词汇与能力；Kimi 只替换宿主相关的表述，
// 业务规则本身不改。Kimi 自己拥有的 Skill（OAuth、浏览器交接、本机素材、
// 工作流存储）不参与同步，见 hostOwned。
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const root = resolve(value('--root') ?? new URL('..', import.meta.url).pathname);
const sourceRoot = resolve(value('--source-root') ?? resolve(root, '../agent-plugin/codex/skills'));
const write = args.includes('--write');
const check = args.includes('--check');
if (write === check || (!write && !check)) throw new Error('Use exactly one of --write or --check');
// agent-plugin/codex/skills 是共享业务 Skill 的唯一来源。源不存在就是错误：
// 静默跳过会让漂移检查永远报通过。
if (!existsSync(sourceRoot)) throw new Error(`Shared Skill source is unavailable: ${sourceRoot}`);

/** 这些 Skill 由 Kimi 自己维护：宿主 OAuth、浏览器交接和本机素材语义与 Codex 不同。 */
const hostOwned = new Set([
  'aixcut-host',
  'aixcut-projects',
  'aixcut-login',
  'aixcut-mcp-logout',
]);

/** Kimi 没有本机路径导入能力，本 Skill 的 description 必须反映这一点。 */
const HOST_DESCRIPTION_OVERRIDE = {
  'aixcut-timeline-editing':
    'description: "Edit Aixcut clips, text, audio, tracks, canvas, and user-selected Project uploads. Do not use for voice scripts, full assembly, or export. Chinese triggers: 剪切、拼接、裁剪、删除片段、加文字、加音乐、轨道、画布、上传素材."',
};

/**
 * Codex 专属的插件维护说明：它讲的是 `codex plugin marketplace` 命令，
 * Kimi 通过自己的插件中心更新，不适用也不应从共享源同步过来。
 */
const excludedFiles = new Set(['aixcut-basics/references/plugin-maintenance.md']);

/**
 * 整句替换必须先于通用词替换执行：否则「Codex Host」会先被换成「Kimi」，
 * 后面那句完整的宿主语义替换就再也匹配不到。
 */
const REPLACEMENTS = [
  // 插件维护归宿主，Kimi 不走 Codex 的 marketplace 命令
  [
    'At the start of the first Aixcut workflow in each new Codex task, follow [plugin maintenance](references/plugin-maintenance.md) once.',
    'Kimi owns plugin installation and updates through its plugin center. Do not run package-manager or marketplace commands from this Skill. After the user updates the plugin, start a new conversation before relying on newly loaded Skills or MCP tools.',
  ],
  // Kimi 不续跑正在等待授权的回合
  [
    '- The Codex Host completes OAuth at the transport layer and resumes the original call.',
    '- Kimi completes OAuth at the transport layer, but it does not resume a call that is already waiting: the turn ends when authorization is required. Tell the user to finish authorizing in the browser and send one more message, then continue from that message.',
  ],
  ['Let the Codex Host reauthorize', 'Let Kimi reauthorize'],
  [
    'Clear the local credential, let the Codex Host reauthorize once',
    "Clear the stale authorization through Kimi's plugin controls, reauthorize once",
  ],
  [
    'The Host handles OAuth; do not call `aixcut_login` first.',
    'Kimi handles OAuth; do not call `aixcut_login` first.',
  ],
  [
    '- Continue asynchronous work when the Host and tools allow it. If the user must act, name the exact action and say what event or state will let work resume.',
    '- Continue asynchronous work when the Host and tools allow it. If the user must act, name the exact action and ask the user to send one more message when it is done; the Host does not resume a turn that is already waiting.',
  ],
  [
    'Do not treat Plugin installation, MCP configuration, OAuth authorization, an active Project page, available source media, or a local media bridge as the same state.',
    'Do not treat Plugin installation, MCP configuration, OAuth authorization, an active Project page, available source media, an open upload prompt, or a completed user-selected upload as the same state.',
  ],
  [
    'When OAuth finishes after the current tool catalog was created, tools may remain absent until a new host session starts. If they remain unavailable, stop and ask the user to start a new session.',
    'OAuth is completed by the Host outside the waiting turn: the turn that asked for authorization has already ended and the Host does not resume it. Ask the user to send one more message after authorizing. If tools are still absent on that message, ask the user to start a new session.',
  ],
  // 浏览器交接用 Kimi 内置浏览器
  [
    'immediately pass the complete `result.browser_handoff.url` to the official host browser-opening capability (Codex Desktop), then call',
    "open the complete `result.browser_handoff.url` in Kimi's built-in browser, then call",
  ],
  [
    'immediately pass its complete handoff URL to the official host browser-opening capability (Codex Desktop).',
    "open its complete handoff URL in Kimi's built-in browser.",
  ],
  // Core 路径由宿主解析
  [
    '宿主提供实际的 `<plugin-root>` 与可写 `<workflow-directory>`。',
    '宿主通过 `${KIMI_SKILL_DIR}` 解析插件内的 Core 路径，并提供可写 `<workflow-directory>`。',
  ],
  // 字幕追加示例
  [
    '- Replace the whole track with the set action; append new captions with the add action.\n',
    '- Replace the whole track with the set action; append new captions with the add action. `add` takes `items` and has no top-level `text`; see the append example in [references/actions.md](references/actions.md).\n',
  ],
  // 前端动作表：Kimi 没有本机导入链路
  [
    'This reference covers the complete frontend action catalog. Each action is published as its own model-callable MCP Tool; the live Tool Schema remains authoritative; send only fields accepted by the selected Tool.',
    'This reference covers the `aixcut_frontend` actions Kimi uses. Every action is called through the model-callable `aixcut_frontend` MCP Tool; the live Tool Schema remains authoritative. Send only fields accepted by the selected action.',
  ],
  // 动作表里本机导入链路的两行对 Kimi 不成立
  [
    '| aixcut_frontend(action="import_local_media") | — | `url` or `urls` | `timeout_ms`, `workspace_id` | Import 1–8 local assets; returns `import_ids` |\n',
    '',
  ],
  [
    '| aixcut_frontend(action="import_status") | — | `import_ids` | `timeout_ms`, `workspace_id` | Check imports until settled and `private_copy` is not `copying` |\n',
    '',
  ],
  [
    'This includes `page_status`, `playback_check`, frame capture, local-media import/status, Project document actions',
    'This includes `page_status`, `playback_check`, frame capture, Project document actions',
  ],
  [
    'Every call may include `project_id`, `workspace_id`, and `timeout_ms` when supported. Each action has its own model-facing Tool name. Page actions take their fields at the top level;',
    'Every call includes `action` and may include `project_id`, `workspace_id`, and `timeout_ms` when supported. Page actions take their fields at the top level;',
  ],
  [
    '| `import_local_media` | Exactly one of `url` or `urls` | `timeout_ms`, `workspace_id`; only use loopback bridge URLs for paths the user explicitly named. Returns `import_ids`, not completion. |\n',
    '',
  ],
  [
    '| `import_status` | `import_ids` | `timeout_ms`, `workspace_id`; poll these same IDs until settled; never resend the import. |\n',
    '',
  ],
  [
    'An accepted file or browser action is not proof that the work completed. Use `operation.get` for file operations, `import_status` for local imports, `export_timeline_status` for page exports, and `list_documents` for Project document upload/parse status.',
    'An accepted file or browser action is not proof that the work completed. Use `operation.get` for operations that return an operation ID, `export_timeline_status` for page exports, and `list_documents` for Project document upload/parse status. The Kimi `prompt_add_material` flow has no import ID: wait for the user, then verify the file in `sources`.',
  ],
  // 成片流程：本地素材只能由用户选择
  [
    'For `prompt_add_material`, wait for the user\'s confirmation and match the uploaded file by `file_name` in `sources`.',
    '',
  ],
  [
    '2. Do not use an old server-side analysis status to decide whether a local video is available. For `import_local_media`, use `import_status` only until the import is settled, then use the returned `media_id` to match the source in `aixcut_read(view="sources")` and check `transcript_status` plus `transcription_tasks` when speech matters. Active transcription states are `pending`, `queued`, `running`, `processing`, `submitted`, or `retrying`; wait briefly and reread `sources`. Do not keep polling a settled import. ',
    '2. Do not use an old server-side analysis status to decide whether a local video is available. Kimi local files must be added through `prompt_add_material`; wait for the user\'s confirmation and match the uploaded file by `file_name` in `aixcut_read(view="sources")`. Then check `transcript_status` plus `transcription_tasks` when speech matters. Active transcription states are `pending`, `queued`, `running`, `processing`, `submitted`, or `retrying`; wait briefly and reread `sources` while transcription is active.',
  ],
  [
    'keep browser handoff and local-file operations in their Codex specialist Skills.',
    'keep browser handoff and user-selected file uploads in the Kimi host and specialist Skills.',
  ],
  [
    '- `MCP_LOCAL_MEDIA_BRIDGE_UNREACHABLE`: The local media bridge URL is no longer serving the file. Do not retry the same URL. Either rerun the helper described by `aixcut-timeline-editing` to obtain its newly printed URL, or ask the user to upload through `prompt_add_material`. Never invent a URL.',
    '- Uploaded file missing: when a file the user just selected does not appear in `aixcut_read(view="sources")`, wait about 15 seconds and reread `sources` once. If it is still missing, report it and ask the user to select the file again through `aixcut_frontend(action="prompt_add_material")`. Never treat the upload prompt opening as a completed upload.',
  ],
  [
    '`import_local_media` and `prompt_add_material` both return acceptance, not completed library ingestion. The first returns `import_ids` for `import_status`; the second has no import ID and must be confirmed by rereading `aixcut_read(view="sources")`. A batch uses `url` for one file or `urls` for up to eight; per-file failures appear in `failures`.',
    'For Kimi local-media uploads, use only `prompt_add_material`. It opens the upload area but does not confirm completion and returns no import ID; wait for the user, then reread `aixcut_read(view="sources")` and match the file by `file_name`. User selection in the Project upload area is the only Kimi route for local files.',
  ],
  [
    'Import `ready` does not mean ASR is complete.',
    'A source appearing in the library does not mean ASR is complete.',
  ],
  [
    '5. If import is still running, reread `import_status`; if transcription is pending or running, reread `sources`. Do not re-import or substitute other media.',
    '5. Do not treat the upload prompt opening as a completed upload. Wait for the user to select files and confirm completion, then verify them in `sources`. If transcription is pending or running, reread `sources`; do not reopen the upload prompt or substitute other media.',
  ],
  // 通用宿主词汇（放最后）
  ['Codex Host', 'Kimi'],
  ["Codex Desktop's official browser-opening capability", "Kimi's built-in browser"],
  ['Codex specialist Skills', 'Kimi host and specialist Skills'],
  ['local-file operations', 'user-selected file uploads'],
  ['codex mcp logout aixcut', "Kimi's plugin connection controls"],
  ['host:"codex"', 'host:"kimi"'],
  ['~/.codex/plugins', '${KIMI_SKILL_DIR}/../..'],
  ['node <plugin-root>/scripts/', 'node ${KIMI_SKILL_DIR}/../../scripts/'],
  ['`contracts/core/', '`${KIMI_SKILL_DIR}/../../contracts/core/'],
  [
    'scripts/download-capture-artifacts.mjs',
    '${KIMI_SKILL_DIR}/../../scripts/download-capture-artifacts.mjs',
  ],
  ['The Kimi handles OAuth.', 'Kimi handles OAuth.'],
];

/** Kimi 只有「用户在项目页选择文件」一条本地素材链路，整段替换而不是逐句改。 */
const SECTION_REPLACEMENTS = [
  [
    /## Local media[\s\S]*?(?=\n## Captures and visual placement)/,
    `## Local media

Kimi has one supported local-media route: ask the user to select files in the Project page. A local path mentioned in chat does not authorize the plugin to read it.

### User-selected Project upload

Call:

\`\`\`json aixcut_frontend
{"action":"prompt_add_material"}
\`\`\`

A completed response means only that the upload area is open, not that a file was uploaded, and it returns no import ID. Tell the user to select or drag files, then end your turn and wait for the user's confirmation; do not read \`sources\`, retry, or draw conclusions before the user replies that the files are selected. After the confirmation, read \`aixcut_read(view="sources")\` and match the new source by \`file_name\`. If the file is not listed yet, wait about 15 seconds and reread \`sources\` once. Do not reopen the prompt for the same upload or assume it succeeded.

ASR is independent of the user's file selection and upload. When the task depends on speech or transcript text, call \`aixcut_read(view="sources")\`, match the uploaded source by \`file_name\`, and check its \`transcript_status\` and \`transcription_tasks\`. Active transcription states are \`pending\`, \`queued\`, \`running\`, \`processing\`, \`submitted\`, or \`retrying\`; wait briefly and reread \`sources\`. If needed to confirm whether transcription should exist, call \`aixcut_read(view="source", source=media_id)\` and check \`has_audio\`. Do not wait for ASR when there is no audio or the task only needs visual evidence. Read \`source_lines\` only after the matching source has \`transcript_status=available\`; report empty, outdated, or failed transcription instead of fabricating text or asking the user to upload again.

Local video does not require a complete server-side video copy. The browser keeps the user-selected original and sends extracted audio for transcription; use \`capture_source_frames\` or \`capture_timeline_frames\` for visual evidence. If \`CAPTURE_PERMISSION_REQUIRED\` occurs, ask the user to click the Project page once and retry the original capture. Local files reach Kimi only after the user selects them in the Project page.`,
  ],
];

export const transformSkillText = (text) =>
  SECTION_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    REPLACEMENTS.reduce((current, [from, to]) => current.replaceAll(from, to), text),
  );

const sourceSkills = (await readdir(sourceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !hostOwned.has(entry.name))
  .map((entry) => entry.name)
  .sort();

const files = async (directory, prefix = '') => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...(await files(join(directory, entry.name), path)));
    else if (entry.isFile() && (path === 'SKILL.md' || path.startsWith('references/'))) result.push(path);
  }
  return result.sort();
};

const applyHostLine = (text, skill) => {
  const override = HOST_DESCRIPTION_OVERRIDE[skill];
  if (!override) return text;
  const lines = text.split('\n');
  const index = lines.findIndex((line) => line.startsWith('description:'));
  if (index < 0) throw new Error(`${skill}: SKILL.md 缺少 description`);
  lines[index] = override;
  return lines.join('\n');
};

const mismatches = [];
for (const skill of sourceSkills) {
  for (const file of await files(join(sourceRoot, skill))) {
    if (excludedFiles.has(`${skill}/${file}`)) continue;
    const source = await readFile(join(sourceRoot, skill, file), 'utf8');
    const expected = transformSkillText(file === 'SKILL.md' ? applyHostLine(source, skill) : source);
    const target = join(root, 'skills', skill, file);
    let actual;
    try { actual = await readFile(target, 'utf8'); } catch { actual = undefined; }
    if (actual !== expected) {
      mismatches.push(`${skill}/${file}`);
      if (write) {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, expected);
      }
    }
  }
}
if (check && mismatches.length) throw new Error(`Skill drift: ${mismatches.join(', ')}`);
console.log(`${write ? 'Synced' : 'Checked'} ${sourceSkills.length} shared business Skills${mismatches.length ? ` (${mismatches.length} changed)` : ''}.`);
