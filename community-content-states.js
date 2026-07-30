(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsCommunityStates = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const STATES = Object.freeze([
    'draft', 'pending', 'visible', 'reported', 'hidden', 'removed',
  ]);
  const SERVER_STATES = Object.freeze(STATES.filter(state => state !== 'draft'));
  const PUBLIC_STATES = Object.freeze(['visible', 'reported']);
  const POLICIES = Object.freeze({
    review:Object.freeze({ initialServerState:'pending', firstContributionState:'pending' }),
    photo:Object.freeze({ initialServerState:'pending', firstContributionState:'pending' }),
    hazard:Object.freeze({ initialServerState:'pending', firstContributionState:'pending' }),
  });
  const MODERATOR_TRANSITIONS = Object.freeze({
    pending:Object.freeze(['visible', 'hidden', 'removed']),
    visible:Object.freeze(['reported', 'hidden', 'removed']),
    reported:Object.freeze(['visible', 'hidden', 'removed']),
    hidden:Object.freeze(['visible', 'removed']),
    removed:Object.freeze(['visible']),
  });

  function isPublic(status){ return PUBLIC_STATES.includes(status); }
  function countsTowardRating(status){ return isPublic(status); }
  function canClientCreate(status){ return status === 'pending'; }
  function authorEditState(){ return 'pending'; }
  function canModeratorTransition(from, to){
    return !!MODERATOR_TRANSITIONS[from] && MODERATOR_TRANSITIONS[from].includes(to);
  }

  return Object.freeze({
    STATES, SERVER_STATES, PUBLIC_STATES, POLICIES, MODERATOR_TRANSITIONS,
    isPublic, countsTowardRating, canClientCreate, authorEditState,
    canModeratorTransition,
  });
});
