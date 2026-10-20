'use strict';

const path=require('path');
const {loadProductionTrails}=require('../scripts/load-production-trails');
const {compileVerifiedDossier}=require('./workflows/compile-verified-dossier');
const {buildVerifiedEditorialHandoff}=require('./workflows/verified-editorial-handoff');
const {buildPublicationStaging}=require('./workflows/build-publication-staging');
const {materializeApprovedPublications}=require('./workflows/materialize-approved-publications');
const {applyVerifiedTrailOverrides}=require('../scripts/verified-trail-overrides');
const routeRefs=require('../trail-route-refs.js');

const ROOT=path.resolve(__dirname,'..');
const AT='2026-10-18T10:00:00Z';

/**
 * Every trail in the catalogue, through the whole lane, on no model calls.
 *
 * The unit tests each hold one join. This holds the chain, on the real
 * catalogue, and it is what found the deadlock it now guards: 23 trails waited
 * on `asset-and-licensing-approval`, which only a visualDirector job can
 * produce, which is never queued for a trail already on the site -- so their
 * directions could never reach the page, and nothing anywhere said so.
 *
 * The survey is a stand-in. A real one is read from OpenStreetMap; this one is
 * built from what the catalogue already knows about the walk -- its route
 * numbers, or the measured-and-carries-none mark where it has none -- in the
 * shape `run-cartographer` writes. So this measures the lane, not the map: a
 * trail that passes here still needs its own survey to have run.
 */
function survey(trail){
  const numbers=routeRefs.forTrail(trail);
  const relationId=trail.osmRelation||0;
  const relations=numbers.map((ref,index)=>
    ({externalRelationId:`relation/${relationId||1000+index}`,ref,name:null}));
  const guidance=numbers.length?{alongOtherRoutes:false,sequence:numbers,
    switches:numbers.slice(1).map((ref,index)=>({from:numbers[index],to:ref,km:null})),
    segments:numbers.map(ref=>({ref})),relations}:null;
  return {
    ...(guidance?{routeGuidance:guidance}:{routeNumbersAbsent:true}),
    relation:{tags:{name:trail.name,...(numbers.length?{ref:numbers.join(';')}:{})}},
    source:{url:`https://www.openstreetmap.org/relation/${relationId}`,
      externalId:`relation/${relationId}`,endpoint:'https://api.openstreetmap.org/x',
      relationVersion:1,relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0',
      ...(relations.length?{relations}:{})},
    geometry:{type:'LineString',coordinates:(trail.path||[]).map(point=>[point[1],point[0]])},
    assessment:{issues:[],pointCount:(trail.path||[]).length,distanceKm:trail.distance},
    trailRecord:{id:trail.id,name:trail.name,startPoint:trail.startPoint||null,
      routeRefs:trail.routeRefs||[]},
    claims:[]};
}

/** One walk, from its survey to the entry the override file would hold. */
function run(record){
  const trail={candidateId:record.id,trailId:record.id,trailName:record.name,...record};
  const result=survey(record);
  const review={reviewId:'r',approvalAllowed:true,blockingReasons:[],
    specialistOutputs:[{agentId:'cartographer',jobId:'c1',result}]};
  const dossier=compileVerifiedDossier(review,trail,{at:AT,trail});
  const handoff=buildVerifiedEditorialHandoff(dossier,
    {candidateId:trail.candidateId,trailName:trail.trailName,verifiedAt:AT,conditions:[]},
    null,{at:AT,preserveExistingAssets:true,existingTrail:record});
  // No agent outputs and no decisions anywhere: nothing here was paid for.
  const staging=buildPublicationStaging(handoff.queue,{outputs:[]},{submissions:[]},
    {at:AT,productionTrails:[record]});
  const item=staging.items[0];
  if(item.state!=='ready-for-publication-preview'){
    return {id:record.id,blocked:[...item.missingApprovals,...item.publicationMappingBlockers].join('; ')};
  }
  const materialized=materializeApprovedPublications({
    requests:{requests:[{id:'pub',candidateId:trail.candidateId,
      status:'approved-for-pr-creation',approvedBy:'policy',approvedAt:AT}]},
    staging,routesByCandidate:{[trail.candidateId]:{geometry:result.geometry}},
    overrides:{contractVersion:'1.0.0',trails:[]},operationalFacts:{trails:[]},at:AT,
    productionTrails:[record]});
  const entry=materialized.overrides.trails[0];
  applyVerifiedTrailOverrides([record],materialized.overrides);
  return {id:record.id,entry,queued:handoff.jobs.length};
}

describe('the free lane, across the whole catalogue',()=>{
  const trails=loadProductionTrails(ROOT);
  const outcomes=trails.map(record=>{
    try{return run(record);}
    catch(error){return {id:record.id,blocked:String(error.message).slice(0,160)};}
  });
  const published=outcomes.filter(outcome=>outcome.entry);
  const blocked=outcomes.filter(outcome=>outcome.blocked);

  test('the catalogue is the real one',()=>{
    expect(trails.length).toBeGreaterThan(150);
  });

  // One trail, and the reason is a fact ORMA does not hold: the import
  // anchors a start to a mapped access point within 400 m of the line and
  // Val di Funes has none, so there is nothing to recommend. It needs a
  // sourced start point, which is what the `startPoint` override scope is for.
  test('every trail but one reaches a published entry',()=>{
    expect(blocked.map(outcome=>`${outcome.id}: ${outcome.blocked}`))
      .toEqual([expect.stringMatching(/^valley-view: .*requires sourced route guidance.*recommended-start/)]);
    expect(published.length).toBe(trails.length-1);
  });

  test('and not one of them queued a job',()=>{
    expect(published.filter(outcome=>outcome.queued).map(outcome=>outcome.id)).toEqual([]);
  });

  test('every published entry comes through the reviewed door, unsealed',()=>{
    const wrong=published.filter(outcome=>outcome.entry.verificationScope!=='routeReviewed'
      ||outcome.entry.fields.ormaVerified!==false);
    expect(wrong.map(outcome=>outcome.id)).toEqual([]);
  });

  test('every one carries its directions and its own words',()=>{
    const byId=new Map(trails.map(record=>[record.id,record]));
    const wrong=published.filter(outcome=>{
      const record=byId.get(outcome.id);
      const fields=outcome.entry.fields;
      return !fields.routeNumberGuidance||fields.desc!==record.desc||fields.name!==record.name;
    });
    expect(wrong.map(outcome=>outcome.id)).toEqual([]);
  });

  // The deadlock this exists to guard. A trail already on the site whose image
  // record is incomplete waited on an approval only a visualDirector job can
  // give, and that job is never queued for such a trail.
  test('a trail with no complete photograph publishes, and does not claim one',()=>{
    const noPhoto=published.filter(outcome=>!outcome.entry.fields.graduation.completed.includes('photo'));
    expect(noPhoto.length).toBeGreaterThan(0);
    // It writes no image fields at all, so the trail keeps whatever it shows.
    const claiming=noPhoto.filter(outcome=>
      'heroImage' in outcome.entry.fields||'imageIcon' in outcome.entry.fields);
    expect(claiming.map(outcome=>outcome.id)).toEqual([]);
    // And counts one check fewer than a trail that has one.
    const withPhoto=published.filter(outcome=>outcome.entry.fields.graduation.completed.includes('photo'));
    expect(new Set(noPhoto.map(outcome=>outcome.entry.fields.graduation.completed.length))).toEqual(new Set([4]));
    expect(new Set(withPhoto.map(outcome=>outcome.entry.fields.graduation.completed.length))).toEqual(new Set([5]));
  });

  test('and no trail claims a safety category nobody researched',()=>{
    const claiming=published.filter(outcome=>(outcome.entry.fields.verified.categories||[]).length);
    expect(claiming.map(outcome=>outcome.id)).toEqual([]);
  });
});
