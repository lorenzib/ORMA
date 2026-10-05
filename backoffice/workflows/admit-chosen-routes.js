'use strict';

/**
 * Puts a chosen route into the verification fleet.
 *
 * Applying a route choice closes the question and promotes the line, but the
 * four route-choice candidates were never in `trail-orchestration` at all: the
 * trail they belong to sat outside the pipeline, so "continue with the evidence
 * gates" was an instruction written on an artifact nobody acts on. This admits
 * the trail the choice is about, at the stage the choice leaves it — geometry
 * approved by a human, evidence still to research — and queues the same three
 * specialists every other trail gets.
 *
 * It runs every pass rather than once, because what stops an admission is
 * usually temporary: the fleet is full, or the catalogue entry is not there
 * yet. A held trail is named with the reason and tried again next time.
 */

const { BASE_SPECIALISTS,specialistJob }=require('./apply-dossier-review');
const { summarize }=require('./build-live-orchestration');
const { agentWorking,DEFAULT_TRAIL_CAPACITY }=require('./start-live-trail-campaign');
const { validateTrailOrchestration }=require('../contracts/trail-orchestration-v1');

const ADMITTED_STATE='route-choice-approved';

function heldReason(item,trail,inFleet){
  if(!item.trailId)return 'no-catalogue-trail-named';
  if(!trail)return 'trail-not-in-catalogue';
  if(inFleet)return 'already-in-verification';
  return null;
}

/**
 * @param orchestration the `trail-orchestration` artifact.
 * @param routeReview   the `route-review` artifact, after the choices are applied.
 * @param options.trailById Map of catalogue trail id -> production trail.
 * @param options.capacity  How many trails agents may work at once (15).
 * @returns {orchestration, routeReview, jobs, admitted, held, changed}
 */
function admitChosenRoutes(orchestration,routeReview,options={}){
  const at=options.at||new Date().toISOString();
  const capacity=Number(options.capacity||DEFAULT_TRAIL_CAPACITY);
  const trailById=options.trailById instanceof Map?options.trailById:new Map();
  const next=JSON.parse(JSON.stringify(orchestration||{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[]}));
  next.trails=Array.isArray(next.trails)?next.trails:[];
  const fleet=new Set(next.trails.map(trail=>trail.trailId));
  // The same budget the campaign spends from, counted the same way: a trail
  // parked at a gate costs nothing, a trail agents are working costs credits on
  // every pass. A route choice must not be a way around it.
  let free=Math.max(0,capacity-next.trails.filter(trail=>agentWorking(trail.state)).length);

  const jobs=[];const admitted=[];const held=[];const items=[];
  for(const item of (routeReview&&routeReview.items)||[]){
    if(item.reviewState!==ADMITTED_STATE||item.orchestrationAdmittedAt){items.push(item);continue;}
    const trail=item.trailId?trailById.get(item.trailId):null;
    const reason=heldReason(item,trail,item.trailId&&fleet.has(item.trailId));
    if(reason==='already-in-verification'){
      // Nothing to do and nothing wrong: the trail is in the fleet already, so
      // record that and stop asking.
      items.push({...item,orchestrationAdmittedAt:at,orchestrationTrailId:item.trailId,orchestrationJobIds:[]});
      admitted.push({candidateId:item.candidateId,trailId:item.trailId,jobIds:[],alreadyInFleet:true});
      continue;
    }
    if(reason){held.push({candidateId:item.candidateId,reason});items.push(item);continue;}
    if(!free){held.push({candidateId:item.candidateId,reason:'verification-capacity-reached'});items.push(item);continue;}

    const entry={trailId:item.trailId,candidateId:item.trailId,trailName:trail.name||item.trailId,
      state:'evidence-research',stage:'parallel-evidence-research',priorityScore:0,
      // Both identities are kept: the catalogue trail this is, and the OSM
      // object the route question was asked about.
      sourceTrail:{origin:'route-choice',externalRelationId:item.candidateId,baselineBlockers:[]},
      // The cartographer's first pass is what produced the proposals the editor
      // chose between, so it is spent, not pending.
      attempts:{cartographer:1},resolutionAttempts:{},jobIds:[],currentJobId:null,
      gate:{id:'geometry-approval',status:'approved',openedAt:at,reviewedAt:at,
        decidedBy:'route-choice',proposalId:item.selectedProposalId||null},
      // The chosen line itself, so every specialist researches the route the
      // editor kept rather than whatever the candidate used to point at.
      latestOutputRef:`firestore:route-proposal-${item.trailId}`,
      blockers:[],publicMutationAllowed:false,updatedAt:at};
    for(const spec of BASE_SPECIALISTS){
      const attempt=(entry.attempts[spec.agentId]||0)+1;
      entry.attempts[spec.agentId]=attempt;
      const job=specialistJob(entry,spec,attempt,at);
      jobs.push(job);entry.jobIds.push(job.id);entry.currentJobId=job.id;
    }
    next.trails.push(entry);fleet.add(entry.trailId);free-=1;
    items.push({...item,orchestrationAdmittedAt:at,orchestrationTrailId:item.trailId,
      orchestrationJobIds:entry.jobIds});
    admitted.push({candidateId:item.candidateId,trailId:item.trailId,jobIds:entry.jobIds});
  }

  if(!admitted.length)return {orchestration,routeReview,jobs:[],admitted,held,changed:false};
  next.generatedAt=at;next.summary=summarize(next.trails);
  const errors=validateTrailOrchestration(next);
  if(errors.length)throw new Error(errors.join('; '));
  return {orchestration:next,routeReview:{...routeReview,updatedAt:at,items},jobs,admitted,held,changed:true};
}

module.exports={ADMITTED_STATE,admitChosenRoutes};
