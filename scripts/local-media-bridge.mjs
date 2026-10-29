#!/usr/bin/env node
/**
 * Aixcut 本机素材桥
 *
 * 只监听回环地址，把命令行给出的文件喂给 Aixcut 页面，让页面在不依赖文件选择器
 * 手势的前提下导入素材。AI 只能在用户明确给出路径后使用它。
 *
 * 用法：
 *   node local-media-bridge.mjs <文件...> [--allowed-origin HTTPS_ORIGIN] [--port N] [--ttl-ms N] [--state-file PATH] [--no-reuse]
 *   node local-media-bridge.mjs --status
 *   node local-media-bridge.mjs --stop
 *
 * 起桥时默认自己后台化：命令打印 JSON 后立即返回，桥继续在后台跑，不依赖调用它的
 * 终端或会话。已经在跑的桥如果已经覆盖这次要的文件，就直接复用，不再起第二个进程。
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 桥默认活 2 小时：够一次创作会话，过期后 url 失效，页面会回桥不可用。 */
export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

/** 起桥后等它写出状态文件的上限。 */
const READY_TIMEOUT_MS = 5_000;
const PROBE_TIMEOUT_MS = 1_000;

export const defaultStateFilePath = (home = os.homedir()) =>
  path.join(home, '.aixcut', 'local-media-bridge.json');

export const parseBridgeArguments = (argv) => {
  const options = {
    mode: 'serve',
    files: [],
    port: 0,
    ttlMs: DEFAULT_TTL_MS,
    stateFile: null,
    allowedOrigin: null,
    reuse: true,
    foreground: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--status') {
      options.mode = 'status';
      continue;
    }
    if (value === '--stop') {
      options.mode = 'stop';
      continue;
    }
    if (value === '--foreground') {
      options.foreground = true;
      continue;
    }
    if (value === '--no-reuse') {
      options.reuse = false;
      continue;
    }
    if (value === '--port' || value === '--ttl-ms' || value === '--state-file' || value === '--allowed-origin') {
      const next = argv[(index += 1)];
      if (next === undefined) throw new Error(`${value} needs a value`);
      if (value === '--port') options.port = Number(next);
      if (value === '--ttl-ms') options.ttlMs = Number(next);
      if (value === '--state-file') options.stateFile = next;
      if (value === '--allowed-origin') options.allowedOrigin = validateAllowedOrigin(next);
      continue;
    }
    if (value.startsWith('--')) throw new Error(`unknown option: ${value}`);
    options.files.push(value);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)
    throw new Error('port must be an integer between 0 and 65535');
  if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0)
    throw new Error('ttl-ms must be a positive number');
  return options;
};

const validateAllowedOrigin = (value) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('--allowed-origin must be an HTTPS origin');
  }
  const isLocalHttp = parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((!isLocalHttp && parsed.protocol !== 'https:') || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.origin !== value)
    throw new Error('--allowed-origin must be an HTTPS origin without a path, query, credentials, or fragment');
  return parsed.origin;
};

export const readBridgeState = (stateFile) => {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const writeBridgeState = (stateFile, state) => {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

export const clearBridgeState = (stateFile) => {
  try {
    fs.unlinkSync(stateFile);
  } catch {
    // 状态文件本来就不在，按已清理处理。
  }
};

/**
 * 桥的服务进程必须拿干净的环境起。
 *
 * 宿主会给子进程注入 NODE_OPTIONS（沙箱文件代理之类的 --require）。桥继承它以后，
 * 读用户文件走的就是宿主代理；会话一结束代理失效，第一次取文件就报
 * connect failed: Connection refused。清掉它，桥只用自己的 node 读盘。
 */
export const bridgeChildEnv = (env = process.env) =>
  Object.fromEntries(Object.entries(env).filter(([key]) => key !== 'NODE_OPTIONS'));

/**
 * 已在跑的桥能不能直接服务这次的文件。
 * 只要过期、或有一个文件它没在服务，就必须起新的。
 */
export const resolveBridgeReuse = (state, filePaths, now = Date.now(), allowedOrigin = null) => {
  if (!state || typeof state !== 'object') return { reusable: false, reason: 'no-state' };
  if ((state.allowed_origin ?? null) !== (allowedOrigin ?? null))
    return { reusable: false, reason: 'origin-mismatch' };
  const expiresAt = Date.parse(state.expires_at ?? '');
  if (!Number.isFinite(expiresAt) || expiresAt <= now)
    return { reusable: false, reason: 'expired' };
  const served = new Map(
    (Array.isArray(state.files) ? state.files : [])
      .filter((file) => file && typeof file.path === 'string' && typeof file.url === 'string')
      .map((file) => [file.path, file]),
  );
  const missing = filePaths.filter((filePath) => !served.has(filePath));
  if (missing.length > 0) return { reusable: false, reason: 'missing-files', missing };
  return {
    reusable: true,
    files: filePaths.map((filePath) => served.get(filePath)),
  };
};

/** 用状态里的 token 探一次 /health，确认桥真的还在跑。 */
export const probeBridgeHealth = async (baseUrl, token, timeoutMs = PROBE_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL('/health', baseUrl);
    url.searchParams.set('token', token ?? '');
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.json();
    return body && body.ok === true ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/** 只探活，不真的发信号；PID 已经被回收或不存在时返回 false。 */
export const processIsRunning = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
};

const resolveFiles = (filePaths) =>
  filePaths.map((filePath) => {
    const absolutePath = path.resolve(filePath);
    const stats = fs.statSync(absolutePath, { throwIfNoEntry: false });
    if (!stats || !stats.isFile()) throw new Error(`not a readable file: ${filePath}`);
    return { path: absolutePath, name: path.basename(absolutePath), size: stats.size };
  });

const summary = (state, reused) => ({
  reused,
  base_url: state.base_url,
  expires_at: state.expires_at,
  log_file: state.log_file,
  files: (state.files ?? []).map((file) => ({
    name: file.name,
    path: file.path,
    size: file.size,
    url: file.url,
  })),
});

/**
 * Origin 头不带路径或末尾斜杠；线上来源要按浏览器实际发来的 origin 精确匹配。
 * 本地来源继续允许任意端口，方便开发环境使用；指定站点后只放行该 Origin，
 * 兼容旧命令时才使用固定的官方域名集合。
 */
const FIXED_ALLOWED_ORIGINS = new Set([
  'https://aixcut.cn',
  'https://aixcut.com',
  'https://www.goxutech.com',
]);

const isAllowedOrigin = (origin, configuredOrigin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin ?? '') ||
  (configuredOrigin !== null
    ? origin === configuredOrigin
    : FIXED_ALLOWED_ORIGINS.has(origin ?? ''));

const corsHeaders = (origin, configuredOrigin) => {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, X-Aixcut-Last-Modified',
  };
  if (isAllowedOrigin(origin, configuredOrigin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
};

const runServer = (options, stateFile) => {
  const entries = resolveFiles(options.files);
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + options.ttlMs;
  const byId = new Map(
    entries.map((entry) => [crypto.randomBytes(8).toString('hex'), entry]),
  );

  const sendJson = (res, status, body, origin) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      ...corsHeaders(origin, options.allowedOrigin),
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
  };

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    // 排查用：确认页面请求是否真的到达桥，以及页面带来的 Origin 是什么。
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        method: req.method,
        target: String(req.url ?? '').replace(/([?&]token=)[^&]*/g, '$1[redacted]'),
        origin: origin ?? null,
      }),
    );
    if (req.method === 'OPTIONS') {
      const headers = corsHeaders(origin, options.allowedOrigin);
      // 页面在远端域名时，浏览器会对回环目标发私有网络预检，必须显式同意。
      if (req.headers['access-control-request-private-network'] === 'true')
        headers['Access-Control-Allow-Private-Network'] = 'true';
      res.writeHead(204, headers);
      res.end();
      return;
    }
    if (Date.now() > expiresAt) {
      sendJson(res, 410, { error: 'bridge-expired' }, origin, options.allowedOrigin);
      return;
    }
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${options.port}`);
    if (url.searchParams.get('token') !== token) {
      sendJson(res, 403, { error: 'invalid-token' }, origin, options.allowedOrigin);
      return;
    }
    if (url.pathname === '/health') {
      sendJson(
        res,
        200,
        {
          ok: true,
          expires_at: new Date(expiresAt).toISOString(),
          files: entries.map((entry) => ({ name: entry.name, size: entry.size })),
        },
        origin,
        options.allowedOrigin,
      );
      return;
    }
    const match = /^\/media\/([0-9a-f]+)$/.exec(url.pathname);
    const entry = match ? byId.get(match[1]) : undefined;
    if (!entry) {
      sendJson(res, 404, { error: 'not-found' }, origin, options.allowedOrigin);
      return;
    }
    // 起桥之后文件可能被删掉、换掉或变成目录。这时必须回一个可读的 500，
    // 不能把异常抛进请求处理里——桥是长驻进程，崩掉以后页面只会看到连接被重置，
    // 于是导入被误判成「被取消」，真实原因反而查不到。
    let lastModified = '';
    try {
      const stats = fs.statSync(entry.path);
      if (!stats.isFile()) throw new Error('not a regular file');
      lastModified = String(stats.mtimeMs);
    } catch (error) {
      sendJson(
        res,
        500,
        {
          error: 'file-unreadable',
          message: `bridge cannot read ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
        },
        origin,
        options.allowedOrigin,
      );
      return;
    }
    const responseHeaders = {
      ...corsHeaders(origin, options.allowedOrigin),
      'Content-Type': 'application/octet-stream',
      'Content-Length': entry.size,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(entry.name)}`,
      'X-Aixcut-Last-Modified': lastModified,
    };
    if (req.method === 'HEAD') {
      res.writeHead(200, responseHeaders);
      res.end();
      return;
    }

    // 等文件确实打开后再发 200。权限在桥启动后被收回时，createReadStream 会
    // 异步报错；若先写响应头，调用方只能得到断开的 200，无法区分读盘失败。
    const stream = fs.createReadStream(entry.path);
    stream.once('open', () => {
      if (res.destroyed) {
        stream.destroy();
        return;
      }
      res.writeHead(200, responseHeaders);
      stream.pipe(res);
    });
    stream.once('error', (error) => {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          event: 'media-read-failed',
          name: entry.name,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: 'file-unreadable',
          message: `bridge cannot read ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
        }, origin);
      } else {
        res.destroy();
      }
    });
    res.on('close', () => stream.destroy());
  });

  server.listen(options.port, '127.0.0.1', () => {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const state = {
      base_url: baseUrl,
      allowed_origin: options.allowedOrigin,
      token,
      pid: process.pid,
      started_at: new Date().toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      log_file: `${stateFile}.log`,
      files: entries.map((entry) => ({
        path: entry.path,
        name: entry.name,
        size: entry.size,
        url: `${baseUrl}/media/${
          [...byId.entries()].find(([, candidate]) => candidate.path === entry.path)[0]
        }?token=${token}`,
      })),
    };
    writeBridgeState(stateFile, state);
    // 到期自己退场，别留孤儿进程占着端口。
    setTimeout(() => {
      retireExpiredBridge(server, stateFile);
    }, Math.max(0, expiresAt - Date.now())).unref?.();
  });

  return server;
};

/**
 * 桥到期时的收尾：停掉监听、清掉自己写的状态文件，然后退出进程。
 *
 * 之前到期只是拒服务（410），进程和端口一直挂着，没人回收。只清状态文件也要防一手：
 * 新桥可能已经覆盖了状态文件，这时删掉会把新桥的句柄弄丢，所以先确认还是自己那条。
 */
export const retireExpiredBridge = (server, stateFile, pid = process.pid) => {
  const state = readBridgeState(stateFile);
  if (state && state.pid === pid) clearBridgeState(stateFile);
  server.close();
  server.closeIdleConnections?.();
};

/** 起新桥：把自己以 --foreground 重新拉起，等它写出状态文件后返回。 */
const startDetachedBridge = async (options, stateFile) => {
  const scriptPath = fileURLToPath(import.meta.url);
  // 首次使用时 ~/.aixcut 还不存在，状态文件和日志都要自己把目录建出来。
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const logFd = fs.openSync(`${stateFile}.log`, 'a');
  const child = spawn(
    process.execPath,
    [
      scriptPath,
      ...options.files,
      '--foreground',
      '--port',
      String(options.port),
      '--ttl-ms',
      String(options.ttlMs),
      '--state-file',
      stateFile,
      ...(options.allowedOrigin ? ['--allowed-origin', options.allowedOrigin] : []),
    ],
    { detached: true, stdio: ['ignore', logFd, logFd], env: bridgeChildEnv() },
  );
  child.unref();
  fs.closeSync(logFd);

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = readBridgeState(stateFile);
    if (state && state.pid === child.pid) return state;
    if (child.exitCode !== null)
      throw new Error(`local media bridge exited early, see ${stateFile}.log`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`local media bridge did not become ready, see ${stateFile}.log`);
};

const runStatus = async (stateFile) => {
  const state = readBridgeState(stateFile);
  if (!state) return { running: false, reason: 'no-state' };
  const health = await probeBridgeHealth(state.base_url, state.token);
  if (!health) return { running: false, reason: 'unreachable' };
  return { running: true, ...summary(state, true) };
};

const runStop = async (stateFile) => {
  const state = readBridgeState(stateFile);
  if (!state) return { stopped: false, reason: 'no-state' };
  if (!(await probeBridgeHealth(state.base_url, state.token))) {
    // 桥崩掉以后端口已经失效，健康检查必然失败。这时还拒绝清理状态文件，
    // 只会把一条死掉的端口和 URL 一直留在磁盘上，下一次起桥也跟着不干净。
    // 只有确认记录的进程真的不在了才清理；进程还活着但探不通时不动它，
    // 免得把 PID 被复用的无关进程连带清掉。
    if (Number.isInteger(state.pid) && !processIsRunning(state.pid)) {
      clearBridgeState(stateFile);
      return { stopped: true, reason: 'process-exited' };
    }
    return { stopped: false, reason: 'bridge-not-verified' };
  }
  if (Number.isInteger(state.pid)) {
    try {
      process.kill(state.pid, 'SIGTERM');
    } catch {
      // 进程已经不在，按停止成功处理。
    }
  }
  clearBridgeState(stateFile);
  return { stopped: true };
};

export const runBridgeCommand = async (argv, { home } = {}) => {
  const options = parseBridgeArguments(argv);
  const stateFile = options.stateFile
    ? path.resolve(options.stateFile)
    : defaultStateFilePath(home);

  if (options.mode === 'status') return runStatus(stateFile);
  if (options.mode === 'stop') return runStop(stateFile);
  if (options.foreground) return runServer(options, stateFile);
  if (options.files.length === 0)
    throw new Error(
      'usage: local-media-bridge.mjs <file...> [--allowed-origin HTTPS_ORIGIN] [--port N] [--ttl-ms N] [--state-file PATH] [--no-reuse]',
    );

  const absoluteFiles = options.files.map((file) => path.resolve(file));
  const existing = readBridgeState(stateFile);
  if (options.reuse && existing) {
    const decision = resolveBridgeReuse(existing, absoluteFiles, Date.now(), options.allowedOrigin);
    if (decision.reusable && (await probeBridgeHealth(existing.base_url, existing.token)))
      return summary(existing, true);
  }

  // 新桥要接着服务旧桥还在的文件，避免换桥后旧 url 全部失效。
  const originChanged = existing && (existing.allowed_origin ?? null) !== (options.allowedOrigin ?? null);
  if (
    originChanged &&
    Number.isInteger(existing.pid) &&
    (await probeBridgeHealth(existing.base_url, existing.token))
  ) {
    try {
      process.kill(existing.pid, 'SIGTERM');
    } catch {
      // 旧桥已经退出，继续启动当前站点的新桥。
    }
  }
  const carriedOver = originChanged
    ? []
    : (Array.isArray(existing?.files) ? existing.files : [])
    .map((file) => file?.path)
    .filter((filePath) => typeof filePath === 'string' && fs.existsSync(filePath));
  const files = [...new Set([...absoluteFiles, ...carriedOver])];
  const state = await startDetachedBridge({ ...options, files }, stateFile);
  return summary(state, false);
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
};

if (isDirectRun()) {
  runBridgeCommand(process.argv.slice(2))
    .then((result) => {
      // 前台模式由 server 自己保持进程存活，不要在这里退出。
      if (result && typeof result.on === 'function') return;
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(2);
    });
}
