import { access, readFile, readdir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DEFAULT_FORBIDDEN_HOST_TEXT = ['mcp__', 'localhost', 'aixcut.cn', 'aixcut.com/mcp', 'api_key', 'access_token'];
const selectorFor = tool => tool === 'aixcut_read' || tool === 'aixcut_review' ? 'view' : tool === 'aixcut_open' ? 'target' : 'action';
const shouldIgnoreLine = line => /(?:do not|don't|never|禁止|不要|历史|historical|removed|旧版|invalid|反例|forbidden|不可调用)/i.test(line.toLowerCase());
const fail = message => { throw new Error('Skill contract closure failed: ' + message); };
const mapCatalog = catalog => new Map((catalog.tools || []).map(tool => [tool.name, new Set(tool.actions || [])]));
const publishedTool = (toolMap, name) => {
  for (const [parent, actions] of toolMap) {
    for (const action of actions) {
      if (`${parent}_${action.replaceAll('.', '_')}` === name)
        return { parent, action };
    }
  }
  return undefined;
};

function invocations(text) {
  const found = [];
  const fence = /```(?:json|javascript|js)?\s+([a-z][a-z0-9_]*)([^\n]*)\n([\s\S]*?)```/gi;
  for (const match of text.matchAll(fence)) {
    if (shouldIgnoreLine(match[2])) continue;
    try { const input = JSON.parse(match[3]); if (input && typeof input === 'object') found.push({ tool: match[1], input, source: 'structured' }); } catch { /* prose */ }
  }
  for (const [lineNumber, line] of text.split(/\r?\n/).entries()) {
    for (const match of line.matchAll(/\b(aixcut_[a-z_]+)\s*\(\s*([^)]*)\)/g)) {
      const prefix = line.slice(0, match.index || 0).split(/[.!?。！？]/).at(-1) || ''; if (shouldIgnoreLine(prefix)) continue;
      const input = {}; for (const field of match[2].matchAll(/\b(action|view|target)\s*=\s*["']([^"']+)["']/g)) input[field[1]] = field[2];
      found.push({ tool: match[1], input, source: 'line ' + (lineNumber + 1) });
    }
    for (const match of line.matchAll(/`(aixcut_[a-z_]+)`/g)) if (!shouldIgnoreLine(line.slice(0, match.index || 0))) found.push({ tool: match[1], input: {}, source: 'line ' + (lineNumber + 1) });
    const table = line.match(/^\s*\|\s*(aixcut_[a-z_]+)\s*\|\s*([a-z][a-z0-9_.]*)\s*\|/);
    if (table && !shouldIgnoreLine(line.slice(0, line.indexOf('|')).trim())) found.push({ tool: table[1], input: { [selectorFor(table[1])]: table[2] }, source: 'table line ' + (lineNumber + 1) });
  }
  return found;
}
async function contained(skillRoot, skill, reference) {
  const path = resolve(skillRoot, skill, reference); const base = resolve(skillRoot, skill);
  if (path !== base && !path.startsWith(base + '/')) fail(skill + ' reference escapes Skill package: ' + reference);
  try { await access(path); } catch { fail(skill + ' reference missing: ' + reference); }
  if (!(await realpath(path)).startsWith((await realpath(base)) + '/')) fail(skill + ' reference symlink escapes Skill package: ' + reference);
}
function check(entry, toolMap, call) {
  const callable = new Set([...(entry.tools && entry.tools.required || []), ...(entry.tools && entry.tools.optional || [])]); const forbidden = new Set(entry.tools && entry.tools.forbidden || []);
  const published = publishedTool(toolMap, call.tool);
  const parent = published?.parent || call.tool;
  const action = published?.action;
  if (forbidden.has(parent) || forbidden.has(call.tool)) fail(entry.skill + ' calls forbidden Tool ' + call.tool + ' (' + call.source + ')');
  if (!callable.has(parent) && !callable.has(call.tool)) fail(entry.skill + ' calls undeclared Tool ' + call.tool + ' (' + call.source + ')');
  const actions = toolMap.get(parent); if (!actions) fail(entry.skill + ' calls unknown Tool ' + call.tool + ' (' + call.source + ')');
  if (action) return;
  const selector = selectorFor(call.tool); for (const field of ['action', 'view']) if (field !== selector && field in call.input) fail(entry.skill + ' uses wrong selector ' + field + '; ' + call.tool + ' expects ' + selector);
  if (call.input[selector] && !actions.has(call.input[selector])) fail(entry.skill + ' references unknown ' + call.tool + '.' + call.input[selector] + ' (' + call.source + ')');
}

/** Validate Skills against a supplied live catalog and host mapping. Pass mapping directly; Core never parses YAML. */
export async function validateSkillClosure({ root, mapping, catalog, skillDirectory = 'shared/skills', forbiddenHostText = DEFAULT_FORBIDDEN_HOST_TEXT }) {
  if (!mapping || !catalog) throw new TypeError('mapping and catalog are required');
  const base = resolve(root); const toolMap = mapCatalog(catalog); const skillRoot = join(base, skillDirectory);
  const directories = (await readdir(skillRoot, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort();
  const entries = mapping.skills || [];
  if (JSON.stringify(directories) !== JSON.stringify(entries.map(entry => entry.skill).sort())) fail('Skill directories and mapping entries differ');
  for (const entry of entries) {
    const callable = [...(entry.tools && entry.tools.required || []), ...(entry.tools && entry.tools.optional || [])];
    for (const name of callable) if (!toolMap.has(name)) fail(entry.skill + ' declares unknown Tool ' + name);
    for (const name of entry.tools && entry.tools.forbidden || []) if (callable.includes(name)) fail(entry.skill + ' declares forbidden Tool ' + name + ' callable');
    for (const name of entry.requires || []) if (!directories.includes(name)) fail(entry.skill + ' requires missing Skill ' + name);
    const skillPath = join(skillRoot, entry.skill); const listed = new Set(entry.references || []); const files = ['SKILL.md', ...listed];
    async function walk(directory, prefix = '') { for (const item of await readdir(directory, { withFileTypes: true })) { const path = prefix ? prefix + '/' + item.name : item.name; if (item.isDirectory()) await walk(join(directory, item.name), path); else if (item.name.endsWith('.md') && path !== 'SKILL.md' && !listed.has(path)) files.push(path); } }
    await walk(skillPath); for (const reference of files.slice(1)) await contained(skillRoot, entry.skill, reference);
    const allText = (await Promise.all(files.map(file => readFile(join(skillPath, file), 'utf8')))).join('\n'); const lower = allText.toLowerCase();
    for (const value of forbiddenHostText) if (lower.includes(value.toLowerCase())) fail(entry.skill + ' contains host-specific or sensitive text: ' + value);
    for (const call of invocations(allText)) check(entry, toolMap, call);
    for (const pair of Object.entries(entry.actions || {})) { const tool = pair[0], actions = pair[1]; if (!toolMap.has(tool)) fail(entry.skill + ' action map references unknown Tool ' + tool); for (const action of actions) if (!toolMap.get(tool).has(action)) fail(entry.skill + ' action map references unknown ' + tool + '.' + action); }
  }
  return { skills: entries.length, tools: toolMap.size };
}
