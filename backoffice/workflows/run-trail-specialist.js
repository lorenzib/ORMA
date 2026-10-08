'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {runCartographer}=require('./run-cartographer');
const {candidateFromProductionTrail,referenceFromProductionTrail}=require('./run-catalogue-batch');
const {loadRouteComposites}=require('../services/route-composites');
const {mergeClaimResolutionResult}=require('./claim-resolution');
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
  logistics:'You are ORMA Logistics Agent. Verify exact parking, road access, public transport and the pedestrian connection to the approved route. For every route, return a distinct recommended-start claim with the authoritative start label and coordinates; a nearby parking pin is not a route start. Add recommended-direction when the authority specifies one. Always return three distinct route-following claims using the existing IDs: route-number-status identifies whether navigation is numbered or landmark-led; route-number-sequence gives the complete reader-facing order from the recommended start; and route-number-switches gives every decision point. For a numbered route, name the first reference and every later reference, and locate each switch by the landmark a walker meets there -- the refuge, col, junction, bridge or saddle the source names. Add a mapped coordinate or distance-from-start where the source gives one; official route descriptions usually do not, so never withhold a switch you can place by landmark because no coordinate was published. A route that keeps one reference from start to finish has no decision point, and saying so is a complete answer, not a missing one: return route-number-switches as a supported proposal whose value states there are none and names the reference followed throughout, cited to the source that establishes it. Reserve unresolved for a route whose course you could not establish at all; it is not the answer for a route you have established that simply never changes path. For a genuinely unnumbered route, do not answer merely that no number applies: use the official route description to provide an ordered landmark sequence and useful turn instructions instead. The combined claims must be publishable as concise start/then-turn directions. If the authoritative source does not establish enough information to guide the reader, return the affected claim as unresolved. ormaRecord carries what ORMA already recorded for this walk: a recommended start with its label, a description that usually names the sequence in order, and the sources those came from. Start there rather than rediscovering the route: open the cited sources, confirm what the record says, and return the claims citing the source you confirmed it against. Where the record is right, say so and cite it; where a source contradicts it, follow the source and say what changed. Parking and the route are separate questions and answering one does not excuse omitting the other: return the four route-following claims even when the parking picture is unresolved, and put a parking uncertainty in the parking claim where it belongs. Prefer official operators and current authoritative sources. Never infer a route start, number, landmark order or turn from proximity or map appearance alone. Return proposals, citations, conflicts and unresolved questions; you cannot approve a claim.',
  regulatoryRanger:'You are ORMA Regulatory Ranger. Verify dog access, leash rules, protected-area rules and seasonal restrictions for this exact route and jurisdiction. Also verify the dog policy of each rifugio, mountain hut and lift on or serving the route, one claim per entity: return a rifugio-dog-policy claim for every hut and a lift-dog-policy claim for every cable car, chairlift or funicular a walker would use. For every entity policy claim set entityName to that single entity as the operator names it, observedAt to the ISO date you read the source, and rule to exactly one of: accepted, accepted-leashed, accepted-muzzled, not-accepted, contact-required, unknown. Set rule to not-applicable on every claim that is not about a single entity. Use accepted-muzzled only where a muzzle is actually required, contact-required where the operator publishes no rule and a walker must ask, and unknown where you could not establish anything. Never merge two entities into one claim and never infer an entity policy from a neighbouring operator, a regional norm or a review site. Prefer current official authorities. Seasonal restrictions may genuinely have no fixed answer: where an authority establishes that a rule applies only in some months, and only after you have tried to pin it down, return finding "varies" with variesWith naming the months or the condition a walker must check. Never use "varies" for a rule you simply could not find. Separate rules from advice and never generalize a regional rule without applicability evidence. You cannot approve a claim.',
  terrainPoi:'You are ORMA Terrain & POI Analyst. Verify elevation, shade, surface, exposure, water, mountain huts, food and drink, other useful mapped places, livestock and other animal encounters for this exact route. Always return the assigned water, mountain-huts, food-drink, other-places, livestock and animals claims -- one for each, whatever the answer, and never omit one because you have nothing to list under it. A route with no fountain, no hut, no bar and nothing else worth naming is the ordinary case, and "there is none on this route" is a finding rather than a gap. Answer every empty category with its own claim saying so: a water claim, a mountain-huts claim, a food-drink claim, an other-places claim, an animals claim -- one per category, each as a supported-proposal whose value says there are none, citing the source that establishes it. One claim never stands in for several: answering water and leaving the rest out is the same omission as answering none of them. That source is an official route description or facility list that enumerates what is there, or a map layer you checked. That is not the same as inferring absence from silence, which stays forbidden: where no source enumerates the category, the honest finding is unresolved, and you still return the claim saying what you looked at. Omitting a claim is never the answer to either case. Audit every existing ORMA waterSources and rifugi entry by name and position, and actively scout missing on-route facilities from current first-party facility pages, authoritative maps and OpenStreetMap as mapped-presence evidence. Distinguish mapped presence from potable or currently available water, and distinguish a mapped bar or restaurant from current opening hours. For each supported water point, hut, bar, restaurant or other named place, return a separate claim, set entityName to the place name and include its source-established coordinate in location; never convert a nearby place into an on-route facility. Livestock is the one terrain question that may have no fixed answer: whether cattle or guardian dogs are on a pasture depends on the month and on how the pasture is grazed that year. Where an authority establishes that it is seasonal rather than constant, and only after you have genuinely tried to establish it, return finding "varies" with variesWith naming what it depends on, in the words a walker would use to check on the day. Shade and water do not vary in this sense: tree cover and the existence of a fountain are features of the route, and you should establish them. Never use "varies" for a question you simply could not answer. Do not infer absence from lack of web mentions. Anything a walker meets at one identifiable place -- a gate, a ford, an exposed traverse, a pasture crossing, a spring, a rockfall section -- must carry the coordinate of that place in location, with a landmark naming what is there. Give a coordinate only where a source establishes one: an official route description, a mapped feature, or a report precise enough to identify the spot. Never infer a position from the middle of the route, from the trail head, or from the fact that the hazard is somewhere on this walk; return location null instead and say in the rationale that the position is unestablished. A hazard that is true of the whole route, such as a surface type, has no location. You cannot approve a claim.',
  evidenceLibrarian:'You are ORMA Evidence Librarian. Audit the supplied specialist outputs for source authority, freshness, duplication, applicability and claim-to-source traceability. Identify missing provenance and conflicts. You cannot approve the dossier.',
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
      throw new Error(`Claim ${claim.id} does not vary by the day and cannot be answered "varies"`);
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

function validateSpecialistResult(result,agentId,requiredClaimIds=[]){
  for(const claim of result.claims||[]){
    if(claim.finding==='supported-proposal'&&!claim.sources.length)throw new Error(`Supported proposal ${claim.id} requires a source`);
    for(const source of claim.sources||[]){if(!/^https:\/\//.test(source.url))throw new Error(`Specialist source must be HTTPS: ${source.url}`);}
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
function routeGuidanceLeads(trail){
  if(!trail)return null;
  const links=(trail.sourceLinks||[]).filter(link=>/^https:\/\//.test(link?.url||''));
  return {
    recordedStart:trail.startPoint||null,
    recordedDescription:trail.desc||null,
    recordedTips:trail.tips||null,
    recordedRouteNumberStatus:trail.routeNumberStatus||null,
    // Not a citable source -- nobody publishes it -- but it is how a walker
    // actually follows an unnumbered route, so the agent should be able to say
    // "follow the white bar on red marked AS" rather than nothing.
    recordedWaymark:trail.routeWaymark?.described||null,
    citedSources:[
      ...(trail.routeNumberSource?.url?[{label:trail.routeNumberSource.name||'Route source',
        url:trail.routeNumberSource.url,authority:trail.routeNumberSource.provider||null}]:[]),
      ...(trail.source?[{label:'Trail source',url:trail.source,authority:null}]:[]),
      ...(trail.waymarkedtrails?[{label:'Waymarked Trails relation',url:trail.waymarkedtrails,authority:'OpenStreetMap'}]:[]),
      ...links.map(link=>({label:link.label||'Source',url:link.url,authority:null})),
    ],
  };
}

async function runTrailSpecialist({job,trail,context},options={}){
  if(job.agentId==='cartographer'){
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
    messages:[{role:'developer',content:prompt+resolutionPrompt+variesPrompt},
      {role:'user',content:JSON.stringify({job,trail,ormaRecord:routeGuidanceLeads(trail),context})}]},clientOptions);
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

module.exports={MANDATORY_CLAIMS,MANDATORY_CLAIM_CATEGORY,fillOmittedClaims,CATEGORIES,VARIABLE_CLAIM_IDS,MIN_VARIES_RESOLUTION_ATTEMPT,validateVariesClaims,locateClaims,routeGuidanceLeads,claimContractStamp,ENTITY_POLICY_CLAIM_IDS,ENTITY_POLICY_RULES,JUDGMENT_AGENTS,SPECIALIST_SCHEMA,EVIDENCE_SCOUTING_CONTRACT,PROMPTS,modelForAgent,validateSpecialistResult,runTrailSpecialist};
