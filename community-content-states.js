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
  const HAZARD_TTL_DAYS = Object.freeze({
    'water-dry':7,
    'guard-dogs-livestock':14,
    'dangerous-terrain':30,
    'lift-refused-dog':30,
    'other':30,
    'not-dog-friendly':90,
  });

  function isPublic(status){ return PUBLIC_STATES.includes(status); }
  function countsTowardRating(status){ return isPublic(status); }
  function canClientCreate(status){ return status === 'pending'; }
  function authorEditState(){ return 'pending'; }
  function canModeratorTransition(from, to){
    return !!MODERATOR_TRANSITIONS[from] && MODERATOR_TRANSITIONS[from].includes(to);
  }
  function hazardExpiryDate(type, from){
    const start = from instanceof Date ? from : new Date(from || Date.now());
    const days = HAZARD_TTL_DAYS[type] || HAZARD_TTL_DAYS.other;
    return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  }
  function timestampDate(value){
    if(value && typeof value.toDate === 'function') return value.toDate();
    if(value instanceof Date) return value;
    if(typeof value === 'number' || typeof value === 'string'){
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
  function hazardIsExpired(flag, at){
    const expires = timestampDate(flag && flag.expiresAt);
    const now = at instanceof Date ? at : new Date(at || Date.now());
    return !expires || expires.getTime() <= now.getTime();
  }
  function hazardTrustState(flag){
    const source = flag && flag.confirmationSource;
    if(source === 'official') return 'official-confirmed';
    if(source === 'dolopaws-reviewed') return 'dolopaws-reviewed';
    const confirmations = Math.max(0, Number(flag && flag.confirmations) || 0);
    const disputes = Math.max(0, Number(flag && flag.disputes) || 0);
    if(confirmations >= 2 && confirmations > disputes) return 'community-confirmed';
    if(disputes >= 2 && disputes >= confirmations) return 'community-disputed';
    return 'unconfirmed';
  }
  function hazardTrustLabel(flag){
    const labels = {
      'official-confirmed':'Confirmed by an official source',
      'dolopaws-reviewed':'Reviewed by DoloPaws',
      'community-confirmed':'Confirmed by the community',
      'community-disputed':'Disputed by the community',
      unconfirmed:'Unconfirmed community report',
    };
    return labels[hazardTrustState(flag)];
  }

  return Object.freeze({
    STATES, SERVER_STATES, PUBLIC_STATES, POLICIES, MODERATOR_TRANSITIONS,
    HAZARD_TTL_DAYS,
    isPublic, countsTowardRating, canClientCreate, authorEditState,
    canModeratorTransition, hazardExpiryDate, hazardIsExpired,
    hazardTrustState, hazardTrustLabel,
  });
});
