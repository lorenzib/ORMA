'use strict';

const VERSION = '1.0.0';

const STATES = Object.freeze([
  'discovered',
  'geometry_validated',
  'evidence_pending',
  'editorial_review',
  'approved_for_enrichment',
  'enriched',
  'approved_for_publish',
  'published',
  'rejected',
]);

const TRANSITIONS = Object.freeze({
  discovered: ['geometry_validated', 'rejected'],
  geometry_validated: ['evidence_pending', 'rejected'],
  evidence_pending: ['editorial_review', 'rejected'],
  editorial_review: ['evidence_pending', 'approved_for_enrichment', 'rejected'],
  approved_for_enrichment: ['enriched', 'rejected'],
  enriched: ['editorial_review', 'approved_for_publish', 'rejected'],
  approved_for_publish: ['published', 'editorial_review'],
  published: [],
  rejected: ['discovered'],
});

function canTransition(from, to){
  return STATES.includes(from) && STATES.includes(to) && TRANSITIONS[from].includes(to);
}

function transition(candidate, to, context = {}){
  if(!candidate || !canTransition(candidate.state, to)){
    throw new Error(`Invalid workflow transition: ${candidate && candidate.state} -> ${to}`);
  }
  const at = context.at || new Date().toISOString();
  const event = {
    from: candidate.state,
    to,
    at,
    actor: context.actor || 'orma-backoffice',
    reason: context.reason || null,
  };
  return {
    ...candidate,
    state: to,
    updatedAt: at,
    history: [...(candidate.history || []), event],
  };
}

module.exports = { VERSION, STATES, TRANSITIONS, canTransition, transition };
