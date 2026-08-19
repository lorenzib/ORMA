(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.ORMAVerificationReviewDecisions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const VERSION = '1.0.0';
  const ACTIONS = ['approve-orma-verified', 'keep-verification-blocked', 'clear-verification-decision'];

  function ids(values){
    return [...new Set((values || []).filter(value => typeof value === 'string' && value))].sort();
  }

  function applyDecision(decisions, input){
    if(!input || !ACTIONS.includes(input.action)) throw new Error('Invalid verification review action');
    if(typeof input.candidateId !== 'string' || !input.candidateId) throw new Error('candidateId is required');
    const next = { ...(decisions || {}) };
    if(input.action === 'clear-verification-decision'){
      delete next[input.candidateId];
      return next;
    }
    const acknowledgementIds = ids(input.acknowledgementIds);
    const requiredAcknowledgementIds = ids(input.requiredAcknowledgementIds);
    if(input.action === 'approve-orma-verified'){
      if(input.reviewReady !== true) throw new Error('Dossier is not ready for final verification');
      if(requiredAcknowledgementIds.length !== acknowledgementIds.length
        || requiredAcknowledgementIds.some(id => !acknowledgementIds.includes(id))){
        throw new Error('Every Red Team acknowledgement is required');
      }
    }
    next[input.candidateId] = {
      contractVersion: VERSION,
      gate: 'serious-objection-review',
      candidateId: input.candidateId,
      action: input.action,
      acknowledgementIds,
      note: String(input.note || '').trim().slice(0, 1500),
      reviewedAt: input.reviewedAt || new Date().toISOString(),
      reviewedBy: input.reviewedBy || 'local-editor',
      publicMutationAllowed: false,
    };
    return next;
  }

  function exportRecord(decisions, exportedAt){
    return {
      contractVersion: VERSION,
      gate: 'serious-objection-review',
      exportedAt: exportedAt || new Date().toISOString(),
      decisions: Object.values(decisions || {}).sort((a, b) => a.candidateId.localeCompare(b.candidateId)),
      publicMutationAllowed: false,
    };
  }

  return { VERSION, ACTIONS, applyDecision, exportRecord };
});
