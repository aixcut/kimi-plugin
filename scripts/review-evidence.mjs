import { randomUUID } from 'node:crypto';
import { validateContract } from './validate-contract.mjs';

export const validateReviewEvidence = evidence => validateContract('review-evidence', evidence);
export async function createReviewEvidence(input) {
  const value = { schema_version: '1.0.0', evidence_id: randomUUID(), hard_failures: [], next_action: { kind: 'reinspect' }, ...structuredClone(input) };
  const errors = validateReviewEvidence(value);
  if (errors.length) throw new Error('invalid ReviewEvidence: ' + errors.join('; '));
  return value;
}
/** A report may honestly disclose missing evidence; an export needs structure; quality needs all layers. */
export function canDeliver(evidence, deliverable = 'report', current) {
  const errors = validateReviewEvidence(evidence);
  if (errors.length) return { ok: false, reasons: errors, next_step: 'repair_evidence' };
  const reasons = [];
  if (!['report', 'export', 'quality'].includes(deliverable)) reasons.push('unknown_deliverable');
  if (current && ['project_id', 'timeline_id', 'revision'].some(key => evidence[key] !== current[key])) reasons.push('evidence_stale');
  if (evidence.hard_failures.length || Object.values(evidence.layers).some(layer => layer.status === 'fail')) reasons.push('quality_failed');
  for (const layer of deliverable === 'quality' ? ['structure', 'semantic', 'visual', 'audio'] : deliverable === 'export' ? ['structure'] : [])
    if (evidence.layers[layer].status !== 'pass') reasons.push(`${layer}_evidence_required`);
  return { ok: !reasons.length, reasons, next_step: reasons.length ? 'reinspect' : 'deliver', limitations: Object.entries(evidence.layers).filter(([,layer]) => layer.status === 'unjudgeable').map(([name,layer]) => ({layer:name, reason:layer.reason})) };
}
