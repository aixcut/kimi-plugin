const mutationEvents = events => events.filter(event => event?.type === 'mutation');
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;

/** Offline trace scorer. It reports null when a trace omitted a measurement. */
export function evaluateWorkflow(trace) {
  const events = Array.isArray(trace?.events) ? trace.events : [];
  const mutations = mutationEvents(events);
  const ids = new Set();
  let duplicateMutations = 0;
  let preserveChecks = 0;
  let preserveViolations = 0;
  let readBacks = 0;
  for (const mutation of mutations) {
    const id = mutation.mutation_id || mutation.idempotency_key || mutation.operation_id;
    if (id) { if (ids.has(id)) duplicateMutations++; ids.add(id); }
    const preserve = Array.isArray(mutation.preserve) ? mutation.preserve : [];
    // A trace that only records the requested scope has not observed whether
    // the preserved object changed. Keep that metric unmeasured instead of
    // turning missing before/after evidence into a false zero violation.
    if (preserve.length && mutation.before !== undefined && mutation.after !== undefined) {
      preserveChecks++;
      if (JSON.stringify(mutation.before ?? {}) !== JSON.stringify(mutation.after ?? {})) preserveViolations++;
    }
    if (events.some(event => event.type === 'read_back' && event.revision === mutation.revision_after)) readBacks++;
  }
  const unknown = events.filter(event => event.type === 'unknown' && (event.mutation_id || event.operation_id || event.job_id));
  const recovered = new Set(events.filter(event => ['recovered','receipt','job_poll'].includes(event.type) && ['applied','duplicate','noop','rejected'].includes(event.status)).map(event => event.mutation_id || event.operation_id || event.job_id));
  const visualObservations = events.filter(event => event.type === 'evidence_collected' && (event.layer === 'visual' || event.visual === true));
  return {
    scenario: trace?.scenario,
    host: trace?.host,
    variant: trace?.variant,
    real_benchmark: trace?.synthetic !== true && trace?.source === 'live',
    metrics: {
      plan_coverage: ratio(mutations.filter(event => typeof event.plan_id === 'string').length, mutations.length) ?? 0,
      preserve_violation_rate: ratio(preserveViolations, preserveChecks),
      duplicate_mutations: duplicateMutations,
      read_back_coverage: ratio(readBacks, mutations.length),
      unknown_recovery_rate: ratio(unknown.filter(event => recovered.has(event.mutation_id || event.operation_id || event.job_id)).length, unknown.length),
      visual_evidence_coverage: visualObservations.length ? ratio(visualObservations.length, mutations.length) : null,
    },
  };
}
