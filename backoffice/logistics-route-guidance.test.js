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
    // This route has no number but does have an official page, so the status
    // now says so and the page travels to the agent as a citable source.
    expect(leads.recordedRouteNumberStatus).toBe('official-route-page');
    expect(leads.citedSources.some(source=>source.url==='https://ap-arclusaz.fr/')).toBe(true);
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

/**
 * Measured 2026-10-08 on the live pipeline: `route-number-switches` blocked 11
 * trails and had failed `unresolved` on all 11, never once `conflicted`, while
 * `recommended-start` failed `conflicted` 7 times out of 7 and the resolution
 * ladder cleared 4 of those. A claim that comes back empty every single time is
 * a question with no answer to find.
 *
 * On those same trails, from the same pages, `route-number-status` resolved
 * every time and `route-number-sequence` nearly always did. The agent had the
 * route; what it lacked was a legal way to describe a walk that follows one
 * path from start to finish.
 */
describe('a walk that never changes path can say so', () => {
  const SOURCE=[{url:'https://www.comune.example.it/sentiero-401',authority:'Comune di Esempio'}];
  const supported=(id,value)=>({id,finding:'supported-proposal',proposedValue:value,sources:SOURCE});

  test('the prompt sanctions "there are none" and says what it still costs', () => {
    expect(PROMPTS.logistics).toContain('has no decision point');
    expect(PROMPTS.logistics).toContain('cited to the source that establishes it');
    // The escape hatch it used 11 times out of 11 is now scoped.
    expect(PROMPTS.logistics)
      .toContain('Reserve unresolved for a route whose course you could not establish at all');
  });

  test('a switch is placed by landmark, and a missing coordinate never withholds one', () => {
    expect(PROMPTS.logistics).toContain('locate each switch by the landmark a walker meets there');
    expect(PROMPTS.logistics).toContain('never withhold a switch you can place by landmark');
  });

  test('the unnumbered-route shortcut is still refused', () => {
    expect(PROMPTS.logistics).toContain('do not answer merely that no number applies');
    expect(PROMPTS.logistics).toContain('ordered landmark sequence and useful turn instructions');
  });

  // The output contract is unchanged: the claim must still be returned.
  test('omitting the claim is still refused, so "none" must be said out loud', () => {
    const withoutSwitches={claims:REQUIRED.filter(id=>id!=='route-number-switches')
      .map(id=>supported(id,'established'))};
    expect(()=>validateSpecialistResult(withoutSwitches,'logistics',REQUIRED))
      .toThrow('omitted mandatory route guidance claim(s): route-number-switches');
  });

  // The safeguard that stops this becoming the easy way out.
  test('"no switches" is only ever accepted beside a sourced sequence', () => {
    const {VERIFICATION_ROUTE_CLAIMS,supportedLogisticsClaim}=
      require('./workflows/compile-verified-dossier.js');
    const review=claims=>({specialistOutputs:[{agentId:'logistics',result:{claims}}]});

    const whole=review(REQUIRED.map(id=>supported(id,
      id==='route-number-switches'?'None — the route follows CAI 401 throughout.':'established')));
    expect(VERIFICATION_ROUTE_CLAIMS.every(id=>supportedLogisticsClaim(whole,id))).toBe(true);

    // Say "no switches" without establishing the order and the gate still refuses.
    const orderMissing=review(REQUIRED.map(id=>id==='route-number-sequence'
      ? {id,finding:'unresolved',proposedValue:'Unknown.',sources:[]}
      : supported(id,id==='route-number-switches'?'None — follows CAI 401 throughout.':'established')));
    expect(supportedLogisticsClaim(orderMissing,'route-number-switches')).toBeTruthy();
    expect(supportedLogisticsClaim(orderMissing,'route-number-sequence')).toBeUndefined();
    expect(VERIFICATION_ROUTE_CLAIMS.every(id=>supportedLogisticsClaim(orderMissing,id))).toBe(false);
  });

  // An unsourced "none" is a model guess, and buys nothing.
  test('"no switches" with no source is refused like any other bare assertion', () => {
    const unsourced={specialistOutputs:[{agentId:'logistics',result:{claims:[
      {id:'route-number-switches',finding:'supported-proposal',
        proposedValue:'None — follows 401 throughout.',sources:[]},
    ]}}]};
    const {supportedLogisticsClaim}=require('./workflows/compile-verified-dossier.js');
    expect(supportedLogisticsClaim(unsourced,'route-number-switches')).toBeUndefined();
  });
});
