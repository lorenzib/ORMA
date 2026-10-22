'use strict';

// OPERATING_STANDARD.md, "A reviewed trail is sent back for its safety
// research" (approved 22 October 2026).
//
// The fast lane sealed a trail's directions on the survey alone and nothing
// ever sent it to the specialists afterwards: eleven trails stood at five of
// eleven checks with no path to the seal. This lane sends a published reviewed
// trail back to the Ranger and the terrain analyst, safety questions only, and
// returns it to the gate with the survey that settled its directions.

const {SAFETY_RESEARCH_CONTRACT,SAFETY_SPECIALISTS,SAFETY_AGENTS,UNREAD_DOCUMENT_MARK,safetyResearchPrompt,
  planSafetyResearch,dispatchSafetyResearch,inSafetyResearch,unreadDocuments,dogsNotAccepted}=require('./workflows/safety-research-lane');
const {BASE_SPECIALISTS}=require('./workflows/apply-dossier-review');
const {SAFETY_CATEGORIES,SAFETY_CATEGORY_OF_CLAIM}=require('./workflows/compile-verified-dossier');
const {graduationFor,SAFETY_CHECKS}=require('./workflows/build-publication-staging');
const {advanceTrailOrchestration}=require('./workflows/advance-trail-orchestration');
const {buildTrailBoard}=require('./workflows/build-trail-board');
const {applyVerifiedTrailOverrides}=require('../scripts/verified-trail-overrides');

const AT='2026-10-22T09:00:00.000Z';
const FIVE=['photo','route','routeNumbers','mapPoints','elevation'];

const reviewedEntry=(id,generatedAt,completed=FIVE)=>({id,candidateId:id,generatedAt,verificationScope:'routeReviewed',
  fields:{ormaVerified:false,graduation:{status:'in-progress',required:[...FIVE,...SAFETY_CHECKS],completed}}});
const settledTrail=(id,extra={})=>({trailId:id,candidateId:id,trailName:id,state:'ready-for-editorial',
  stage:'verified-dossier-approved',verificationStatus:'orma-verified',attempts:{},jobIds:[`survey-${id}`],...extra});

describe('which trails the lane takes',()=>{
  test('a published reviewed trail short of a safety check, oldest-sealed first, two a pass',()=>{
    const orchestration={trails:['a','b','c'].map(id=>settledTrail(id))};
    const overrides={trails:[reviewedEntry('c','2026-10-20'),reviewedEntry('a','2026-10-18'),reviewedEntry('b','2026-10-19')]};
    const plan=planSafetyResearch(orchestration,overrides,{limit:2});
    expect(plan.map(item=>item.trailId)).toEqual(['a','b']);
    expect(plan[0].missing).toEqual([...SAFETY_CHECKS]);
  });

  test('never a sealed trail, a trail still in the route pipeline, or one already sent under this contract',()=>{
    const sealed={id:'sealed',fields:{ormaVerified:true}};
    const orchestration={trails:[
      settledTrail('sealed'),
      settledTrail('researching',{state:'evidence-research'}),
      settledTrail('sent',{safetyResearch:{contract:SAFETY_RESEARCH_CONTRACT}}),
      settledTrail('complete'),
    ]};
    const overrides={trails:[sealed,reviewedEntry('researching','2026-10-01'),reviewedEntry('sent','2026-10-01'),
      reviewedEntry('complete','2026-10-01',[...FIVE,...SAFETY_CHECKS])]};
    expect(planSafetyResearch(orchestration,overrides,{limit:5})).toEqual([]);
  });
});

describe('what it asks',()=>{
  test('only the two specialists the fast lane skipped, and never logistics or the survey',()=>{
    expect([...SAFETY_AGENTS]).toEqual(['regulatoryRanger','terrainPoi']);
    const asked=Object.fromEntries(BASE_SPECIALISTS.map(spec=>[spec.agentId,spec.claimIds]));
    expect(asked.logistics).toBeDefined();
    expect(SAFETY_AGENTS).not.toContain('logistics');
  });

  test('every safety category is answered by an id the lane asks',()=>{
    const ids=SAFETY_SPECIALISTS.flatMap(spec=>spec.claimIds);
    const covered=new Set(ids.map(id=>SAFETY_CATEGORY_OF_CLAIM[id]||id).filter(id=>SAFETY_CATEGORIES.includes(id)));
    expect([...covered].sort()).toEqual([...SAFETY_CATEGORIES].sort());
  });

  test('a dispatched trail goes back to research, flagged, with two lane jobs and nothing else changed',()=>{
    const orchestration={trails:[settledTrail('a'),settledTrail('b')]};
    const {orchestration:next,jobs}=dispatchSafetyResearch(orchestration,[{trailId:'a'}],AT);
    expect(jobs.map(job=>job.agentId)).toEqual(['regulatoryRanger','terrainPoi']);
    expect(jobs.every(job=>job.lane==='safety-research')).toBe(true);
    const a=next.trails.find(trail=>trail.trailId==='a');
    expect(a.state).toBe('evidence-research');
    expect(a.stage).toBe('safety-research');
    expect(a.safetyResearch).toMatchObject({contract:SAFETY_RESEARCH_CONTRACT,requestedAt:AT,returnTo:'ready-for-editorial'});
    expect(a.jobIds).toEqual(expect.arrayContaining(['survey-a',...jobs.map(job=>job.id)]));
    expect(inSafetyResearch(a)).toBe(true);
    expect(next.trails.find(trail=>trail.trailId==='b')).toEqual(settledTrail('b'));
    expect(orchestration.trails[0].state).toBe('ready-for-editorial');
  });

  test('the prompt tells the Ranger how to say dogs are banned, and both agents how to mark an unread document',()=>{
    const ranger=safetyResearchPrompt({lane:'safety-research',agentId:'regulatoryRanger'});
    expect(ranger).toMatch(/not-accepted/);
    expect(ranger).toContain(UNREAD_DOCUMENT_MARK);
    expect(safetyResearchPrompt({lane:'safety-research',agentId:'terrainPoi'})).toContain(UNREAD_DOCUMENT_MARK);
    expect(safetyResearchPrompt({agentId:'regulatoryRanger'})).toBe('');
  });
});

describe('back to the gate',()=>{
  function storeWith(orchestration,jobs,outputs){
    const artifacts=new Map([['trail-orchestration',orchestration],
      ['dossier-review-queue',{contractVersion:'1.0.0',items:[],publicMutationAllowed:false}],
      ...Object.entries(outputs).map(([id,result])=>[`trail-specialist-output-${id}`,result])]);
    return {artifacts,putJob:async()=>{},getJobsByIds:async()=>jobs,
      getArtifact:async id=>artifacts.get(id)||null,setArtifact:async(id,value)=>{artifacts.set(id,value);}};
  }
  const survey={id:'survey-a',candidateId:'a',agentId:'cartographer',status:'completed',createdAt:'2026-10-01T00:00:00Z'};
  const job=(agentId,createdAt,id=`${agentId}-new`)=>({id,candidateId:'a',agentId,status:'completed',createdAt,completedAt:createdAt});
  const claim=(id,category,rationale='Read the source.')=>({id,category,finding:'supported-proposal',proposedValue:'x',
    confidence:'high',rationale,sources:[{url:'https://example.org/rule',label:'rule'}],blockers:[]});

  test('with nothing left to resolve, opens the dossier gate with the survey and the new answers, not an older one',async()=>{
    // Past the resolution ladder: an unread document can still be unresolved
    // here, and it goes to the hand audit rather than being guessed.
    const trail={...settledTrail('a'),state:'evidence-resolution',stage:'autonomous-claim-resolution',claimResolution:{},
      jobIds:['survey-a','regulatoryRanger-old','regulatoryRanger-new','terrainPoi-new'],
      safetyResearch:{contract:SAFETY_RESEARCH_CONTRACT,requestedAt:'2026-10-22T08:00:00Z',returnTo:'ready-for-editorial',handAudit:[]}};
    const jobs=[survey,job('regulatoryRanger','2026-09-01T00:00:00Z','regulatoryRanger-old'),
      job('regulatoryRanger','2026-10-22T08:30:00Z'),job('terrainPoi','2026-10-22T08:31:00Z')];
    const store=storeWith({trails:[trail]},jobs,{
      'survey-a':{claims:[]},
      'regulatoryRanger-new':{claims:[claim('dog-access','access'),
        {...claim('leash-rules','access',`${UNREAD_DOCUMENT_MARK} the municipal regulation is a scanned PDF`),finding:'unresolved'}]},
      'terrainPoi-new':{claims:[claim('livestock','livestock')]},
    });
    await advanceTrailOrchestration(store,{at:AT,productionTrails:[]});
    const next=store.artifacts.get('trail-orchestration').trails[0];
    expect(next.state).toBe('dossier-human-gate');
    expect(next.stage).toBe('safety-research-dossier');
    const item=store.artifacts.get('dossier-review-queue').items.find(entry=>entry.candidateId==='a');
    expect(item.gateType).toBe('dossier-approval');
    expect(item.specialistOutputs.map(output=>output.jobId).sort()).toEqual(['regulatoryRanger-new','survey-a','terrainPoi-new']);
    expect(next.safetyResearch.handAudit).toEqual([{agentId:'regulatoryRanger',claimId:'leash-rules',category:'access',
      sources:['https://example.org/rule']}]);
  });

  test('straight from research when every answer is already settled',async()=>{
    const trail={...settledTrail('a'),state:'evidence-research',stage:'safety-research',
      jobIds:['survey-a','regulatoryRanger-new','terrainPoi-new'],
      safetyResearch:{contract:SAFETY_RESEARCH_CONTRACT,requestedAt:'2026-10-22T08:00:00Z',handAudit:[]}};
    const jobs=[survey,job('regulatoryRanger','2026-10-22T08:30:00Z'),job('terrainPoi','2026-10-22T08:31:00Z')];
    const store=storeWith({trails:[trail]},jobs,{'survey-a':{claims:[]},
      'regulatoryRanger-new':{claims:[claim('dog-access','access'),claim('leash-rules','access')]},
      'terrainPoi-new':{claims:[claim('livestock','livestock')]}});
    await advanceTrailOrchestration(store,{at:AT,productionTrails:[]});
    const next=store.artifacts.get('trail-orchestration').trails[0];
    expect(next.state).toBe('dossier-human-gate');
    expect(next.safetyResearch.handAudit).toEqual([]);
    // Never the Librarian or the red team: nothing was queued.
    expect(next.jobIds).toEqual(['survey-a','regulatoryRanger-new','terrainPoi-new']);
  });

  test('waits while either specialist has not answered since it was sent back',async()=>{
    const trail={...settledTrail('a'),state:'evidence-research',stage:'safety-research',
      jobIds:['survey-a','regulatoryRanger-old','terrainPoi-new'],
      safetyResearch:{contract:SAFETY_RESEARCH_CONTRACT,requestedAt:'2026-10-22T08:00:00Z',handAudit:[]}};
    const jobs=[survey,job('regulatoryRanger','2026-09-01T00:00:00Z','regulatoryRanger-old'),job('terrainPoi','2026-10-22T08:31:00Z')];
    const store=storeWith({trails:[trail]},jobs,{'survey-a':{claims:[]},'regulatoryRanger-old':{claims:[]},'terrainPoi-new':{claims:[]}});
    await advanceTrailOrchestration(store,{at:AT,productionTrails:[]});
    expect(store.artifacts.get('trail-orchestration').trails[0].state).toBe('evidence-research');
  });
});

describe('the three decisions',()=>{
  const fact=(claimId,rule,finding='supported-proposal')=>({claimId,rule,humanAcceptedFinding:finding,
    label:`access: ${claimId}`,value:'Dogs are prohibited in the reserve.',sourceIds:['s1']});

  test('1. a looked-and-unknown access or livestock completes the check but holds the seal, and says why',()=>{
    const graduation=graduationFor([...SAFETY_CHECKS],true,true,['access']);
    expect(graduation.status).toBe('in-progress');
    expect(graduation.completed).toEqual(expect.arrayContaining([...SAFETY_CHECKS]));
    expect(graduation.heldFor).toEqual(['livestock-unanswered']);
  });

  test('2. a settled finding that dogs are not allowed holds the seal and withdraws the walk',()=>{
    expect(dogsNotAccepted({lockedFacts:[fact('dog-access','not-accepted')]})).toHaveLength(1);
    expect(dogsNotAccepted({lockedFacts:[fact('protected-area-dog-policy','not-accepted')]})).toHaveLength(1);
    expect(dogsNotAccepted({lockedFacts:[fact('dog-access','not-accepted','unresolved')]})).toHaveLength(0);
    expect(dogsNotAccepted({lockedFacts:[fact('dog-access','not-applicable')]})).toHaveLength(0);
    const graduation=graduationFor([...SAFETY_CHECKS],true,true,['access','livestock'],{dogsNotAccepted:true});
    expect(graduation.status).toBe('in-progress');
    expect(graduation.heldFor).toEqual(['dogs-not-accepted']);
  });

  test('2. a complete graduation held back for a reason is a valid reviewed publication',()=>{
    const entry={id:'a',verificationScope:'routeReviewed',fields:{ormaVerified:false,
      routeNumberGuidance:{mode:'landmarks',start:'s',sequence:'q',switches:'w',
        establishedBy:{start:'orma-record',status:'orma-record',sequence:'orma-record',switches:'orma-record'}},
      graduation:{status:'in-progress',required:[...FIVE,...SAFETY_CHECKS],completed:[...FIVE,...SAFETY_CHECKS],heldFor:['dogs-not-accepted']},
      withdrawal:{reason:'dogs-not-accepted'}}};
    const [trail]=applyVerifiedTrailOverrides([{id:'a',name:'A'}],{trails:[entry]});
    expect(trail.withdrawal.reason).toBe('dogs-not-accepted');
    const unheld={...entry,fields:{...entry.fields,graduation:{...entry.fields.graduation,heldFor:undefined}}};
    expect(()=>applyVerifiedTrailOverrides([{id:'a'}],{trails:[unheld]})).toThrow();
  });

  test('2. a withdrawn walk is a draft, so it leaves the site by the path every held trail takes',()=>{
    const {adaptLegacyTrail}=require('../scripts/trail-adapter');
    const legacy={id:'osm-1',name:'Walk',lat:46,lng:11,distance:4,elevation:100,hours:'1.5',safetyLevel:'low-risk',
      path:[[46,11],[46.001,11.001],[46.002,11.002]]};
    expect(adaptLegacyTrail(legacy).record.lifecycle).toBe('published');
    const withdrawn=adaptLegacyTrail({...legacy,withdrawal:{reason:'dogs-not-accepted'}});
    expect(withdrawn.record.lifecycle).toBe('draft');
    expect(withdrawn.exclusionReasons.join(' ')).toMatch(/withdrawn pending review/);
  });

  test('3. a claim resting on a document nobody could read is listed for a hand audit, and nothing else is',()=>{
    const outputs=[
      {agentId:'regulatoryRanger',result:{claims:[{id:'dog-access',category:'access',rationale:`${UNREAD_DOCUMENT_MARK} scanned regulation`,
        sources:[{url:'https://example.org/scan.pdf'}]},{id:'leash-rules',category:'access',rationale:'Read it.'}]}},
      {agentId:'cartographer',result:{claims:[{id:'route-number-status',rationale:`${UNREAD_DOCUMENT_MARK} ignored`}]}},
    ];
    expect(unreadDocuments(outputs)).toEqual([{agentId:'regulatoryRanger',claimId:'dog-access',category:'access',
      sources:['https://example.org/scan.pdf']}]);
  });

  test('the board shows a hand audit and a withdrawal, and counts them',()=>{
    const board=buildTrailBoard({at:AT,slugs:{},
      trails:[{id:'a',name:'A'},{id:'b',name:'B',withdrawal:{reason:'dogs-not-accepted'}}],
      orchestration:{trails:[{...settledTrail('a'),safetyResearch:{contract:SAFETY_RESEARCH_CONTRACT,
        handAudit:[{claimId:'dog-access',sources:['https://example.org/scan.pdf']}]}},settledTrail('b')]}});
    const a=board.trails.find(entry=>entry.id==='a');const b=board.trails.find(entry=>entry.id==='b');
    expect(a.flag).toBe('audit');
    expect(a.audit).toEqual([{claimId:'dog-access',sources:['https://example.org/scan.pdf']}]);
    expect(b.flag).toBe('withdrawn');
    expect(b.next).toBe('Taken off the site pending review');
    expect(board.summary).toMatchObject({audit:1,withdrawn:1});
  });
});

describe('a trail verified by hand while the lane had it out',()=>{
  const {planStandDown,standDown}=require('./workflows/safety-research-lane');
  const {sendReviewedTrailsForSafetyResearch}=require('./workflows/run-live-backoffice-worker');
  const out=(id,extra={})=>({trailId:id,candidateId:id,state:'evidence-research',stage:'safety-research',
    jobIds:[`survey-${id}`,`${id}-ranger`,`${id}-terrain`],attempts:{},
    safetyResearch:{contract:SAFETY_RESEARCH_CONTRACT,requestedAt:'2026-10-22T09:35:00Z',returnTo:'ready-for-editorial',handAudit:[]},...extra});

  test('stands down: back where it was, and only a sealed trail',()=>{
    const orchestration={trails:[out('sealed'),out('open')]};
    const plan=planStandDown(orchestration,['sealed']);
    expect(plan.map(item=>item.trailId)).toEqual(['sealed']);
    const next=standDown(orchestration,plan,AT);
    expect(next.trails[0]).toMatchObject({state:'ready-for-editorial',stage:'safety-research-superseded-by-hand-audit'});
    expect(next.trails[0].safetyResearch.supersededAt).toBe(AT);
    expect(next.trails[1].state).toBe('evidence-research');
  });

  test('its queued lane jobs are retired before they spend anything, even with the lane switched off',async()=>{
    const jobs=new Map([
      ['sealed-ranger',{id:'sealed-ranger',status:'queued',lane:'safety-research'}],
      ['sealed-terrain',{id:'sealed-terrain',status:'running',lane:'safety-research'}],
      ['survey-sealed',{id:'survey-sealed',status:'completed'}],
    ]);
    const retired=[];const artifacts=new Map([['trail-orchestration',{trails:[out('sealed')]}]]);
    const store={getArtifact:async id=>artifacts.get(id)||null,setArtifact:async(id,value)=>{artifacts.set(id,value);},
      getJobsByIds:async ids=>ids.map(id=>jobs.get(id)).filter(Boolean),
      completeSystemJob:async(id,fields)=>{retired.push({id,...fields});},putJob:async()=>{}};
    const outcomes=await sendReviewedTrailsForSafetyResearch(store,{safetyResearchEnabled:false,now:new Date(AT),
      productionTrails:[{id:'sealed',ormaVerified:true}],verifiedOverrides:{trails:[]}});
    expect(outcomes).toEqual([{trailId:'sealed',candidateId:'sealed',status:'stood-down'}]);
    expect(retired.map(item=>item.id)).toEqual(['sealed-ranger']);
    expect(retired[0].retiredFrom).toBe('queued');
    expect(artifacts.get('trail-orchestration').trails[0].state).toBe('ready-for-editorial');
  });
});
