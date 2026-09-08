const {buildVerificationReport}=require('./cli/report-verification-state.js');

// The gate says "supported authoritative route guidance is required" and never
// which of the three conditions failed. This mirrors supportedLogisticsClaim so
// the report answers that, rather than restating that something is missing.
function storeWith(claims,extra={}){
  const item={state:'awaiting-human',gateType:'dossier-approval',trailId:'t1',approvalAllowed:false,
    specialistOutputs:[{agentId:'logistics',result:{recommendation:'advance',openQuestions:[],claims,...extra}}]};
  return {getArtifact:async name=>name==='dossier-review-queue'?{items:[item]}:null,
    listJobs:async()=>[]};
}
const claim=over=>({id:'route-number-status',category:'route',proposedValue:'Landmark-led',
  finding:'supported-proposal',confidence:1,rationale:'',blockers:[],
  sources:[{label:'x',url:'https://example.org/a',authority:'municipality',accessedAt:'2026-09-01'}],...over});

async function diagnose(claims,extra){
  const report=await buildVerificationReport({store:storeWith(claims,extra)});
  return report.routeGuidance[0];
}

describe('why the route-guidance gate refuses', () => {
  test('a claim meeting all three conditions passes', async () => {
    const found=(await diagnose([claim()])).claims.find(entry=>entry.id==='route-number-status');
    expect(found).toMatchObject({present:true,passes:true,finding:'supported-proposal',hasValue:true});
  });

  test('it distinguishes a missing claim from a failing one', async () => {
    const result=await diagnose([claim()]);
    expect(result.claims.find(entry=>entry.id==='route-number-sequence')).toEqual({id:'route-number-sequence',present:false});
  });

  test.each([
    ['an unresolved finding',{finding:'unresolved'}],
    ['an empty value',{proposedValue:'   '}],
    ['a source with no authority',{sources:[{url:'https://example.org/a',authority:'  ',label:'x',accessedAt:'x'}]}],
    ['a non-https source',{sources:[{url:'http://example.org/a',authority:'municipality',label:'x',accessedAt:'x'}]}],
    ['no sources at all',{sources:[]}],
  ])('%s is reported as not passing', async (_label,over) => {
    const found=(await diagnose([claim(over)])).claims.find(entry=>entry.id==='route-number-status');
    expect(found.passes).toBe(false);
  });

  test('the agent’s own open questions and recommendation come back', async () => {
    const result=await diagnose([claim()],{recommendation:'needs-resolution',openQuestions:['Which car park is official?']});
    expect(result.recommendation).toBe('needs-resolution');
    expect(result.openQuestions).toEqual(['Which car park is official?']);
    expect(result.logisticsRan).toBe(true);
  });

  test('a trail whose logistics never ran says so, rather than looking refused', async () => {
    const store={getArtifact:async name=>name==='dossier-review-queue'
      ?{items:[{state:'awaiting-human',gateType:'dossier-approval',trailId:'t2',specialistOutputs:[]}]}:null,
      listJobs:async()=>[]};
    const [result]=(await buildVerificationReport({store})).routeGuidance;
    expect(result.logisticsRan).toBe(false);
    expect(result.claims.every(entry=>entry.present===false)).toBe(true);
  });
});
