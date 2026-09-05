'use strict';

const {runHazardVetting,hazardFromVetting,applyHazardVetting,expireCommunityHazards,
  UNVERIFIED_NOTICE,UNVERIFIED_LIFETIME_DAYS}=require('./workflows/community-hazard-vetting');
const {processCommunityHazardReports}=require('./workflows/run-live-backoffice-worker');

const AT='2026-09-05T10:00:00.000Z';
const report={id:'r1',trailId:'seceda',trailName:'Seceda Ridge Trail',area:'Val Gardena',
  category:'route-damage',description:'The footbridge below the ridge is washed out.',createdAt:AT};

const corroborated={verdict:'corroborated',plausible:true,severity:'severe',title:'Footbridge washed out below Seceda',
  message:'The footbridge is out and the crossing is impassable.',reasoning:'Comune notice confirms.',expectedDurationDays:14,
  sources:[{url:'https://comune.example/notice',publisher:'Comune di Ortisei',publishedOn:'2026-09-03',quote:'ponte chiuso'}]};
const uncorroborated={verdict:'uncorroborated',plausible:true,severity:'moderate',title:'Footbridge reported washed out',
  message:'A hiker reports the footbridge is out.',reasoning:'No published coverage found.',expectedDurationDays:null,sources:[]};

describe('customer hazard reports are vetted, not moderated',()=>{
  test('the analyst is given web search and the report, and returns a cited verdict',async()=>{
    const seen=[];
    const runAgent=async input=>{seen.push(input);return {data:corroborated};};
    const result=await runHazardVetting(report,{runAgent,at:AT});
    expect(seen[0].webSearch).toBe(true);
    expect(seen[0].messages[1].content).toContain('footbridge below the ridge is washed out');
    expect(result.verdict).toBe('corroborated');
    expect(result.publicMutationAllowed).toBe(false);
  });

  test('a corroborated report publishes as a confirmed hazard carrying its sources',()=>{
    const hazard=hazardFromVetting(report,corroborated,AT);
    expect(hazard).toEqual(expect.objectContaining({origin:'community',verificationState:'corroborated',severity:'severe',
      title:'Footbridge washed out below Seceda',removalRequiresHumanReview:false,trailIds:['seceda']}));
    expect(hazard.corroboration[0].publisher).toBe('Comune di Ortisei');
    expect(hazard.message).not.toContain(UNVERIFIED_NOTICE);
    expect(hazard.expiresAt).toBe('2026-09-19T10:00:00.000Z');
  });

  test('a plausible but uncorroborated report publishes labelled, and expires quickly',()=>{
    const hazard=hazardFromVetting(report,uncorroborated,AT);
    expect(hazard.verificationState).toBe('reported-unverified');
    expect(hazard.title.startsWith('Unconfirmed:')).toBe(true);
    expect(hazard.message).toContain(UNVERIFIED_NOTICE);
    expect(hazard.severity).toBe('moderate');
    const lifetimeDays=(new Date(hazard.expiresAt)-new Date(AT))/86400000;
    expect(lifetimeDays).toBe(UNVERIFIED_LIFETIME_DAYS);
  });

  test('a contradicted report, spam, or an implausible claim is never published',()=>{
    for(const vetting of [
      {...uncorroborated,verdict:'contradicted'},
      {...uncorroborated,verdict:'not-a-hazard'},
      {...uncorroborated,plausible:false},
    ]) expect(hazardFromVetting(report,vetting,AT)).toBeNull();
    const applied=applyHazardVetting({hazards:[]},report,{...uncorroborated,verdict:'not-a-hazard'},{at:AT});
    expect(applied.status).toBe('rejected');
    expect(applied.publicData.hazards).toHaveLength(0);
  });

  test('a corroborated verdict claiming no source is not treated as corroborated',()=>{
    expect(hazardFromVetting(report,{...corroborated,sources:[]},AT)).toBeNull();
  });

  test('re-vetting replaces the trail’s previous community hazard rather than stacking',()=>{
    const first=applyHazardVetting({hazards:[]},report,uncorroborated,{at:AT});
    const second=applyHazardVetting(first.publicData,report,corroborated,{at:AT});
    expect(second.publicData.hazards).toHaveLength(1);
    expect(second.publicData.hazards[0].verificationState).toBe('corroborated');
  });

  test('community hazards expire and re-check themselves without a human',()=>{
    const later='2026-09-20T10:00:00.000Z';
    const data={hazards:[
      {id:'community-r1',origin:'community',expiresAt:'2026-09-12T10:00:00.000Z',reportId:'r1'},
      {id:'community-r2',origin:'community',expiresAt:'2026-10-01T10:00:00.000Z',nextVettingAt:'2026-09-19T10:00:00.000Z',reportId:'r2'},
      {id:'source:a',sourceKey:'source'},
    ]};
    const result=expireCommunityHazards(data,{at:later});
    expect(result.expired.map(item=>item.id)).toEqual(['community-r1']);
    expect(result.dueForRevetting.map(item=>item.id)).toEqual(['community-r2']);
    expect(result.publicData.hazards.map(item=>item.id)).toEqual(['community-r2','source:a']);
  });
});

describe('the worker pass vets pending reports',()=>{
  function store(reports,hazards=[]){
    const artifacts=new Map([['dynamic-hazards',{contractVersion:'1.0.0',hazards}]]);const marked=[];
    return {artifacts,marked,
      getArtifact:async id=>artifacts.get(id)??null,
      setArtifact:async(id,value)=>{artifacts.set(id,value);},
      listHazardReports:async()=>reports,
      markHazardReport:async(id,status,fields)=>marked.push({id,status,...fields})};
  }

  test('publishes a corroborated report and records the outcome on the report',async()=>{
    const target=store([report]);
    const result=await processCommunityHazardReports(target,{at:AT,runAgent:async()=>({data:corroborated})});
    expect(result.vetted[0]).toEqual(expect.objectContaining({reportId:'r1',status:'published',verdict:'corroborated'}));
    expect(target.marked[0]).toEqual(expect.objectContaining({id:'r1',status:'published',sourceCount:1,hazardId:'community-r1'}));
    expect(target.artifacts.get('dynamic-hazards').hazards).toHaveLength(1);
  });

  test('a failing analyst leaves the hazard state untouched and the pass continues',async()=>{
    const target=store([report],[{id:'source:a',sourceKey:'source'}]);
    const result=await processCommunityHazardReports(target,{at:AT,runAgent:async()=>{throw new Error('search unavailable');}});
    expect(result.vetted[0].status).toBe('vetting-failed');
    expect(target.artifacts.get('dynamic-hazards').hazards).toHaveLength(1);
    expect(target.marked).toHaveLength(0);
  });
});
