(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.ORMARouteReviewDecisions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const VERSION = '1.0.0';
  const ACTIONS = [
    'approve-route',
    'approve-route-variants',
    'route-unresolved',
    'request-route-research',
    'reject-route-source',
    'clear-route-decision',
  ];

  function applyDecision(decisions, input){
    if(!input || !ACTIONS.includes(input.action)) throw new Error('Invalid route review action');
    if(typeof input.candidateId !== 'string' || !input.candidateId) throw new Error('candidateId is required');
    const next = { ...(decisions || {}) };
    if(input.action === 'clear-route-decision'){
      delete next[input.candidateId];
      return next;
    }
    if(input.action === 'approve-route'){
      if(!input.route || input.route.type !== 'LineString' || !Array.isArray(input.route.coordinates)
        || input.route.coordinates.length < 2){
        throw new Error('A reviewable LineString route is required');
      }
      if(typeof input.proposalId !== 'string' || !input.proposalId) throw new Error('proposalId is required');
      if(!Array.isArray(input.sourceRefs) || !input.sourceRefs.length) throw new Error('sourceRefs are required');
    }
    if(input.action === 'approve-route-variants'){
      if(!Array.isArray(input.routes) || input.routes.length < 2
        || input.routes.some(route => !route || typeof route.proposalId !== 'string'
          || !route.geometry || route.geometry.type !== 'LineString'
          || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2
          || !Array.isArray(route.sourceRefs) || !route.sourceRefs.length)){
        throw new Error('Two or more source-backed route variants are required');
      }
    }
    next[input.candidateId] = {
      contractVersion: VERSION,
      gate: 'geometry-approval',
      candidateId: input.candidateId,
      action: input.action,
      proposalId: input.action === 'approve-route' ? input.proposalId : null,
      route: input.action === 'approve-route' ? input.route : null,
      routes: input.action === 'approve-route-variants' ? input.routes : null,
      sourceRefs: input.action === 'approve-route' ? input.sourceRefs : [],
      note: String(input.note || '').trim().slice(0, 1000),
      reviewedAt: input.reviewedAt || new Date().toISOString(),
      reviewedBy: input.reviewedBy || 'local-editor',
    };
    return next;
  }

  function exportRecord(routeReview, decisions, exportedAt){
    return {
      contractVersion: VERSION,
      gate: 'geometry-approval',
      sourceGeneratedAt: routeReview && routeReview.generatedAt || null,
      exportedAt: exportedAt || new Date().toISOString(),
      decisions: Object.values(decisions || {}).sort((a, b) => a.candidateId.localeCompare(b.candidateId)),
    };
  }

  return { VERSION, ACTIONS, applyDecision, exportRecord };
});
