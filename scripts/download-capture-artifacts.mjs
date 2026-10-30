#!/usr/bin/env node
import { mkdir, open } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const SCHEMA_VERSION = "1.0.0";

const outputDir = process.argv[2];
if (!outputDir) throw new Error('Usage: download-capture-artifacts.mjs <output-directory>');
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const result = payload?.result;
if (payload?.status !== 'ok' || payload?.tool !== 'aixcut_frontend' || !String(result?.action).startsWith('capture_') || !Array.isArray(result?.data?.artifacts)) {
  throw new Error('Expected a successful aixcut_frontend capture result on stdin');
}
if (result.data.artifacts.length < 1 || result.data.artifacts.length > 8) throw new Error('Invalid artifact count');

const targetDir = resolve(outputDir);
await mkdir(targetDir, { recursive: true });
let total = 0;
const written = [];
for (const artifact of result.data.artifacts) {
  const url = new URL(artifact.download_url);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Artifact URL must use HTTPS');
  const declared = Number(artifact.byte_size);
  if (!Number.isInteger(declared) || declared < 1 || declared > 4 * 1024 * 1024) throw new Error('Invalid artifact byte size');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let response;
  try { response = await fetch(url, { signal: controller.signal }); } finally { clearTimeout(timer); }
  if (!response.ok) throw new Error(`Artifact download failed (${response.status})`);
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mime !== 'image/jpeg') throw new Error('Artifact response is not image/jpeg');
  const bytes = Buffer.from(await response.arrayBuffer());
  total += bytes.length;
  if (bytes.length !== declared || total > 16 * 1024 * 1024) throw new Error('Artifact byte size mismatch');
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new Error('Artifact is not a valid JPEG stream');
  const safeName = basename(String(artifact.file_name ?? 'capture.jpg')).replace(/[^A-Za-z0-9._-]/g, '_');
  const filePath = resolve(targetDir, safeName || 'capture.jpg');
  if (!filePath.startsWith(`${targetDir}/`)) throw new Error('Artifact file name escapes output directory');
  const handle = await open(filePath, 'wx');
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
  written.push(filePath);
}
process.stdout.write(`${JSON.stringify({ schema_version: SCHEMA_VERSION, files: written }, null, 2)}\n`);
