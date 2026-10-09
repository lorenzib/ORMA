'use strict';

const { randomUUID } = require('crypto');
const { recordVerifiedTrailReview,applyVerifiedTrailReviewStatus,assertVerifiedTrailReviewDecisions } = require('./apply-content-review');
const { buildVerifiedTrailRevisionJobs } = require('./queue-verified-trail-revisions');
const { buildPublicationStaging } = require('./build-publication-staging');
const { runVerifiedTrailRevision } = require('./run-verified-trail-revision');
const { applyDossierReview, cancelJobsForRejectedTrail, cancelOrphanedRejectedJobs } = require('./apply-dossier-review');
const { planGateDispatches } = require('./dispatch-unanswered-gates');
const { adjudicateGateBlockers, adjudicableBlockers, contestedCount, mergeAdjudications, adjudicationMatches } = require('./adjudicate-gate-blockers');
const { rehydrateReviewQueue } = require('./rehydrate-review-detail');
const { applyRouteReview,promotableFeature,unpromotedChoices } = require('./apply-route-review');
const { admitChosenRoutes } = require('./admit-chosen-routes');
const { runTrailSpecialist } = require('./run-trail-specialist');
const { advanceTrailOrchestration } = require('./advance-trail-orchestration');
const {buildVerifiedEditorialHandoff}=require('./verified-editorial-handoff');
const {runVerifiedEditorialFirstPass}=require('./run-verified-editorial-first-pass');
const {runScheduledTrailCampaign}=require('./campaign-scheduler');
const {DEFAULT_CAMPAIGN_LIMIT,DEFAULT_TRAIL_CAPACITY}=require('./start-live-trail-campaign');
const {applyNewTrailReview}=require('./plan-new-trail-scouting');
const {admitNewTrailIntake}=require('./new-trail-intake');
const {applyHazardReview}=require('./dynamic-hazards');
const {summarisePipeline}=require('./pipeline-health');
const {summariseProgrammeHealth}=require('./programme-health');
const {accumulateUsage,ARTIFACT_ID:USAGE_DAY_ARTIFACT}=require('./firestore-usage-day');
const {summariseRegionalCoverage}=require('./regional-coverage');
const {nearestLocalityFor}=require('../services/region-taxonomy');
const {runHazardVetting,applyHazardVetting,expireCommunityHazards}=require('./community-hazard-vetting');
const {automateEvidenceGates,automateEditorialReviews,automatePublicationReviews}=require('./automate-existing-trail-verification');
const {validateContentExecution}=require('../contracts/content-result-v1');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const {currentSiteTrails,isCurrentSiteTrail}=require('../services/public-site-trails');
const fs=require('fs');
const path=require('path');

function iso(value){
  if(!value) return new Date().toISOString();
  if(typeof value === 'string') return value;
  if(typeof value.toDate === 'function') return value.toDate().toISOString();
  return new Date(value).toISOString();
}

async function ingestTrailReviews(store, options = {}){
  const reviews = await store.listReviews('queued'); const outcomes = [];
  for(const review of reviews){
    try{
      const [editorialQueue, execution, reviewQueue] = await Promise.all([
        store.getArtifact('verified-trail-editorial-queue'), store.getArtifact('verified-trail-editorial-execution'),
        store.getArtifact('content-review-queue'),
      ]);
      if(!editorialQueue || !execution) throw new Error('Verified trail artifacts are not seeded');
      const allowedJobs = new Set(execution.outputs.map(output => output.jobId));
      const decisions = (review.decisions || []).filter(decision => allowedJobs.has(decision.jobId));
      if(!decisions.length) throw new Error('Review contains no verified-trail decisions');
      assertVerifiedTrailReviewDecisions(execution,decisions);
      const submittedAt = iso(review.submittedAt); const recorded = recordVerifiedTrailReview(execution, decisions);
      const existingJobs = await store.listJobs(['queued','running','ready-for-review','blocked']);
      const revisionJobs = buildVerifiedTrailRevisionJobs(execution, decisions, submittedAt, existingJobs);
      for(const job of revisionJobs) await store.putJob(job);
      if(typeof store.markJobReviewed === 'function'){
        for(const decision of decisions){
          const target = existingJobs.filter(job => job.jobId === decision.jobId && job.status === 'ready-for-review')
            .sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
          if(target) await store.markJobReviewed(target.id, decision.action, submittedAt);
        }
      }
      const submission = { submissionId:review.id, submittedAt, status:'processed', decisions, outcomes:recorded, publicMutationAllowed:false };
      const nextReviewQueue = { contractVersion:'1.0.0', updatedAt:submittedAt,
        submissions:[...(reviewQueue?.submissions || []), submission] };
      // The decision reaches the output it was made about. Without this the
      // review queue and the staging artifact were written and the execution
      // was not, so a reviewed output kept reading `ready-for-review` -- which
      // is how six finished outputs behind three published trails were still
      // advertising themselves as waiting months later.
      const nextExecution = applyVerifiedTrailReviewStatus(execution, recorded);
      const executionErrors = validateContentExecution(nextExecution);
      if(executionErrors.length) throw new Error(executionErrors.join('; '));
      // Staging reads the decisions rather than the status, so it is given the
      // updated execution for consistency, not because the state depends on it.
      const staging = buildPublicationStaging(editorialQueue, nextExecution, nextReviewQueue,
        { at:submittedAt,
          productionTrails:options.productionTrails||loadProductionTrails(path.resolve(__dirname,'../..')) });
      await Promise.all([
        store.setArtifact('content-review-queue', nextReviewQueue), store.setArtifact('publication-staging', staging),
        ...(nextExecution!==execution
          ? [store.setArtifact('verified-trail-editorial-execution', nextExecution, { lastWorkerId:'content-review-apply' })]
          : []),
        store.markReview(review.id, 'processed', { outcomes:recorded, revisionJobIds:revisionJobs.map(job => job.id) }),
      ]);
      outcomes.push({ reviewId:review.id, status:'processed', revisions:revisionJobs.length });
    }catch(error){
      await store.markReview(review.id, 'blocked', { error:String(error.message || error).slice(0,2000) });
      outcomes.push({ reviewId:review.id, status:'blocked', error:error.message });
    }
  }
  return outcomes;
}

async function processRevisionJobs(store, options = {}){
  const workerId = options.workerId || `orma-worker-${randomUUID()}`;
  const queued = (await store.listJobs(['queued'])).filter(job=>job.jobType==='verified-trail-editorial-revision'||String(job.id).startsWith('trail-revision-')); const outcomes = [];
  for(const pending of queued.slice(0, options.limit || 5)){
    const job = await store.claimJob(pending.id, workerId); if(!job) continue;
    try{
      const [execution, editorialQueue] = await Promise.all([
        store.getArtifact('verified-trail-editorial-execution'), store.getArtifact('verified-trail-editorial-queue'),
      ]);
      const result = await runVerifiedTrailRevision({ job, execution, editorialQueue }, options);
      const nextExecution = { ...execution, generatedAt:result.output.revision.completedAt,
        outputs:execution.outputs.map(output => output.jobId === job.jobId ? result.output : output) };
      await store.setArtifact('verified-trail-editorial-execution', nextExecution, { lastWorkerId:workerId });
      await store.completeJob(job.id, {
        resolution:result.job.resolution, rejectedInstructionClaims:result.job.rejectedInstructionClaims,
        factIdsUsed:result.job.factIdsUsed, responseId:result.job.responseId, model:result.job.model,
      });
      outcomes.push({ jobId:job.id, status:'ready-for-review' });
    }catch(error){
      await store.failJob(job.id, error); outcomes.push({ jobId:job.id, status:'retry-or-blocked', error:error.message });
    }
  }
  return outcomes;
}

async function processEditorialFirstPassJobs(store,options={}){
  const workerId=options.workerId||`orma-worker-${randomUUID()}`;
  const queued=(await store.listJobs(['queued'])).filter(job=>job.jobType==='verified-trail-editorial-first-pass');const outcomes=[];
  const production=options.productionTrails||loadProductionTrails(path.resolve(__dirname,'../..'));
  const existingIds=new Set(currentSiteTrails(production).map(trail=>String(trail.id)));
  for(const pending of queued.slice(0,options.editorialLimit||4)){
    const job=await store.claimJob(pending.id,workerId);if(!job)continue;
    try{
      if(job.agentId==='visualDirector'&&existingIds.has(String(job.candidateId))){
        await store.completeJob(job.id,{resolution:'Existing licensed trail image retained by evidence policy.'});
        outcomes.push({jobId:job.id,agentId:job.agentId,status:'existing-asset-retained'});continue;
      }
      const [editorialQueue,dossier,execution]=await Promise.all([
        store.getArtifact('verified-trail-editorial-queue'),store.getArtifact(`verified-dossier-${job.candidateId}`),
        store.getArtifact('verified-trail-editorial-execution'),
      ]);
      const item=(editorialQueue?.items||[]).find(candidate=>candidate.candidateId===job.candidateId);
      if(!item)throw new Error(`Verified editorial item not found: ${job.candidateId}`);
      const result=await runVerifiedEditorialFirstPass({job,item,dossier},options);
      const current=execution||{contractVersion:'1.0.0',generatedAt:null,mode:'draft-only',stage:'verified-trail-editorial-review',
        executionOrigin:'live-orma-verified-handoff',sourceQueue:'firestore:verified-trail-editorial-queue',
        publicMutationAllowed:false,publicationAuthorized:false,outputs:[]};
      const outputs=[...(current.outputs||[]).filter(output=>output.jobId!==result.output.jobId),result.output];
      const next={...current,generatedAt:result.output.firstPass.completedAt,outputs,summary:{trails:new Set(outputs.map(output=>output.candidateId)).size,
        readyForReview:outputs.filter(output=>output.status==='ready-for-review').length,blocked:outputs.filter(output=>output.status==='blocked').length,publicationReady:0}};
      const errors=validateContentExecution(next);if(errors.length)throw new Error(errors.join('; '));
      await store.setArtifact('verified-trail-editorial-execution',next,{lastWorkerId:workerId});
      await store.completeJob(job.id,{responseId:result.job.responseId,model:result.job.model,factIdsUsed:result.job.factIdsUsed,
        auditSummary:result.job.auditSummary,outputRef:'firestore:verified-trail-editorial-execution'});
      outcomes.push({jobId:job.id,agentId:job.agentId,status:'ready-for-review'});
    }catch(error){await store.failJob(job.id,error,{maximumFailures:3});outcomes.push({jobId:job.id,agentId:job.agentId,status:'retry-or-blocked',error:error.message});}
  }
  return outcomes;
}

// The job types this worker still has a processor for. Releasing a job outside
// this set puts it back in a queue nothing reads, so the requeue is scoped to it
// and follows automatically when a lane is added or retired.
const PROCESSABLE_JOB_TYPES = Object.freeze([
  'trail-verification-specialist', 'trail-claim-resolution',
  'verified-trail-editorial-first-pass', 'verified-trail-editorial-revision',
]);

// How many jobs a pass may try to claim for each slot it wants to fill. A claim
// can still lose a race with another worker, so one attempt per slot would
// under-fill the batch; an unbounded walk would turn a long unclaimable queue
// into a long run of refused claims.
const ATTEMPTS_PER_SLOT=3;

// How many specialist jobs a pass asks the model about at once. The jobs in a
// batch are independent — different trails, different claims — but they were
// asked one at a time, so a pass spent almost all of its twelve minutes waiting
// for one answer at a time. The first metered drain did ten jobs per pass at
// 12 minutes a pass, which is what made a 45-minute drain window fit three
// passes instead of eleven.
//
// Four rather than ten: the provider has a tokens-per-minute ceiling, and a
// pass that trips it converts work into rescheduling. Raise it with
// ORMA_SPECIALIST_CONCURRENCY once a drain shows headroom.
const SPECIALIST_CONCURRENCY=4;

/**
 * Run `worker` over `items` with at most `concurrency` in flight, returning the
 * results in the order of `items` rather than the order they finished, so a
 * pass summary does not change shape because one agent answered faster.
 */
async function mapWithConcurrency(items,concurrency,worker){
  const results=new Array(items.length);
  let next=0;
  const runners=Array.from({length:Math.max(1,Math.min(concurrency,items.length))},async()=>{
    for(;;){
      const index=next;next+=1;
      if(index>=items.length)return;
      results[index]=await worker(items[index],index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** The job's own schedule, read the way claimJob reads it. */
function claimNotBefore(job,now){
  const value=job&&job.notBefore;
  if(!value)return false;
  const at=typeof value.toDate==='function'?value.toDate():new Date(value.seconds?value.seconds*1000:value);
  return at.getTime()>(now?new Date(now).getTime():Date.now());
}

async function processTrailSpecialistJobs(store,options={}){
  const workerId=options.workerId||`orma-worker-${randomUUID()}`;
  let queued=(await store.listJobs(['queued'])).filter(job=>['trail-verification-specialist','trail-claim-resolution'].includes(job.jobType));const outcomes=[];
  if(options.specialistCandidateId) queued=queued.filter(job=>job.candidateId===options.specialistCandidateId);
  const intake=await store.getArtifact('new-trail-intake');
  const production=options.productionTrails||loadProductionTrails(path.resolve(__dirname,'../..'));
  const trails=[...production,...(intake?.candidates||[])];
  const trailById=new Map(trails.map(trail=>[trail.id,trail]));
  // Fill the batch rather than taking the oldest N and giving up on them. A
  // queued job is not necessarily a claimable one — claimJob refuses anything
  // whose notBefore is still ahead — so taking a fixed slice let a handful of
  // scheduled jobs at the front hold back every job behind them, on every pass,
  // while the run reported only that it had attempted nothing. Attempts are
  // still bounded, so a queue full of unclaimable work cannot spin.
  const limit=options.specialistLimit||5;
  const claimable=queued.filter(job=>!claimNotBefore(job,options.now));
  // Claimed one at a time and in queue order. A claim is cheap, it has to win a
  // race against other workers to count, and claiming in parallel would make
  // which jobs a pass takes depend on which transaction landed first.
  const claimed=[];
  for(const pending of claimable.slice(0,limit*ATTEMPTS_PER_SLOT)){
    if(claimed.length>=limit)break;
    const job=await store.claimJob(pending.id,workerId);
    if(job)claimed.push(job);
  }
  // The model calls are where the pass spends its time, and nothing in a batch
  // depends on anything else in it.
  const concurrency=Number(options.specialistConcurrency)>0
    ?Number(options.specialistConcurrency):SPECIALIST_CONCURRENCY;
  const results=await mapWithConcurrency(claimed,concurrency,async job=>{
    try{
      const trail=trailById.get(job.candidateId);if(!trail)throw new Error(`Production trail not found: ${job.candidateId}`);
      const context=[];
      for(const ref of job.inputRefs||[]){if(String(ref).startsWith('firestore:')){const artifact=await store.getArtifact(String(ref).slice(10));if(artifact)context.push(artifact);}}
      const response=await runTrailSpecialist({job,trail,context},options);
      await store.setArtifact(`trail-specialist-output-${job.id}`,response.result,{agentId:job.agentId,candidateId:job.candidateId});
      await store.completeSystemJob(job.id,{responseId:response.responseId,model:response.model,outputRef:`firestore:trail-specialist-output-${job.id}`});
      return {jobId:job.id,agentId:job.agentId,status:'completed'};
    }catch(error){
      await store.failJob(job.id,error,{maximumFailures:3});
      return {jobId:job.id,agentId:job.agentId,status:'retry-or-blocked',error:error.message};
    }
  });
  outcomes.push(...results);
  return outcomes;
}

async function ingestPublicationReviews(store){
  const reviews = await store.listPublicationReviews('queued'); const outcomes = [];
  const effectiveByCandidate = new Map();
  for(const review of reviews){
    const current=effectiveByCandidate.get(review.candidateId);
    const reviewKey=`${iso(review.submittedAt)}:${review.id}`;
    const currentKey=current?`${iso(current.submittedAt)}:${current.id}`:'';
    if(!current||reviewKey>currentKey)effectiveByCandidate.set(review.candidateId,review);
  }
  for(const review of reviews){
    const effective=effectiveByCandidate.get(review.candidateId);
    if(effective?.id===review.id)continue;
    await store.markPublicationReview(review.id,'superseded',{supersededBy:effective.id});
    outcomes.push({reviewId:review.id,status:'superseded',supersededBy:effective.id});
  }
  for(const review of effectiveByCandidate.values()){
    try{
      const staging = await store.getArtifact('publication-staging');
      const item = staging?.items?.find(candidate => candidate.candidateId === review.candidateId);
      if(!item) throw new Error('Publication staging candidate was not found');
      if(review.action === 'approve-for-pr-creation' && item.state !== 'ready-for-publication-preview'){
        throw new Error('Both content approvals are required before PR creation');
      }
      const artifact = await store.getArtifact('publication-requests') || { contractVersion:'1.0.0', requests:[] };
      const existing=(artifact.requests||[]).find(request=>request.id===review.id);
      const request = existing||{ id:review.id, candidateId:review.candidateId, targetTrailId:item.targetTrailId,
        action:review.action, note:review.note || '', status:review.action === 'approve-for-pr-creation' ? 'approved-for-pr-creation' : review.action,
        reviewedAt:iso(review.submittedAt),approvedBy:review.submittedBy||'backoffice-moderator', publicMutationAllowed:false };
      const requests=existing?(artifact.requests||[]):[...(artifact.requests || []), request];
      await store.setArtifact('publication-requests', { ...artifact, updatedAt:new Date().toISOString(), requests });
      await store.markPublicationReview(review.id, 'processed', { outcome:request });
      outcomes.push({ reviewId:review.id, status:'processed', action:review.action });
    }catch(error){
      await store.markPublicationReview(review.id, 'blocked', { error:String(error.message || error).slice(0,2000) });
      outcomes.push({ reviewId:review.id, status:'blocked', error:error.message });
    }
  }
  return outcomes;
}

// Stage 0: the route choice. The desk writes one document per answer and the
// question stays in the `route-review` artifact, so until this ran the same
// card was asked for again on every refresh and the chosen line never became
// the candidate's route.
async function ingestRouteReviews(store){
  if(typeof store.listRouteReviews!=='function')return [];
  const reviews=await store.listRouteReviews('queued');const outcomes=[];
  // Two answers for one trail are one answer and one change of mind. Applying
  // both would replay the older one over the newer, so only the newest is
  // applied and the rest are marked superseded rather than failed.
  const effectiveByCandidate=new Map();
  for(const review of reviews){
    const current=effectiveByCandidate.get(review.candidateId);
    const key=`${iso(review.submittedAt)}:${review.id}`;
    const currentKey=current?`${iso(current.submittedAt)}:${current.id}`:'';
    if(!current||key>currentKey)effectiveByCandidate.set(review.candidateId,review);
  }
  for(const review of reviews){
    const effective=effectiveByCandidate.get(review.candidateId);
    if(effective?.id===review.id)continue;
    await store.markRouteReview(review.id,'superseded',{supersededBy:effective.id});
    outcomes.push({reviewId:review.id,candidateId:review.candidateId,status:'superseded',supersededBy:effective.id});
  }
  for(const review of effectiveByCandidate.values()){
    try{
      const [routeReview,ledger]=await Promise.all([
        store.getArtifact('route-review'),store.getArtifact('route-review-ledger'),
      ]);
      if(!routeReview)throw new Error('Route review artifact is not seeded');
      // The chosen lines, read before the decision is applied. Bounded by the
      // six proposal ids a decision may carry.
      const geometries=new Map();
      for(const proposalId of (review.proposalIds||[]).slice(0,6)){
        const proposal=await store.getArtifact(`route-proposal-geometry-${proposalId}`);
        if(proposal)geometries.set(String(proposalId),proposal);
      }
      const result=applyRouteReview(routeReview,ledger,review,{at:iso(review.submittedAt),geometries});
      const writes=[store.setArtifact('route-review',result.routeReview,{lastRouteDecisionId:review.id}),
        store.setArtifact('route-review-ledger',result.ledger)];
      // The line the rest of the pipeline reads for this candidate. Promoted
      // only when the chosen proposal's geometry was found: a decision is never
      // lost to a missing file, and a wrong line is never written in its place.
      for(const promotion of result.promotions){
        if(!promotion.feature)continue;
        writes.push(store.setArtifact(`route-proposal-${promotion.candidateId}`,promotion.feature,
          {proposalId:promotion.proposalId,approvedAt:iso(review.submittedAt)}));
      }
      await Promise.all(writes);
      await store.markRouteReview(review.id,'processed',{outcome:result.outcome});
      outcomes.push({reviewId:review.id,status:'processed',...result.outcome});
    }catch(error){
      await store.markRouteReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});
      outcomes.push({reviewId:review.id,candidateId:review.candidateId,status:'blocked',error:error.message});
    }
  }
  return outcomes;
}

/**
 * Writes the line a recorded choice is still owed.
 *
 * A choice applied before its proposal geometry reached the store promoted
 * nothing — correctly, because a decision must not be lost to a missing file —
 * and applying happens once. Nothing else would ever write that line, so the
 * trail would enter verification pointing at a route artifact that does not
 * exist. This closes that: it costs one read per recorded choice and stops
 * reading as soon as the line is there.
 */
async function promoteOwedLines(store,routeReview,at){
  const promoted=[];
  for(const owed of unpromotedChoices(routeReview)){
    if(await store.getArtifact(`route-proposal-${owed.promoteAs}`))continue;
    const stored=await store.getArtifact(`route-proposal-geometry-${owed.proposalId}`);
    const {feature,...refusal}=promotableFeature(stored,owed.proposalId);
    if(!feature){
      // A line that is simply not seeded yet is not news on every pass; one
      // that disagrees with its own proposal id is.
      if(stored)promoted.push({candidateId:owed.candidateId,status:'promotion-refused',
        proposalId:owed.proposalId,...refusal});
      continue;
    }
    await store.setArtifact(`route-proposal-${owed.promoteAs}`,feature,
      {proposalId:owed.proposalId,promotedAt:at});
    promoted.push({candidateId:owed.candidateId,trailId:owed.promoteAs,status:'promoted',
      proposalId:owed.proposalId});
  }
  return promoted;
}

// A chosen route is only an answer until the trail it names is in the fleet.
// This runs every pass, not only when a decision arrives: what holds an
// admission back — a full fleet, a catalogue entry that is not there yet — is
// usually temporary, and the trail should enter as soon as it clears.
async function admitRouteChoices(store,options={}){
  try{
    const at=options.at||new Date().toISOString();
    const routeReview=await store.getArtifact('route-review');
    if(!routeReview)return [];
    const promoted=await promoteOwedLines(store,routeReview,at);
    const orchestration=await store.getArtifact('trail-orchestration')
      ||{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[]};
    const trailById=options.trailById
      ||new Map((options.productionTrails||[]).map(trail=>[trail.id,trail]));
    const result=admitChosenRoutes(orchestration,routeReview,{at,
      trailById,capacity:options.campaignCapacity||DEFAULT_TRAIL_CAPACITY});
    if(result.changed){
      for(const job of result.jobs){
        if(typeof store.putJobIfAbsent==='function')await store.putJobIfAbsent(job);else await store.putJob(job);
      }
      await Promise.all([
        store.setArtifact('trail-orchestration',result.orchestration),
        store.setArtifact('route-review',result.routeReview),
      ]);
    }
    return [
      ...promoted,
      ...result.admitted.map(entry=>({candidateId:entry.candidateId,trailId:entry.trailId,
        status:entry.alreadyInFleet?'already-in-verification':'admitted',jobIds:entry.jobIds})),
      ...result.held.map(entry=>({candidateId:entry.candidateId,status:'held',reason:entry.reason})),
    ];
  }catch(error){
    // An admission that cannot be written is a contract problem, not a queue
    // problem: it fails the run rather than disappearing into a log.
    return [{status:'blocked',error:String(error.message||error).slice(0,2000)}];
  }
}

/**
 * Send a standing gate to the agent that can clear it.
 *
 * Submits exactly the queued decision the desk submits, through the same store
 * method, so ingestDossierReviews below applies it identically -- this is a
 * transport, not a second state machine. It only ever requests a revision:
 * approval and rejection stay human decisions.
 */
async function dispatchUnansweredGates(store,options={}){
  if(options.gateDispatchEnabled===false)return [];
  if(typeof store.submitDossierReview!=='function'||typeof store.listDossierReviews!=='function')return [];
  const [orchestration,reviewQueue]=await Promise.all([
    store.getArtifact('trail-orchestration'),store.getArtifact('dossier-review-queue'),
  ]);
  if(!orchestration||!reviewQueue)return [];
  const queued=await store.listDossierReviews('queued');
  const plan=planGateDispatches(orchestration,reviewQueue,{limit:options.gateDispatchLimit,
    queuedReviewIds:queued.map(review=>review.reviewId)});
  const outcomes=[];
  for(const dispatch of plan.dispatches){
    try{
      const written=await store.submitDossierReview({reviewId:dispatch.reviewId,candidateId:dispatch.candidateId,
        action:'request-revision',targetAgent:dispatch.targetAgent,note:dispatch.note,
        submittedBy:'orma-gate-dispatch-v1'});
      outcomes.push({reviewId:dispatch.reviewId,candidateId:dispatch.candidateId,targetAgent:dispatch.targetAgent,
        status:'dispatched',decisionId:written?.reviewId||null});
    }catch(error){
      outcomes.push({reviewId:dispatch.reviewId,candidateId:dispatch.candidateId,targetAgent:dispatch.targetAgent,
        status:'blocked',error:String(error.message||error).slice(0,2000)});
    }
  }
  return outcomes;
}

async function ingestDossierReviews(store,options={}){
  const reviews=await store.listDossierReviews('queued'); const outcomes=[];
  // Before anything else: a rejected trail owns no queued work. Catches what
  // earlier rejections orphaned, and any route to `rejected` that does not
  // come through applyDossierReview.
  const swept=await cancelOrphanedRejectedJobs(store,
    await store.getArtifact('trail-orchestration'),iso(options.now||new Date()));
  if(swept.length)outcomes.push({status:'stopped-orphaned-jobs',stoppedJobs:swept.length});
  for(const review of reviews){
    try{
      const [orchestration,reviewQueue]=await Promise.all([
        store.getArtifact('trail-orchestration'),store.getArtifact('dossier-review-queue'),
      ]);
      if(!orchestration||!reviewQueue)throw new Error('Trail orchestration artifacts are not seeded');
      // An approval reads the claims' sources, and compaction removes them from
      // a waiting item, leaving a pointer. Follow it first, for this one item,
      // or the gate refuses evidence that exists. Nothing persists: an approved
      // item becomes decided and has its outputs dropped on the way out.
      const decided=review.action==='approve'
        ? await rehydrateReviewQueue(store,reviewQueue,review.reviewId)
        : reviewQueue;
      const result=applyDossierReview(orchestration,decided,review,{at:iso(review.submittedAt)});
      for(const job of result.jobs)await store.putJob(job);
      const stopped=await cancelJobsForRejectedTrail(store,result.cancelJobIds,iso(review.submittedAt));
      const writes=[];
      if(result.verifiedDossier){
        const [registryValue,editorialQueue]=await Promise.all([store.getArtifact('orma-verified-registry-live'),store.getArtifact('verified-trail-editorial-queue')]);
        const registry=registryValue||{contractVersion:'1.0.0',status:'active',verified:[],publicMutationAllowed:false,publicationAuthorized:false};
        registry.generatedAt=iso(review.submittedAt);registry.verified=[...(registry.verified||[]).filter(item=>item.candidateId!==result.verifiedRecord.candidateId),result.verifiedRecord];
        const production=options.productionTrails||loadProductionTrails(path.resolve(__dirname,'../..'));
        const preserveExistingAssets=production.some(trail=>trail.id===result.verifiedDossier.trailId&&isCurrentSiteTrail(trail));
        const handoff=buildVerifiedEditorialHandoff(result.verifiedDossier,result.verifiedRecord,editorialQueue,
          {at:iso(review.submittedAt),preserveExistingAssets});
        for(const job of handoff.jobs){const created=typeof store.putJobIfAbsent==='function'?await store.putJobIfAbsent(job):(await store.putJob(job),true);if(created)result.jobs.push(job);}
        writes.push(store.setArtifact(`verified-dossier-${result.verifiedDossier.candidateId}`,result.verifiedDossier),
          store.setArtifact(`route-proposal-${result.verifiedDossier.candidateId}`,{contractVersion:'1.0.0',candidateId:result.verifiedDossier.candidateId,geometry:result.verifiedDossier.routeGeometry,approvedAt:iso(review.submittedAt),publicMutationAllowed:false}),
          store.setArtifact('orma-verified-registry-live',registry),
          store.setArtifact('verified-trail-editorial-queue',handoff.queue,{lastVerifiedCandidateId:result.verifiedDossier.candidateId}));
      }
      await Promise.all([
        store.setArtifact('trail-orchestration',result.orchestration),
        store.setArtifact('dossier-review-queue',result.reviewQueue),
        store.markDossierReview(review.id,'processed',{queuedJobIds:result.jobs.map(job=>job.id)}),
        ...writes,
      ]);
      outcomes.push({reviewId:review.id,status:'processed',queuedJobs:result.jobs.length,
        ...(stopped.length?{stoppedJobs:stopped.length}:{}),ormaVerified:!!result.verifiedDossier});
    }catch(error){
      await store.markDossierReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});
      outcomes.push({reviewId:review.id,status:'blocked',error:error.message});
    }
  }
  return outcomes;
}

/**
 * Write a cited recommendation onto the gates that are genuinely hers.
 *
 * Runs after the dispatch and apply steps on purpose: a gate being handed back
 * to an agent is about to have different blockers, so adjudicating it would
 * spend a model call on a question that is already changing. What is left here
 * is a gate nobody can clear by re-running an agent — the ones she has to
 * decide, and the ones she cannot research from a review card.
 *
 * It recommends only. Nothing is accepted, nothing is approved, and the
 * artifact it writes is never read by the apply path.
 */
async function adjudicateStandingGates(store,options={}){
  if(options.gateAdjudicationEnabled===false)return [];
  if(typeof store.getArtifact!=='function'||typeof store.setArtifact!=='function')return [];
  const limit=Number.isInteger(options.gateAdjudicationLimit)&&options.gateAdjudicationLimit>0
    ?options.gateAdjudicationLimit:2;
  const reviewQueue=await store.getArtifact('dossier-review-queue');
  if(!reviewQueue)return [];
  let stored=await store.getArtifact('gate-adjudications');
  const byReview=new Map((stored?.items||[]).map(item=>[String(item.reviewId),item]));
  const waiting=(reviewQueue.items||[]).filter(item=>item.state==='awaiting-human'
    &&adjudicableBlockers(item).length
    // A recommendation already standing against this exact blocker set is the
    // answer; re-asking costs a model call to learn the same thing.
    &&!adjudicationMatches(byReview.get(String(item.reviewId)),item));
  const trailById=new Map((options.productionTrails||[]).map(trail=>[String(trail.id),trail]));
  const outcomes=[];
  // Two gates a pass, so which two matters. A contested blocker is where a
  // cited recommendation is worth most -- the sources exist and disagree, and
  // somebody has to weigh them -- while a gate that is all missing work is
  // better served by the dispatch asking the agent again. Ties keep queue
  // order, which is oldest gate first.
  const ranked=waiting
    .map((item,index)=>({item,index,contested:contestedCount(item)}))
    .sort((a,b)=>b.contested-a.contested||a.index-b.index)
    .map(entry=>entry.item);
  for(const item of ranked.slice(0,limit)){
    try{
      const adjudication=await adjudicateGateBlockers(item,{at:options.at,
        trail:trailById.get(String(item.trailId||item.candidateId))||null,
        runAgent:options.runAgent,clientOptions:options.clientOptions});
      stored=mergeAdjudications(stored,adjudication);
      await store.setArtifact('gate-adjudications',stored);
      outcomes.push({reviewId:item.reviewId,candidateId:item.candidateId,status:'adjudicated',
        recommended:adjudication.verdicts.filter(verdict=>verdict.recommendation==='accept').length,
        verdicts:adjudication.verdicts.length,dropped:adjudication.dropped.length});
    }catch(error){
      outcomes.push({reviewId:item.reviewId,candidateId:item.candidateId,status:'adjudication-failed',
        error:String(error.message||error).slice(0,2000)});
    }
  }
  return outcomes;
}

async function ingestNewTrailReviews(store){
  if(typeof store.listNewTrailReviews!=='function')return [];
  const reviews=await store.listNewTrailReviews('queued');const outcomes=[];const effectiveByCandidate=new Map();
  for(const review of reviews){const current=effectiveByCandidate.get(review.candidateId);const key=`${iso(review.submittedAt)}:${review.id}`;const currentKey=current?`${iso(current.submittedAt)}:${current.id}`:'';if(!current||key>currentKey)effectiveByCandidate.set(review.candidateId,review);}
  for(const review of reviews){const effective=effectiveByCandidate.get(review.candidateId);if(effective?.id===review.id)continue;await store.markNewTrailReview(review.id,'superseded',{supersededBy:effective.id});outcomes.push({reviewId:review.id,status:'superseded',supersededBy:effective.id});}
  let ledger=await store.getArtifact('new-trail-scouting-review')||{contractVersion:'1.0.0',updatedAt:null,decisions:[],intake:[]};
  for(const review of effectiveByCandidate.values()){
    try{
      const packet=await store.getArtifact('new-trail-scouting');if(!packet)throw new Error('New Trail scouting packet is not available');
      ledger=applyNewTrailReview(packet,ledger,review,{at:iso(review.submittedAt),reviewedBy:review.submittedBy||'moderator'});
      let intake={jobIds:[],summary:{selected:0,admitted:0,waiting:0}};
      if(review.action==='send-to-verification')intake=await admitNewTrailIntake(store,packet,ledger,{at:iso(review.submittedAt),capacity:DEFAULT_TRAIL_CAPACITY});
      await Promise.all([store.setArtifact('new-trail-scouting-review',ledger,{lastDecisionId:review.id}),
        store.markNewTrailReview(review.id,'processed',{outcome:{action:review.action,jobIds:intake.jobIds||[],summary:intake.summary}})]);
      outcomes.push({reviewId:review.id,candidateId:review.candidateId,status:'processed',action:review.action,jobIds:intake.jobIds||[]});
    }catch(error){await store.markNewTrailReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({reviewId:review.id,candidateId:review.candidateId,status:'blocked',error:error.message});}
  }
  return outcomes;
}

async function ingestHazardReviews(store){
  if(typeof store.listHazardReviews!=='function')return [];
  const reviews=await store.listHazardReviews('queued');const outcomes=[];const effectiveByHazard=new Map();
  for(const review of reviews){const current=effectiveByHazard.get(review.hazardId);const key=`${iso(review.submittedAt)}:${review.id}`;const currentKey=current?`${iso(current.submittedAt)}:${current.id}`:'';if(!current||key>currentKey)effectiveByHazard.set(review.hazardId,review);}
  for(const review of reviews){const effective=effectiveByHazard.get(review.hazardId);if(effective?.id===review.id)continue;await store.markHazardReview(review.id,'superseded',{supersededBy:effective.id});outcomes.push({reviewId:review.id,status:'superseded',supersededBy:effective.id});}
  let ledger=await store.getArtifact('hazard-review-ledger')||{contractVersion:'1.0.0',updatedAt:null,decisions:[]};
  for(const review of effectiveByHazard.values()){
    try{
      const publicData=await store.getArtifact('dynamic-hazards');if(!publicData)throw new Error('Protected hazard state is not available');
      const result=applyHazardReview(publicData,ledger,review,{at:iso(review.submittedAt)});ledger=result.ledger;
      const reviewQueue={contractVersion:'1.0.0',generatedAt:iso(review.submittedAt),items:(result.publicData.hazards||[]).filter(item=>item.state==='resolution-review'),publicMutationAllowed:false};
      const release=await store.getArtifact('hazard-release-receipts')||{contractVersion:'1.0.0',receipts:[]};
      const receipt={id:review.id,hazardId:review.hazardId,action:review.action,status:'protected-update-applied',websiteState:'publication-integration-pending',reviewedAt:iso(review.submittedAt),publicMutationAllowed:false};
      const releaseNext={...release,updatedAt:iso(review.submittedAt),receipts:[...(release.receipts||[]).filter(item=>item.id!==receipt.id),receipt].slice(-100)};
      await Promise.all([store.setArtifact('dynamic-hazards',{...result.publicData,publicMutationAllowed:false},{lastHazardDecisionId:review.id}),store.setArtifact('hazard-review-queue',reviewQueue),store.setArtifact('hazard-review-ledger',ledger),store.setArtifact('hazard-release-receipts',releaseNext),store.markHazardReview(review.id,'processed',{outcome:receipt})]);
      outcomes.push({reviewId:review.id,hazardId:review.hazardId,status:'processed',action:review.action,websiteState:receipt.websiteState});
    }catch(error){await store.markHazardReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({reviewId:review.id,hazardId:review.hazardId,status:'blocked',error:error.message});}
  }
  return outcomes;
}

// Customer hazard reports never wait for a person. Each pending report is vetted
// against independent sources by the Hazard Analyst, then published, published
// under an explicit unverified label, or rejected. Published community hazards
// re-check themselves and expire without asking.
async function processCommunityHazardReports(store,options={}){
  if(typeof store.listHazardReports!=='function')return {vetted:[],expired:0,revetted:0};
  const at=options.at||new Date().toISOString();
  const limit=options.hazardReportLimit||3;
  const outcomes=[];
  let publicData=await store.getArtifact('dynamic-hazards')||{contractVersion:'1.0.0',hazards:[]};

  const lifecycle=expireCommunityHazards(publicData,{at});
  publicData=lifecycle.publicData;

  const pending=await store.listHazardReports('pending',limit);
  const revet=lifecycle.dueForRevetting.slice(0,Math.max(0,limit-pending.length));
  // A re-check must not cost a hazard its position. The hazard is rebuilt from
  // the report it came from, so the position it already carries has to travel
  // with it or every daily re-vetting would quietly unplace it.
  const reports=[...pending,...revet.map(hazard=>({id:hazard.reportId,trailId:hazard.trailIds?.[0],
    trailName:hazard.trailNames?.[0],category:hazard.event,description:hazard.message,
    area:hazard.area,createdAt:hazard.reportedAt,location:hazard.at||null,revetting:true}))];

  // The path the Analyst's coordinate is measured against. Without it a located
  // hazard cannot be placed, so it is looked up once per report rather than
  // left to the agent to assert.
  const trailPathFor=id=>{
    const trail=id&&typeof options.trailById?.get==='function'?options.trailById.get(id):null;
    return Array.isArray(trail?.path)?trail.path:null;
  };

  for(const report of reports){
    try{
      const vetting=await runHazardVetting(report,{...options,at,trailPath:trailPathFor(report.trailId)});
      const applied=applyHazardVetting(publicData,report,vetting,{at});
      publicData=applied.publicData;
      await store.markHazardReport(report.id,applied.status,{verdict:vetting.verdict,
        sourceCount:(vetting.sources||[]).length,hazardId:applied.hazard?.id||null});
      outcomes.push({reportId:report.id,status:applied.status,verdict:vetting.verdict,revetting:!!report.revetting});
    }catch(error){
      outcomes.push({reportId:report.id,status:'vetting-failed',error:String(error.message||error).slice(0,2000)});
    }
  }

  if(lifecycle.expired.length||outcomes.some(item=>item.status!=='vetting-failed')){
    await store.setArtifact('dynamic-hazards',{...publicData,publicMutationAllowed:false},{lastCommunityVettingAt:at});
  }
  return {vetted:outcomes,expired:lifecycle.expired.length,revetted:revet.length};
}

async function runLiveBackofficeWorker(store, options = {}){
  const productionTrails=options.productionTrails||loadProductionTrails(path.resolve(__dirname,'../..'));
  const siteTrails=currentSiteTrails(productionTrails);
  const campaign=await runScheduledTrailCampaign(store,siteTrails,{enabled:options.campaignEnabled===true,
    at:options.at,limit:options.campaignLimit||DEFAULT_CAMPAIGN_LIMIT,capacity:options.campaignCapacity||DEFAULT_TRAIL_CAPACITY,
    queueCapacity:options.campaignQueueCapacity,trigger:options.campaignTrigger,
    workflowRunUrl:options.workflowRunUrl,runId:options.runId});
  const newTrailReviews=await ingestNewTrailReviews(store);
  const hazardReviews=await ingestHazardReviews(store);
  const communityHazards=await processCommunityHazardReports(store,
    {...options,trailById:new Map(productionTrails.map(trail=>[trail.id,trail]))});
  const recoveredJobs = typeof store.recoverExpiredJobs === 'function'
    ? await store.recoverExpiredJobs(options)
    : [];
  // Work retired by a provider outage before the outage guard existed. Blocked
  // is terminal and putJobIfAbsent will not recreate an existing job, so this is
  // the only way those trails re-enter the queue. Bounded per pass so a backlog
  // drains steadily instead of arriving all at once.
  const requeuedAfterOutage = typeof store.requeueOutageBlockedJobs === 'function'
    ? await store.requeueOutageBlockedJobs({ ...options, limit: options.outageRequeueLimit,
        jobTypes: PROCESSABLE_JOB_TYPES })
    : [];
  const routeReviews=await ingestRouteReviews(store);
  const routeAdmissions=await admitRouteChoices(store,{...options,productionTrails});
  // Before the apply step, so a gate dispatched here becomes a queued agent
  // job in this same pass rather than waiting three hours for the next one.
  const gateDispatches=await dispatchUnansweredGates(store,options);
  const automatedGates=[];const dossierReviews=[];
  automatedGates.push(...await automateEvidenceGates(store,{...options,productionTrails:siteTrails}));
  dossierReviews.push(...await ingestDossierReviews(store,{...options,productionTrails}));
  const advancementBefore=await advanceTrailOrchestration(store,options);
  // Advancement can open a clean geometry or dossier gate. Decide it in the
  // same pass so "automatic" never means "wait three hours at a human desk".
  automatedGates.push(...await automateEvidenceGates(store,{...options,productionTrails:siteTrails}));
  dossierReviews.push(...await ingestDossierReviews(store,{...options,productionTrails}));
  const reviews = await ingestTrailReviews(store, options);
  const specialistJobs=await processTrailSpecialistJobs(store,{...options,productionTrails});
  const advancementAfter=await advanceTrailOrchestration(store,options);
  automatedGates.push(...await automateEvidenceGates(store,{...options,productionTrails:siteTrails}));
  dossierReviews.push(...await ingestDossierReviews(store,{...options,productionTrails}));
  // Last of the gate lanes, after every automatic decision this pass can make
  // and after the gates going back to an agent are gone. What is still waiting
  // here is hers, so this is the only set worth researching a recommendation
  // for -- and a web search spent on a gate that was about to be decided
  // automatically is a web search wasted.
  const gateAdjudications=await adjudicateStandingGates(store,{...options,productionTrails});
  const editorialFirstPass=await processEditorialFirstPassJobs(store,{...options,productionTrails:siteTrails});
  const jobs = await processRevisionJobs(store, options);
  const automatedEditorial=await automateEditorialReviews(store,{...options,productionTrails:siteTrails});
  reviews.push(...await ingestTrailReviews(store,{...options,productionTrails}));
  const automatedPublications=await automatePublicationReviews(store,{...options,productionTrails:siteTrails});
  const publications = await ingestPublicationReviews(store);
  // Last, so it describes the pipeline as this pass leaves it. The desk cannot
  // afford to list jobs itself -- it polls once a minute against a free-tier
  // quota -- so the one place already holding every job writes the summary down.
  const pipeline = await recordPipelineHealth(store, options);
  // Beside it, and from the same already-loaded state: what the programme costs,
  // what it owes, and which of those nobody can decide their way out of.
  // Before the summary, so the summary can read today's running total. A pass
  // knows what it spent; only the total says what is left.
  const usageDay = await recordDayUsage(store, options);
  const programme = await recordProgrammeHealth(store,
    {...options,dayUsage:usageDay&&!usageDay.error?usageDay:null,
      jobsDone:(specialistJobs||[]).filter(job=>job.status==='completed').length});
  // The expansion programme's numbers come from the repository, not Firestore,
  // so the pass that has the checkout is the one that can write them down for a
  // desk that does not.
  const coverage = await recordRegionalCoverage(store,{...options,productionTrails:siteTrails});
  return { workerId:options.workerId || null,campaign,pipeline,programme,coverage,usageDay,newTrailReviews,hazardReviews,communityHazards,recoveredJobs,requeuedAfterOutage, routeReviews, routeAdmissions, gateDispatches,automatedGates, dossierReviews, gateAdjudications, advancementBefore,reviews,editorialFirstPass,automatedEditorial,jobs,specialistJobs,advancementAfter,automatedPublications,publications,completedAt:new Date().toISOString() };
}

/**
 * One artifact saying what is moving and what has stopped. Never fatal: a
 * failure to describe the pass must not fail the pass that did the work.
 */
/**
 * Add this pass's spend to today's running total.
 *
 * Deliberately last-but-one and never fatal: the figure is for a human to read,
 * and losing it must not fail a pass that did the work. The read and write it
 * costs are themselves counted on the next pass, which is honest.
 */
async function recordDayUsage(store, options = {}){
  try{
    if(typeof store.getArtifact!=='function'||typeof store.setArtifact!=='function')return null;
    const spent=typeof store.usage?.snapshot==='function'?store.usage.snapshot():null;
    if(!spent)return null;
    const previous=await store.getArtifact(USAGE_DAY_ARTIFACT);
    const next=accumulateUsage(previous,spent,options.at?new Date(options.at).valueOf():Date.now());
    await store.setArtifact(USAGE_DAY_ARTIFACT,next,{day:next.day,reads:next.reads});
    return next;
  }catch(error){
    return {error:String(error?.message||error).slice(0,200)};
  }
}

/**
 * Per-valley coverage, written where a desk can read it.
 *
 * The catalogue, the valley taxonomy and the per-valley evidence files are all
 * in the repository, so this costs no reads to derive -- but the hosted
 * backoffice is served without `data/` or `backoffice-data/` (the
 * private-hosting-boundary rule), so a desk cannot read them. The worker has
 * both the checkout and the credential, so it is the one place that can join
 * them and write the result down.
 *
 * Never fatal, for the same reason the other summaries are not.
 */
async function recordRegionalCoverage(store, options = {}){
  try{
    if(typeof store.setArtifact!=='function')return null;
    const root=path.resolve(__dirname,'../..');
    const research=[];
    const dir=path.join(root,'backoffice-data/valley-research');
    if(fs.existsSync(dir)){
      for(const name of fs.readdirSync(dir).filter(file=>file.endsWith('.json'))){
        try{research.push(JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')));}catch{/* a damaged file is not a reason to lose the rest */}
      }
    }
    const scouting=await store.getArtifact('new-trail-scouting');
    const coverage=summariseRegionalCoverage({
      trails:options.productionTrails||loadProductionTrails(root),
      valleyResearch:research,
      scoutingCandidates:(scouting&&scouting.candidates)||[],
      nearestLocality:nearestLocalityFor(root),
      at:options.at||new Date().toISOString(),
    });
    await store.setArtifact('regional-coverage',coverage,
      {programme:coverage.programme,valleys:coverage.totals.valleys});
    return coverage;
  }catch(error){
    return {error:String(error?.message||error).slice(0,200)};
  }
}

/**
 * The five things the catalogue-verification lane has to answer about itself.
 * Never fatal: failing to describe a pass must not fail the pass that did the
 * work, which is the rule recordPipelineHealth already follows.
 */
async function recordProgrammeHealth(store, options = {}){
  try{
    if(typeof store.getArtifact!=='function'||typeof store.setArtifact!=='function')return null;
    const orchestration=await store.getArtifact('trail-orchestration');
    if(!orchestration)return null;
    const health=summariseProgrammeHealth({
      orchestration,
      jobs:await store.listJobs(['queued','running','ready-for-review','blocked']),
      reviewQueue:await store.getArtifact('dossier-review-queue'),
      // The meter counts this store, so it is this pass's spend.
      usage:typeof store.usage?.snapshot==='function'?store.usage.snapshot():undefined,
      jobsDone:options.jobsDone||0,
      dayUsage:options.dayUsage||null,
      nowMs:options.at?new Date(options.at).valueOf():Date.now(),
    });
    await store.setArtifact('programme-health',health,
      {programme:health.programme,unwaivableOpen:health.evidenceGaps.unwaivableOpen});
    return health;
  }catch(error){
    return {error:String(error?.message||error).slice(0,200)};
  }
}

async function recordPipelineHealth(store, options = {}){
  try{
    if(typeof store.listJobs !== 'function' || typeof store.setArtifact !== 'function') return null;
    const jobs = await store.listJobs(['queued','running','ready-for-review','blocked']);
    // The same list requeueOutageBlockedJobs filters on, so the desk cannot
    // promise a restart this worker will not make.
    const health = summarisePipeline(jobs, { at:options.at || new Date().toISOString(),
      processableJobTypes:PROCESSABLE_JOB_TYPES });
    await store.setArtifact('pipeline-health', health, { stopped:health.stopped.total });
    return health;
  }catch(error){
    return { error:String(error?.message || error).slice(0,200) };
  }
}

module.exports = { PROCESSABLE_JOB_TYPES,ATTEMPTS_PER_SLOT,SPECIALIST_CONCURRENCY,mapWithConcurrency,claimNotBefore, recordPipelineHealth,recordProgrammeHealth,recordRegionalCoverage,recordDayUsage, iso, processCommunityHazardReports, ingestTrailReviews, processRevisionJobs,processEditorialFirstPassJobs,processTrailSpecialistJobs,dispatchUnansweredGates,adjudicateStandingGates,ingestDossierReviews,ingestRouteReviews,promoteOwedLines,admitRouteChoices,ingestNewTrailReviews,ingestHazardReviews,ingestPublicationReviews,runLiveBackofficeWorker };
