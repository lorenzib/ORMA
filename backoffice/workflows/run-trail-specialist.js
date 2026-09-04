'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {runCartographer}=require('./run-cartographer');
const {candidateFromProductionTrail,referenceFromProductionTrail}=require('./run-catalogue-batch');
const {mergeClaimResolutionResult}=require('./claim-resolution');

const CATEGORIES=['route','geometry','elevation','parking','water','heat','exposure','livestock','surfaceHazards','access','photo','provenance'];
const JUDGMENT_AGENTS=new Set(['evidenceLibrarian','redTeam','auditor']);
const SPECIALIST_SCHEMA={type:'object',additionalProperties:false,properties:{
  summary:{type:'string'},
  claims:{type:'array',items:{type:'object',additionalProperties:false,properties:{
    id:{type:'string'},category:{type:'string',enum:CATEGORIES},proposedValue:{type:'string'},
    finding:{type:'string',enum:['supported-proposal','conflicted','unresolved','counter-evidence']},
    confidence:{type:'number',minimum:0,maximum:1},rationale:{type:'string'},
    sources:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      label:{type:'string'},url:{type:'string'},authority:{type:'string'},accessedAt:{type:'string'},
    },required:['label','url','authority','accessedAt']}},
    blockers:{type:'array',items:{type:'string'}},
  },required:['id','category','proposedValue','finding','confidence','rationale','sources','blockers']}},
  openQuestions:{type:'array',items:{type:'string'}},
  recommendation:{type:'string',enum:['advance','needs-resolution','block']},
},required:['summary','claims','openQuestions','recommendation']};

const PROMPTS={
  logistics:'You are ORMA Logistics Agent. Verify exact parking, road access, public transport and the pedestrian connection to the approved route. For every route, return a distinct recommended-start claim with the authoritative start label and coordinates; a nearby parking pin is not a route start. Add recommended-direction when the authority specifies one. Always return three distinct route-following claims using the existing IDs: route-number-status identifies whether navigation is numbered or landmark-led; route-number-sequence gives the complete reader-facing order from the recommended start; and route-number-switches gives every decision point. For a numbered route, name the first reference and every later reference; locate each switch with its outgoing reference, incoming reference, mapped coordinate and distance-from-start or an unambiguous landmark. For a genuinely unnumbered route, do not answer merely that no number or switch applies: use the official route description to provide an ordered landmark sequence and useful turn instructions instead. The combined claims must be publishable as concise start/then-turn directions. If the authoritative source does not establish enough information to guide the reader, return the affected claim as unresolved. Prefer official operators and current authoritative sources. Never infer a route start, number, landmark order or turn from proximity or map appearance alone. Return proposals, citations, conflicts and unresolved questions; you cannot approve a claim.',
  regulatoryRanger:'You are ORMA Regulatory Ranger. Verify dog access, leash rules, protected-area rules and seasonal restrictions for this exact route and jurisdiction. Prefer current official authorities. Separate rules from advice and never generalize a regional rule without applicability evidence. You cannot approve a claim.',
  terrainPoi:'You are ORMA Terrain & POI Analyst. Verify elevation, shade, surface, exposure, water, POIs and livestock indicators for this exact route. Distinguish mapped presence from potable or currently available water. Do not infer absence from lack of web mentions. You cannot approve a claim.',
  evidenceLibrarian:'You are ORMA Evidence Librarian. Audit the supplied specialist outputs for source authority, freshness, duplication, applicability and claim-to-source traceability. Identify missing provenance and conflicts. You cannot approve the dossier.',
  redTeam:'You are ORMA Red Team. Challenge the supplied route dossier. Search for counter-evidence, variant mismatch, unsupported inference, stale rules and safety claims that are stronger than their sources. Return objections or a bounded advance recommendation. You cannot approve the dossier.',
  auditor:'You are ORMA Auditor. Resolve only the human-requested dossier issue using current authoritative sources. Preserve supported facts, expose conflicts and keep unresolved claims unresolved. You cannot approve the dossier.',
};

function modelForAgent(agentId,env=process.env){
  const sharedOverride=env.ORMA_CONTENT_MODEL;
  if(JUDGMENT_AGENTS.has(agentId)){
    return env.ORMA_CONTENT_AUDIT_MODEL||sharedOverride||'gpt-5.6-terra';
  }
  return env.ORMA_CONTENT_ROUTINE_MODEL||sharedOverride||'gpt-5.6-luna';
}

function validateSpecialistResult(result,agentId){
  for(const claim of result.claims||[]){
    if(claim.finding==='supported-proposal'&&!claim.sources.length)throw new Error(`Supported proposal ${claim.id} requires a source`);
    for(const source of claim.sources||[]){if(!/^https:\/\//.test(source.url))throw new Error(`Specialist source must be HTTPS: ${source.url}`);}
  }
  if(agentId==='logistics'){
    const ids=new Set((result.claims||[]).map(claim=>claim.id));
    const required=['recommended-start','route-number-status','route-number-sequence','route-number-switches'];
    const missing=required.filter(id=>!ids.has(id));
    if(missing.length)throw new Error(`Logistics result omitted mandatory route guidance claim(s): ${missing.join(', ')}`);
  }
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
    messages:[{role:'developer',content:prompt+resolutionPrompt},{role:'user',content:JSON.stringify({job,trail,context})}]},clientOptions);
  validateSpecialistResult(response.data,job.agentId);
  const at=options.at||new Date().toISOString();
  const previous=context.slice().reverse().find(item=>item?.agentId===job.agentId&&Array.isArray(item.claims));
  const current={contractVersion:'1.0.0',candidateId:job.candidateId,
    agentId:job.agentId,action:job.action,generatedAt:at,...response.data,publicMutationAllowed:false};
  const result=mergeClaimResolutionResult(previous,current,job,at);
  return {responseId:response.responseId,model:response.model,result};
}

module.exports={CATEGORIES,JUDGMENT_AGENTS,SPECIALIST_SCHEMA,PROMPTS,modelForAgent,validateSpecialistResult,runTrailSpecialist};
