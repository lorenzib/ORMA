'use strict';

const facts = require('../../route-operational-facts');

// Turns approved Regulatory Ranger claims into route_operational_fact rows.
//
// The Ranger works from published operator and authority sources, which is why
// this exists at all: rifugio and lift dog policies are the same verification
// work it already does for route-level access, at entity granularity. Nothing
// here reaches the table without passing the human dossier gate first.

const CLAIM_ENTITY_TYPE = Object.freeze({
  'rifugio-dog-policy':'rifugio',
  'lift-dog-policy':'lift',
  'protected-area-dog-policy':'protected-area',
});

// The Ranger states a rule; these are the only rules the table understands.
// Anything else is left for a human rather than mapped onto the nearest fit.
const POLICY_BY_RULE = Object.freeze({
  accepted:'accepted',
  'accepted-leashed':'accepted_leashed',
  'accepted-muzzled':'accepted_muzzled',
  'not-accepted':'not_accepted',
  'contact-required':'unknown',
  unknown:'unknown',
});

function slug(value){
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function isoDate(value){
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

// A claim only becomes a fact when it names an entity, states a rule the table
// understands, and carries a source. The Ranger's own boundary is that silence
// is never permission, so a claim missing any of these is skipped rather than
// recorded as `unknown` — an absent row reads as "not yet verified", which is
// the truth, while an `unknown` row asserts that somebody asked.
function factFromClaim(claim, context){
  if(!claim || typeof claim !== 'object') return null;
  const entityType = CLAIM_ENTITY_TYPE[claim.id] || CLAIM_ENTITY_TYPE[claim.claimId];
  if(!entityType) return null;
  if(claim.state !== 'supported') return null;

  const entityName = String(claim.entityName || claim.subject || '').trim();
  const rule = String(claim.rule || claim.proposedValue || '').trim();
  const dogPolicy = POLICY_BY_RULE[rule];
  if(!entityName || !dogPolicy) return null;

  // The date must be when the source was observed, not when the publication
  // happened to run. Falling back to `now` would stamp a verification date
  // nobody established, and the twelve-month staleness rule reads that date.
  const verifiedAt = isoDate(claim.observedAt || claim.verifiedAt);
  const source = claim.verifiedSource || (claim.sourceIds && claim.sourceIds.length ? 'website' : null);
  if(!verifiedAt || !facts.VERIFIED_SOURCES.includes(source)) return null;

  const fact = {
    id:`${slug(context.trailId)}-${slug(entityName)}`.slice(0, 80),
    trail_id:context.trailId,
    entity_type:entityType,
    entity_name:entityName.slice(0, 160),
    dog_policy:dogPolicy,
    policy_notes:typeof claim.notes === 'string' && claim.notes.trim() ? claim.notes.trim().slice(0, 400) : null,
    verified_at:verifiedAt,
    verified_source:source,
    verified_by:String(context.verifiedBy || 'ORMA Regulatory Ranger').slice(0, 120),
  };
  return facts.validateFact(fact, 0).length ? null : fact;
}

// Merges approved facts into the existing table. A later verification of the
// same entity replaces the earlier one; everything else is left alone, so an
// unrelated trail's facts are never disturbed by a publication.
function mergeOperationalFacts(table, incoming, at){
  const next = table && typeof table === 'object'
    ? JSON.parse(JSON.stringify(table))
    : { contractVersion:facts.CONTRACT_VERSION, updatedAt:null, facts:[] };
  next.contractVersion = facts.CONTRACT_VERSION;
  next.facts = Array.isArray(next.facts) ? next.facts : [];

  let changed = 0;
  for(const fact of incoming){
    const index = next.facts.findIndex(entry => entry.id === fact.id);
    if(index >= 0){
      if(JSON.stringify(next.facts[index]) === JSON.stringify(fact)) continue;
      next.facts[index] = fact;
    }else{
      next.facts.push(fact);
    }
    changed += 1;
  }
  if(changed) next.updatedAt = isoDate(at);
  return { table:next, changed };
}

function operationalFactsFromClaims(claims, context){
  return (Array.isArray(claims) ? claims : [])
    .map(claim => factFromClaim(claim, context))
    .filter(Boolean);
}

module.exports = {
  CLAIM_ENTITY_TYPE,
  POLICY_BY_RULE,
  factFromClaim,
  operationalFactsFromClaims,
  mergeOperationalFacts,
};
