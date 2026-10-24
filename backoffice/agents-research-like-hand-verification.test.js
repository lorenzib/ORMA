'use strict';

const {validateSpecialistResult,runTrailSpecialist,SPECIALIST_SCHEMA,PROMPTS}=require('./workflows/run-trail-specialist');
const {OPTIONAL_RESEARCH_CALLS_PER_AGENT,settleOverOptionalBudget,optionalCallsSpent,decidesTheSeal,
  EXHAUSTED_PHRASE}=require('./workflows/claim-resolution');
const {BASE_SPECIALISTS}=require('./workflows/apply-dossier-review');
const {SAFETY_SPECIALISTS}=require('./workflows/safety-research-lane');
const {OFFICIAL_FIGURE_CLAIM_IDS,PROTECTED_AREAS_CLAIM}=require('./workflows/research-methods');

/**
 * The agents are asked to research the way a walk is verified by hand, and
 * their answers are checked against the same rules the seal applies -- so when
 * paid research is switched back on, an agent reaches the answer a person did.
 * Every model call here is a stub: nothing in this file spends a credit.
 */

const AT='2026-10-23T10:00:00Z';
const TOURISM={label:'Anello',url:'https://www.dolomiti.it/it/escursioni/anello',authority:'Consorzio Turistico',accessedAt:AT};
const EEA={label:'Natura 2000',url:'https://natura2000.eea.europa.eu/',authority:'European Environment Agency',accessedAt:AT};
const OSM={label:'Relation',url:'https://www.openstreetmap.org/relation/1',authority:'OpenStreetMap',accessedAt:AT};

const claim=(id,fields={})=>({id,category:'elevation',finding:'supported-proposal',confidence:0.9,
  proposedValue:`${id} value`,rationale:'Read it.',sources:[TOURISM],blockers:[],entityName:null,
  rule:'not-applicable',observedAt:null,location:null,variesWith:null,basis:null,figure:null,...fields});

const italian={id:'osm-1',region:'dolomites',path:[[46.48,12.44],[46.49,12.45],[46.5,12.46]]};
const french={id:'osm-2',region:'savoy',path:[[45.6,5.9],[45.61,5.91]]};

const checked=(agentId,claims,trail=italian,claimIds=[])=>{
  const result={summary:'',claims,openQuestions:[],recommendation:'advance'};
  validateSpecialistResult(result,agentId,claimIds,trail);
  return result;
};
const finding=(result,id)=>result.claims.find(item=>item.id===id);

describe('an agent answer is held to the hand-verification rules',()=>{
  test('a climb the agent measured is not the walk’s official climb',()=>{
    const result=checked('terrainPoi',[claim('official-ascent',{basis:'measured',figure:180})]);
    expect(finding(result,'official-ascent').finding).toBe('unresolved');
    expect(finding(result,'official-ascent').blockers).toContain('official-ascent-not-published');
  });

  test('an estimated walking time is not the official one',()=>{
    const result=checked('terrainPoi',[claim('official-walking-time',{basis:'estimated',figure:90})]);
    expect(finding(result,'official-walking-time').finding).toBe('unresolved');
  });

  test('a figure cited only to the map is not published by an authority',()=>{
    const result=checked('terrainPoi',[claim('official-distance',{basis:'published',figure:6.3,sources:[OSM]})]);
    expect(finding(result,'official-distance').finding).toBe('unresolved');
  });

  test('an authority’s own figure, as a number, stands',()=>{
    const result=checked('terrainPoi',[claim('official-ascent',{basis:'published',figure:180})]);
    expect(finding(result,'official-ascent').finding).toBe('supported-proposal');
  });

  test('omitted official figures go round the ladder rather than disappearing',()=>{
    const result=checked('terrainPoi',[claim('official-ascent',{basis:'published',figure:180})],italian,
      [...OFFICIAL_FIGURE_CLAIM_IDS]);
    expect(finding(result,'official-walking-time').finding).toBe('unresolved');
    expect(finding(result,'official-distance').blockers).toContain('official-distance-not-answered');
  });

  test('the Italian national dog default stands in Italy and not in France',()=>{
    const rule=claim('commune-dog-rule-lozzo',{category:'access',entityName:'Lozzo di Cadore',basis:'national-default'});
    expect(finding(checked('regulatoryRanger',[{...rule}],italian),rule.id).finding).toBe('supported-proposal');
    const france=checked('regulatoryRanger',[{...rule,entityName:'Albens'}],french);
    expect(finding(france,rule.id).finding).toBe('unresolved');
    expect(finding(france,rule.id).blockers).toContain(`${rule.id}-no-national-default`);
  });

  test('a dog rule that does not say what it rests on is not settled',()=>{
    const rule=claim('commune-dog-rule-lozzo',{category:'access',entityName:'Lozzo di Cadore',basis:null});
    expect(finding(checked('regulatoryRanger',[rule]),rule.id).finding).toBe('unresolved');
  });

  test('a protected-area answer must come from the EEA Natura 2000 data',()=>{
    const without=checked('regulatoryRanger',[claim(PROTECTED_AREAS_CLAIM,{category:'access'})]);
    expect(finding(without,PROTECTED_AREAS_CLAIM).finding).toBe('unresolved');
    const withEea=checked('regulatoryRanger',[claim(PROTECTED_AREAS_CLAIM,{category:'access',sources:[EEA]})]);
    expect(finding(withEea,PROTECTED_AREAS_CLAIM).finding).toBe('supported-proposal');
  });
});

describe('the agents are asked what hand verification asks',()=>{
  test('every claim says what it rests on, and a figure is a number',()=>{
    const item=SPECIALIST_SCHEMA.properties.claims.items;
    expect(item.required).toEqual(expect.arrayContaining(['basis','figure']));
    expect(item.properties.basis.enum).toEqual(expect.arrayContaining(['published','measured','estimated','national-default']));
  });

  test('the route pipeline and the safety lane ask for the figures and the protected areas',()=>{
    const asked=specs=>agentId=>specs.find(spec=>spec.agentId===agentId).claimIds;
    for(const specs of [BASE_SPECIALISTS,SAFETY_SPECIALISTS]){
      expect(asked(specs)('terrainPoi')).toEqual(expect.arrayContaining([...OFFICIAL_FIGURE_CLAIM_IDS]));
      expect(asked(specs)('regulatoryRanger')).toContain(PROTECTED_AREAS_CLAIM);
    }
  });

  test('the prompts carry the methods: whole line, national default, EEA, official page, Open Data Hub, OCR',()=>{
    expect(PROMPTS.regulatoryRanger).toMatch(/every municipality the line crosses/);
    expect(PROMPTS.regulatoryRanger).toMatch(/6 August 2013/);
    expect(PROMPTS.regulatoryRanger).toMatch(/Natura 2000/);
    expect(PROMPTS.regulatoryRanger).toMatch(/query a site you know is there/);
    expect(PROMPTS.terrainPoi).toMatch(/basis "published"/);
    for(const prompt of Object.values(PROMPTS)){
      expect(prompt).toMatch(/over OpenStreetMap/);
      expect(prompt).toMatch(/routes-hikingtrails/);
      expect(prompt).toMatch(/never copy their descriptions/);
      expect(prompt).toMatch(/newPlan/);
      expect(prompt).toMatch(/OCR/);
    }
  });

  test('the Ranger is handed samples along the whole line, not the start point',async()=>{
    let sent=null;
    const runAgent=async request=>{sent=request;return {responseId:'resp',model:'stub',data:{summary:'',
      claims:[claim('dog-access',{category:'access'})],openQuestions:[],recommendation:'advance'}};};
    const job={id:'j1',agentId:'regulatoryRanger',action:'verify',candidateId:'osm-1',claimIds:['dog-access']};
    await runTrailSpecialist({job,trail:italian,context:[]},{runAgent,at:AT});
    const input=JSON.parse(sent.messages[1].content);
    expect(input.lineSamples.map(sample=>sample.kind)).toEqual(expect.arrayContaining(['start','end']));
    expect(input.lineSamples.at(-1).lat).toBe(46.5);
  });
});

describe('optional detail has a credit budget per trail',()=>{
  const entry=(claimId,attempts,agentId='terrainPoi')=>({key:`${agentId}:${claimId}`,agentId,claimId,
    state:'researchable',attempts:Array.from({length:attempts},(_,i)=>({jobId:`${claimId}-${i}`,status:'completed'}))});

  test('once an agent has spent its optional calls on a trail, the next optional claim is settled unknown',()=>{
    const ledger=[entry('water',2),entry('shade',1),entry('surface',0)];
    expect(optionalCallsSpent(ledger,'terrainPoi')).toBe(OPTIONAL_RESEARCH_CALLS_PER_AGENT);
    const surface=ledger[2];
    expect(settleOverOptionalBudget(ledger,surface,AT)).toBe(true);
    expect(surface.state).toBe('source-exhausted');
    expect(surface.note).toContain(EXHAUSTED_PHRASE);
  });

  test('under budget, research goes on',()=>{
    const ledger=[entry('water',1),entry('surface',0)];
    expect(settleOverOptionalBudget(ledger,ledger[1],AT)).toBe(false);
    expect(ledger[1].state).toBe('researchable');
  });

  test('what decides the seal is never cut short by the optional budget',()=>{
    const ledger=[entry('water',3),entry('official-ascent',0),entry('commune-dog-rule-lozzo',0,'regulatoryRanger')];
    expect(settleOverOptionalBudget(ledger,ledger[1],AT)).toBe(false);
    expect(decidesTheSeal('official-ascent')).toBe(true);
    expect(decidesTheSeal('recommended-start')).toBe(true);
    expect(decidesTheSeal('protected-areas')).toBe(true);
    expect(decidesTheSeal('water')).toBe(false);
  });

  test('one agent’s spending does not use up another’s',()=>{
    const ledger=[entry('water',3),entry('leash-rules',0,'regulatoryRanger')];
    expect(settleOverOptionalBudget(ledger,ledger[1],AT)).toBe(false);
  });
});
