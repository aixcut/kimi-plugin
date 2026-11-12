/**
 * Convert the MCP E2E journal shape into the host-neutral workflow trace shape.
 * This is deliberately conservative: incomplete requests and missing evidence
 * are omitted rather than being reported as successful workflow steps.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../contracts/mcp-tool-catalog.json', import.meta.url), 'utf8'));
const PUBLISHED_TOOLS = catalog.tools.map(tool => tool.name);
const PUBLISHED_TOOL_SET = new Set(PUBLISHED_TOOLS);

const READ_ONLY_FRONTEND_ACTIONS = new Set([
  'page_status', 'capture_timeline_frames', 'capture_source_frames',
  'import_status', 'media.list', 'media.inspect', 'media.local_status',
  'media.resolve_cloud_url', 'operation.get', 'export_timeline_status',
]);
const READ_ONLY_GENERATE_ACTIONS = new Set(['catalog', 'get', 'list', 'quote', 'speech_read', 'speech_quote']);
const READ_ONLY_DOCUMENT_ACTIONS = new Set(['list', 'get', 'status']);
const CONTROL_TOOLS = new Set(['aixcut_open', 'aixcut_exit_project', 'aixcut_login', 'aixcut_logout']);
const READ_ONLY_TOOLS = new Set(['aixcut_read', 'aixcut_review']);
const BILLABLE_ACTIONS = new Map([
  ['aixcut_generate', new Set(['submit', 'speech_submit'])],
  ['aixcut_export', new Set(['submit'])],
]);
const ACTION_READ_ONLY_ACTIONS = new Map([
  ['aixcut_frontend', READ_ONLY_FRONTEND_ACTIONS],
  ['aixcut_generate', READ_ONLY_GENERATE_ACTIONS],
  ['aixcut_document', READ_ONLY_DOCUMENT_ACTIONS],
  ['aixcut_export', new Set(['get'])],
  ['aixcut_media', new Set(['upload_status'])],
]);

export const TRACE_TOOL_POLICY = Object.freeze(Object.fromEntries(PUBLISHED_TOOLS.map(tool => [tool,
  CONTROL_TOOLS.has(tool) ? 'control' : READ_ONLY_TOOLS.has(tool) ? 'read' : ACTION_READ_ONLY_ACTIONS.has(tool) || BILLABLE_ACTIONS.has(tool) ? 'mixed' : 'mutation',
])));

export const classifyTraceTool = (tool, args = {}) => {
  if (CONTROL_TOOLS.has(tool)) return 'control';
  if (READ_ONLY_TOOLS.has(tool)) return 'read';
  const action = actionOf(args);
  if (action && ACTION_READ_ONLY_ACTIONS.get(tool)?.has(action)) return 'read';
  if (action && BILLABLE_ACTIONS.get(tool)?.has(action)) return 'billable';
  return 'mutation';
};

const resultOf = (envelope) => envelope?.result && typeof envelope.result === 'object'
  ? envelope.result : {};
const errorOf = (envelope) => envelope?.error && typeof envelope.error === 'object'
  ? envelope.error : {};
const actionOf = (args) => args?.action ?? args?.view;
const stableJson = value => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
};
const requestDigest = value => createHash('sha256').update(stableJson(value)).digest('hex');
export const normalizePublishedCall = (tool, rawArgs) => {
  if (PUBLISHED_TOOL_SET.has(tool)) return { tool, args: rawArgs, action: actionOf(rawArgs) };
  const parent = PUBLISHED_TOOLS
    .filter(candidate => tool.startsWith(`${candidate}_`))
    .sort((left, right) => right.length - left.length)[0];
  if (!parent) return { tool, args: rawArgs, action: actionOf(rawArgs) };
  let action = tool.slice(parent.length + 1);
  if (parent === 'aixcut_frontend') {
    action = action.replace(/^media_/, 'media.').replace(/^timeline_/, 'timeline.').replace(/^operation_/, 'operation.');
  }
  const selector = parent === 'aixcut_read' || parent === 'aixcut_review' ? 'view' : parent === 'aixcut_open' ? 'target' : 'action';
  return { tool: parent, args: { ...rawArgs, [selector]: action }, action };
};
const identityOf = (args, envelope, error = {}) => {
  const result = resultOf(envelope);
  const details = error?.details && typeof error.details === 'object' ? error.details : {};
  return args?.idempotency_key || args?.mutation_id || args?.operation_id
    || result.mutation_id || result.operation_id || result.job_id
    || details.mutation_id || details.operation_id || details.job_id;
};
const planOf = (args) => args?.plan_context?.plan_id || args?.plan_id;
const isMutation = (tool, args = {}) => ['mutation', 'billable'].includes(classifyTraceTool(tool, args));

export function normalizeMcpE2eTrace(raw = {}, metadata = {}) {
  const sourceEvents = Array.isArray(raw.events) ? raw.events : [];
  const starts = new Map();
  const seenMutations = new Map();
  const output = [];
  for (const event of sourceEvents) {
    if (event?.kind === 'tool:start' && event.requestId) {
      starts.set(event.requestId, event);
      continue;
    }
    if (!['tool:end', 'tool:error'].includes(event?.kind) || !event.requestId) continue;
    const start = starts.get(event.requestId);
    starts.delete(event.requestId);
    if (!start) continue;
    const rawArgs = start.arguments && typeof start.arguments === 'object' ? start.arguments : {};
    const envelope = event.envelope && typeof event.envelope === 'object' ? event.envelope : {};
    const normalized = normalizePublishedCall(event.tool || start.tool, rawArgs);
    const args = normalized.args;
    const tool = normalized.tool;
    const action = normalized.action;
    const identity = identityOf(args, envelope, errorOf(envelope));
    const result = resultOf(envelope);
    const status = envelope.status;
    const argsDigest = requestDigest(args);

    if (isMutation(tool, args)) {
      const unknown = event.kind === 'tool:error'
        || event.isError === true
        || envelope.isError === true
        || errorOf(envelope).type === 'status_unknown'
        || errorOf(envelope).code === 'MCP_MUTATION_STATUS_UNKNOWN'
        || result.status === 'status_unknown';
      if (unknown && identity) {
        output.push({ type: 'unknown', mutation_id: identity, operation_id: identity, tool, action });
      } else if (!unknown && ['ok', 'async'].includes(status)) {
        const plan = planOf(args);
        const prior = identity ? seenMutations.get(identity) : undefined;
        const idempotentReplay = Boolean(prior && prior.args_digest === argsDigest);
        if (identity) seenMutations.set(identity, { args_digest: argsDigest });
        const mutation = {
          type: 'mutation', tool, action,
          ...(identity ? { mutation_id: identity } : {}),
          ...(plan ? { plan_id: plan } : {}),
          ...(Number.isSafeInteger(args.plan_context?.plan_epoch) ? { plan_epoch: args.plan_context.plan_epoch } : {}),
          args_digest: argsDigest,
          idempotent_replay: idempotentReplay,
          ...(Array.isArray(args.plan_context?.preserve) ? { preserve: args.plan_context.preserve } : {}),
          ...(Number.isSafeInteger(result.revision_before) ? { revision_before: result.revision_before } : {}),
          ...(Number.isSafeInteger(result.revision_after) ? { revision_after: result.revision_after } : {}),
        };
        output.push(mutation);
      }
      continue;
    }

    if (tool === 'aixcut_read' || tool === 'aixcut_review') {
      const revision = result.revision ?? result.graph?.revision ?? result.timeline?.revision;
      if (action === 'timeline' && Number.isSafeInteger(revision)) output.push({ type: 'read_back', revision });
      if (action === 'mutation_receipt' || action === 'job') {
        const recoveredIdentity = identity || result.mutation_id || result.operation_id || result.job_id;
        const recoveredStatus = result.status || result.state;
        if (recoveredIdentity && ['applied', 'duplicate', 'noop', 'rejected', 'succeeded', 'failed'].includes(recoveredStatus)) {
          output.push({ type: 'recovered', mutation_id: recoveredIdentity, operation_id: recoveredIdentity, status: recoveredStatus });
        }
      }
      continue;
    }

    if (tool === 'aixcut_frontend' && action === 'capture_timeline_frames' && ['ok', 'async'].includes(status)) {
      output.push({ type: 'evidence_collected', layer: 'visual', visual: true });
    }
  }
  return {
    ...metadata,
    source: 'mcp-e2e',
    synthetic: metadata.synthetic ?? true,
    events: output,
  };
}

export default normalizeMcpE2eTrace;
