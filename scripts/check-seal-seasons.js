#!/usr/bin/env node
'use strict';

// The Verified seal and the seasons: a walk keeps the seal only when its hard
// seasonal limits are settled. Best months stay outside the seal (a walk can be
// verified and out of season); the limits that make the walk as described
// impossible for part of the year do not.
//
//   1. Every verified walk has a season record (data/trail-seasons.json).
//   2. A walk along a ski or sled run leaves December to April out of its best
//      months: the run is a piste then.
//   3. A walk whose words name a lift is either declared in
//      data/lift-access.json or checked by hand as riding none
//      (data/seal-season-review.json).
//   4. A walk that needs a lift has dated lift seasons in data/lift-seasons.json,
//      or is held there with a reason.
//
// Pass-road closures are not checked yet: there is no road data to check.
//
//   node scripts/check-seal-seasons.js     exits 1 and lists what is unsettled

const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./load-production-trails');
const words = require('../trail-season-words');

// Lifts by their names in the walks' languages. Bare "lift" is left out: "lift
// your dog over the stile" is not a lift.
const LIFT_WORDS = /\b(cable ?cars?|gondolas?|chair ?lifts?|ski lifts?|drag lifts?|lift stations?|lift car park|lift valley station|funiculars?|funivia|cabinovia|seggiovia|Seilbahn|Bergbahn|Umlaufbahn|Sessellift|télésiège|télécabine|téléphérique)\b/i;

function readJson(root, file){
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function wordsOf(trail){
  const guidance = trail.routeNumberGuidance || {};
  return [
    trail.desc, trail.tips, ...(trail.surfaceHazards || []),
    trail.startPoint && trail.startPoint.label,
    guidance.start, guidance.sequence, guidance.switches,
    ...(guidance.steps || []).map(step => step && step.text),
    ...(trail.decisionPoints || []).map(point => point && point.instruction),
  ].filter(text => typeof text === 'string').join(' ');
}

function audit(root){
  const trails = loadProductionTrails(root);
  const verified = trails.filter(trail => trail.graduation && trail.graduation.status === 'verified');
  const liftAccess = new Map(readJson(root, 'data/lift-access.json').trails.map(entry => [entry.id, entry.fields.liftAccess]));
  const liftSeasons = readJson(root, 'data/lift-seasons.json');
  const reviewed = readJson(root, 'data/seal-season-review.json').liftMentions || {};
  const problems = [];
  const ids = new Set(trails.map(trail => trail.id));

  for(const id of Object.keys(reviewed)){
    if(!ids.has(id)) problems.push(`${id}: in seal-season-review.json but not in the catalogue`);
    else if(liftAccess.has(id)) problems.push(`${id}: declared in lift-access.json and also checked as riding no lift`);
  }

  for(const trail of verified){
    const season = trail.season;
    if(!season){
      problems.push(`${trail.id}: verified but has no season record`);
      continue;
    }
    const onPiste = (season.winterUse || []).filter(use => use.kind === 'downhill' || use.kind === 'sled');
    const best = words.bestMonths(season) || [];
    const pisteMonths = best.filter(month => words.WINTER_SPORT_MONTHS.includes(month));
    if(onPiste.length && pisteMonths.length){
      problems.push(`${trail.id}: runs ${onPiste.map(use => `${use.km} km on a ${use.kind} run`).join(' and ')} but its best months include ${pisteMonths.join(', ')}`);
    }
    if(LIFT_WORDS.test(wordsOf(trail)) && !liftAccess.has(trail.id) && !reviewed[trail.id]){
      problems.push(`${trail.id}: names a lift; declare it in lift-access.json or check it into seal-season-review.json`);
    }
    const lift = liftAccess.get(trail.id);
    if(lift && lift.dependency === 'required' && !liftSeasons.trails[trail.id] && !(liftSeasons.held || {})[trail.id]){
      problems.push(`${trail.id}: needs the ${lift.name || 'lift'} but has no lift season and no held reason in lift-seasons.json`);
    }
  }
  return { verified: verified.length, problems };
}

if(require.main === module){
  const { verified, problems } = audit(path.resolve(__dirname, '..'));
  if(problems.length){
    console.error(`Seasonal limits unsettled on ${problems.length} verified walk(s):`);
    problems.forEach(problem => console.error(`  - ${problem}`));
    process.exit(1);
  }
  console.log(`Seasonal limits settled on all ${verified} verified walks.`);
}

module.exports = { LIFT_WORDS, audit };
