const forbidden = /token|cookie|secret|credential|signature|raw_media|raw_audio|raw_video/i;
const writePurposes = new Set(['write', 'mutation', 'submit']);
export function validateTraceEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object') return ['event must be an object'];
  for (const field of ['type', 'host', 'run_id', 'seq']) if (event[field] === undefined) errors.push('missing ' + field);
  if (!Number.isInteger(event.seq) || event.seq < 1) errors.push('seq must be positive integer');
  if (JSON.stringify(event).length > 16384) errors.push('event exceeds 16KiB');
  const walk = value => { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (forbidden.test(key)) errors.push('forbidden field ' + key); walk(child); } };
  walk(event);
  return [...new Set(errors)];
}
export function summarizeTrace(trace) {
  const events = trace.events || []; const seen = new Set(); let duplicateWrites = 0; let readBacks = 0; let polls = 0;
  for (const event of events) {
    if (event.purpose === 'read_back') readBacks++;
    if (event.purpose === 'poll' || event.type === 'job_poll') polls++;
    if (writePurposes.has(event.purpose)) { const key = [event.tool, event.action || event.view || '', event.idempotency_key || '', event.input_fingerprint || ''].join('|'); if (seen.has(key)) duplicateWrites++; seen.add(key); }
  }
  const costs = trace.costs || {}; return { tool_calls: events.length, read_backs: readBacks, polls, duplicate_writes: duplicateWrites, credits_total: Number(costs.credits_spent || 0) + Number(costs.failed_credits || 0), wait_ms: Number(costs.wait_ms || 0) };
}
