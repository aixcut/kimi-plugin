#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCheckpoint, resumeCheckpoint, saveCheckpoint, validateEditPlan } from './workflow-state.mjs';
import { canDeliver } from './review-evidence.mjs';

// This is deliberately a small host boundary. The host owns the directory;
// Core only persists validated, opaque workflow state below a safe plan id.
const input = async () => {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  if (!text.trim()) return {};
  return JSON.parse(text);
};

const safePlanId = value => {
  if (typeof value !== 'string' || !/^[\w-]{1,128}$/.test(value)) throw new Error('Invalid checkpoint plan_id');
  return value;
};

const fileAdapter = directory => {
  if (!directory) return undefined;
  const root = resolve(directory);
  const pathFor = key => join(root, `${safePlanId(key.split('/').at(-1))}.json`);
  return {
    async write(key, value) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const destination = pathFor(key);
      const temporary = `${destination}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
      await rename(temporary, destination);
    },
    async read(key) {
      try { return JSON.parse(await readFile(pathFor(key), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
  };
};

const main = async () => {
  const [, , command, ...args] = process.argv;
  const directoryIndex = args.indexOf('--directory');
  const directory = directoryIndex === -1 ? undefined : args[directoryIndex + 1];
  if (directoryIndex !== -1 && !directory) throw new Error('--directory requires a host-owned path');
  const body = await input();
  if (command === 'resume' || command === 'gate') {
    const current = body.current;
    if (!current || typeof current.project_id !== 'string' || !current.project_id ||
        typeof current.timeline_id !== 'string' || !current.timeline_id ||
        !Number.isInteger(current.revision) || current.revision < 0) {
      throw new Error('current must bind project_id, timeline_id and a non-negative revision');
    }
  }
  if (command === 'save') {
    const result = await saveCheckpoint(body.checkpoint, fileAdapter(directory));
    return { persisted: result.persisted, key: result.key, ...(result.reason ? { reason: result.reason } : {}) };
  }
  if (command === 'validate-plan') {
    const errors = await validateEditPlan(body.plan);
    return { ok: errors.length === 0, errors };
  }
  if (command === 'create') {
    const checkpoint = await createCheckpoint(body);
    return { ok: true, checkpoint };
  }
  if (command === 'resume') {
    const planId = safePlanId(body.plan_id);
    if (!directory) return { ok: false, next_step: 'inspect', reasons: ['host_storage_unavailable'] };
    return resumeCheckpoint(planId, body.current, fileAdapter(directory));
  }
  if (command === 'gate') return canDeliver(body.evidence, body.deliverable || 'report', body.current);
  throw new Error(`Unknown workflow host command: ${command || '(missing)'}`);
};

try {
  process.stdout.write(`${JSON.stringify(await main())}\n`);
} catch (error) {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
}
