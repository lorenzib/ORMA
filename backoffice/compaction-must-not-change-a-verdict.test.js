'use strict';

const fs=require('fs');
const path=require('path');
const {DECIDING_FIELDS,BOUNDED_FIELDS,MAX_PREVIEW_POINTS,QUEUE_BUDGET,summariseOutput}
  =require('./workflows/review-queue-compaction');
const {MAX_ARTIFACT_BYTES}=require('./services/firestore-backoffice-store');
const {rehydrateItem}=require('./workflows/rehydrate-review-detail');
const {dossierBlockingReasons,compileVerifiedDossier}=require('./workflows/compile-verified-dossier');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {loadProductionTrails}=require('../scripts/load-production-trails');

const ROOT=path.resolve(__dirname,'..');
const AT='2026-10-18T10:00:00Z';

/**
 * Compaction keeps the queue under Firestore's 1 MB property ceiling. It was
 * also deciding verdicts: seven of the fourteen fields the gate reads off a
 * specialist result were dropped, so a walk whose directions the map and
 * ORMA's own record had already answered was refused the moment its queue item
 * was summarised -- for evidence that was never research, but a measurement the
 * cartographer had made and written down.
 */

/**
 * A claim's sources and its evidence are the bulky part and the reason the
 * pointer exists. They are fetched from the output's own document before an
 * approval, which is what `rehydrateItem` is for.
 */
const REHYDRATE_ONLY=Object.freeze({
  claims:'a claim keeps its id, category, finding and value; its sources and evidence are the bulky part and are fetched through the pointer',
  geometry:'simplified to a sketch; the full line is fetched through the pointer',
  detailWithheld:'the flag that says this is a summary',
});

describe('compaction may drop what is bulky, not what decides',()=>{
  // Read off the gate itself. A new `result.something` in the gate fails this
  // until somebody decides which side of the line it is on, which is the whole
  // point: the list of deciding fields was my reading of the code, and a
  // reading goes stale the next time the code changes.
  test('every field the gate reads is kept, or named as fetched through the pointer',()=>{
    const gate=fs.readFileSync(path.join(__dirname,'workflows/compile-verified-dossier.js'),'utf8');
    const read=[...new Set([...gate.matchAll(/\bresult\??\.([a-zA-Z][a-zA-Z0-9]*)/g)].map(match=>match[1]))];
    expect(read.length).toBeGreaterThan(10);
    const kept=[...DECIDING_FIELDS,...BOUNDED_FIELDS];
    const unaccounted=read.filter(field=>
      !kept.includes(field)&&!Object.hasOwn(REHYDRATE_ONLY,field));
    expect(unaccounted).toEqual([]);
  });

  test('and nothing is on both lists',()=>{
    const kept=[...DECIDING_FIELDS,...BOUNDED_FIELDS];
    expect(kept.filter(field=>Object.hasOwn(REHYDRATE_ONLY,field))).toEqual([]);
    expect(DECIDING_FIELDS.filter(field=>BOUNDED_FIELDS.includes(field))).toEqual([]);
  });

  // An open question blocks a trail. Dropping it made a blocked trail read as
  // an unblocked one, which is the worse way for a gate to be wrong.
  test('a list that blocks survives, bounded, and still blocks',()=>{
    const long=Array.from({length:40},(_, index)=>`question ${index} ${'x'.repeat(500)}`);
    const summarised=summariseOutput({agentId:'logistics',jobId:'j1',
      result:{openQuestions:long,claims:[]}});
    const reasons=dossierBlockingReasons([summarised],{}).map(String);
    expect(reasons.filter(reason=>/open question/.test(reason)).length).toBeGreaterThan(0);
    expect(summarised.result.openQuestions.length).toBeLessThan(long.length);
    expect(summarised.result.openQuestions.at(-1)).toMatch(/and 28 more, in the full agent output/);
    expect(Math.max(...summarised.result.openQuestions.map(entry=>entry.length))).toBeLessThanOrEqual(300);
  });
});

// The three shapes a geometry survey comes in, from the cartographer's own
// producer rather than typed out: a walk with its own number, a walk measured
// and found to carry none, and a walk nobody could measure.
function surveys(){
  const trail=loadProductionTrails(ROOT).find(record=>record.id==='osm-11839597');
  if(!trail)throw new Error('osm-11839597 left the catalogue; pick another surveyed trail');
  const base={
    relation:{tags:{ref:'20',name:trail.name}},
    source:{url:'https://www.openstreetmap.org/relation/11839597',externalId:'relation/11839597',
      endpoint:'https://api.openstreetmap.org/x',relationVersion:3,
      relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
    geometry:{type:'LineString',coordinates:trail.path.map(point=>[point[1],point[0]])},
    assessment:{issues:[],pointCount:trail.path.length,distanceKm:trail.distance},
    trailRecord:{id:trail.id,name:trail.name,startPoint:trail.startPoint,routeRefs:trail.routeRefs||[]},
    claims:[]};
  return {trail:{...trail,candidateId:trail.id,trailId:trail.id,trailName:trail.name},shapes:{
    'its own number':{...base,routeGuidance:singleRelationGuidance({tags:{ref:'20'}})},
    'measured and carrying none':{...base,relation:{tags:{name:trail.name}},routeNumbersAbsent:true},
    'never measured':{...base,relation:{tags:{name:trail.name}},
      routeNumbersUnmeasured:'the corridor fetch failed'},
  }};
}

function verdict(outputs,trail){
  const review={reviewId:'r',candidateId:trail.candidateId,trailId:trail.trailId,
    approvalAllowed:true,blockingReasons:[],specialistOutputs:outputs};
  let compiled='refused';
  try{compileVerifiedDossier(review,trail,{at:AT,trail});compiled='compiled';}catch(error){compiled=error.message;}
  return {blockers:dossierBlockingReasons(outputs,{trail}).map(reason=>reason.id).sort(),compiled};
}

describe('a summarised survey reaches the same verdict as the record',()=>{
  const {trail,shapes}=surveys();

  for(const [shape,result] of Object.entries(shapes)){
    test(`a walk with ${shape}`,()=>{
      const full=[{agentId:'cartographer',jobId:'c1',result}];
      const summarised=[summariseOutput(full[0])];
      expect({shape,...verdict(summarised,trail)}).toEqual({shape,...verdict(full,trail)});
    });
  }

  // The failure this is really about: the three shapes must still be told
  // apart after compaction. A walk measured and found to carry no number can
  // be answered from ORMA's record; a walk nobody measured cannot, and the two
  // read alike the moment the marks are dropped.
  test('and the three shapes are still told apart',()=>{
    const verdicts=Object.entries(shapes).map(([shape,result])=>
      [shape,verdict([summariseOutput({agentId:'cartographer',jobId:'c1',result})],trail).compiled]);
    expect(verdicts.find(([shape])=>shape==='its own number')[1]).toBe('compiled');
    expect(verdicts.find(([shape])=>shape==='measured and carrying none')[1]).toBe('compiled');
    expect(verdicts.find(([shape])=>shape==='never measured')[1]).toMatch(/requires sourced route guidance/);
  });

  // Before this, the same survey decided differently depending on whether the
  // artifact behind the pointer could be read -- so a verdict depended on a
  // Firestore read that an approval should not have needed at all.
  test('and does not depend on the pointer being followed',async()=>{
    const result=shapes['its own number'];
    const summarised=summariseOutput({agentId:'cartographer',jobId:'c1',result});
    const gone={async getArtifact(){return null;}};
    const item=await rehydrateItem(gone,{reviewId:'r',specialistOutputs:[summarised]});
    expect(verdict(item.specialistOutputs,trail))
      .toEqual(verdict([{agentId:'cartographer',jobId:'c1',result}],trail));
  });

  // The ceiling is the reason compaction exists, and keeping the deciding
  // fields costs about a kilobyte an item. This is the headroom that buys:
  // every trail in the catalogue waiting at the gate at once, which has never
  // happened. Each item costs about 2.6 KB at worst. Until 30 October 2026 the
  // queue was one Firestore property and held about 400 of them; the catalogue
  // passed that at 406 trails, and the queue was split instead of the test
  // loosened: the store now writes it in pieces across documents, and the
  // queue's own budget is the bound. When this fails again, raise the budget
  // only if the store still has room for it; otherwise the queue needs a
  // different shape, not a looser test.
  test('the whole catalogue could wait at the gate at once',()=>{
    const trails=loadProductionTrails(ROOT).filter(record=>Array.isArray(record.path));
    const longest=[...trails].sort((a,b)=>b.path.length-a.path.length)[0];
    const result={...surveys().shapes['its own number'],
      geometry:{type:'LineString',coordinates:longest.path.map(point=>[point[1],point[0]])}};
    const worst=JSON.stringify(summariseOutput({agentId:'cartographer',jobId:'c1',result})).length;
    expect(worst*trails.length).toBeLessThan(QUEUE_BUDGET);
    // And the budget itself fits the store with room to spare.
    expect(QUEUE_BUDGET).toBeLessThan(MAX_ARTIFACT_BYTES/2);
  });

  // The ceiling is the reason compaction exists, so the saving has to survive.
  // Measured on the catalogue's longest line rather than on a short fixture:
  // geometry is 92% of a cartographer output and the preview keeps 80 points,
  // so the saving is a property of a real route, and on a route shorter than
  // the preview the summary has always cost a few bytes more than it saves.
  test('the saving is still the saving on a real route',()=>{
    const longest=loadProductionTrails(ROOT)
      .filter(record=>Array.isArray(record.path))
      .sort((a,b)=>b.path.length-a.path.length)[0];
    expect(longest.path.length).toBeGreaterThan(MAX_PREVIEW_POINTS*2);
    const result={...shapes['its own number'],
      geometry:{type:'LineString',coordinates:longest.path.map(point=>[point[1],point[0]])}};
    const output={agentId:'cartographer',jobId:'c1',result};
    const full=JSON.stringify(output).length;
    const summarised=JSON.stringify(summariseOutput(output)).length;
    expect(summarised).toBeLessThan(full/4);
  });
});

describe('a refusal says which problem it is',()=>{
  const summary=()=>({agentId:'logistics',jobId:'j1',
    resultRef:'firestore:trail-specialist-output-j1',
    result:{detailWithheld:true,claims:[
      {id:'recommended-start',category:'logistics',finding:'supported-proposal',
        proposedValue:'Start at the car park.'}]}});

  const reasons=outputs=>dossierBlockingReasons(outputs,{}).map(reason=>String(reason.id||reason));

  test('evidence that cannot be read back is named as that, not as missing research',async()=>{
    const gone={async getArtifact(){return null;}};
    const item=await rehydrateItem(gone,{reviewId:'r',specialistOutputs:[summary()]});
    expect(item.specialistOutputs[0].detailUnreadable).toBe('no artifact at trail-specialist-output-j1');
    expect(reasons(item.specialistOutputs).filter(reason=>/could not be read back/.test(reason)))
      .toEqual(['logistics: evidence could not be read back — no artifact at trail-specialist-output-j1']);
  });

  test('so is a summary with no pointer at all',async()=>{
    const {resultRef,...orphan}=summary();
    const item=await rehydrateItem({async getArtifact(){return null;}},
      {reviewId:'r',specialistOutputs:[orphan]});
    expect(item.specialistOutputs[0].detailUnreadable)
      .toBe('the summary carries no pointer to its evidence');
  });

  test('and a pointer that is followed leaves no such blocker',async()=>{
    const store={async getArtifact(){return {claims:[{id:'recommended-start',category:'logistics',
      finding:'supported-proposal',proposedValue:'Start at the car park.',
      sources:[{url:'https://example.test/route',reviewedAt:'2026-10-01'}]}]};}};
    const item=await rehydrateItem(store,{reviewId:'r',specialistOutputs:[summary()]});
    expect(item.specialistOutputs[0].detailUnreadable).toBeUndefined();
    expect(reasons(item.specialistOutputs).filter(reason=>/could not be read back/.test(reason))).toEqual([]);
  });
});
