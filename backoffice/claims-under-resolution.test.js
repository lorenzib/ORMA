const {buildVerificationReport}=require('./cli/report-verification-state.js');

// A trail in evidence-resolution retries each unresolved claim up to five times,
// and every attempt is a model call. Naming the claims is what makes that spend
// a decision rather than a surprise.
function storeWith(trails){
  return {getArtifact:async name=>name==='trail-orchestration'?{trails}:null,listJobs:async()=>[]};
}
const trail=(id,state,claimResolution)=>({trailId:id,candidateId:id,state,claimResolution});

describe('what the resolution lane is working on', () => {
  test('it names the claim, what it was, and how often it has been tried', async () => {
    const report=await buildVerificationReport({store:storeWith([
      trail('t1','evidence-resolution',{
        'logistics::route-number-sequence':{agentId:'logistics',claimId:'route-number-sequence',
          originalFinding:'unresolved',state:'researchable',attempts:[{jobId:'j1'},{jobId:'j2'}]},
      }),
    ])});
    expect(report.underResolution).toEqual([{trailId:'t1',claims:[
      {claim:'logistics/route-number-sequence',was:'unresolved',state:'researchable',attempts:2},
    ]}]);
  });

  test('claims are listed in a stable order', async () => {
    const report=await buildVerificationReport({store:storeWith([
      trail('t1','evidence-resolution',{
        b:{agentId:'terrainPoi',claimId:'water',originalFinding:'unresolved',state:'researchable',attempts:[]},
        a:{agentId:'logistics',claimId:'parking',originalFinding:'conflicted',state:'researchable',attempts:[]},
      }),
    ])});
    expect(report.underResolution[0].claims.map(entry=>entry.claim))
      .toEqual(['logistics/parking','terrainPoi/water']);
  });

  test('only trails actually in resolution are reported', async () => {
    const report=await buildVerificationReport({store:storeWith([
      trail('t1','evidence-research',{}),
      trail('t2','dossier-human-gate',{}),
    ])});
    expect(report.underResolution).toEqual([]);
  });

  test('a trail resolving nothing yet reports an empty list, not a crash', async () => {
    const report=await buildVerificationReport({store:storeWith([trail('t1','evidence-resolution',undefined)])});
    expect(report.underResolution).toEqual([{trailId:'t1',claims:[]}]);
  });
});
