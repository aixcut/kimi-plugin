function validatePlan(value, errors) {
  const sources = new Map((value.sources ?? []).map(source => [source.ref, source]));
  if (sources.size !== (value.sources ?? []).length) errors.push('duplicate source ref');
  const refs = new Set();
  for (const shot of value.shots ?? []) {
    if (refs.has(shot.shot_ref)) errors.push('duplicate shot_ref');
    refs.add(shot.shot_ref);
    const source = sources.get(shot.source_ref);
    if (!source) errors.push('unknown source_ref');
    for (const range of [shot.source_range, shot.output_range]) {
      if (range.end_ms <= range.start_ms) errors.push('range end_ms must exceed start_ms');
    }
    if (source && shot.source_range.end_ms > source.duration_ms) errors.push('source range exceeds duration');
  }
  const preserve = new Set(value.scope.preserve);
  for (const ref of value.scope.delete_refs) if (preserve.has(ref)) errors.push('preserve/delete conflict');
  const graph = new Map((value.shots ?? []).map(shot => [shot.shot_ref, shot.depends_on ?? []]));
  for (const deps of graph.values()) for (const dep of deps) if (!graph.has(dep)) errors.push('missing dependency');
  const visiting = new Set(); const visited = new Set();
  const visit = ref => {
    if (visiting.has(ref)) { errors.push('cyclic dependency'); return; }
    if (visited.has(ref)) return;
    visiting.add(ref); for (const dep of graph.get(ref) ?? []) visit(dep);
    visiting.delete(ref); visited.add(ref);
  };
  for (const ref of graph.keys()) visit(ref);
}

function validateReceipt(value, errors) {
  if (value.status === 'pending' && !['poll', 'wait', 'ask_user', 'wait_then_read'].includes(value.next_action.kind)) errors.push('pending receipt requires poll/wait');
  if (value.revision_before != null && value.revision_after != null && value.revision_after < value.revision_before) errors.push('revision_after precedes revision_before');
}

function validateCheckpoint(value, errors) {
  for (const receipt of value.pending_mutations) {
    if (receipt.project_id !== value.project_id) errors.push('pending mutation belongs to another project');
    if (receipt.timeline_id && receipt.timeline_id !== value.timeline_id) errors.push('pending mutation belongs to another timeline');
    validateReceipt(receipt, errors);
  }
}

function validateEvidence(value, errors) {
  const current = record => record && record.project_id === value.project_id && record.timeline_id === value.timeline_id && record.revision === value.revision;
  if (value.hard_failures.length && value.next_action.kind === 'deliver') errors.push('hard failures cannot be delivered');
  for (const layer of Object.values(value.layers)) if (layer.status === 'unjudgeable' && !layer.reason) errors.push('unjudgeable requires reason');
  const visual = value.layers.visual;
  const structure = value.layers.structure;
  if (structure.status === 'pass' && (!structure.checks.length || !structure.observations.length || structure.observations.some(record => !current(record)))) errors.push('structure pass requires current revision observations');
  if (visual.status === 'pass') {
    if (!visual.frames.length) errors.push('visual pass requires composed frames');
    for (const frame of visual.frames) {
      if (frame.project_id !== value.project_id || frame.timeline_id !== value.timeline_id || frame.revision !== value.revision) errors.push('frame does not prove current composed revision');
    }
  }
  const audio = value.layers.audio;
  if (audio.status === 'pass' && (!audio.listened || !audio.checks.length || !current(audio.listening))) errors.push('audio pass requires current revision listening evidence');
}


export function semanticErrors(name, value) {
 const errors = [];
 if (name === 'edit-plan') validatePlan(value, errors);
 if (name === 'operation-receipt') validateReceipt(value, errors);
 if (name === 'checkpoint') validateCheckpoint(value, errors);
 if (name === 'review-evidence') validateEvidence(value, errors);
 if (name === 'plan-context' && value.delete_refs.some(ref => value.preserve.includes(ref))) errors.push('preserve/delete conflict');
 return [...new Set(errors)];
}
