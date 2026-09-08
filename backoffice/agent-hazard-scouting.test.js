const fs=require('fs');
const {SPECIALIST_SCHEMA,PROMPTS,locateClaims,runTrailSpecialist}=require('../backoffice/workflows/run-trail-specialist.js');
const {HAZARD_VETTING_SCHEMA,runHazardVetting,hazardFromVetting}=require('../backoffice/workflows/community-hazard-vetting.js');

function realTrail(id){
  const src=fs.readFileSync('data/regions/dolomites-trails.js','utf8');
  return JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]).find(item=>item.id===id);
}
const TRAIL=realTrail('giro-del-bulacia');
const ON_ROUTE=TRAIL.path[20];
const AT='2026-09-08T10:00:00.000Z';

function claim(overrides){
  return {id:'livestock',category:'livestock',proposedValue:'Electrified cattle gate',
    finding:'supported-proposal',confidence:0.8,rationale:'',
    sources:[{label:'Comune notice',url:'https://example.org/notice',authority:'Comune',accessedAt:'2026-09-01'}],
    blockers:[],
    entityName:null,rule:'not-applicable',observedAt:null,...overrides};
}

describe('a specialist can say where a hazard is', () => {
  test('the claim schema carries a coordinate and what is there', () => {
    const properties=SPECIALIST_SCHEMA.properties.claims.items.properties;
    expect(Object.keys(properties.location.properties).sort()).toEqual(['landmark','lat','lng']);
    expect(SPECIALIST_SCHEMA.properties.claims.items.required).toContain('location');
    // Nullable, so a hazard true of the whole route is not forced to invent one.
    expect(properties.location.type).toEqual(['object','null']);
  });

  test('terrainPoi is told to place hazards and told not to guess', () => {
    expect(PROMPTS.terrainPoi).toContain('must carry the coordinate of that place in location');
    expect(PROMPTS.terrainPoi).toContain('Never infer a position from the middle of the route');
    expect(PROMPTS.terrainPoi).toContain('return location null instead');
  });
});

// The agent finds the evidence; the km is measured here, off the trail's own
// path, so it matches the km a reader gets by tapping the same spot.
describe('the measurement is not the agent’s', () => {
  test('a coordinate on the route gains the km it sits at', () => {
    const result=locateClaims({claims:[claim({location:{lat:ON_ROUTE[0],lng:ON_ROUTE[1],landmark:'The pasture gate'}})]},TRAIL);
    const [located]=result.claims;
    expect(located.location.km).toBeGreaterThan(0);
    expect(located.location.offRouteM).toBeLessThanOrEqual(1);
    expect(located.location.landmark).toBe('The pasture gate');
    expect(located.blockers).toEqual([]);
  });

  test('a coordinate that is not on this route is refused, not published', () => {
    const result=locateClaims({claims:[claim({location:{lat:46.9,lng:12.2,landmark:'Somewhere else'}})]},TRAIL);
    const [refused]=result.claims;
    expect(refused.location).toBeNull();
    expect(refused.blockers).toContain('claim-location-off-route');
  });

  test('a claim with no position is left exactly as it is', () => {
    const plain=claim({location:null});
    const result=locateClaims({claims:[plain]},TRAIL);
    expect(result.claims[0].location).toBeNull();
    expect(result.claims[0].blockers).toEqual([]);
  });

  test('a position cannot survive a trail with no path to measure against', () => {
    const result=locateClaims({claims:[claim({location:{lat:ON_ROUTE[0],lng:ON_ROUTE[1],landmark:'The gate'}})]},{path:[]});
    expect(result.claims[0].location).toBeNull();
    expect(result.claims[0].blockers).toContain('claim-location-off-route');
  });

  test('the specialist run measures what the agent returned', async () => {
    const runAgent=async () => ({responseId:'r',model:'m',data:{
      summary:'',openQuestions:[],recommendation:'advance',
      claims:[claim({location:{lat:ON_ROUTE[0],lng:ON_ROUTE[1],landmark:'The pasture gate'}})],
    }});
    const {result}=await runTrailSpecialist(
      {job:{agentId:'terrainPoi',action:'verify',candidateId:'c1',claimIds:['livestock']},trail:TRAIL,context:[]},
      {runAgent,at:AT});
    expect(result.claims[0].location.km).toBeGreaterThan(0);
  });
});

describe('the Hazard Analyst can place a report nobody pinned', () => {
  const REPORT={id:'r1',trailId:'giro-del-bulacia',trailName:'Giro della Bullaccia',
    category:'livestock',description:'Electrified gate partway up',createdAt:AT};
  const vetted=location => ({verdict:'corroborated',plausible:true,severity:'severe',
    title:'Electrified gate',message:'A live gate crosses the path.',reasoning:'',
    expectedDurationDays:14,location,
    sources:[{url:'https://example.org/n',publisher:'Comune',publishedOn:'2026-09-01',quote:'x'}]});

  test('its schema asks for a coordinate and a landmark', () => {
    expect(HAZARD_VETTING_SCHEMA.required).toContain('location');
    expect(Object.keys(HAZARD_VETTING_SCHEMA.properties.location.properties).sort())
      .toEqual(['landmark','lat','lng']);
  });

  test('a located verdict is measured against the trail path', async () => {
    const runAgent=async () => ({responseId:'r',model:'m',
      data:vetted({lat:ON_ROUTE[0],lng:ON_ROUTE[1],landmark:'The pasture gate'})});
    const result=await runHazardVetting(REPORT,{runAgent,at:AT,trailPath:TRAIL.path});
    expect(result.locatedAt.km).toBeGreaterThan(0);
    expect(hazardFromVetting(REPORT,result,AT).at.km).toBe(result.locatedAt.km);
  });

  test('a coordinate off this route is discarded rather than published', async () => {
    const runAgent=async () => ({responseId:'r',model:'m',
      data:vetted({lat:46.9,lng:12.2,landmark:'Elsewhere'})});
    const result=await runHazardVetting(REPORT,{runAgent,at:AT,trailPath:TRAIL.path});
    expect(result.locatedAt).toBeNull();
    expect(hazardFromVetting(REPORT,result,AT).at).toBeNull();
  });

  // The reporter stood there; the analyst read a description.
  test('the reporter’s own pin outranks the analyst’s reading', async () => {
    const runAgent=async () => ({responseId:'r',model:'m',
      data:vetted({lat:ON_ROUTE[0],lng:ON_ROUTE[1],landmark:'The pasture gate'})});
    const result=await runHazardVetting(REPORT,{runAgent,at:AT,trailPath:TRAIL.path});
    const pinned={...REPORT,location:{lat:46.5496457,lng:11.6039329,km:0.77}};
    expect(hazardFromVetting(pinned,result,AT).at.km).toBe(0.77);
  });
});

describe('a daily re-check does not unplace a hazard', () => {
  const worker=fs.readFileSync('backoffice/workflows/run-live-backoffice-worker.js','utf8');

  test('the position travels with a hazard back into vetting', () => {
    expect(worker).toContain('location:hazard.at||null');
  });

  test('the analyst is given the path its coordinate is measured against', () => {
    expect(worker).toContain('trailPath:trailPathFor(report.trailId)');
    expect(worker).toContain('trailById:new Map(productionTrails.map(trail=>[trail.id,trail]))');
  });
});
