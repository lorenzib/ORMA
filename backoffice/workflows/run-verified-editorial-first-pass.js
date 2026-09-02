'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {EDIT_SCHEMA,PICTURE_SCHEMA}=require('./run-guide-content');

function envelopeSchema(resultSchema){return {type:'object',additionalProperties:false,properties:{
  result:resultSchema,factIdsUsed:{type:'array',items:{type:'string'}},auditSummary:{type:'string'},
},required:['result','factIdsUsed','auditSummary']};}

function validateFirstPass(item,job,payload){
  const allowed=new Set((item.lockedFacts||[]).map(fact=>fact.id));
  if(!(payload.factIdsUsed||[]).length)throw new Error('First pass must cite at least one locked fact ID');
  const unknown=(payload.factIdsUsed||[]).filter(id=>!allowed.has(id));
  if(unknown.length)throw new Error(`First pass cited unknown locked fact IDs: ${unknown.join(', ')}`);
  if(job.agentId==='copywriter'){
    if(item.editorialBrief.requiredStartFactId&&!payload.factIdsUsed.includes(item.editorialBrief.requiredStartFactId)){
      throw new Error(`Numbered-route copy must use recommended start fact ${item.editorialBrief.requiredStartFactId}`);
    }
    const required=new Set(item.editorialBrief.requiredSections);const sections=(payload.result.changes||[]).map(change=>change.section);
    if(sections.length!==required.size||sections.some(section=>!required.has(section))){throw new Error('Copywriter must return exactly the three approved trail sections');}
    if((payload.result.changes||[]).some(change=>change.before!=='No verified editorial draft.'))throw new Error('First-pass copy must use the empty-draft comparison anchor');
    if(!(payload.result.sources||[]).some(source=>source.url===item.dossierRef))throw new Error('First-pass copy must cite the locked ORMA dossier');
  }else{
    const unsafe=(payload.result.candidates||[]).filter(candidate=>candidate.status==='ready'&&(
      !/^https:\/\//.test(candidate.assetUrl)||!/^https:\/\//.test(candidate.sourcePageUrl)||!/^https:\/\//.test(candidate.licenseUrl)
      ||!candidate.creator.trim()||!candidate.license.trim()||!candidate.credit.trim()||!candidate.altText.trim()));
    if(unsafe.length)throw new Error('Visual Director marked an incompletely licensed asset ready');
  }
}

async function runVerifiedEditorialFirstPass({job,item,dossier},options={}){
  if(!['copywriter','visualDirector'].includes(job.agentId))throw new Error(`Unsupported first-pass editorial agent: ${job.agentId}`);
  if(dossier?.ormaVerification?.status!=='verified')throw new Error('First-pass editorial work requires a locked ORMA Verified dossier');
  const isVisual=job.agentId==='visualDirector';const runAgent=options.runAgent||createStructuredResponse;
  const prompt=isVisual
    ?'You are the ORMA Visual Director for one ORMA Verified trail. Search only for a genuinely reusable location image with a direct preview, source page, named creator, explicit licence, licence URL, complete credit and location-safe alt text. A photograph is not evidence of current trail conditions. Mark incomplete candidates blocked. If no ready asset exists, return a concrete owned-photo checklist in coverageGaps. You propose; a human approves assets and licensing.'
    :'You are the ORMA Copywriter for one ORMA Verified trail. Write premium, concise trail copy using only the supplied locked facts and verification conditions. For a numbered route, begin the route description at the locked authoritative recommended starting point and follow the approved geometry order. Return exactly About the trail, Why it suits dogs, and Important practical notes. Keep operational uncertainty and safety caveats prominent. Do not browse, invent, weaken, or reinterpret a locked fact. Use “No verified editorial draft.” as every before value. You propose; a human approves copy.';
  const response=await runAgent({schemaName:isVisual?'orma_verified_trail_visual_first_pass':'orma_verified_trail_copy_first_pass',
    schema:envelopeSchema(isVisual?PICTURE_SCHEMA:EDIT_SCHEMA),webSearch:isVisual,
    messages:[{role:'developer',content:prompt},{role:'user',content:JSON.stringify({trail:{candidateId:item.candidateId,trailName:item.trailName,
      dossierRef:item.dossierRef,verificationConditions:item.verificationConditions,lockedFacts:item.lockedFacts,evidenceSources:item.evidenceSources,
      editorialBrief:item.editorialBrief,visualBrief:item.visualBrief},lockedDossier:dossier})}]},
  {...(options.clientOptions||{}),model:options.clientOptions?.model||options.env?.ORMA_CONTENT_AUDIT_MODEL||options.env?.ORMA_CONTENT_MODEL||'gpt-5.6-terra'});
  validateFirstPass(item,job,response.data);const at=options.at||new Date().toISOString();
  return {output:{jobId:job.jobId||job.id,agentId:job.agentId,status:'ready-for-review',candidateId:item.candidateId,
    responseId:response.responseId,model:response.model,error:null,result:response.data.result,
    firstPass:{jobId:job.id,completedAt:at,factIdsUsed:response.data.factIdsUsed,auditSummary:response.data.auditSummary}},
    job:{...job,status:'ready-for-review',completedAt:at,responseId:response.responseId,model:response.model,
      factIdsUsed:response.data.factIdsUsed,auditSummary:response.data.auditSummary}};
}

module.exports={envelopeSchema,validateFirstPass,runVerifiedEditorialFirstPass};
