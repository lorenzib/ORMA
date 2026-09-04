'use strict';

const {buildVerifiedEditorialHandoff}=require('./workflows/verified-editorial-handoff');
const {runVerifiedEditorialFirstPass}=require('./workflows/run-verified-editorial-first-pass');
const {ingestDossierReviews,processEditorialFirstPassJobs}=require('./workflows/run-live-backoffice-worker');
const {assertVerifiedTrailReviewDecisions}=require('./workflows/apply-content-review');
const {buildPublicationStaging}=require('./workflows/build-publication-staging');

const at='2026-08-20T01:00:00.000Z';
const dossier={contractVersion:'1.0.0',candidateId:'trail-a',trailId:'trail-a',trailName:'Trail A',reviewState:'accepted',
  sources:[{id:'source-1',label:'Park authority',url:'https://example.test/trail',authority:'Park',accessedAt:at}],
  claims:[{id:'route-identity',label:'Approved route identity',state:'supported',proposedValue:'Trail A circuit',sourceIds:['source-1']},
    {id:'logistics-parking',label:'parking: parking',state:'supported',proposedValue:'Use official P1.',sourceIds:['source-1']},
    {id:'logistics-recommended-start',label:'access: recommended-start',state:'supported',proposedValue:'Start at the official trailhead, 46.0000, 11.0000.',sourceIds:['source-1']},
    {id:'logistics-route-number-status',label:'route: route-number-status',state:'supported',proposedValue:'Named-only route; no numbered reference applies.',sourceIds:['source-1']},
    {id:'logistics-route-number-sequence',label:'route: route-number-sequence',state:'supported',proposedValue:'Start on the signed Trail A circuit; no numbered sequence applies.',sourceIds:['source-1']},
    {id:'logistics-route-number-switches',label:'route: route-number-switches',state:'supported',proposedValue:'No numbered switch is required.',sourceIds:['source-1']}],
  routeGeometry:{type:'LineString',coordinates:[[11,46],[11.01,46.01],[11,46]]},
  ormaVerification:{status:'verified',verifiedAt:at,verifiedBy:'moderator',conditions:['Recheck seasonal access.']},
  publicMutationAllowed:false,publicationAuthorized:false};
const record={candidateId:'trail-a',trailName:'Trail A',verifiedAt:at,conditions:['Recheck seasonal access.']};

function copyPayload(item){return {factIdsUsed:item.lockedFacts.map(fact=>fact.id),auditSummary:'Every sentence maps to locked facts.',result:{
  title:'Trail A circuit',summary:'Locked-fact first pass.',changes:item.editorialBrief.requiredSections.map(section=>({section,before:'No verified editorial draft.',after:`Verified ${section.toLowerCase()} copy.`,reason:'Uses locked facts.'})),
  sources:[{label:'Locked ORMA dossier',url:item.dossierRef,checkedAt:'2026-08-20',supports:'All factual statements'}],openQuestions:[],
}};}

describe('automatic ORMA Verified editorial handoff',()=>{
  test('creates idempotent trail-only Copywriter and Visual Director jobs behind separate human gates',()=>{
    const first=buildVerifiedEditorialHandoff(dossier,record,null,{at});
    expect(first.jobs.map(job=>job.agentId)).toEqual(['copywriter','visualDirector']);
    expect(first.jobs.every(job=>job.jobType==='verified-trail-editorial-first-pass'&&job.publicMutationAllowed===false)).toBe(true);
    expect(first.jobs.map(job=>job.humanGate)).toEqual(['editorial-approval','asset-and-licensing-approval']);
    expect(first.jobs.some(job=>String(job.id).startsWith('guide-'))).toBe(false);
    const repeated=buildVerifiedEditorialHandoff(dossier,record,first.queue,{at:'2026-08-20T01:01:00.000Z'});
    expect(repeated.queue.items).toHaveLength(1);expect(repeated.queue.jobs).toHaveLength(2);
  });

  test('Copywriter first pass stays inside locked facts and returns exactly three review sections',async()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,record,null,{at});const job=handoff.jobs[0];
    const result=await runVerifiedEditorialFirstPass({job,item:handoff.item,dossier},{at,env:{},runAgent:async input=>{
      expect(input.webSearch).toBe(false);return {responseId:'copy-response',model:'test-model',data:copyPayload(handoff.item)};
    }});
    expect(result.output).toEqual(expect.objectContaining({jobId:'verified-trail-a-copy',agentId:'copywriter',status:'ready-for-review',candidateId:'trail-a'}));
    expect(result.output.result.changes.map(change=>change.section)).toEqual(handoff.item.editorialBrief.requiredSections);
  });

  test('numbered-route copy must cite the locked recommended starting point',async()=>{
    const numbered={...dossier,claims:dossier.claims.map(claim=>claim.id==='logistics-recommended-start'
      ?{...claim,proposedValue:'Start at Rifugio Example, 46.0000, 11.0000.'}:claim)};
    const handoff=buildVerifiedEditorialHandoff(numbered,record,null,{at});const job=handoff.jobs[0];
    expect(handoff.item.editorialBrief.requiredStartFactId).toBe('logistics-recommended-start');
    const payload=copyPayload(handoff.item);payload.factIdsUsed=payload.factIdsUsed.filter(id=>id!=='logistics-recommended-start');
    await expect(runVerifiedEditorialFirstPass({job,item:handoff.item,dossier:numbered},{at,env:{},runAgent:async()=>({responseId:'copy-response',model:'test-model',data:payload})}))
      .rejects.toThrow('must use recommended start fact');
  });

  test('Visual Director cannot mark an incompletely licensed image ready',async()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,record,null,{at});const job=handoff.jobs[1];
    await expect(runVerifiedEditorialFirstPass({job,item:handoff.item,dossier},{at,env:{},runAgent:async()=>({responseId:'visual-response',model:'test-model',data:{
      factIdsUsed:['route-identity'],auditSummary:'Candidate is incomplete.',result:{searchSummary:'One candidate.',coverageGaps:[],candidates:[{
        title:'Trail A',sourcePageUrl:'https://example.test/photo',assetUrl:'',creator:'Creator',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',credit:'Creator',matchEvidence:'Location match.',altText:'Trail A.',status:'ready',
      }]},
    }})})).rejects.toThrow('incompletely licensed');
  });

  test('Visual Director may return a blocked candidate with a concrete owned-photo checklist',async()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,record,null,{at});const job=handoff.jobs[1];
    const result=await runVerifiedEditorialFirstPass({job,item:handoff.item,dossier},{at,env:{},runAgent:async input=>{
      expect(input.webSearch).toBe(true);return {responseId:'visual-blocked',model:'test-model',data:{factIdsUsed:['route-identity'],auditSummary:'No reusable asset proved.',result:{searchSummary:'No licensable trail-specific candidate.',candidates:[{title:'Unlicensed candidate',sourcePageUrl:'',assetUrl:'',creator:'',license:'',licenseUrl:'',credit:'',matchEvidence:'Location could not be proved.',altText:'',status:'blocked'}],coverageGaps:['Photograph the route overview and trailhead sign.']}}};
    }});
    expect(result.output.status).toBe('ready-for-review');
    expect(result.output.result).toEqual(expect.objectContaining({coverageGaps:['Photograph the route overview and trailhead sign.']}));
  });

  test('human approval stays locked when the Visual Director has no ready licensed asset',()=>{
    const execution={outputs:[{jobId:'verified-trail-a-visual',agentId:'visualDirector',status:'ready-for-review',result:{candidates:[{status:'blocked'}]}}]};
    expect(()=>assertVerifiedTrailReviewDecisions(execution,[{jobId:'verified-trail-a-visual',action:'approve'}]))
      .toThrow('exactly one fully licensed ready image');
  });

  test('an unmapped future trail keeps approved content but blocks release mapping truthfully',()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,record,null,{at});const copy=copyPayload(handoff.item).result;
    const visual={searchSummary:'Licensed.',coverageGaps:[],candidates:[{title:'Trail A',sourcePageUrl:'https://example.test/photo',assetUrl:'https://example.test/photo.jpg',creator:'Creator',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',credit:'Creator',matchEvidence:'Location.',altText:'Trail A.',status:'ready'}]};
    const staging=buildPublicationStaging(handoff.queue,{outputs:[{jobId:'verified-trail-a-copy',candidateId:'trail-a',agentId:'copywriter',result:copy},{jobId:'verified-trail-a-visual',candidateId:'trail-a',agentId:'visualDirector',result:visual}]},{submissions:[{submissionId:'review-a',decisions:[{jobId:'verified-trail-a-copy',action:'approve'},{jobId:'verified-trail-a-visual',action:'approve'}]}]},{at});
    expect(staging.items[0]).toEqual(expect.objectContaining({state:'waiting-publication-mapping',missingApprovals:[],publicationMappingBlockers:['structured-website-fields'],proposedWebsiteFields:null}));
  });

  test('live worker writes a first-pass proposal into protected execution and returns it for human review',async()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,record,null,{at});const pending=handoff.jobs[0];let execution=null;const completed=[];
    const store={listJobs:async()=>[pending],claimJob:async()=>pending,getArtifact:async id=>id==='verified-trail-editorial-queue'?handoff.queue:id==='verified-dossier-trail-a'?dossier:execution,
      setArtifact:async(id,value)=>{if(id==='verified-trail-editorial-execution')execution=value;},completeJob:async(id,fields)=>completed.push({id,fields}),failJob:async()=>{}};
    const outcomes=await processEditorialFirstPassJobs(store,{at,env:{},runAgent:async()=>({responseId:'copy-response',model:'test-model',data:copyPayload(handoff.item)})});
    expect(outcomes).toEqual([expect.objectContaining({jobId:pending.id,status:'ready-for-review'})]);
    expect(execution.outputs).toEqual([expect.objectContaining({jobId:pending.jobId,status:'ready-for-review'})]);
    expect(completed).toEqual([expect.objectContaining({id:pending.id})]);
  });

  test('final dossier approval automatically persists the editorial queue and both first-pass jobs',async()=>{
    const routeSource={label:'Park authority',url:'https://example.test/trail',authority:'Park',accessedAt:at};
    const routeGuidance=[
      {id:'recommended-start',category:'access',proposedValue:'Start at the official trailhead, 46.0000, 11.0000.',finding:'supported-proposal',confidence:.95,rationale:'Official route guide.',sources:[routeSource],blockers:[]},
      {id:'route-number-status',category:'route',proposedValue:'Named route; no numbered reference applies.',finding:'supported-proposal',confidence:.95,rationale:'Official route guide.',sources:[routeSource],blockers:[]},
      {id:'route-number-sequence',category:'route',proposedValue:'No numbered sequence applies.',finding:'supported-proposal',confidence:.95,rationale:'Official route guide.',sources:[routeSource],blockers:[]},
      {id:'route-number-switches',category:'route',proposedValue:'No numbered switch is required.',finding:'supported-proposal',confidence:.95,rationale:'Official route guide.',sources:[routeSource],blockers:[]},
    ];
    const reviewItem={reviewId:'dossier-review-a',candidateId:'trail-a',trailId:'trail-a',trailName:'Trail A',gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:true,
      sourceTrail:{externalRelationId:'relation/1'},specialistOutputs:[
        {agentId:'cartographer',jobId:'cart-a',result:{source:{provider:'OSM',url:'https://www.openstreetmap.org/relation/1',endpoint:'https://api.openstreetmap.org/api/0.6/relation/1/full',externalId:'relation/1',relationVersion:1,relationTimestamp:at,licence:'ODbL-1.0'},relation:{tags:{name:'Trail A'}},geometry:dossier.routeGeometry,assessment:{pointCount:3,distanceKm:2}}},
        {agentId:'logistics',jobId:'log-a',result:{claims:[{id:'parking',category:'parking',proposedValue:'Use official P1.',finding:'supported-proposal',confidence:.9,rationale:'Official.',sources:[{label:'Park authority',url:'https://example.test/trail',authority:'Park',accessedAt:at}],blockers:[]},...routeGuidance] }},
      ]};
    const artifacts={'trail-orchestration':{contractVersion:'1.0.0',publicMutationAllowed:false,summary:{},trails:[{trailId:'trail-a',candidateId:'trail-a',trailName:'Trail A',state:'dossier-human-gate',stage:'complete-evidence-dossier',attempts:{},resolutionAttempts:{},jobIds:['cart-a','log-a'],gate:{id:'dossier-approval',status:'awaiting-human'},sourceTrail:{externalRelationId:'relation/1'},publicMutationAllowed:false}]},
      'dossier-review-queue':{contractVersion:'1.0.0',items:[reviewItem],publicMutationAllowed:false}};
    const queued=[];const marks=[];const store={listDossierReviews:async()=>[{id:'approval-a',reviewId:'dossier-review-a',candidateId:'trail-a',action:'approve',submittedAt:at,submittedBy:'moderator'}],
      getArtifact:async id=>artifacts[id]||null,setArtifact:async(id,value)=>{artifacts[id]=value;},putJobIfAbsent:async job=>{queued.push(job);return true;},
      putJob:async job=>queued.push(job),markDossierReview:async(id,status,fields)=>marks.push({id,status,fields})};
    const outcomes=await ingestDossierReviews(store);
    expect(outcomes).toEqual([expect.objectContaining({status:'processed',queuedJobs:2,ormaVerified:true})]);
    expect(queued.map(job=>job.agentId)).toEqual(['copywriter','visualDirector']);
    expect(artifacts['verified-trail-editorial-queue'].items).toEqual([expect.objectContaining({candidateId:'trail-a',dossierArtifactRef:'firestore:verified-dossier-trail-a'})]);
    expect(artifacts['route-proposal-trail-a']).toEqual(expect.objectContaining({candidateId:'trail-a',geometry:dossier.routeGeometry,publicMutationAllowed:false}));
    expect(marks[0].fields.queuedJobIds).toHaveLength(2);
  });
});
