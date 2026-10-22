'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {runCartographer}=require('./run-cartographer');
const {candidateFromProductionTrail,referenceFromProductionTrail}=require('./run-catalogue-batch');
const {loadRouteComposites}=require('../services/route-composites');
const {mergeClaimResolutionResult}=require('./claim-resolution');
const {ROUTE_GUIDANCE_CLAIM_IDS}=require('./compile-verified-dossier');
const {placesOnRoute}=require('./places-on-route');
const {auditSources,hasFindings}=require('./source-audit');
// Required lazily: the lane builds jobs through apply-dossier-review, and
// loading it at the top would make this module part of that graph.
const safetyResearchPrompt=job=>require('./safety-research-lane').safetyResearchPrompt(job);
const fs=require('fs');
const path=require('path');
const {CLAIM_ENTITY_TYPE,POLICY_BY_RULE}=require('./compile-operational-facts');
const {locateOnRoute}=require('../../hazard-location');
const {ROUTE_GUIDANCE_CONTRACT}=require('./compile-verified-dossier');

// A claim that names one rifugio, lift or protected area rather than the whole
// route. These are the only claim ids that compile into operational facts, so
// the list is taken from the compiler instead of restated here.
const ENTITY_POLICY_CLAIM_IDS=Object.freeze(Object.keys(CLAIM_ENTITY_TYPE));
const ENTITY_POLICY_RULES=Object.freeze(Object.keys(POLICY_BY_RULE));

const CATEGORIES=['route','geometry','elevation','parking','water','heat','exposure','livestock','animals','facilities','surfaceHazards','access','photo','provenance'];
const JUDGMENT_AGENTS=new Set(['evidenceLibrarian','redTeam','auditor']);
const SPECIALIST_SCHEMA={type:'object',additionalProperties:false,properties:{
  summary:{type:'string'},
  claims:{type:'array',items:{type:'object',additionalProperties:false,properties:{
    id:{type:'string'},category:{type:'string',enum:CATEGORIES},proposedValue:{type:'string'},
    finding:{type:'string',enum:['supported-proposal','conflicted','unresolved','counter-evidence','varies']},
    confidence:{type:'number',minimum:0,maximum:1},rationale:{type:'string'},
    sources:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      label:{type:'string'},url:{type:'string'},authority:{type:'string'},accessedAt:{type:'string'},
    },required:['label','url','authority','accessedAt']}},
    blockers:{type:'array',items:{type:'string'}},
    entityName:{type:['string','null'],description:'For an entity policy claim, the single rifugio, lift or protected area this claim is about. Null otherwise.'},
    rule:{type:'string',enum:[...ENTITY_POLICY_RULES,'not-applicable'],description:'For an entity policy claim, the published rule in controlled form; not-applicable for any claim that is not about a single rifugio, lift or protected area.'},
    observedAt:{type:['string','null'],description:'For an entity policy claim, the ISO date the source was read. Null otherwise.'},
    variesWith:{type:['string','null'],description:'For a claim whose finding is "varies", what the answer depends on -- the season, the month, the time of day -- stated the way a walker would check it on the day. Null for every other finding.'},
    location:{type:['object','null'],additionalProperties:false,properties:{
      lat:{type:'number',description:'Latitude in decimal degrees.'},
      lng:{type:'number',description:'Longitude in decimal degrees.'},
      landmark:{type:'string',description:'What is at this point, named the way a walker would recognise it: the gate, the ford, the pasture crossing.'},
    },required:['lat','lng','landmark'],
    description:'For a claim about something at one identifiable place on the route -- a hazard, a gate, a crossing, a pasture, a spring -- the coordinate of that place. Give a coordinate only where a source establishes one; never infer it from the middle of the route or from the trail head. Null for anything that is true of the route as a whole.'},
  },required:['id','category','proposedValue','finding','confidence','rationale','sources','blockers','entityName','rule','observedAt','location','variesWith']}},
  openQuestions:{type:'array',items:{type:'string'}},
  recommendation:{type:'string',enum:['advance','needs-resolution','block']},
},required:['summary','claims','openQuestions','recommendation']};

const EVIDENCE_SCOUTING_CONTRACT=[
  'Optional does not mean optional research. Actively scout every assigned claim even when it will not by itself block final publication, and never call a detail unsubstantiated because the first route page omits it.',
  'Follow the source ladder: reopen ORMA-recorded sources; search the current route operator, municipality, park, regulator, transport provider or facility owner; inspect linked PDFs, GPX files, maps, geoportals and current notices; triangulate mapped infrastructure and topographic data; then use credible local or specialist secondary sources as leads or corroboration.',
  'Search local-language route and entity names, known variants and the exact claim.',
  'If the answer remains unresolved, record what was checked, the access dates, the materially different strategy or query, conflicts or applicability gaps, and the exact authority contact, field observation or measurement that could settle it.',
  'Never turn silence into absence, permission or safety, and date every current operational fact.',
].join(' ');

const BASE_PROMPTS={
  logistics:'You are ORMA Logistics Agent. Verify exact parking, road access, public transport and the pedestrian connection to the approved route. For every route, return a distinct recommended-start claim with the authoritative start label and coordinates; a nearby parking pin is not a route start. Add recommended-direction when the authority specifies one. Always return three distinct route-following claims using the existing IDs: route-number-status identifies whether navigation is numbered or landmark-led; route-number-sequence gives the complete reader-facing order from the recommended start; and route-number-switches gives every decision point. For a numbered route, name the first reference and every later reference, and locate each switch by the landmark a walker meets there -- the refuge, col, junction, bridge or saddle the source names. Add a mapped coordinate or distance-from-start where the source gives one; official route descriptions usually do not, so never withhold a switch you can place by landmark because no coordinate was published. A route that keeps one reference from start to finish has no decision point, and saying so is a complete answer, not a missing one: return route-number-switches as a supported proposal whose value states there are none and names the reference followed throughout, cited to the source that establishes it. Reserve unresolved for a route whose course you could not establish at all; it is not the answer for a route you have established that simply never changes path. For a genuinely unnumbered route, do not answer merely that no number applies: use the official route description to provide an ordered landmark sequence and useful turn instructions instead. The combined claims must be publishable as concise start/then-turn directions. If the authoritative source does not establish enough information to guide the reader, return the affected claim as unresolved. ormaRecord carries what ORMA already recorded for this walk: a recommended start with its label, a description that usually names the sequence in order, and the sources those came from. Where recordedRouteGuidance is present it already states the start, the order and the turns in the shape these claims are asked for, and citedSources lists the authorities it came from; it is a lead and not evidence, so confirm it against those sources and cite the source rather than the record, and where a source disagrees follow the source and say what changed. Start there rather than rediscovering the route: open the cited sources, confirm what the record says, and return the claims citing the source you confirmed it against. Where the record is right, say so and cite it; where a source contradicts it, follow the source and say what changed. Parking and the route are separate questions and answering one does not excuse omitting the other: return the four route-following claims even when the parking picture is unresolved, and put a parking uncertainty in the parking claim where it belongs. Prefer official operators and current authoritative sources. Never infer a route start, number, landmark order or turn from proximity or map appearance alone. Return proposals, citations, conflicts and unresolved questions; you cannot approve a claim.',
  regulatoryRanger:'You are ORMA Regulatory Ranger. Verify dog access, leash rules, protected-area rules and seasonal restrictions for this exact route and jurisdiction. Also verify the dog policy of each rifugio, mountain hut and lift on or serving the route, one claim per entity: return a rifugio-dog-policy claim for every hut and a lift-dog-policy claim for every cable car, chairlift or funicular a walker would use. For every entity policy claim set entityName to that single entity as the operator names it, observedAt to the ISO date you read the source, and rule to exactly one of: accepted, accepted-leashed, accepted-muzzled, not-accepted, contact-required, unknown. Set rule to not-applicable on every claim that is not about a single entity. Use accepted-muzzled only where a muzzle is actually required, contact-required where the operator publishes no rule and a walker must ask, and unknown where you could not establish anything. Never merge two entities into one claim and never infer an entity policy from a neighbouring operator, a regional norm or a review site. Prefer current official authorities. Seasonal restrictions may genuinely have no fixed answer: where an authority establishes that a rule applies only in some months, and only after you have tried to pin it down, return finding "varies" with variesWith naming the months or the condition a walker must check. Never use "varies" for a rule you simply could not find. Separate rules from advice and never generalize a regional rule without applicability evidence. You cannot approve a claim.',
  terrainPoi:'You are ORMA Terrain & POI Analyst. Verify elevation, shade, surface, exposure, water, mountain huts, food and drink, other useful mapped places, livestock and other animal encounters for this exact route. Always return the assigned water, mountain-huts, food-drink, other-places, livestock and animals claims -- one for each, whatever the answer, and never omit one because you have nothing to list under it. A route with no fountain, no hut, no bar and nothing else worth naming is the ordinary case, and "there is none on this route" is a finding rather than a gap. Answer every empty category with its own claim saying so: a water claim, a mountain-huts claim, a food-drink claim, an other-places claim, an animals claim -- one per category, each as a supported-proposal whose value says there are none, citing the source that establishes it. One claim never stands in for several: answering water and leaving the rest out is the same omission as answering none of them. That source is an official route description or facility list that enumerates what is there, or a map layer you checked. That is not the same as inferring absence from silence, which stays forbidden: where no source enumerates the category, the honest finding is unresolved, and you still return the claim saying what you looked at. Omitting a claim is never the answer to either case. mappedPlaces, where present, is what OpenStreetMap already records on this exact line, measured against the line of the walk itself: each water point and each hut, bar, restaurant or shelter with the kilometre it sits at and how far off the route it is. Start from it rather than searching for what it already lists, and cite the OpenStreetMap node or way it names. It establishes that a place is mapped there and nothing more, which is the distinction you are already asked to draw: whether that water is drinkable now, or that hut open this season, is the part that still needs a source, and it is the part worth spending a search on. A category mappedPlaces is empty for is not thereby absent -- the map is not a facility list -- so answer it as you would have anyway. Audit every existing ORMA waterSources and rifugi entry by name and position, and actively scout missing on-route facilities from current first-party facility pages, authoritative maps and OpenStreetMap as mapped-presence evidence. Distinguish mapped presence from potable or currently available water, and distinguish a mapped bar or restaurant from current opening hours. For each supported water point, hut, bar, restaurant or other named place, return a separate claim, set entityName to the place name and include its source-established coordinate in location; never convert a nearby place into an on-route facility. Livestock is the one terrain question that may have no fixed answer: whether cattle or guardian dogs are on a pasture depends on the month and on how the pasture is grazed that year. Where an authority establishes that it is seasonal rather than constant, and only after you have genuinely tried to establish it, return finding "varies" with variesWith naming what it depends on, in the words a walker would use to check on the day. Shade and water do not vary in this sense: tree cover and the existence of a fountain are features of the route, and you should establish them. Never use "varies" for a question you simply could not answer. Do not infer absence from lack of web mentions. Anything a walker meets at one identifiable place -- a gate, a ford, an exposed traverse, a pasture crossing, a spring, a rockfall section -- must carry the coordinate of that place in location, with a landmark naming what is there. Give a coordinate only where a source establishes one: an official route description, a mapped feature, or a report precise enough to identify the spot. Never infer a position from the middle of the route, from the trail head, or from the fact that the hazard is somewhere on this walk; return location null instead and say in the rationale that the position is unestablished. A hazard that is true of the whole route, such as a surface type, has no location. You cannot approve a claim.',
  evidenceLibrarian:'You are ORMA Evidence Librarian. sourceAudit has already counted what counting can establish about the supplied outputs: the citations naming no authority, those carrying no access date, those over a year old, and any one page being made to answer most of the dossier. Take those as done and do not recount them. Your work is the half that needs reading: whether each cited page actually describes this exact route rather than a neighbouring one, whether it is the right kind of source for the claim it is attached to, and whether two sources disagree. Where sourceAudit names a gap, say what it means for the claim it sits on rather than restating it. Identify missing provenance and conflicts. You cannot approve the dossier.',
  redTeam:'You are ORMA Red Team. Challenge the supplied route dossier. Search for counter-evidence, variant mismatch, unsupported inference, stale rules and safety claims that are stronger than their sources. Return objections or a bounded advance recommendation. You cannot approve the dossier.',
  auditor:'You are ORMA Auditor. Resolve only the human-requested dossier issue using current authoritative sources. Preserve supported facts, expose conflicts and keep unresolved claims unresolved. You cannot approve the dossier.',
};
const PROMPTS=Object.freeze(Object.fromEntries(Object.entries(BASE_PROMPTS)
  .map(([agentId,prompt])=>[agentId,`${prompt} ${EVIDENCE_SCOUTING_CONTRACT}`])));

function modelForAgent(agentId,env=process.env){
  const sharedOverride=env.ORMA_CONTENT_MODEL;
  if(JUDGMENT_AGENTS.has(agentId)){
    return env.ORMA_CONTENT_AUDIT_MODEL||sharedOverride||'gpt-5.6-terra';
  }
  return env.ORMA_CONTENT_ROUTINE_MODEL||sharedOverride||'gpt-5.6-luna';
}


// Some questions have no fixed answer. Whether cattle are on a summer pasture
// depends on the day you walk, and no amount of research settles it: a claim
// that says so is finished, not failed. RESOLVABLE_FINDINGS does not contain
// 'varies', so it stops the retries, and dossierBlockingReasons does not either,
// so it does not hold the trail at the gate.
//
// It is deliberately hard to reach. Only questions that genuinely turn on the
// day may use it -- a route's start point and its distance do not vary, and
// neither does a fountain's existence or a wood's canopy, which are features
// rather than conditions. It cannot be given on the first pass, because "it
// varies" must be a conclusion drawn from having looked, never a way of saying
// nothing was found. And it needs a source of its own: the evidence is for the
// variability, not for a value.
const VARIABLE_CLAIM_IDS=Object.freeze(['livestock','seasonal-restrictions']);
const MIN_VARIES_RESOLUTION_ATTEMPT=2;

function validateVariesClaims(result,job){
  const attempt=Number(job?.resolutionAttempt||0);
  for(const claim of result.claims||[]){
    if(claim.finding!=='varies')continue;
    if(!VARIABLE_CLAIM_IDS.includes(claim.id)){
      // Same enforcement mistake as the attempt check below, one branch up, and
      // it cost jobs on 9 October: terrainPoi answered a claim it called
      // `livestock-and-guardian-dogs` with "varies". `claim.id` is a free
      // string in the schema, so an agent can name a claim ORMA does not have,
      // and a near-miss of a real variable claim is the likely way it does.
      // Throwing retried the run at the same resolutionAttempt, the agent
      // invented the same id again, and the job died on its failure budget
      // without the claim ever being researched.
      //
      // The rule itself is right: "varies" is not an available answer here,
      // either because the claim does not vary by the day or because ORMA never
      // asked it. Unresolved is what is actually true -- nothing was
      // established -- and it is resolvable, so the loop re-queues it with an
      // incremented attempt instead of spending the budget on the same reply.
      //
      // The id is NOT corrected to the nearest real claim. Matching an agent's
      // wording back to a known id is the failure this codebase has paid for in
      // #632, #717 and #721; an unrecognised claim is recorded as unrecognised.
      claim.finding='unresolved';
      claim.reopenedFromVaries=true;
      claim.blockers=[...(claim.blockers||[]),`${claim.id}-cannot-vary`];
      claim.rationale=`${String(claim.rationale||'').trim()} Answered "varies", which is not available for ${claim.id}: ORMA treats it as a claim with a fixed answer, or does not ask it at all. Recorded as unresolved and sent to automated resolution.`.trim();
      continue;
    }
    if(attempt<MIN_VARIES_RESOLUTION_ATTEMPT){
      // "varies" has to be earned by having looked, but throwing here was the
      // wrong enforcement: a thrown specialist run is retried at the SAME
      // resolutionAttempt, so the counter never climbed to 2, the check could
      // never pass, and the trail blocked forever (observed: regulatoryRanger
      // seasonal-restrictions jobs stuck "blocked after the full retry budget").
      // Downgrade to unresolved instead, which IS a resolvable finding, so the
      // resolution loop re-queues the claim with an incremented attempt. Once it
      // has genuinely been through MIN_VARIES_RESOLUTION_ATTEMPT attempts, the
      // agent's "varies" reaches the accepting branch below.
      claim.finding='unresolved';
      claim.reopenedFromVaries=true;
      continue;
    }
    if(!String(claim.variesWith||'').trim()){
      throw new Error(`Claim ${claim.id} is "varies" but does not say what it varies with`);
    }
    if(!(claim.sources||[]).length){
      throw new Error(`Claim ${claim.id} is "varies" and requires a source establishing that it varies`);
    }
  }
}

const MANDATORY_CLAIMS=Object.freeze({
  logistics:['recommended-start','route-number-status','route-number-sequence','route-number-switches'],
  terrainPoi:['water','mountain-huts','food-drink','other-places','livestock','animals'],
});

// The category a filled-in claim belongs to, so it is a valid claim rather than
// a schema violation in a different costume.
const MANDATORY_CLAIM_CATEGORY=Object.freeze({
  'recommended-start':'route','route-number-status':'route',
  'route-number-sequence':'route','route-number-switches':'route',
  water:'water','mountain-huts':'facilities','food-drink':'facilities',
  'other-places':'facilities',livestock:'livestock',animals:'animals',
});

/**
 * Record a claim the agent did not return as unresolved, instead of throwing
 * the whole result away.
 *
 * Why. Both guards used to throw, `failJob` counted that as a system failure,
 * and three of those block the job permanently. An agent asked for six claims
 * in one reply usually returns six and sometimes returns four -- not for any
 * reason a prompt can address. Measured by forcing one trail through on
 * 2026-10-08: #678 removed `water` from the omissions, #680 named all five
 * categories explicitly and forbade one claim standing in for several, and
 * `water` came back anyway on the commit containing #680. Two wording fixes,
 * neither reliable, because wording was never the cause. Roughly a fifth of
 * replies died and each death cost a life.
 *
 * An unresolved claim is the state the pipeline already has for exactly this,
 * and the resolution ladder exists to work through five different strategies on
 * it. So the omission becomes ordinary unfinished research.
 *
 * It asserts nothing and hides nothing. No sources, zero confidence, a
 * rationale saying the agent did not answer, and a blocker so it reaches the
 * dossier gate and the desk. It cannot sneak a trail through a gate either: the
 * dossier gate needs `supported-proposal` for every route-guidance claim, so an
 * unresolved one still refuses verification exactly as before.
 */
function fillOmittedClaims(result,ids,agentLabel){
  result.claims=result.claims||[];
  // An agent that returned nothing at all did not omit a claim, it failed to
  // work. Filling six unresolved claims there would report a job as done having
  // answered nothing and spend a resolution attempt to discover it, so that
  // stays fatal and keeps its retry.
  if(!result.claims.length){
    throw new Error(`${agentLabel} returned no claims at all`);
  }
  const present=new Set(result.claims.map(claim=>claim.id));
  const missing=ids.filter(id=>!present.has(id));
  for(const id of missing){
    result.claims.push({
      id,category:MANDATORY_CLAIM_CATEGORY[id]||'provenance',
      proposedValue:'Not answered on this pass.',
      finding:'unresolved',confidence:0,
      rationale:`${agentLabel} returned no ${id} claim on this pass, so it is recorded as unresolved and goes to automated resolution. This is not evidence that there is nothing to report.`,
      sources:[],blockers:[`${id}-not-answered`],
    });
  }
  return missing;
}

/**
 * A citation nobody can open is dropped, not thrown over.
 *
 * Observed on alpe-siusi: the cartographer cited
 * `firestore:trail-specialist-output-trail-verification-alpe-siusi-cartographer-...`
 * as a source. That is ORMA's own internal artifact pointer, and the agent is
 * shown prior specialist output that carries such pointers in `outputRef`, so
 * it had read one and mistaken it for a page it had visited.
 *
 * Throwing blocked the job for good -- a thrown run is retried at the same
 * resolutionAttempt, so the agent read the same context and cited the same
 * pointer again until the failure budget ran out. That job was one of the four
 * agent failures holding the dossier stage.
 *
 * So an unretrievable source is removed and recorded. What it may not do is
 * leave a claim still calling itself supported: a supported proposal with no
 * source it retrieved is an assertion, and it becomes unresolved so the
 * resolution loop asks again with a different strategy.
 */
function dropUnretrievableSources(result){
  const dropped=[];
  for(const claim of result.claims||[]){
    const keep=(claim.sources||[]).filter(source=>/^https:\/\//.test(String(source?.url||'')));
    if(keep.length===(claim.sources||[]).length)continue;
    for(const source of claim.sources||[]){
      if(!/^https:\/\//.test(String(source?.url||''))){
        dropped.push({claimId:claim.id,url:String(source?.url||'').slice(0,200)});
      }
    }
    claim.sources=keep;
    claim.blockers=[...(claim.blockers||[]),`${claim.id}-source-not-retrievable`];
    if(claim.finding==='supported-proposal'&&!keep.length){
      claim.finding='unresolved';
      claim.rationale=`${String(claim.rationale||'').trim()} The source cited for this claim is not a retrievable page, so it is recorded as unresolved rather than supported.`.trim();
    }
  }
  return dropped;
}

/**
 * A route claim the gate could never use is unresolved, not supported.
 *
 * supportedLogisticsClaim asks for three things before a route claim counts:
 * a supported proposal, a value with something in it, and a source that is an
 * https page with a named authority behind it. Nothing checked the last two
 * when the agent handed the claim in. A claim could cite a real page with no
 * authority named, pass validation, read as answered everywhere, and refuse
 * the gate for ever -- without ever being researched again, because the
 * resolution ladder only picks up `unresolved` and `conflicted`.
 *
 * Les Marais d'Albens is what that looks like from the outside. It was
 * rejected for a missing route-number-sequence while route-number-sequence
 * showed zero exhausted claims across the whole catalogue: nobody had ever
 * researched it, and nobody ever would have.
 *
 * Downgraded rather than thrown. A thrown run is retried at the same attempt,
 * so the agent reads the same context, hands in the same claim, and burns the
 * failure budget reaching the same place -- the lesson of #681, #722 and #724.
 * Unresolved sends it round the ladder with a different strategy instead.
 *
 * Scoped to the four route claims, which are the only ones the gate reads this
 * way. Holding optional detail to a standard the gate does not apply would
 * push honest answers back into research for nothing.
 */
function demoteClaimsTheGateCannotUse(result,agentId){
  if(agentId!=='logistics')return [];
  const demoted=[];
  for(const claim of result.claims||[]){
    if(!ROUTE_GUIDANCE_CLAIM_IDS.includes(String(claim.id)))continue;
    if(claim.finding!=='supported-proposal')continue;
    const hasValue=Boolean(String(claim.proposedValue||'').trim());
    const hasAuthority=(claim.sources||[]).some(source=>
      /^https:\/\//.test(String(source?.url||''))&&String(source?.authority||'').trim());
    if(hasValue&&hasAuthority)continue;
    const missing=!hasValue&&!hasAuthority?'no value and no source authority'
      :hasValue?'no named authority on any source':'no proposed value';
    demoted.push({claimId:claim.id,missing});
    claim.finding='unresolved';
    claim.blockers=[...(claim.blockers||[]),`${claim.id}-not-citable`];
    claim.rationale=`${String(claim.rationale||'').trim()} Recorded as unresolved rather than supported: the route guidance a walker reads has to name the authority it came from, and this claim has ${missing}.`.trim();
  }
  return demoted;
}

function validateSpecialistResult(result,agentId,requiredClaimIds=[]){
  const unretrievable=dropUnretrievableSources(result);
  if(unretrievable.length)result.unretrievableSources=unretrievable;
  // After the unretrievable sources are gone, so a claim left citing nothing
  // usable is caught here rather than counted as sourced.
  const uncitable=demoteClaimsTheGateCannotUse(result,agentId);
  if(uncitable.length)result.uncitableRouteClaims=uncitable;
  for(const claim of result.claims||[]){
    if(claim.finding==='supported-proposal'&&!claim.sources.length)throw new Error(`Supported proposal ${claim.id} requires a source`);
  }
  for(const claim of result.claims||[]){
    if(!ENTITY_POLICY_CLAIM_IDS.includes(claim.id)||claim.finding!=='supported-proposal')continue;
    // "This route passes no rifugio" is an answer, and the only true one for 92
    // of 165 trails. The schema offers not-applicable and the prompt asks for it,
    // but this check refused it, leaving no valid reply: naming no entity threw,
    // and answering unresolved instead blocked the dossier gate. A claim about
    // nothing carries no entity and no reading date, so neither is required --
    // but it must not name one either, or it is not about nothing.
    if(claim.rule==='not-applicable'){
      if(String(claim.entityName||'').trim()){
        throw new Error(`Entity policy claim ${claim.id} is not-applicable but names ${claim.entityName}`);
      }
      continue;
    }
    if(!String(claim.entityName||'').trim())throw new Error(`Entity policy claim ${claim.id} requires the entity it is about`);
    if(!(typeof claim.rule==='string'&&Object.hasOwn(POLICY_BY_RULE,claim.rule)))throw new Error(`Entity policy claim ${claim.id} requires a rule from the published vocabulary, got ${JSON.stringify(claim.rule)}`);
    if(!/^\d{4}-\d{2}-\d{2}/.test(String(claim.observedAt||'')))throw new Error(`Entity policy claim ${claim.id} requires the date its source was read`);
  }
  // A claim the agent did not return is recorded as unresolved, not thrown.
  // See fillOmittedClaims: a probabilistic agent against an all-or-nothing
  // contract loses jobs for no reason anyone can act on.
  if(agentId==='logistics'){
    fillOmittedClaims(result,MANDATORY_CLAIMS.logistics,'The Logistics Agent');
  }
  if(agentId==='terrainPoi'&&requiredClaimIds.some(id=>['mountain-huts','food-drink','other-places','animals'].includes(id))){
    fillOmittedClaims(result,MANDATORY_CLAIMS.terrainPoi,'The Terrain & POI Analyst');
  }
}


// An agent supplies the evidence for where something is; it never supplies the
// measurement. The coordinate it found is projected onto the trail's own path
// here, so the km a claim carries is computed the same way as the km a reader
// gets by tapping the map, and cannot be an agent's arithmetic.
//
// A coordinate that does not sit on this route is not a position on it: the
// position is dropped and the claim keeps a blocker saying so, rather than
// planting a hazard on a stretch no source placed it.
// Which claim contract a result was produced under is a fact about this process,
// never something an agent may assert, so it is stamped here and placed after the
// model's own fields so it cannot be overwritten by them. Only logistics carries
// the route-guidance claims, so only logistics is stamped.
const CLAIM_CONTRACTS_BY_AGENT={logistics:{routeGuidance:ROUTE_GUIDANCE_CONTRACT}};

function claimContractStamp(agentId){
  const contracts=CLAIM_CONTRACTS_BY_AGENT[agentId];
  return contracts?{claimContracts:{...contracts}}:{};
}


function locateClaims(result,trail){
  const path=trail&&trail.path;
  for(const claim of result.claims||[]){
    if(!claim.location)continue;
    const located=locateOnRoute(claim.location,path);
    if(!located||!located.onRoute){
      // Recorded, not blocked. dossierBlockingReasons treats every claim blocker
      // as gate-blocking, so putting this there would let a stray coordinate on
      // a decorative field veto the verification of an otherwise sound trail.
      // The position is dropped and the rejection kept where a moderator can see
      // it, because an agent placing hazards off the route is worth knowing.
      claim.locationRejected={reason:located?'off-route':'unmeasurable',
        offRouteM:located?located.offRouteM:null};
      claim.location=null;
      continue;
    }
    claim.location={...claim.location,lat:located.lat,lng:located.lng,
      km:located.km,offRouteM:located.offRouteM};
  }
  return result;
}


// What ORMA already knows about how this walk is followed, named so the agent
// does not have to rediscover it from a raw trail record where 40% of the
// characters are path coordinates. These are leads to verify against their own
// cited sources, never facts to copy: the curated record is where the previous
// human research landed, and re-deriving it from scratch is what produced
// parking-only dossiers on trails whose start and sequence were already written
// down.
/**
 * The mapped water, huts, bars and restaurants ORMA already holds, for the walk
 * in hand.
 *
 * terrainPoi is asked to establish these and answers by searching the web,
 * while 12,938 water points and 19,837 places sit in data/regions and are never
 * consulted. 911 searches went on optional detail across the catalogue and 111
 * of 225 such claims exhausted their ladder having found nothing -- about half
 * the money spent on optional research buying an answer of "unknown" the map
 * could often have given outright.
 *
 * Handed to the agent rather than claimed outright: mapped presence is not
 * current availability, and whether a fountain runs in October or a hut opens
 * this season is exactly what still needs a source. This saves the finding, not
 * the checking.
 */
const PLACE_FILES=Object.freeze(['dolomites-water.geojson','dolomites-huts-bars.geojson',
  'savoy-water.geojson','savoy-huts-bars.geojson']);
let mappedFeatures=null;

function loadMappedFeatures(root){
  if(mappedFeatures)return mappedFeatures;
  const base=root||path.resolve(__dirname,'../../data/regions');
  const features=[];
  for(const file of PLACE_FILES){
    try{
      const parsed=JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
      features.push(...(parsed.features||[]));
    }catch(error){
      // A region's file missing is not a reason to fail a job. The agent simply
      // gets fewer leads and researches as it did before.
    }
  }
  mappedFeatures=features;
  return mappedFeatures;
}

function mappedPlacesFor(trail,options={}){
  if(!Array.isArray(trail?.path)||trail.path.length<2)return null;
  const found=placesOnRoute(trail.path,loadMappedFeatures(options.placesRoot));
  if(!found.water.length&&!found.places.length)return null;
  return {
    note:'Mapped in OpenStreetMap and measured against this walk’s own line. Presence on the map is not current availability: whether the water is drinkable now, or the hut open this season, still needs a source.',
    radiusMetres:found.radiusMetres||60,
    water:found.water,
    places:found.places,
  };
}

function routeGuidanceLeads(trail){
  if(!trail)return null;
  const links=(trail.sourceLinks||[]).filter(link=>/^https:\/\//.test(link?.url||''));
  // What ORMA has already published for following this walk, where it has
  // any: the start, the order and the turns, each cited to an authority.
  //
  // This is the exact shape the four route claims are asked for, and it was
  // the one thing the agent was never shown. Tre Cime di Lavaredo has carried
  // "Start at Rifugio Auronzo", the 101-to-105 order and the switch at
  // Rifugio Locatelli since September, cited to the Consorzio Turistico and
  // the Dolomiti Bellunesi portal -- and the agent researching it was handed
  // the description and a list of links and asked to find all that again.
  //
  // It is a lead, not evidence. The prompt already says to open the cited
  // sources and return the claim citing the source it was confirmed against,
  // and the gate still demands an https source with a named authority, so a
  // claim cannot be made by echoing this back. What it removes is the blind
  // search for a page ORMA already knows the address of.
  const guidance=trail.routeNumberGuidance&&typeof trail.routeNumberGuidance==='object'
    ?trail.routeNumberGuidance:null;
  const guidanceSources=(guidance?.sources||[])
    .filter(source=>/^https:\/\//.test(String(source?.url||'')));
  return {
    recordedStart:trail.startPoint||null,
    recordedDescription:trail.desc||null,
    recordedTips:trail.tips||null,
    recordedRouteNumberStatus:trail.routeNumberStatus||null,
    recordedRouteGuidance:guidance?{
      mode:guidance.mode||null,
      start:guidance.start||null,
      sequence:guidance.sequence||null,
      switches:guidance.switches||null,
    }:null,
    // Not a citable source -- nobody publishes it -- but it is how a walker
    // actually follows an unnumbered route, so the agent should be able to say
    // "follow the white bar on red marked AS" rather than nothing.
    recordedWaymark:trail.routeWaymark?.described||null,
    citedSources:[
      // The guidance's own authorities first: they are the pages that
      // established the route, so they are the ones worth opening first.
      // They also mean routeSourceReady counts a trail whose only sourcing
      // lives in this field, which otherwise read as having nothing citable
      // and was researched last of all.
      ...guidanceSources.map(source=>({label:source.label||'Recorded route guidance source',
        url:source.url,authority:source.authority||null})),
      ...(trail.routeNumberSource?.url?[{label:trail.routeNumberSource.name||'Route source',
        url:trail.routeNumberSource.url,authority:trail.routeNumberSource.provider||null}]:[]),
      ...(trail.source?[{label:'Trail source',url:trail.source,authority:null}]:[]),
      ...(trail.waymarkedtrails?[{label:'Waymarked Trails relation',url:trail.waymarkedtrails,authority:'OpenStreetMap'}]:[]),
      ...links.map(link=>({label:link.label||'Source',url:link.url,authority:null})),
    ],
  };
}

// OpenStreetMap is where ORMA's lines come from and it is not an authority on
// how to walk them. A relation records that a path exists; it does not publish
// a start point, a numbered sequence or the turns a reader follows, and the
// logistics prompt forbids inferring any of them "from proximity or map
// appearance alone".
const MAP_DATA_SOURCE=/waymarkedtrails|openstreetmap/i;

/**
 * Whether this trail has anything an authoritative route claim could cite.
 *
 * The four route claims are unwaivable, and supportedLogisticsClaim requires a
 * sourced supported proposal for each. A trail whose only sources are the OSM
 * relation its line came from cannot satisfy that however long it is
 * researched: the agent correctly declines to invent directions, the claims
 * stay unresolved, and the policy rejects the trail at the end of the ladder.
 *
 * Measured 2026-10-12: 126 of 162 catalogue trails are in that position. They
 * were being researched first simply because their jobs were queued first,
 * which spent most of the model budget on trails that cannot pass.
 */
function routeSourceReady(trail){
  return (routeGuidanceLeads(trail)?.citedSources||[])
    .some(source=>/^https:\/\//.test(String(source?.url||''))&&!MAP_DATA_SOURCE.test(String(source.url)));
}

/**
 * The agents that cost nothing to run.
 *
 * The cartographer reads OpenStreetMap and measures: no model call, no credit.
 * Named here because the pass that orders work and the branch that runs it must
 * agree about which jobs are free, and a second list would drift from this one.
 */
const FREE_AGENTS=Object.freeze(['cartographer']);

/** Whether running this job spends anything. */
function costsNoModelCall(job){return FREE_AGENTS.includes(job?.agentId);}

/**
 * Claimable work with the free jobs first, then the trails that can actually be
 * verified.
 *
 * The verifiable-first rule exists to stop the model budget going on trails
 * that cannot pass. **It has no business ordering work that costs nothing** --
 * and it was, because a free survey job carries the same unverifiable trail as
 * a paid research job for it.
 *
 * That produced a circle. A trail with no published source ranks last; its
 * survey is the free job that would answer its directions from the map and make
 * it verifiable; and the survey never ran, because it was behind every paid job
 * in the queue and a pass takes ten. Six surveys were queued by hand on 16
 * October 2026 and not one of them ran until each trail was scoped on its own.
 * We would not survey it because it had no directions, and it had no directions
 * because we would not survey it.
 *
 * Free first, then the existing rule among the rest, then the queue's own order.
 * A pass can therefore spend itself entirely on free work, which is the right
 * way round: every such job makes a trail verifiable for nothing, and there is
 * at most one survey per trail, so the group drains. Research already in flight
 * waits behind it for a pass or two rather than for ever.
 */
function verifiableFirst(jobs,trailById){
  const ready=job=>routeSourceReady(trailById?.get?.(job?.candidateId));
  const rank=job=>costsNoModelCall(job)?0:(ready(job)?1:2);
  return [...(jobs||[]).map((job,index)=>({job,index,rank:rank(job)}))]
    .sort((a,b)=>(a.rank===b.rank?a.index-b.index:a.rank-b.rank))
    .map(entry=>entry.job);
}

async function runTrailSpecialist({job,trail,context},options={}){
  if(costsNoModelCall(job)){
    // Six curated trails have no relation of their own and an approved
    // composite instead. Without this the candidate builder throws
    // route-source-identity-unresolved on every one of them.
    const composites=options.routeComposites||loadRouteComposites(options.root);
    const result=await runCartographer(candidateFromProductionTrail(trail,composites),referenceFromProductionTrail(trail),options);
    return {responseId:null,model:'deterministic-osm-cartographer',result};
  }
  const prompt=PROMPTS[job.agentId]; if(!prompt)throw new Error(`No live specialist handler for ${job.agentId}`);
  const runAgent=options.runAgent||createStructuredResponse;
  const clientOptions={...(options.clientOptions||{}),model:options.clientOptions?.model||modelForAgent(job.agentId,options.env)};
  // The validator rejects "varies" before resolution attempt 2, and nothing ever
  // told the agent which attempt it was on: a first pass carries no resolution
  // prompt at all, so an agent reading "only after you have tried to pin it
  // down" concludes it has tried, answers "varies", and is refused by a number
  // it was never given. The retry then re-sends the identical prompt, so it
  // answers the same way until the budget is gone -- seven seasonal-restrictions
  // jobs blocked that way before anything said so out loud.
  //
  // Both branches are built from the constants the validator reads, so the rule
  // and the instruction cannot drift apart.
  const variesPrompt=Number(job.resolutionAttempt||0)>=MIN_VARIES_RESOLUTION_ATTEMPT
    ? `\n\nOn this attempt you may conclude finding "varies" for ${VARIABLE_CLAIM_IDS.join(' or ')} if the evidence establishes that the answer genuinely depends on when someone walks. It still needs variesWith naming what it depends on, and a source establishing the variability itself.`
    : `\n\nDo not return finding "varies" on this pass, for any claim. It is reserved for automated resolution attempt ${MIN_VARIES_RESOLUTION_ATTEMPT} and later, so that it is always a conclusion drawn from repeated looking rather than a first impression. Where you cannot establish ${VARIABLE_CLAIM_IDS.join(' or ')} on this pass, return finding "unresolved" and say in blockers what you would need; a later attempt will be allowed to conclude that it varies.`;
  const resolutionPrompt=job.resolutionAttempt?`\n\nThis is automated evidence-resolution attempt ${job.resolutionAttempt} of ${job.maximumResolutionAttempts||5} for claim(s) ${(job.claimIds||[]).join(', ')}. Use this materially different strategy: ${job.resolutionStrategyLabel} (${job.resolutionStrategy}). ${job.resolutionInstruction} Return a complete updated specialist result: preserve unrelated prior claims, include every targeted claim, and list only questions that remain open after this attempt. Never claim success merely because a source was not found.`:'';
  const response=await runAgent({schemaName:`orma_${job.agentId}_trail_findings`,schema:SPECIALIST_SCHEMA,webSearch:true,
    messages:[{role:'developer',content:prompt+resolutionPrompt+variesPrompt+safetyResearchPrompt(job)},
      {role:'user',content:JSON.stringify({job,trail,ormaRecord:routeGuidanceLeads(trail),
        // Only the agent that is asked about places gets them; the others would
        // be paying tokens to read a list they have no claim for.
        ...(job.agentId==='terrainPoi'?{mappedPlaces:mappedPlacesFor(trail,options)}:{}),
        // The counting half of the Librarian's audit, done before it reads:
        // which citations name no authority, carry no access date, are over a
        // year old, or are one page answering most of the dossier. Only it
        // gets them; no other agent is asked to audit citations.
        ...(job.agentId==='evidenceLibrarian'?{sourceAudit:auditSources(context,{at:options.at})}:{}),
        context})}]},clientOptions);
  validateSpecialistResult(response.data,job.agentId,job.claimIds||[]);
  validateVariesClaims(response.data,job);
  locateClaims(response.data,trail);
  const at=options.at||new Date().toISOString();
  const previous=context.slice().reverse().find(item=>item?.agentId===job.agentId&&Array.isArray(item.claims));
  const current={contractVersion:'1.0.0',candidateId:job.candidateId,
    agentId:job.agentId,action:job.action,generatedAt:at,...response.data,
    ...claimContractStamp(job.agentId),publicMutationAllowed:false};
  const result=mergeClaimResolutionResult(previous,current,job,at);
  return {responseId:response.responseId,model:response.model,result};
}

module.exports={FREE_AGENTS,costsNoModelCall,demoteClaimsTheGateCannotUse,mappedPlacesFor,loadMappedFeatures,PLACE_FILES,MANDATORY_CLAIMS,MANDATORY_CLAIM_CATEGORY,fillOmittedClaims,dropUnretrievableSources,MAP_DATA_SOURCE,routeSourceReady,verifiableFirst,CATEGORIES,VARIABLE_CLAIM_IDS,MIN_VARIES_RESOLUTION_ATTEMPT,validateVariesClaims,locateClaims,routeGuidanceLeads,claimContractStamp,ENTITY_POLICY_CLAIM_IDS,ENTITY_POLICY_RULES,JUDGMENT_AGENTS,SPECIALIST_SCHEMA,EVIDENCE_SCOUTING_CONTRACT,PROMPTS,modelForAgent,validateSpecialistResult,runTrailSpecialist};
