'use strict';

// A hard seasonal limit is sourced before the seal (owner's decision of
// 10 November 2026; backoffice/OPERATING_STANDARD.md, "A seasonal limit is
// sourced before the seal"). A walk whose season is decided by something that
// opens and shuts must say when, from a source, before it is ORMA Verified:
//
//   season-unrecorded       no months at all: neither a board's months nor
//                           the altitude estimate (data/trail-seasons.json)
//   lift-dates-unpublished  the walk needs a lift (data/lift-access.json,
//                           dependency required) and no dated running period
//                           for it is held in data/lift-seasons.json
//
// Ski and sled runs on the line are read off the map and said to be
// (trail.season.winterUse), so they are sourced the way the standard allows.
// The best months stay outside the seal: they guide, they do not verify.
//
// The rule holds seals given from SEASONAL_RULE_FROM on. Walks verified before
// keep their seal and are listed as gaps to fix, not withdrawn.

const SEASONAL_RULE_FROM = '2026-11-10';

function needsLift(trail){
  const lift = trail && trail.liftAccess;
  return Boolean(lift && lift.dependency === 'required');
}

function seasonalLimitHolds(trail){
  const holds = [];
  const season = trail && trail.season;
  if(!season || (!season.recommended && !season.snow)){
    holds.push({ id: 'season-unrecorded', sentence: 'the walk has no months recorded: no board season and no altitude estimate' });
  }
  if(needsLift(trail)){
    const dated = ((season && season.lifts) || []).some(lift => lift.required && Array.isArray(lift.periods) && lift.periods.length);
    if(!dated){
      const name = trail.liftAccess.name || 'the lift';
      holds.push({ id: 'lift-dates-unpublished', sentence: `the walk needs ${name} and no published running dates for it are held` });
    }
  }
  return holds;
}

// When the walk's seal was given: the hand verification's date, else the review.
function sealDate(trail){
  return (trail.verified && trail.verified.date) || trail.reviewedAt || '';
}

function isSealed(trail){
  return Boolean(trail.graduation && trail.graduation.status === 'verified');
}

// Every sealed walk with a hold: `violations` were sealed under the rule and
// fail validation; `gaps` were sealed before it and are listed to be fixed.
function seasonalSealReport(trails){
  const violations = [];
  const gaps = [];
  for(const trail of trails){
    if(!isSealed(trail)) continue;
    const holds = seasonalLimitHolds(trail);
    if(!holds.length) continue;
    const entry = { id: trail.id, sealedOn: sealDate(trail), holds: holds.map(hold => hold.id), detail: holds.map(hold => hold.sentence) };
    (entry.sealedOn >= SEASONAL_RULE_FROM ? violations : gaps).push(entry);
  }
  return { ruleFrom: SEASONAL_RULE_FROM, violations, gaps };
}

module.exports = { SEASONAL_RULE_FROM, seasonalLimitHolds, seasonalSealReport };
