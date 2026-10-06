'use strict';

const {routeGuidanceDiagnosis}=require('./cli/report-verification-state');
const {routeGuidanceBlockingReasons}=require('./workflows/compile-verified-dossier');

const sourced=url=>[{url,authority:'Comune di Example',label:'Official guide'}];
const claim=(id,over={})=>({id,category:'logistics',finding:'supported-proposal',
  proposedValue:`value for ${id}`,sources:sourced(`https://comune.example/${id}`),blockers:[],...over});
const logistics=(claims,over={})=>({agentId:'logistics',jobId:'j1',
  result:{recommendation:'advance',openQuestions:[],claims,...over}});
const item=(outputs,over={})=>({trailId:'osm-1',gateType:'dossier-approval',state:'awaiting-human',
  specialistOutputs:outputs,blockingReasons:[],...over});

describe('a diagnosis of a gate has to agree with the gate',()=>{
  test('a claim settled in a later pass is not reported as missing evidence',()=>{
    // The 6 October bug: the diagnosis read only the FIRST logistics output and
    // called every claim unsourced on all seven dossiers, while the gate --
    // which searches every output -- found them fine and listed no
    // route-guidance blocker at all.
    const first=logistics([claim('recommended-start',{sources:[]})],{recommendation:'needs-resolution'});
    const revised=logistics([claim('recommended-start')]);
    const review=item([first,revised]);

    // The gate is satisfied, so the diagnosis must say so too.
    expect(routeGuidanceBlockingReasons(review.specialistOutputs)).toEqual([]);
    const [diagnosed]=routeGuidanceDiagnosis([review]);
    const start=diagnosed.claims.find(entry=>entry.id==='recommended-start');
    expect(start.passes).toBe(true);
    expect(start.sources).toHaveLength(1);
  });

  test('the standing recommendation is the newest, not the first',()=>{
    const review=item([
      logistics([claim('recommended-start')],{recommendation:'needs-resolution'}),
      logistics([claim('recommended-start')],{recommendation:'advance'}),
    ]);
    const [diagnosed]=routeGuidanceDiagnosis([review]);
    expect(diagnosed.recommendation).toBe('advance');
    expect(diagnosed.logisticsOutputCount).toBe(2);
  });

  test('a genuinely unsourced start still fails, and matches the gate',()=>{
    const review=item([logistics([claim('recommended-start',{sources:[]})])]);
    const [diagnosed]=routeGuidanceDiagnosis([review]);
    expect(diagnosed.claims.find(entry=>entry.id==='recommended-start').passes).toBe(false);
    expect(routeGuidanceBlockingReasons(review.specialistOutputs))
      .toEqual(['logistics/recommended-start: a sourced recommended start is required']);
  });

  test('only the start is reported as blocking verification',()=>{
    // #472 moved the numbered-route claims out of the gate. Reporting them as
    // blockers sends a reader hunting for a route sheet that stopped mattering.
    const review=item([logistics([claim('recommended-start')])]);
    const [diagnosed]=routeGuidanceDiagnosis([review]);
    const blocking=diagnosed.claims.filter(entry=>entry.blocksVerification).map(entry=>entry.id);
    expect(blocking).toEqual(['recommended-start']);
    const optional=diagnosed.claims.filter(entry=>!entry.blocksVerification);
    expect(optional.map(entry=>entry.id)).toEqual(['route-number-status','route-number-sequence','route-number-switches']);
    expect(optional.every(entry=>entry.passes===false)).toBe(true);
  });

  test('a summarised queue item says its sources were withheld, not absent',()=>{
    // Compaction strips sources on purpose and leaves a pointer. Calling that a
    // claim without evidence invents a failure out of a storage decision.
    const stripped={agentId:'logistics',jobId:'j1',resultRef:'firestore:trail-specialist-output-j1',
      result:{recommendation:'advance',detailWithheld:true,
        claims:[{id:'recommended-start',category:'logistics',finding:'supported-proposal',proposedValue:'Start here'}]}};
    const [diagnosed]=routeGuidanceDiagnosis([item([stripped])]);
    expect(diagnosed.detailWithheld).toBe(true);
    expect(diagnosed.claims.find(entry=>entry.id==='recommended-start').sourcesWithheld).toBe(true);
  });

  test('the gate’s own reasons travel beside the rows',()=>{
    const review=item([logistics([claim('recommended-start')])],
      {blockingReasons:['regulatoryRanger: recommendation is needs-resolution']});
    expect(routeGuidanceDiagnosis([review])[0].gateBlockingReasons)
      .toEqual(['regulatoryRanger: recommendation is needs-resolution']);
  });

  test('items at other gates are left out',()=>{
    expect(routeGuidanceDiagnosis([item([logistics([])],{gateType:'geometry-approval'})])).toEqual([]);
  });
});
