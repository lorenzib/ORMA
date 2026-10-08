'use strict';

/**
 * Scouting produced a list, not a programme: four candidates, every one tagged
 * `existing-area`, ranked by proximity to something ORMA already had. With no
 * denominator no valley could ever be called finished.
 *
 * Run against the real catalogue, the join immediately said something the tier
 * label could not: those four candidates sit in four different valleys, two of
 * them thin and one — Val di Non — with no ORMA trail at all. `existing-area`
 * was measuring distance to the nearest trail, not coverage of a place.
 */

const {summariseRegionalCoverage,coverageState,candidateValley,
  DEFAULT_POLICY,UNPLACED}=require('./workflows/regional-coverage');

const AT='2026-10-08T21:00:00.000Z';
const trail=(id,valley,verified=false)=>({id,valley,ormaVerified:verified});
const research=(valley,extra={})=>({valley,categoriesNeeded:{water:2,heat:2},
  canCloseHere:['livestock','access'],...extra});

describe('verification coverage and catalogue depth are different questions', () => {
  test('a valley with one unverified trail is thin, not merely unstarted', () => {
    const coverage=summariseRegionalCoverage({at:AT,
      trails:[trail('a','Paganella')]});
    expect(coverage.valleys[0].state).toBe('thin');
  });

  test('a deep valley with nothing verified is unstarted, which is a different job', () => {
    const coverage=summariseRegionalCoverage({at:AT,
      trails:Array.from({length:18},(_,i)=>trail(`m${i}`,'Maurienne'))});
    expect(coverage.valleys[0].state).toBe('unstarted');
    // 18 trails and 0 verified is a verification problem; 1 trail and 0
    // verified is an expansion problem. One number cannot say both.
    expect(coverage.totals.thin).toBe(0);
    expect(coverage.totals.unstarted).toBe(1);
  });

  test('covered needs the published share, not just one verified trail', () => {
    const many=[...Array.from({length:27},(_,i)=>trail(`t${i}`,'Alta Pusteria')),
      trail('tre-cime','Alta Pusteria',true),trail('lago-braies','Alta Pusteria',true)];
    const coverage=summariseRegionalCoverage({at:AT,trails:many});

    expect(coverage.valleys[0].verified).toBe(2);
    expect(coverage.valleys[0].state).toBe('started');
    expect(coverage.totals.covered).toBe(0);
  });

  test('the thresholds are named policy, and overridable', () => {
    const trails=[trail('a','Val Gardena'),trail('b','Val Gardena',true)];
    expect(summariseRegionalCoverage({at:AT,trails}).valleys[0].state).toBe('thin-started');
    // Half of two is verified, so a policy that does not call two trails thin
    // reads this valley as covered.
    const loosened=summariseRegionalCoverage({at:AT,trails,policy:{thinBelowPublished:2}});
    expect(loosened.valleys[0].state).toBe('covered');
    expect(loosened.policy.coveredAtVerifiedShare).toBe(DEFAULT_POLICY.coveredAtVerifiedShare);
  });
});

describe('what stops a valley being measurable is named, not dropped', () => {
  test('a trail with no valley is counted apart and called out', () => {
    const coverage=summariseRegionalCoverage({at:AT,
      trails:[trail('tre-cime','Alta Pusteria',true),trail('cinque-torri-assisted',null,true)]});

    // It is ORMA Verified and invisible to every per-valley figure, which is
    // exactly why it is reported rather than silently skipped.
    expect(coverage.gaps.unplacedTrails).toBe(1);
    expect(coverage.gaps.unplacedVerifiedTrails).toEqual(['cinque-torri-assisted']);
    expect(coverage.totals.valleys).toBe(1);
    expect(coverage.valleys.some(row=>row.valley===UNPLACED)).toBe(true);
  });

  test('valleys with no evidence file are named, because nothing can say what they need', () => {
    const coverage=summariseRegionalCoverage({at:AT,
      trails:[trail('a','Val Gardena'),trail('b','Valsugana')],
      valleyResearch:[research('Val Gardena')]});

    expect(coverage.gaps.valleysWithoutResearchFile).toEqual(['Valsugana']);
    expect(coverage.valleys.find(row=>row.valley==='Val Gardena').closableValleyWide)
      .toEqual(['livestock','access']);
    expect(coverage.valleys.find(row=>row.valley==='Valsugana').researchFile).toBe(false);
  });

  test('the evidence one source settles for a whole valley is surfaced', () => {
    const coverage=summariseRegionalCoverage({at:AT,trails:[trail('a','Brenta')],
      valleyResearch:[research('Brenta',{canCloseHere:['access']})]});
    expect(coverage.valleys[0].closableValleyWide).toEqual(['access']);
    expect(coverage.valleys[0].evidenceStillNeeded).toEqual(['water','heat']);
  });
});

describe('candidates are placed by the taxonomy, not by their own label', () => {
  const nearestLocality=(lat,lng)=>
    lat>46.4?{valley:'Val di Non – Nonsberg'}:{valley:'Val Gardena'};

  test('a candidate lands in a valley with no ORMA trail at all', () => {
    const coverage=summariseRegionalCoverage({at:AT,
      trails:[trail('a','Val Gardena')],
      scoutingCandidates:[{id:'osm-relation-1',center:[11.1,46.5]}],
      nearestLocality});

    const nonsberg=coverage.valleys.find(row=>row.valley==='Val di Non – Nonsberg');
    expect(nonsberg).toMatchObject({published:0,candidates:1,state:'no-trails'});
    expect(coverage.totals.candidatesAwaitingSelection).toBe(1);
  });

  test('the lookup takes lat then lng, the reverse of how the centre is stored', () => {
    // regions-config stores [lng, lat]; getting this backwards silently files
    // every candidate in the wrong valley.
    const seen=[];
    candidateValley({center:[11.43,46.35]},(lat,lng)=>{seen.push([lat,lng]);return {valley:'x'};});
    expect(seen).toEqual([[46.35,11.43]]);
  });

  test('a candidate with no usable centre is counted, not discarded', () => {
    const coverage=summariseRegionalCoverage({at:AT,trails:[trail('a','Val Gardena')],
      scoutingCandidates:[{id:'osm-relation-2'}],nearestLocality});
    expect(coverage.totals.candidatesAwaitingSelection).toBe(1);
    expect(coverage.valleys.find(row=>row.valley===UNPLACED).candidates).toBe(1);
  });
});

describe('coverageState', () => {
  test('an empty valley is not the same as an unverified one', () => {
    expect(coverageState(0,0,DEFAULT_POLICY)).toBe('no-trails');
    expect(coverageState(9,0,DEFAULT_POLICY)).toBe('unstarted');
  });

  test('totals add up to the valleys counted', () => {
    const coverage=summariseRegionalCoverage({at:AT,trails:[
      trail('a','Maurienne'),trail('b','Maurienne'),trail('c','Maurienne'),
      trail('d','Maurienne'),trail('e','Maurienne'),trail('f','Val Gardena')]});
    expect(coverage.totals.published).toBe(6);
    expect(coverage.totals.valleys).toBe(2);
  });
});
