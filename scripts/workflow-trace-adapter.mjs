/**
 * Convert the MCP E2E journal shape into the host-neutral workflow trace shape.
 * This is deliberately conservative: incomplete requests and missing evidence
 * are omitted rather than being reported as successful workflow steps.
 */

const READ_ONLY_FRONTEND_ACTIONS = new Set([
  'page_status', 'capture_timeline_frames', 'capture_source_frames',
  'import_status', 'media.list', 'media.inspect', 'media.local_status',
  'media.resolve_cloud_url', 'operation.get', 'export_timeline_status',
]);
const READ_ONLY_GENERATE_ACTIONS = new Set(['catalog', 'get', 'list', 'quote', 'speech_read', 'speech_quote']);
const READ_ONLY_DOCUMENT_ACTIONS = new Set(['list', 'get', 'status']);
const MUTATION_TOOLS = new Set([
  'aixcut_primary', 'aixcut_speech', 'aixcut_caption', 'aixcut_clip',
  'aixcut_text', 'aixcut_audio', 'aixcut_track', 'aixcut_project',
  'aixcut_timeline', 'aixcut_generate', 'aixcut_document', 'aixcut_frontend',
]);

const resultOf = (envelope) => envelope?.result && typeof envelope.result === 'object'
  ? envelope.result : {};
const errorOf = (envelope) => envelope?.error && typeof envelope.error === 'object'
  ? envelope.error : {};
const actionOf = (args) => args?.action ?? args?.view;
const identityOf = (args, envelope, error = {}) => {
  const result = resultOf(envelope);
  const details = error?.details && typeof error.details === 'object' ? error.details : {};
  return args?.idempotency_key || args?.mutation_id || args?.operation_id
    || result.mutation_id || result.operation_id || result.job_id
    || details.mutation_id || details.operation_id || details.job_id;
};
const planOf = (args) => args?.plan_context?.plan_id || args?.plan_id;
const isMutation = (tool, args = {}) => {
  if (!MUTATION_TOOLS.has(tool)) return false;
  if (tool === 'aixcut_frontend') return !READ_ONLY_FRONTEND_ACTIONS.has(args.action);
  if (tool === 'aixcut_generate') return !READ_ONLY_GENERATE_ACTIONS.has(args.action);
  if (tool === 'aixcut_document') return !READ_ONLY_DOCUMENT_ACTIONS.has(args.action);
  return tool !== 'aixcut_read' && tool !== 'aixcut_review';
};

export function normalizeMcpE2eTrace(raw = {}, metadata = {}) {
  const sourceEvents = Array.isArray(raw.events) ? raw.events : [];
  const starts = new Map();
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
    const args = start.arguments && typeof start.arguments === 'object' ? start.arguments : {};
    const envelope = event.envelope && typeof event.envelope === 'object' ? event.envelope : {};
    const tool = event.tool || start.tool;
    const action = actionOf(args);
    const identity = identityOf(args, envelope, errorOf(envelope));
    const result = resultOf(envelope);
    const status = envelope.status;

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
        const mutation = {
          type: 'mutation', tool, action,
          ...(identity ? { mutation_id: identity } : {}),
          ...(plan ? { plan_id: plan } : {}),
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
