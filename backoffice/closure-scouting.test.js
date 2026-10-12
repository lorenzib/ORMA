'use strict';

const {reviewNotices,prompt,ballot,scoutAreaClosures,hazardReportsFromNotices,
  nextAreasToScout,mergeScoutingHistory,CATEGORIES,MAX_TRAILS_ASKED}=require('./workflows/scout-area-closures');
const {runHazardVetting,hazardFromVetting,statedExpiry,SCOUT_REPORTER,
  SCOUTED_UNVERIFIED_NOTICE,UNVERIFIED_NOTICE,CORROBORATED_LIFETIME_DAYS,
  UNVERIFIED_LIFETIME_DAYS}=require('./workflows/community-hazard-vetting');
const {scoutClosureNotices}=require('./workflows/run-live-backoffice-worker');

const at='2026-10-12T09:00:00.000Z';
const TRAILS=[
  {id:'tre-cime',name:'Tre Cime di Lavaredo',valley:'Val Pusteria',routeReference:'101'},
  {id:'lago-braies',name:'Lago di Braies',valley:'Val Pusteria',routeReference:'1'},
];
const source=(overrides={})=>({url:'https://comune.braies.bz.it/avvisi/101',
  publisher:'Comune di Braies',publishedOn:'2026-10-01',
  quote:'Il sentiero 101 è chiuso per frana.',...overrides});
const notice=(overrides={})=>({trailIds:['T1'],category:'path-closed',
  description:'Sentiero 101 closed by a landslide above the refuge.',
  startsOn:'2026-10-01',endsOn:null,source:source(),...overrides});

describe('what the closure scout is allowed to bring back',()=>{
  const rules=result=>result.dropped.map(entry=>entry.rule);

  test('the prompt prints an id beside every trail',()=>{
    const asked=prompt('Val Pusteria',TRAILS)[1].content;
    expect(asked).toContain('- T1 Tre Cime di Lavaredo · route 101 · Val Pusteria');
    expect(asked).toContain('- T2 Lago di Braies · route 1 · Val Pusteria');
  });

  test('an id the prompt printed resolves to that trail',()=>{
    const ids=ballot(TRAILS).map(entry=>entry.id);
    const result=reviewNotices(ids.map(id=>notice({trailIds:[id]})),TRAILS);
    expect(result.notices.flatMap(item=>item.trails.map(trail=>trail.id)))
      .toEqual(['tre-cime','lago-braies']);
  });

  // #717's lesson, one lane over: a trail named in prose would have to be
  // matched back by its wording, which is the failure already paid for.
  test('a trail named instead of chosen is refused',()=>{
    const result=reviewNotices([notice({trailIds:['Tre Cime di Lavaredo']})],TRAILS);
    expect(result.notices).toEqual([]);
    expect(rules(result)).toEqual(['no-trail-on-this-area-ballot']);
  });

  test('an id this area never printed is refused',()=>{
    expect(rules(reviewNotices([notice({trailIds:['T9']})],TRAILS)))
      .toEqual(['no-trail-on-this-area-ballot']);
  });

  test('a notice with no retrievable source is refused',()=>{
    expect(rules(reviewNotices([notice({source:source({url:'not a url'})})],TRAILS)))
      .toEqual(['no-retrievable-official-source']);
    expect(rules(reviewNotices([notice({source:source({quote:'  '})})],TRAILS)))
      .toEqual(['no-retrievable-official-source']);
  });

  test('a category ORMA does not publish is refused',()=>{
    expect(rules(reviewNotices([notice({category:'parking-is-busy'})],TRAILS)))
      .toEqual(['category-is-not-one-ORMA-publishes']);
  });

  test('the same notice twice is filed once',()=>{
    const result=reviewNotices([notice(),notice()],TRAILS);
    expect(result.notices).toHaveLength(1);
    expect(rules(result)).toEqual(['duplicate-notice']);
  });

  test('a guessed end date that is not a date is dropped, not kept',()=>{
    const [kept]=reviewNotices([notice({endsOn:'next spring'})],TRAILS).notices;
    expect(kept.endsOn).toBeNull();
  });

  test('it asks the model for the web and judges only the trails it gave',async()=>{
    let asked=null;
    const result=await scoutAreaClosures('Val Pusteria',TRAILS,{at,runAgent:async request=>{
      asked=request;return {model:'m',responseId:'r',
        data:{notices:[notice()],searched:'Comune di Braies, Parco Fanes-Senes-Braies'}};}});
    expect(asked.webSearch).toBe(true);
    expect(result.notices).toHaveLength(1);
    expect(result).toEqual(expect.objectContaining({area:'Val Pusteria',trailsAsked:2,
      searched:'Comune di Braies, Parco Fanes-Senes-Braies',publicMutationAllowed:false}));
  });

  test('finding nothing is a normal answer, not a failure',async()=>{
    const result=await scoutAreaClosures('Val Pusteria',TRAILS,{at,
      runAgent:async()=>({model:'m',responseId:'r',data:{notices:[],searched:'Comune, park'}})});
    expect(result.notices).toEqual([]);
    expect(result.searched).toBe('Comune, park');
  });

  test('an area with no trails is not scouted at all',async()=>{
    await expect(scoutAreaClosures('Nowhere',[],{at})).rejects.toThrow('needs the trails');
  });

  test('it never asks about more trails than it can be answered about',()=>{
    const many=Array.from({length:MAX_TRAILS_ASKED+10},(_,i)=>({id:`t${i}`,name:`Trail ${i}`}));
    expect(ballot(many)).toHaveLength(MAX_TRAILS_ASKED);
  });
});

describe('a scouted notice becomes a pending report, not a published warning',()=>{
  const scoutResult=()=>({area:'Val Pusteria',scoutedAt:at,
    notices:[{trails:TRAILS,category:'path-closed',description:'Closed by a landslide.',
      source:source(),startsOn:'2026-10-01',endsOn:'2026-11-30'}],dropped:[]});

  test('one report per affected trail, because vetting asks about one trail',()=>{
    const reports=hazardReportsFromNotices(scoutResult(),{at});
    expect(reports.map(report=>report.trailId)).toEqual(['tre-cime','lago-braies']);
    expect(reports.every(report=>report.status==='pending')).toBe(true);
  });

  test('the report says where it came from, so nothing claims a hiker saw it',()=>{
    const [report]=hazardReportsFromNotices(scoutResult(),{at});
    expect(report.reportedBy).toBe(SCOUT_REPORTER);
    expect(report.scoutedSource).toEqual(source());
    expect(report.statedEndsOn).toBe('2026-11-30');
  });

  test('the same notice found again is the same document id',()=>{
    const first=hazardReportsFromNotices(scoutResult(),{at});
    const later=hazardReportsFromNotices({...scoutResult(),scoutedAt:'2026-11-01T09:00:00.000Z'},
      {at:'2026-11-01T09:00:00.000Z'});
    expect(later.map(report=>report.id)).toEqual(first.map(report=>report.id));
  });
});

describe('the Analyst is told which kind of report this is',()=>{
  const vetting=overrides=>({verdict:'uncorroborated',plausible:true,severity:'moderate',
    title:'Path closed above the refuge',message:'The path is reported shut.',
    reasoning:'',expectedDurationDays:null,sources:[],location:null,...overrides});
  const report=overrides=>({id:'r1',trailId:'tre-cime',trailName:'Tre Cime',area:'Val Pusteria',
    category:'path-closed',description:'Closed by a landslide.',...overrides});
  const scoutedReport=()=>report({reportedBy:SCOUT_REPORTER,scoutedSource:source(),
    statedEndsOn:'2026-11-30'});

  test('a scouted notice is handed to it as published evidence',async()=>{
    let asked=null;
    await runHazardVetting(scoutedReport(),{at,runAgent:async request=>{
      asked=request;return {model:'m',responseId:'r',data:vetting()};}});
    const user=asked.messages[1].content;
    expect(user).toContain('Reported by: ORMA closure scout, from a published notice');
    expect(user).toContain('https://comune.braies.bz.it/avvisi/101');
    expect(user).toContain('Il sentiero 101 è chiuso per frana.');
    expect(user).toContain('The notice states it ends on: 2026-11-30');
    expect(asked.messages[0].content).toContain('independent of it');
  });

  test('a hiker report still says a hiker, and carries no notice',async()=>{
    let asked=null;
    await runHazardVetting(report(),{at,runAgent:async request=>{
      asked=request;return {model:'m',responseId:'r',data:vetting()};}});
    expect(asked.messages[1].content).toContain('Reported by: a hiker');
    expect(asked.messages[1].content).not.toContain('Notice the scout found');
  });

  test('an unconfirmed scouted notice is not published as somebody’s sighting',()=>{
    const hazard=hazardFromVetting(scoutedReport(),vetting(),at);
    expect(hazard.message).toContain(SCOUTED_UNVERIFIED_NOTICE);
    expect(hazard.message).not.toContain(UNVERIFIED_NOTICE);
    expect(hazard.sourceLabel).toBe('Official notice found by ORMA, unconfirmed');
  });

  test('an unconfirmed hiker report is unchanged',()=>{
    const hazard=hazardFromVetting(report(),vetting(),at);
    expect(hazard.message).toContain(UNVERIFIED_NOTICE);
    expect(hazard.sourceLabel).toBe('Hiker report, unconfirmed');
  });

  test('it stays add-only: the feeds never reconcile it away',()=>{
    expect(hazardFromVetting(scoutedReport(),vetting(),at).origin).toBe('community');
  });
});

describe('a stated end date is the expiry, within reason',()=>{
  const report=overrides=>({id:'r1',trailId:'tre-cime',trailName:'Tre Cime',
    category:'path-closed',reportedBy:SCOUT_REPORTER,scoutedSource:source(),...overrides});
  const vetting={verdict:'uncorroborated',plausible:true,severity:'moderate',title:'t',
    message:'m',reasoning:'',expectedDurationDays:null,sources:[],location:null};
  const days=(from,count)=>new Date(new Date(from).getTime()+count*86400000).toISOString();

  test('an authority saying "until 1 November" outlives the seven-day default',()=>{
    const hazard=hazardFromVetting(report({statedEndsOn:'2026-11-01'}),vetting,at);
    expect(hazard.expiresAt).toBe('2026-11-01T23:59:59.000Z');
    expect(new Date(hazard.expiresAt).getTime())
      .toBeGreaterThan(new Date(days(at,UNVERIFIED_LIFETIME_DAYS)).getTime());
  });

  test('a notice reaching past the cap is capped, and renewed by re-vetting',()=>{
    expect(hazardFromVetting(report({statedEndsOn:'2031-01-01'}),vetting,at).expiresAt)
      .toBe(days(at,CORROBORATED_LIFETIME_DAYS));
    // 30 November is 49 days out, so an ordinary winter closure is capped too.
    expect(hazardFromVetting(report({statedEndsOn:'2026-11-30'}),vetting,at).expiresAt)
      .toBe(days(at,CORROBORATED_LIFETIME_DAYS));
  });

  test('an end date already past expires at once, not thirty days out',()=>{
    const hazard=hazardFromVetting(report({statedEndsOn:'2026-01-01'}),vetting,at);
    expect(hazard.expiresAt).toBe(at);
  });

  test('a hiker report has no stated end, so the default still applies',()=>{
    expect(statedExpiry({statedEndsOn:'2026-11-30'},at)).toBeNull();
  });
});

describe('the budget rotates over the areas',()=>{
  const trails=[
    {id:'a1',name:'A1',valley:'Val Pusteria'},{id:'b1',name:'B1',valley:'Val Gardena'},
    {id:'c1',name:'C1',valley:'Val di Fassa'},
  ];

  test('with nothing scouted yet it takes them in a stable order',()=>{
    expect(nextAreasToScout(trails,null,{limit:2}).map(entry=>entry.area))
      .toEqual(['Val di Fassa','Val Gardena']);
  });

  test('and then always the one scouted longest ago',()=>{
    const history={areas:[
      {area:'Val Gardena',scoutedAt:'2026-10-12T00:00:00.000Z'},
      {area:'Val Pusteria',scoutedAt:'2026-10-11T00:00:00.000Z'},
    ]};
    expect(nextAreasToScout(trails,history,{limit:1}).map(entry=>entry.area))
      .toEqual(['Val di Fassa']);
    const allSeen={areas:[...history.areas,{area:'Val di Fassa',scoutedAt:'2026-10-13T00:00:00.000Z'}]};
    expect(nextAreasToScout(trails,allSeen,{limit:1}).map(entry=>entry.area))
      .toEqual(['Val Pusteria']);
  });

  test('the history keeps one entry per area, newest first',()=>{
    const first=mergeScoutingHistory(null,{area:'Val Pusteria',scoutedAt:at,notices:[],dropped:[],searched:'x'});
    const again=mergeScoutingHistory(first,{area:'Val Pusteria',scoutedAt:'2026-10-13T09:00:00.000Z',
      notices:[1],dropped:[],searched:'y'});
    expect(again.areas).toHaveLength(1);
    expect(again.areas[0]).toEqual(expect.objectContaining({scoutedAt:'2026-10-13T09:00:00.000Z',found:1}));
  });
});

describe('the worker pass',()=>{
  const trails=[{id:'tre-cime',name:'Tre Cime',valley:'Val Pusteria',routeReference:'101'}];
  const store=(filed=[])=>{
    const artifacts={};
    return {artifacts,filed,
      getArtifact:async id=>artifacts[id]||null,
      setArtifact:async(id,value)=>{artifacts[id]=value;},
      putHazardReportIfAbsent:async report=>{
        if(filed.some(existing=>existing.id===report.id))return false;
        filed.push(report);return true;}};
  };
  const found=async()=>({model:'m',responseId:'r',
    data:{notices:[notice()],searched:'Comune di Braies'}});

  test('it is off unless it is asked for',async()=>{
    const subject=store();
    expect(await scoutClosureNotices(subject,{at,productionTrails:trails,runAgent:found})).toEqual([]);
    expect(subject.filed).toEqual([]);
  });

  test('switched on, it files what it found and records the pass',async()=>{
    const subject=store();
    const [outcome]=await scoutClosureNotices(subject,
      {at,productionTrails:trails,closureScoutEnabled:true,runAgent:found});
    expect(outcome).toEqual(expect.objectContaining({area:'Val Pusteria',status:'scouted',found:1,filed:1}));
    expect(subject.filed[0]).toEqual(expect.objectContaining({
      trailId:'tre-cime',status:'pending',reportedBy:SCOUT_REPORTER}));
    expect(subject.artifacts['closure-scouting'].areas[0].area).toBe('Val Pusteria');
  });

  test('a standing closure found again is not filed or vetted twice',async()=>{
    const subject=store();
    const run=()=>scoutClosureNotices(subject,
      {at,productionTrails:trails,closureScoutEnabled:true,runAgent:found});
    await run();
    const [second]=await run();
    expect(second).toEqual(expect.objectContaining({found:1,filed:0}));
    expect(subject.filed).toHaveLength(1);
  });

  test('a discarded notice names the rule, so an empty area is not ambiguous',async()=>{
    const subject=store();
    const [outcome]=await scoutClosureNotices(subject,{at,productionTrails:trails,
      closureScoutEnabled:true,runAgent:async()=>({model:'m',responseId:'r',
        data:{notices:[notice({trailIds:['T9']})],searched:'Comune'}})});
    expect(outcome).toEqual(expect.objectContaining({found:0,filed:0,
      discardedBy:{'no-trail-on-this-area-ballot':1}}));
  });

  test('a failed pass is reported, not thrown',async()=>{
    const subject=store();
    const [outcome]=await scoutClosureNotices(subject,{at,productionTrails:trails,
      closureScoutEnabled:true,runAgent:async()=>{throw new Error('429 no credits');}});
    expect(outcome).toEqual(expect.objectContaining({status:'scouting-failed'}));
    expect(String(outcome.error)).toContain('429');
  });

  test('every category it may file is one the publisher understands',()=>{
    expect(CATEGORIES).toContain('path-closed');
    expect(CATEGORIES.every(category=>typeof category==='string'&&category===category.toLowerCase()))
      .toBe(true);
  });
});
