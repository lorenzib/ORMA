'use strict';

const path=require('path');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {compileVerifiedDossier}=require('./workflows/compile-verified-dossier');
const {buildVerifiedEditorialHandoff}=require('./workflows/verified-editorial-handoff');
const {buildPublicationStaging}=require('./workflows/build-publication-staging');
const {materializeApprovedPublications}=require('./workflows/materialize-approved-publications');
const {loadProductionTrails}=require('../scripts/load-production-trails');

const AT='2026-10-20T10:00:00Z';
const ROOT=path.resolve(__dirname,'..');

// The first five walks to reach publication were not all in the Dolomites, and
// the distance a dossier publishes is not the line the route proposal draws.
// Both fixtures here are real catalogue records, because a hand-typed path
// cannot disagree with a hand-typed distance in the way that broke generation.
const CATALOGUE=loadProductionTrails(ROOT);
function record(id){
  const trail=CATALOGUE.find(entry=>entry.id===id);
  if(!trail)throw new Error(`${id} left the catalogue; pick another published walk`);
  return {candidateId:trail.id,trailId:trail.id,trailName:trail.name,...trail};
}

// The catalogue keys a walk as osm-<relation>; the survey's source is the
// relation itself, which is what the guidance check reads.
const relationId=trail=>String(trail.id).replace(/^osm-/,'');

const km=(a,b)=>Math.hypot((a[0]-b[0])*111.2,(a[1]-b[1])*Math.cos(a[0]*Math.PI/180)*111.2);
const lineKm=p=>p.reduce((total,point,i)=>i?total+km(p[i-1],point):0,0);

function survey(trail,coordinates){
  return {routeGuidance:singleRelationGuidance({tags:{ref:'20'}}),
    relation:{tags:{ref:'20',name:trail.trailName}},
    source:{url:`https://www.openstreetmap.org/relation/${relationId(trail)}`,
      externalId:`relation/${relationId(trail)}`,
      endpoint:'https://api.openstreetmap.org/x',relationVersion:3,
      relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
    geometry:{type:'LineString',coordinates},
    assessment:{issues:[],pointCount:coordinates.length,distanceKm:trail.distance}};
}

// One walk through the lane, with the line the route proposal carries kept
// separate from the record's own distance so the two can be made to disagree.
function publish(trail,options={}){
  const coordinates=(options.path||trail.path).map(point=>[point[1],point[0]]);
  const result=survey(trail,coordinates);
  const review={reviewId:'r',approvalAllowed:true,blockingReasons:[],
    specialistOutputs:[{agentId:'cartographer',jobId:'c1',result}]};
  const dossier=compileVerifiedDossier(review,trail,{at:AT,trail});
  const handoff=buildVerifiedEditorialHandoff(dossier,
    {candidateId:trail.candidateId,trailName:trail.trailName,verifiedAt:AT,conditions:[]},
    null,{at:AT,preserveExistingAssets:true});
  const copyJobId=`verified-${trail.candidateId}-copy`;
  const execution={outputs:[{jobId:copyJobId,candidateId:trail.candidateId,agentId:'editorialCopywriter',
    result:{title:trail.trailName,changes:[
      {section:'About the trail',after:'A gentle promenade above the village.'},
      {section:'Why it suits dogs',after:'Wide, shaded and away from traffic.'},
      {section:'Important practical notes',after:'No water on the route; carry your own.'}]}}]};
  const reviewQueue={submissions:[{submissionId:'s1',decisions:[
    {jobId:copyJobId,action:'approve',gateId:'editorial-evidence-policy',decidedBy:'benedetta'}]}]};
  const staging=buildPublicationStaging(handoff.queue,execution,reviewQueue,
    {at:AT,productionTrails:[{...trail,id:trail.trailId}]});
  const requests={requests:[{id:`pub-${trail.candidateId}`,candidateId:trail.candidateId,
    status:'approved-for-pr-creation',approvedBy:'benedetta',approvedAt:AT}]};
  return materializeApprovedPublications({requests,staging,
    routesByCandidate:{[trail.candidateId]:{geometry:result.geometry}},
    overrides:{contractVersion:'1.0.0',trails:options.declared||[]},
    operationalFacts:{trails:[]},at:AT,
    productionTrails:'priorTrails' in options?options.priorTrails:[trail]});
}

describe('a publication lands in the region its line is in',()=>{
  // The website splits its runtime bundles on this field, so the wrong value
  // does not merely mislabel a walk -- it ships it in the wrong package.
  test.each([
    ['osm-11839597','dolomites'],
    ['osm-12127424','savoy'],
  ])('%s publishes in %s',(id,region)=>{
    const trail=record(id);
    const entry=publish(trail).entries[0];
    expect(entry.fields.region).toBe(region);
    // And the region is read off the line, not off the record it came with.
    expect(entry.fields.lng).toBeCloseTo(trail.path[0][1],5);
  });
});

describe('a publication does not write a distance its own line contradicts',()=>{
  const trail=record('osm-11839597');

  test('the sound walk publishes with its line and its distance agreeing',()=>{
    const result=publish(trail);
    expect(result.refused).toEqual([]);
    const fields=result.entries[0].fields;
    expect(Math.abs(fields.distance/lineKm(fields.path)-1)).toBeLessThan(0.2);
  });

  test('a line far short of the published distance is refused and named',()=>{
    // Half the points: the same walk traced to its midpoint, which is what a
    // partial relation answer looks like.
    const half=trail.path.slice(0,Math.ceil(trail.path.length*0.55));
    const result=publish(trail,{path:half});
    expect(result.materialized).toBe(0);
    expect(result.refused).toHaveLength(1);
    const [refusal]=result.refused;
    expect(refusal.trailId).toBe(trail.id);
    expect(refusal.reason).toBe('distance-disagrees-with-its-line');
    // Both measurements are in the receipt, because which one is wrong is the
    // next question anyone asks.
    expect(refusal.distance).toBeCloseTo(trail.distance,3);
    expect(refusal.lineKm).toBeCloseTo(lineKm(half),2);
    expect(refusal.message).toMatch(/disagrees with the approved line/);
  });

  test('a declared out-and-back is not refused for the 2x it is meant to show',()=>{
    const oneWay=trail.path.slice(0,Math.ceil(trail.path.length/2));
    const result=publish(trail,{path:oneWay,priorTrails:[],
      declared:[{id:trail.id,verificationScope:'routeShape',
        fields:{routeShape:'out-and-back',routeShapeNote:'Traced one way; the walk returns the same path.'}}]});
    expect(result.refused).toEqual([]);
    expect(result.materialized).toBe(1);
  });

  // Four walks in the catalogue disagree with their own lines knowingly, and
  // route-shape-geometry.test.js pins them. Re-publishing one is not this
  // fault, and refusing it would stop a trail the repository already accepts.
  // the-free-lane-across-the-catalogue.test.js proves this across all 162 real
  // records; here the rule is isolated from the lane that feeds it.
  test('a disagreement the record already carries is not refused',()=>{
    const half=trail.path.slice(0,Math.ceil(trail.path.length*0.55));
    const result=publish(trail,{path:half,priorTrails:[{...trail,path:half}]});
    expect(result.refused).toEqual([]);
    expect(result.materialized).toBe(1);
  });

  // A walk arriving with no record to compare against has no prior agreement to
  // break -- and a new disagreement entering the catalogue is the thing the
  // pinned test says to look at rather than absorb.
  test('a walk new to the catalogue may not arrive already disagreeing',()=>{
    const half=trail.path.slice(0,Math.ceil(trail.path.length*0.55));
    const result=publish(trail,{path:half,priorTrails:[]});
    expect(result.materialized).toBe(0);
    expect(result.refused[0].reason).toBe('distance-disagrees-with-its-line');
  });
});

// On 23 October a policy-approved publication would have put St. Magdalena
// back on its old 1.6 km line and taken its Verified badge away: its seal
// lives in trail-audits.js and its official line in a routeLine entry, and
// the seal check only looked at the ledger's own fields.
describe('a walk verified or re-lined by hand is not republished by the pipeline',()=>{
  test('a hand-verified walk is refused and its record left alone',()=>{
    // Tru di Lëc: verified by hand on 23 October, like St. Magdalena, and an
    // imported walk the lane's fixtures can build.
    // Its seal was withdrawn on 29 October 2026 for want of directions and
    // restored on 30 October once the page printed them; either way the
    // hand-verified record must not be overwritten by the lane.
    const trail=record('osm-9493733');
    expect(trail.tier).toBe('route-audited');
    const result=publish(trail);
    expect(result.entries).toEqual([]);
    expect(result.overrides.trails).toEqual([]);
    expect(result.refused.map(r=>[r.trailId,r.reason])).toEqual([['osm-9493733','verified-by-hand']]);
  });

  test('an official line set by hand is not replaced, verified or not',()=>{
    const trail=record('osm-12174210');
    expect(trail.graduation?.status).not.toBe('verified');
    const line={id:trail.id,verificationScope:'routeLine',
      sources:[{url:'https://example.test/official',reviewedAt:'2026-10-23'}],
      fields:{path:trail.path,distance:trail.distance,routeLineNote:'Rebuilt on OSM ways along the official GPX.'}};
    const result=publish(trail,{declared:[line]});
    expect(result.overrides.trails).toEqual([line]);
    expect(result.refused.map(r=>r.reason)).toEqual(['line-set-by-hand']);
  });
});
