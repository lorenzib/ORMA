'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {runCartographer}=require('./run-cartographer');
const {candidateFromProductionTrail,referenceFromProductionTrail}=require('./run-catalogue-batch');
const {mergeClaimResolutionResult}=require('./claim-resolution');
const {CLAIM_ENTITY_TYPE,POLICY_BY_RULE}=require('./compile-operational-facts');
const {locateOnRoute}=require('../../hazard-location');

// A claim that names one rifugio, lift or protected area rather than the whole
// route. These are the only claim ids that compile into operational facts, so
// the list is taken from the compiler instead of restated here.
const ENTITY_POLICY_CLAIM_IDS=Object.freeze(Object.keys(CLAIM_ENTITY_TYPE));
const ENTITY_POLICY_RULES=Object.freeze(Object.keys(POLICY_BY_RULE));

const CATEGORIES=['route','geometry','elevation','parking','water','heat','exposure','livestock','surfaceHazards','access','photo','provenance'];
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
  logistics:'You are ORMA Logistics Agent. Verify exact parking, road access, public transport and the pedestrian connection to the approved route. For every route, return a distinct recommended-start claim with the authoritative start label and coordinates; a nearby parking pin is not a route start. Add recommended-direction when the authority specifies one. Always return three distinct route-following claims using the existing IDs: route-number-status identifies whether navigation is numbered or landmark-led; route-number-sequence gives the complete reader-facing order from the recommended start; and route-number-switches gives every decision point. For a numbered route, name the first reference and every later reference; locate each switch with its outgoing reference, incoming reference, mapped coordinate and distance-from-start or an unambiguous landmark. For a genuinely unnumbered route, do not answer merely that no number or switch applies: use the official route description to provide an ordered landmark sequence and useful turn instructions instead. The combined claims must be publishable as concise start/then-turn directions. If the authoritative source does not establish enough information to guide the reader, return the affected claim as unresolved. ormaRecord carries what ORMA already recorded for this walk: a recommended start with its label, a description that usually names the sequence in order, and the sources those came from. Start there rather than rediscovering the route: open the cited sources, confirm what the record says, and return the claims citing the source you confirmed it against. Where the record is right, say so and cite it; where a source contradicts it, follow the source and say what changed. Parking and the route are separate questions and answering one does not excuse omitting the other: return the four route-following claims even when the parking picture is unresolved, and put a parking uncertainty in the parking claim where it belongs. Prefer official operators and current authoritative sources. Never infer a route start, number, landmark order or turn from proximity or map appearance alone. Return proposals, citations, conflicts and unresolved questions; you cannot approve a claim.',
  regulatoryRanger:'You are ORMA Regulatory Ranger. Verify dog access, leash rules, protected-area rules and seasonal restrictions for this exact route and jurisdiction. Also verify the dog policy of each rifugio, mountain hut and lift on or serving the route, one claim per entity: return a rifugio-dog-policy claim for every hut and a lift-dog-policy claim for every cable car, chairlift or funicular a walker would use. For every entity policy claim set entityName to that single entity as the operator names it, observedAt to the ISO date you read the source, and rule to exactly one of: accepted, accepted-leashed, accepted-muzzled, not-accepted, contact-required, unknown. Set rule to not-applicable on every claim that is not about a single entity. Use accepted-muzzled only where a muzzle is actually required, contact-required where the operator publishes no rule and a walker must ask, and unknown where you could not establish anything. Never merge two entities into one claim and never infer an entity policy from a neighbouring operator, a regional norm or a review site. Prefer current official authorities. Seasonal restrictions may genuinely have no fixed answer: where an authority establishes that a rule applies only in some months, and only after you have tried to pin it down, return finding "varies" with variesWith naming the months or the condition a walker must check. Never use "varies" for a rule you simply could not find. Separate rules from advice and never generalize a regional rule without applicability evidence. You cannot approve a claim.',
  terrainPoi:'You are ORMA Terrain & POI Analyst. Verify elevation, shade, surface, exposure, water, POIs and livestock indicators for this exact route. Distinguish mapped presence from potable or currently available water. Livestock is the one terrain question that may have no fixed answer: whether cattle or guardian dogs are on a pasture depends on the month and on how the pasture is grazed that year. Where an authority establishes that it is seasonal rather than constant, and only after you have genuinely tried to establish it, return finding "varies" with variesWith naming what it depends on, in the words a walker would use to check on the day. Shade and water do not vary in this sense: tree cover and the existence of a fountain are features of the route, and you should establish them. Never use "varies" for a question you simply could not answer. Do not infer absence from lack of web mentions. Anything a walker meets at one identifiable place -- a gate, a ford, an exposed traverse, a pasture crossing, a spring, a rockfall section -- must carry the coordinate of that place in location, with a landmark naming what is there. Give a coordinate only where a source establishes one: an official route description, a mapped feature, or a report precise enough to identify the spot. Never infer a position from the middle of the route, from the trail head, or from the fact that the hazard is somewhere on this walk; return location null instead and say in the rationale that the position is unestablished. A hazard that is true of the whole route, such as a surface type, has no location. You cannot approve a claim.',
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
      throw new Error(`Claim ${claim.id} cannot be answered "varies" before resolution attempt ${MIN_VARIES_RESOLUTION_ATTEMPT}; it has had ${attempt}`);
    }
    if(!String(claim.variesWith||'').trim()){
      throw new Error(`Claim ${claim.id} is "varies" but does not say what it varies with`);
    }
    if(!(claim.sources||[]).length){
      throw new Error(`Claim ${claim.id} is "varies" and requires a source establishing that it varies`);
    }
  }
}

function validateSpecialistResult(result,agentId){
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
  if(agentId==='logistics'){
    const ids=new Set((result.claims||[]).map(claim=>claim.id));
    const required=['recommended-start','route-number-status','route-number-sequence','route-number-switches'];
    const missing=required.filter(id=>!ids.has(id));
    if(missing.length)throw new Error(`Logistics result omitted mandatory route guidance claim(s): ${missing.join(', ')}`);
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
    const result=await runCartographer(candidateFromProductionTrail(trail),referenceFromProductionTrail(trail),options);
    return {responseId:null,model:'deterministic-osm-cartographer',result};
  }
  const prompt=PROMPTS[job.agentId]; if(!prompt)throw new Error(`No live specialist handler for ${job.agentId}`);
  const runAgent=options.runAgent||createStructuredResponse;
  const clientOptions={...(options.clientOptions||{}),model:options.clientOptions?.model||modelForAgent(job.agentId,options.env)};
  const resolutionPrompt=job.resolutionAttempt?`\n\nThis is automated evidence-resolution attempt ${job.resolutionAttempt} of ${job.maximumResolutionAttempts||5} for claim(s) ${(job.claimIds||[]).join(', ')}. Use this materially different strategy: ${job.resolutionStrategyLabel} (${job.resolutionStrategy}). ${job.resolutionInstruction} Return a complete updated specialist result: preserve unrelated prior claims, include every targeted claim, and list only questions that remain open after this attempt. Never claim success merely because a source was not found.`:'';
  const response=await runAgent({schemaName:`orma_${job.agentId}_trail_findings`,schema:SPECIALIST_SCHEMA,webSearch:true,
    messages:[{role:'developer',content:prompt+resolutionPrompt},
      {role:'user',content:JSON.stringify({job,trail,ormaRecord:routeGuidanceLeads(trail),context})}]},clientOptions);
  validateSpecialistResult(response.data,job.agentId);
  validateVariesClaims(response.data,job);
  locateClaims(response.data,trail);
  const at=options.at||new Date().toISOString();
  const previous=context.slice().reverse().find(item=>item?.agentId===job.agentId&&Array.isArray(item.claims));
  const current={contractVersion:'1.0.0',candidateId:job.candidateId,
    agentId:job.agentId,action:job.action,generatedAt:at,...response.data,publicMutationAllowed:false};
  const result=mergeClaimResolutionResult(previous,current,job,at);
  return {responseId:response.responseId,model:response.model,result};
}

module.exports={CATEGORIES,VARIABLE_CLAIM_IDS,MIN_VARIES_RESOLUTION_ATTEMPT,validateVariesClaims,locateClaims,routeGuidanceLeads,ENTITY_POLICY_CLAIM_IDS,ENTITY_POLICY_RULES,JUDGMENT_AGENTS,SPECIALIST_SCHEMA,EVIDENCE_SCOUTING_CONTRACT,PROMPTS,modelForAgent,validateSpecialistResult,runTrailSpecialist};
