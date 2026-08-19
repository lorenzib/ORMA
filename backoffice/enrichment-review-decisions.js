(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.ORMAEnrichmentReviewDecisions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const VERSION = '1.0.0';
  const ACTIONS = ['confirm-supported-claims', 'request-enrichment-resolution', 'keep-enrichment-blocked', 'clear-enrichment-decision'];

  function ids(values){
    return [...new Set((values || []).filter(value => typeof value === 'string' && value))].sort();
  }

  function applyDecision(decisions, input){
    if(!input || !ACTIONS.includes(input.action)) throw new Error('Invalid enrichment review action');
    if(typeof input.candidateId !== 'string' || !input.candidateId) throw new Error('candidateId is required');
    const next = { ...(decisions || {}) };
    if(input.action === 'clear-enrichment-decision'){
      delete next[input.candidateId];
      return next;
    }
    const supportedClaimIds = ids(input.supportedClaimIds);
    const unresolvedClaimIds = ids(input.unresolvedClaimIds);
    if(input.action === 'confirm-supported-claims' && !supportedClaimIds.length){
      throw new Error('At least one reviewed supported claim is required');
    }
    if(input.action === 'request-enrichment-resolution' && !unresolvedClaimIds.length){
      throw new Error('At least one unresolved claim is required');
    }
    next[input.candidateId] = {
      contractVersion: VERSION,
      gate: 'safety-input-review',
      candidateId: input.candidateId,
      action: input.action,
      supportedClaimIds,
      unresolvedClaimIds,
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
      gate: 'safety-input-review',
      exportedAt: exportedAt || new Date().toISOString(),
      decisions: Object.values(decisions || {}).sort((a, b) => a.candidateId.localeCompare(b.candidateId)),
      publicMutationAllowed: false,
    };
  }

  return { VERSION, ACTIONS, applyDecision, exportRecord };
});
