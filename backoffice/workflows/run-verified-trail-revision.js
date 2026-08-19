'use strict';

const { createStructuredResponse } = require('../services/openai-responses-client');
const { EDIT_SCHEMA, PICTURE_SCHEMA } = require('./run-guide-content');

function envelopeSchema(resultSchema){
  return {
    type:'object', additionalProperties:false,
    properties:{
      result:resultSchema,
      factIdsUsed:{type:'array',items:{type:'string'}},
      instructionResolution:{type:'string'},
      rejectedInstructionClaims:{type:'array',items:{type:'string'}},
    },
    required:['result','factIdsUsed','instructionResolution','rejectedInstructionClaims'],
  };
}

function validateLockedRevision(item, output, payload){
  const allowedFacts = new Set((item.lockedFacts || []).map(fact => fact.id));
  const unknown = (payload.factIdsUsed || []).filter(id => !allowedFacts.has(id));
  if(unknown.length) throw new Error(`Revision cited unknown locked fact IDs: ${unknown.join(', ')}`);
  if(output.agentId === 'copywriter'){
    if(!(payload.result.sources || []).some(source => source.url === item.dossierRef)){
      throw new Error('Copy revision must cite the locked ORMA evidence dossier');
    }
    const allowedSections = new Set((output.result?.changes || []).map(change => change.section));
    const extraSections = (payload.result.changes || []).filter(change => !allowedSections.has(change.section));
    if(extraSections.length) throw new Error(`Copy revision introduced unapproved sections: ${extraSections.map(change => change.section).join(', ')}`);
  }
  if(output.agentId === 'visualDirector'){
    const unsafe = (payload.result.candidates || []).filter(candidate => candidate.status === 'ready' && (
      !candidate.assetUrl || !candidate.sourcePageUrl || !candidate.creator || !candidate.license || !candidate.licenseUrl || !candidate.credit
    ));
    if(unsafe.length) throw new Error('Visual revision marked an incompletely licensed asset ready');
  }
}

async function runVerifiedTrailRevision(input, options = {}){
  const { job, execution, editorialQueue } = input;
  const output = (execution?.outputs || []).find(item => item.jobId === job.jobId);
  const trail = (editorialQueue?.items || []).find(item => item.candidateId === job.candidateId);
  if(!output) throw new Error(`Revision target output not found: ${job.jobId}`);
  if(!trail) throw new Error(`Revision target trail not found: ${job.candidateId}`);
  if(!['copywriter','visualDirector'].includes(output.agentId)) throw new Error(`Unsupported revision agent: ${output.agentId}`);
  const runAgent = options.runAgent || createStructuredResponse;
  const isVisual = output.agentId === 'visualDirector';
  const prompt = isVisual
    ? 'You are ORMA Visual Director. Revise only the licensed trail-asset recommendation in response to the editor. You may search the web. A ready candidate requires a direct preview URL, source page, creator, explicit reusable licence, licence URL, full credit and alt text. Never treat a photograph as evidence of trail conditions. Return a complete replacement result and an audit explanation.'
    : 'You are ORMA Copywriter. Revise only the editorial proposal requested by the editor. Every factual statement must remain inside the supplied locked facts and verification conditions. If the instruction conflicts with locked evidence, reject that part explicitly and produce the safest useful edit. Do not invent, weaken, or silently override a verified fact. Return a complete replacement result and an audit explanation.';
  const context = {
    trail:{ candidateId:trail.candidateId, trailName:trail.trailName, dossierRef:trail.dossierRef,
      lockedFacts:trail.lockedFacts, verificationConditions:trail.verificationConditions },
    revision:{ id:job.id, attempt:job.attempt, instruction:job.instruction },
    currentResult:output.result,
  };
  const response = await runAgent({
    schemaName:isVisual?'orma_verified_trail_visual_revision':'orma_verified_trail_copy_revision',
    schema:envelopeSchema(isVisual ? PICTURE_SCHEMA : EDIT_SCHEMA), webSearch:isVisual,
    messages:[{role:'developer',content:prompt},{role:'user',content:JSON.stringify(context)}],
  }, options.clientOptions || {});
  validateLockedRevision(trail, output, response.data);
  const completedAt = options.at || new Date().toISOString();
  return {
    output:{ ...output, status:'ready-for-review', responseId:response.responseId, model:response.model, error:null,
      revision:{ revisionJobId:job.id, attempt:job.attempt, instruction:job.instruction, status:'ready-for-review',
        completedAt, resolution:response.data.instructionResolution,
        rejectedInstructionClaims:response.data.rejectedInstructionClaims, factIdsUsed:response.data.factIdsUsed },
      result:response.data.result },
    job:{ ...job, status:'ready-for-review', completedAt, resolution:response.data.instructionResolution,
      rejectedInstructionClaims:response.data.rejectedInstructionClaims, factIdsUsed:response.data.factIdsUsed,
      responseId:response.responseId, model:response.model },
  };
}

module.exports = { envelopeSchema, validateLockedRevision, runVerifiedTrailRevision };
