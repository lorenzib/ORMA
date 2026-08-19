(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.ORMAContentReviewDecisions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const VERSION = '1.0.0';
  const ACTIONS = ['approve', 'request-revision', 'reject', 'clear'];
  function applyDecision(decisions, input){
    if(!input || !ACTIONS.includes(input.action)) throw new Error('Invalid content review action');
    if(typeof input.jobId !== 'string' || !input.jobId) throw new Error('jobId is required');
    const next = { ...(decisions || {}) };
    if(input.action === 'clear'){ delete next[input.jobId]; return next; }
    next[input.jobId] = {
      contractVersion: VERSION, gate: input.agentId === 'visualDirector' ? 'asset-and-licensing-approval' : 'editorial-approval',
      jobId: input.jobId, agentId: input.agentId, action: input.action,
      note: String(input.note || '').trim().slice(0, 1500), reviewedAt: input.reviewedAt || new Date().toISOString(),
      reviewedBy: input.reviewedBy || 'local-editor', publicMutationAllowed: false,
    };
    return next;
  }
  function exportRecord(decisions, exportedAt){
    return { contractVersion: VERSION, gate: 'content-review', exportedAt: exportedAt || new Date().toISOString(),
      decisions: Object.values(decisions || {}).sort((a, b) => a.jobId.localeCompare(b.jobId)), publicMutationAllowed: false };
  }
  return { VERSION, ACTIONS, applyDecision, exportRecord };
});
