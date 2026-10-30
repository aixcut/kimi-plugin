import { validateContract } from './validate-contract.mjs';

const IDENTITY_FIELDS = ['operation_id', 'mutation_id', 'idempotency_key', 'job_id'];
const queryFor = receipt => {
  const identity = receipt.mutation_id || receipt.idempotency_key;
  if (!identity) return undefined;
  const field = receipt.mutation_id ? 'mutation_id' : 'idempotency_key';
  return `aixcut_read(view="mutation_receipt",project_id=${JSON.stringify(receipt.project_id)},${field}=${JSON.stringify(identity)})`;
};
export async function validateEditPlan(plan, root) { return validateContract('edit-plan', plan, root); }
export async function validateCheckpoint(checkpoint, root) { return validateContract('checkpoint', checkpoint, root); }
export async function createCheckpoint({ plan, host, phase, lastConfirmedRevision, completedSteps = [], pendingMutations = [], jobIds = [], nextStep, sourceVersions = [], evidenceIds = [] }, root) {
  const planErrors = await validateEditPlan(plan, root); if (planErrors.length) throw new Error('invalid EditPlan: ' + planErrors.join('; '));
  if (!Number.isInteger(lastConfirmedRevision) || lastConfirmedRevision < 0) throw new Error('lastConfirmedRevision must be a non-negative integer');
  const pending = pendingMutations.map(receipt => {
    const clean = Object.fromEntries(Object.entries(receipt).filter(([key]) => IDENTITY_FIELDS.includes(key) || ['schema_version', 'status', 'project_id', 'timeline_id', 'revision_before', 'revision_after', 'request_digest', 'next_action'].includes(key)));
    clean.schema_version ||= '1.0.0'; clean.project_id ||= plan.project_id; clean.timeline_id ||= plan.timeline_id;
    if (['unknown', 'not_found', 'pending'].includes(clean.status) && !clean.next_action) {
      const read = queryFor(clean);
      clean.next_action = read ? { kind: 'wait_then_read', read } : { kind: 'ask_user', reason: 'Original mutation_id or idempotency_key is required; do not replay an operation_id' };
    }
    return clean;
  });
  const checkpoint = { schema_version: '1.0.0', plan_id: plan.plan_id, host, project_id: plan.project_id, timeline_id: plan.timeline_id, phase, last_confirmed_revision: lastConfirmedRevision, completed_steps: [...new Set(completedSteps)], pending_mutations: pending, job_ids: [...new Set(jobIds)], next_step: nextStep || (pending.some(item => ['unknown', 'not_found', 'pending'].includes(item.status)) ? 'confirm_original_receipt' : 'continue'), ...(sourceVersions.length ? { source_versions: sourceVersions } : {}), ...(evidenceIds.length ? { evidence_ids: evidenceIds } : {}) };
  const errors = await validateCheckpoint(checkpoint, root); if (errors.length) throw new Error('invalid Checkpoint: ' + errors.join('; '));
  return checkpoint;
};
export async function canResumeCheckpoint(checkpoint, current, root) {
  const errors = await validateCheckpoint(checkpoint, root); if (errors.length) return { ok: false, next_step: 'repair_checkpoint', reasons: ['checkpoint_invalid'] };
  const reasons = []; if (checkpoint.project_id !== current.project_id) reasons.push('project_changed'); if (checkpoint.timeline_id && checkpoint.timeline_id !== current.timeline_id) reasons.push('timeline_changed'); if (checkpoint.last_confirmed_revision !== current.revision) reasons.push('revision_changed');
  for (const receipt of checkpoint.pending_mutations) if (['unknown', 'not_found', 'pending'].includes(receipt.status)) reasons.push('receipt_confirmation_required');
  const versions = new Map((current.source_versions ?? []).map(source => [source.source_ref, source.input_version]));
  if ((checkpoint.source_versions ?? []).some(source => versions.get(source.source_ref) !== source.input_version)) reasons.push('source_versions_changed');
  return { ok: reasons.length === 0, next_step: reasons.includes('receipt_confirmation_required') ? 'confirm_original_receipt' : reasons.includes('source_versions_changed') ? 'reinspect_sources' : reasons.length ? 'reinspect_project' : checkpoint.next_step, reasons: [...new Set(reasons)] };
};

const checkpointKey = planId => {
  if (typeof planId !== 'string' || !/^[\w-]{1,128}$/.test(planId)) throw new Error('Invalid checkpoint plan_id');
  return `aixcut/checkpoints/${planId}`;
};
export async function saveCheckpoint(checkpoint, adapter) {
  const errors = await validateCheckpoint(checkpoint);
  if (errors.length) throw new Error('invalid Checkpoint: ' + errors.join('; '));
  const key = checkpointKey(checkpoint.plan_id);
  if (!adapter?.write) return { persisted: false, key, checkpoint: structuredClone(checkpoint), reason: 'host_storage_unavailable' };
  await adapter.write(key, structuredClone(checkpoint));
  return { persisted: true, key };
}
export async function loadCheckpoint(planId, adapter) {
  const key = checkpointKey(planId);
  if (!adapter?.read) throw new Error('host_storage_unavailable');
  const value = await adapter.read(key);
  if (value == null) return null;
  const errors = await validateCheckpoint(value);
  if (errors.length || value.plan_id !== planId) throw new Error('invalid or mismatched Checkpoint');
  return structuredClone(value);
}
export async function resumeCheckpoint(planId, current, adapter) {
  const checkpoint = await loadCheckpoint(planId, adapter);
  if (!checkpoint) return { ok: false, next_step: 'inspect', reasons: ['checkpoint_missing'] };
  return { ...await canResumeCheckpoint(checkpoint, current), checkpoint };
}
