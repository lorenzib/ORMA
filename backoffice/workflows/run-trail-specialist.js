'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {runCartographer}=require('./run-cartographer');
const {candidateFromProductionTrail,referenceFromProductionTrail}=require('./run-catalogue-batch');

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
  logistics:'You are ORMA Logistics Agent. Verify exact parking, road access, public transport and the pedestrian connection to the approved route. Prefer official operators and current authoritative sources. Never infer a parking pin from proximity alone. Return proposals, citations, conflicts and unresolved questions; you cannot approve a claim.',
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

function validateSpecialistResult(result){
  for(const claim of result.claims||[]){
    if(claim.finding==='supported-proposal'&&!claim.sources.length)throw new Error(`Supported proposal ${claim.id} requires a source`);
    for(const source of claim.sources||[]){if(!/^https:\/\//.test(source.url))throw new Error(`Specialist source must be HTTPS: ${source.url}`);}
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
  const response=await runAgent({schemaName:`orma_${job.agentId}_trail_findings`,schema:SPECIALIST_SCHEMA,webSearch:true,
    messages:[{role:'developer',content:prompt},{role:'user',content:JSON.stringify({job,trail,context})}]},clientOptions);
  validateSpecialistResult(response.data);
  return {responseId:response.responseId,model:response.model,result:{contractVersion:'1.0.0',candidateId:job.candidateId,
    agentId:job.agentId,action:job.action,generatedAt:options.at||new Date().toISOString(),...response.data,publicMutationAllowed:false}};
}

module.exports={CATEGORIES,JUDGMENT_AGENTS,SPECIALIST_SCHEMA,PROMPTS,modelForAgent,validateSpecialistResult,runTrailSpecialist};
