const {BASE_SPECIALISTS}=require('./workflows/apply-dossier-review.js');
const {routeGuidanceLeads,PROMPTS,validateSpecialistResult,runTrailSpecialist}=require('./workflows/run-trail-specialist.js');
const fs=require('fs');

const REQUIRED=['recommended-start','route-number-status','route-number-sequence','route-number-switches'];

function realTrail(id){
  const src=fs.readFileSync('data/regions/savoy-trails.js','utf8');
  return JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]).find(item=>item.id===id);
}

// Both trails at the dossier gate returned a parking-only dossier: the job asked
// for parking, road access and the pedestrian connection, while the output
// contract has thrown out any logistics result lacking route guidance since
// 2026-09-04. The agent answered the question it was given.
describe('logistics is asked for what its output must contain', () => {
  const logistics=BASE_SPECIALISTS.find(spec=>spec.agentId==='logistics');

  test('every claim the validator demands is a claim the job requests', () => {
    REQUIRED.forEach(id=>expect(logistics.claimIds).toContain(id));
  });

  test('the access claims it always had are still requested', () => {
    ['parking','road-access','pedestrian-connection'].forEach(id=>expect(logistics.claimIds).toContain(id));
  });

  test('the action no longer names only half the job', () => {
    expect(logistics.action).not.toBe('verify-parking-and-access');
    expect(logistics.action).toContain('route-guidance');
  });

  // The two contracts must not drift apart again.
  test('a result missing route guidance is still refused', () => {
    const claim=id=>({id,category:'parking',proposedValue:'x',finding:'supported-proposal',
      confidence:1,rationale:'',blockers:[],entityName:null,rule:'not-applicable',observedAt:null,
      sources:[{label:'Mairie',url:'https://example.org/a',authority:'municipality',accessedAt:'2026-09-01'}]});
    expect(()=>validateSpecialistResult({claims:[claim('parking')]},'logistics'))
      .toThrow(/omitted mandatory route guidance/);
    expect(()=>validateSpecialistResult({claims:REQUIRED.map(claim)},'logistics')).not.toThrow();
  });
});

describe('the agent is handed what ORMA already recorded', () => {
  const trail=realTrail('osm-19153189');

  test('the recorded start and description are surfaced by name', () => {
    const leads=routeGuidanceLeads(trail);
    expect(leads.recordedStart.label).toContain('Saint-Pierre-d');
    expect(leads.recordedDescription).toContain('Mont Benoit');
    expect(leads.recordedRouteNumberStatus).toBe('not-listed-in-mapped-source');
  });

  test('the sources it can cite come with it', () => {
    const leads=routeGuidanceLeads(trail);
    expect(leads.citedSources.length).toBeGreaterThan(0);
    expect(leads.citedSources.every(source=>/^https:\/\//.test(source.url))).toBe(true);
  });

  test('a trail with nothing recorded yields empty leads, not invented ones', () => {
    const leads=routeGuidanceLeads({id:'bare'});
    expect(leads.recordedStart).toBeNull();
    expect(leads.recordedDescription).toBeNull();
    expect(leads.citedSources).toEqual([]);
    expect(routeGuidanceLeads(null)).toBeNull();
  });

  test('the record reaches the model alongside the job', async () => {
    let sent=null;
    const runAgent=async request => {sent=request;return {responseId:'r',model:'m',data:{
      summary:'',openQuestions:[],recommendation:'advance',
      claims:REQUIRED.map(id=>({id,category:'route',proposedValue:'x',finding:'supported-proposal',
        confidence:1,rationale:'',blockers:[],entityName:null,rule:'not-applicable',
        observedAt:null,location:null,
        sources:[{label:'Mairie',url:'https://example.org/a',authority:'municipality',accessedAt:'2026-09-01'}]})),
    }};};
    await runTrailSpecialist({job:{agentId:'logistics',action:'verify-access-and-route-guidance',
      candidateId:trail.id,claimIds:[]},trail,context:[]},{runAgent,at:'2026-09-08T10:00:00.000Z'});
    const payload=JSON.parse(sent.messages[1].content);
    expect(payload.ormaRecord.recordedStart.label).toContain('Saint-Pierre-d');
  });

  test('the prompt tells it to start from the record and cite what it confirms', () => {
    expect(PROMPTS.logistics).toContain('ormaRecord carries what ORMA already recorded');
    expect(PROMPTS.logistics).toContain('citing the source you confirmed it against');
    // Parking uncertainty is where the last two dossiers went to die.
    expect(PROMPTS.logistics).toContain('return the four route-following claims even when the parking picture is unresolved');
  });
});
