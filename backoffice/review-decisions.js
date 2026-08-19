(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.ORMAReviewDecisions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const VERSION = '1.0.0';
  const ACTIONS = ['approve-parking', 'approve-parking-set', 'parking-unresolved', 'reject-candidate', 'clear'];

  function applyDecision(decisions, input){
    if(!input || !ACTIONS.includes(input.action)) throw new Error('Invalid review action');
    if(typeof input.candidateId !== 'string' || !input.candidateId) throw new Error('candidateId is required');
    const next = { ...(decisions || {}) };
    if(input.action === 'clear'){
      delete next[input.candidateId];
      return next;
    }
    if(input.action === 'approve-parking' && (!input.parking || !Array.isArray(input.parking.position))){
      throw new Error('A mapped parking suggestion is required');
    }
    if(input.action === 'approve-parking-set' && (!Array.isArray(input.parkings) || !input.parkings.length
      || input.parkings.some(parking => !Array.isArray(parking.position)))){
      throw new Error('One or more mapped parking suggestions are required');
    }
    next[input.candidateId] = {
      contractVersion: VERSION,
      candidateId: input.candidateId,
      action: input.action,
      parking: input.action === 'approve-parking' ? input.parking : null,
      parkings: input.action === 'approve-parking-set' ? input.parkings : null,
      note: String(input.note || '').trim().slice(0, 500),
      reviewedAt: input.reviewedAt || new Date().toISOString(),
      reviewedBy: input.reviewedBy || 'local-editor',
    };
    return next;
  }

  function exportRecord(queue, decisions, exportedAt){
    return {
      contractVersion: VERSION,
      sourceWorkflowVersion: queue && queue.workflowVersion || null,
      sourceGeneratedAt: queue && queue.generatedAt || null,
      exportedAt: exportedAt || new Date().toISOString(),
      decisions: Object.values(decisions || {}).sort((a, b) => a.candidateId.localeCompare(b.candidateId)),
    };
  }

  return { VERSION, ACTIONS, applyDecision, exportRecord };
});
