'use strict';

/**
 * The ranking scored `existing-area` — within 30 km of a published trail —
 * highest, and a valley with nothing nearby lowest. At ORMA's density almost
 * everything in the Dolomites is within 30 km of something, so the tier barely
 * discriminated: measured 2026-10-08, all four awaiting candidates were tagged
 * `existing-area` while sitting in four different valleys, two of them thin and
 * one (Val di Non) with no ORMA trail at all.
 *
 * Proximity is not coverage. A 28th trail in Alta Pusteria adds less than a
 * second trail in Cortina, and only the valley count says so.
 */

const {planNewTrailScouting,compareScoutingCandidates,coverageNeed,
  publishedByValley}=require('./workflows/plan-new-trail-scouting');
const {DEFAULT_POLICY}=require('./workflows/regional-coverage');

const AT='2026-10-09T08:00:00.000Z';

// Two valleys far apart, so nearestLocality can be a clean threshold.
const DENSE='Alta Pusteria – Tre Cime';
const THIN='Cortina – Ampezzo';
const nearestLocality=lat=>({valley:lat>46.6?DENSE:THIN});

function loop(relation,lat,lng,name){
  return {properties:{osm_relation:relation,name,distance_km:6,loop:true},
    geometry:{type:'LineString',coordinates:[[lng,lat],[lng+0.01,lat+0.01],[lng,lat]]}};
}

// 27 published in the dense valley, 2 in the thin one — the real shape of the
// catalogue on 2026-10-08.
const trails=[
  ...Array.from({length:27},(_,i)=>({id:`d${i}`,name:`Dense ${i}`,region:'dolomites',
    valley:DENSE,lat:46.7,lng:12.3})),
  ...Array.from({length:2},(_,i)=>({id:`t${i}`,name:`Thin ${i}`,region:'dolomites',
    valley:THIN,lat:46.5,lng:12.1})),
];

const sources=[{region:'dolomites',data:{features:[
  loop('900',46.70,12.31,'Another in the dense valley'),
  loop('901',46.50,12.11,'One in the thin valley'),
]}}];

describe('a thin valley outranks a full one', () => {
  test('the candidate in the thin valley comes first', () => {
    const plan=planNewTrailScouting(sources,trails,{at:AT,nearestLocality});

    expect(plan.candidates.map(item=>item.name))
      .toEqual(['One in the thin valley','Another in the dense valley']);
    expect(plan.candidates[0]).toMatchObject({valley:THIN,valleyPublishedTrails:2});
    expect(plan.candidates[1]).toMatchObject({valley:DENSE,valleyPublishedTrails:27});
  });

  test('both are still tagged existing-area, which is why the tier could not decide', () => {
    const plan=planNewTrailScouting(sources,trails,{at:AT,nearestLocality});
    expect(plan.candidates.every(item=>item.expansionTier==='existing-area')).toBe(true);
    // Same tier, same score, opposite value — the old comparator had nothing
    // left to separate them but raw distance to the nearest trail.
    expect(plan.candidates.every(item=>item.expansionScore===3)).toBe(true);
  });

  test('the reason says which valley and how thin it is', () => {
    const plan=planNewTrailScouting(sources,trails,{at:AT,nearestLocality});
    expect(plan.candidates[0].whyCandidate)
      .toContain(`in ${THIN} where ORMA publishes 2 trails`);
  });

  test('the summary counts what the tiers could not say', () => {
    const plan=planNewTrailScouting(sources,trails,{at:AT,nearestLocality});
    expect(plan.summary.inThinValleys).toBe(1);
    expect(plan.summary.valleysRepresented).toBe(2);
    expect(plan.policy.thinValleyBelowPublished).toBe(DEFAULT_POLICY.thinBelowPublished);
  });
});

describe('the region policy still wins', () => {
  test('a thin valley in another region does not jump the primary region', () => {
    const mixed=[
      {region:'savoy',data:{features:[loop('910',45.6,6.5,'Thin but in Savoy')]}},
      {region:'dolomites',data:{features:[loop('911',46.70,12.31,'Dense but Dolomites')]}},
    ];
    const withSavoy=[...trails,{id:'s0',name:'Savoy one',region:'savoy',valley:'Maurienne',lat:45.6,lng:6.5}];
    const plan=planNewTrailScouting(mixed,withSavoy,{at:AT,primaryRegion:'dolomites',
      nearestLocality:lat=>lat>46?{valley:DENSE}:{valley:'Maurienne'}});

    // Coherent expansion before unrelated new regions is the stated policy and
    // this change sits underneath it, not in front of it.
    expect(plan.candidates[0].region).toBe('dolomites');
  });
});

describe('without the valley lookup, nothing changes', () => {
  test('the ordering falls back to exactly what it was', () => {
    const plan=planNewTrailScouting(sources,trails,{at:AT});
    expect(plan.candidates.every(item=>item.valley===null)).toBe(true);
    expect(plan.candidates.every(item=>item.coverageNeed===0)).toBe(true);
    // All equal on coverage, so the old proximity tiebreak decides as before.
    expect(plan.candidates).toHaveLength(2);
  });
});

describe('coverageNeed', () => {
  test('it is capped, so a very full valley cannot score negative', () => {
    const counts=publishedByValley(trails);
    expect(counts.get(DENSE)).toBe(27);
    expect(coverageNeed(DENSE,counts)).toBe(0);
    expect(coverageNeed(THIN,counts)).toBe(DEFAULT_POLICY.thinBelowPublished-2);
  });

  test('a valley with no trails needs the most', () => {
    expect(coverageNeed('Val di Non – Nonsberg',publishedByValley(trails)))
      .toBe(DEFAULT_POLICY.thinBelowPublished);
  });

  test('no valley means no opinion, never a bonus', () => {
    expect(coverageNeed(null,publishedByValley(trails))).toBe(0);
    expect(compareScoutingCandidates(
      {region:'dolomites',coverageNeed:0,expansionScore:3,distanceKm:5},
      {region:'dolomites',coverageNeed:4,expansionScore:3,distanceKm:5},'dolomites')).toBeGreaterThan(0);
  });
});
