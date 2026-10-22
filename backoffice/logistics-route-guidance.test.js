const {BASE_SPECIALISTS}=require('./workflows/apply-dossier-review.js');
const {routeGuidanceLeads,routeSourceReady,PROMPTS,validateSpecialistResult,runTrailSpecialist}=require('./workflows/run-trail-specialist.js');
const {supportedLogisticsClaim,ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier.js');
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
  // This used to throw. It no longer does, and the reason is measured rather
  // than preferred: an agent asked for four claims in one reply sometimes
  // returns three, throwing cost the job one of three lives, and two wording
  // fixes (#678, #680) failed to make it reliable. The claim is now recorded
  // unresolved and researched. What must not change is that a missing answer
  // cannot buy verification, so that is what this asserts.
  test('route guidance the agent did not answer becomes unresolved, and still cannot verify', () => {
    const claim=id=>({id,category:'parking',proposedValue:'x',finding:'supported-proposal',
      confidence:1,rationale:'',blockers:[],entityName:null,rule:'not-applicable',observedAt:null,
      sources:[{label:'Mairie',url:'https://example.org/a',authority:'municipality',accessedAt:'2026-09-01'}]});
    const parkingOnly={claims:[claim('parking')]};
    expect(()=>validateSpecialistResult(parkingOnly,'logistics')).not.toThrow();

    const filled=REQUIRED.map(id=>parkingOnly.claims.find(entry=>entry.id===id));
    expect(filled.every(Boolean)).toBe(true);
    expect(filled.every(entry=>entry.finding==='unresolved')).toBe(true);
    expect(filled.every(entry=>entry.sources.length===0)).toBe(true);
    expect(filled.every(entry=>entry.blockers.includes(`${entry.id}-not-answered`))).toBe(true);

    // The gate needs a supported proposal with an authority, so a filled claim
    // refuses verification exactly as the thrown result did.
    const {VERIFICATION_ROUTE_CLAIMS,supportedLogisticsClaim}=
      require('./workflows/compile-verified-dossier.js');
    const review={specialistOutputs:[{agentId:'logistics',result:parkingOnly}]};
    expect(VERIFICATION_ROUTE_CLAIMS.some(id=>supportedLogisticsClaim(review,id))).toBe(false);

    expect(()=>validateSpecialistResult({claims:REQUIRED.map(claim)},'logistics')).not.toThrow();
  });

  test('an agent that returned nothing at all is still a failure, not an omission', () => {
    expect(()=>validateSpecialistResult({claims:[]},'logistics'))
      .toThrow('returned no claims at all');
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
    expect(leads.citedSources.some(source=>String(source.url).startsWith('https://ap-arclusaz.fr/'))).toBe(true);
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

  // "None" still has to be said out loud. It is no longer fatal to leave it
  // out, but an unanswered claim is unresolved, and unresolved does not verify.
  test('leaving switches out records it unresolved rather than accepting it', () => {
    const withoutSwitches={claims:REQUIRED.filter(id=>id!=='route-number-switches')
      .map(id=>supported(id,'established'))};
    expect(()=>validateSpecialistResult(withoutSwitches,'logistics',REQUIRED)).not.toThrow();

    const switches=withoutSwitches.claims.find(entry=>entry.id==='route-number-switches');
    expect(switches.finding).toBe('unresolved');
    const {supportedLogisticsClaim}=require('./workflows/compile-verified-dossier.js');
    expect(supportedLogisticsClaim(
      {specialistOutputs:[{agentId:'logistics',result:withoutSwitches}]},'route-number-switches'))
      .toBeUndefined();
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

// Tre Cime di Lavaredo has carried "Start at Rifugio Auronzo", the 101-to-105
// order and the switch at Rifugio Locatelli since September, each cited to the
// Consorzio Turistico and the Dolomiti Bellunesi portal. That is exactly the
// shape the four route claims are asked for, and the agent sent to research it
// was handed the description and a list of links and asked to find it again.
describe('the agent is shown what ORMA already recorded',()=>{
  function dolomitesTrail(id){
    const src=fs.readFileSync('data/regions/dolomites-trails.js','utf8');
    return JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]).find(item=>item.id===id);
  }
  // A real trail, so this moves if the catalogue does rather than passing
  // against a shape nothing publishes.
  const treCime=dolomitesTrail('tre-cime');

  test('the recorded start, order and turns reach the lead',()=>{
    expect(treCime.routeNumberGuidance).toBeTruthy();
    const leads=routeGuidanceLeads(treCime);
    expect(leads.recordedRouteGuidance).toEqual({
      mode:treCime.routeNumberGuidance.mode,
      start:treCime.routeNumberGuidance.start,
      sequence:treCime.routeNumberGuidance.sequence,
      switches:treCime.routeNumberGuidance.switches,
    });
  });

  test('its authorities are cited first, so they are the pages opened first',()=>{
    const leads=routeGuidanceLeads(treCime);
    const recorded=treCime.routeNumberGuidance.sources.filter(source=>/^https:\/\//.test(source.url));
    expect(leads.citedSources.slice(0,recorded.length).map(source=>source.url))
      .toEqual(recorded.map(source=>source.url));
    expect(leads.citedSources.slice(0,recorded.length).every(source=>source.authority)).toBe(true);
  });

  test('a trail whose only sourcing is this field counts as researchable',()=>{
    // Without the guidance's own sources it reads as having nothing citable
    // and is researched last of all, behind trails that cannot finish.
    const stripped={...treCime,routeNumberGuidance:null};
    expect(routeSourceReady(treCime)).toBe(true);
    const onlyGuidance={id:'x',routeNumberGuidance:treCime.routeNumberGuidance};
    expect(routeSourceReady(onlyGuidance)).toBe(true);
    expect(routeSourceReady({id:'x',...(stripped.source?{}:{})})).toBe(false);
  });

  test('a trail with no recorded guidance is unchanged',()=>{
    expect(routeGuidanceLeads({id:'x'}).recordedRouteGuidance).toBeNull();
  });

  test('the prompt says it is a lead to confirm, never evidence to echo',()=>{
    expect(PROMPTS.logistics).toContain('recordedRouteGuidance');
    expect(PROMPTS.logistics).toContain('it is a lead and not evidence');
    expect(PROMPTS.logistics).toContain('cite the source rather than the record');
  });
});

// The gate asks three things of a route claim; the validator checked one.
//
// A claim could cite a real page with no authority named, pass validation,
// read as answered everywhere, and refuse the gate for ever -- never
// researched again, because the resolution ladder only picks up `unresolved`
// and `conflicted`. Les Marais d'Albens is what that looks like: rejected for
// a missing route-number-sequence while route-number-sequence showed zero
// exhausted claims in the entire catalogue. Nobody had ever researched it.
describe('a route claim the gate cannot use is unresolved, not supported',()=>{
  const claim=over=>({id:ROUTE_GUIDANCE_CLAIM_IDS[2],category:'route',finding:'supported-proposal',
    proposedValue:'Follow 101 to Rifugio Locatelli, then 105 back.',confidence:0.9,
    rationale:'Read from the operator route page.',
    sources:[{label:'Operator',url:'https://example.test/route',authority:'Route operator',accessedAt:'2026-10-14'}],
    blockers:[],...over});
  const validated=over=>{
    const result={claims:[claim(over)],openQuestions:[],recommendation:'advance'};
    validateSpecialistResult(result,'logistics',[]);
    return result;
  };
  // What the gate itself would say about the same claim, so the two cannot
  // drift apart again: this is the rule being mirrored, not a copy of it.
  const gateAccepts=result=>Boolean(supportedLogisticsClaim(
    {specialistOutputs:[{agentId:'logistics',result}]},ROUTE_GUIDANCE_CLAIM_IDS[2]));

  test('a properly cited claim is left alone, and the gate takes it',()=>{
    const result=validated({});
    expect(result.claims[0].finding).toBe('supported-proposal');
    expect(result.uncitableRouteClaims).toBeUndefined();
    expect(gateAccepts(result)).toBe(true);
  });

  test('a source with no named authority sends the claim back to research',()=>{
    const result=validated({sources:[{label:'A page',url:'https://example.test/route'}]});
    expect(result.claims[0].finding).toBe('unresolved');
    expect(result.uncitableRouteClaims[0].missing).toMatch(/authority/);
    // Which is the point: unresolved is what the resolution ladder picks up.
    expect(gateAccepts(result)).toBe(false);
  });

  test('a supported claim with nothing proposed goes back too',()=>{
    const result=validated({proposedValue:'   '});
    expect(result.claims[0].finding).toBe('unresolved');
    expect(result.uncitableRouteClaims[0].missing).toMatch(/value/);
  });

  test('it never throws, because a thrown run replays the same claim',()=>{
    expect(()=>validated({sources:[]})).not.toThrow();
  });

  test('optional detail is not held to a standard the gate does not apply',()=>{
    const result={claims:[{id:'water',category:'water',finding:'supported-proposal',
      proposedValue:'A fountain at the trailhead.',confidence:0.8,rationale:'Mapped.',
      sources:[{label:'Map',url:'https://example.test/map'}],blockers:[]}],
      openQuestions:[],recommendation:'advance'};
    validateSpecialistResult(result,'terrainPoi',[]);
    expect(result.claims[0].finding).toBe('supported-proposal');
    expect(result.uncitableRouteClaims).toBeUndefined();
  });

  test('every claim the gate reads this way is covered',()=>{
    for(const id of ROUTE_GUIDANCE_CLAIM_IDS){
      const result={claims:[claim({id,sources:[{label:'A page',url:'https://example.test/route'}]})],
        openQuestions:[],recommendation:'advance'};
      validateSpecialistResult(result,'logistics',[]);
      expect(result.claims[0].finding).toBe('unresolved');
    }
  });
});
