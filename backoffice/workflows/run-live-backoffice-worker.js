'use strict';

const { randomUUID } = require('crypto');
const { recordVerifiedTrailReview } = require('./apply-content-review');
const { buildVerifiedTrailRevisionJobs } = require('./queue-verified-trail-revisions');
const { buildPublicationStaging } = require('./build-publication-staging');
const { runVerifiedTrailRevision } = require('./run-verified-trail-revision');
const { applyDossierReview } = require('./apply-dossier-review');
const { runTrailSpecialist } = require('./run-trail-specialist');
const { advanceTrailOrchestration } = require('./advance-trail-orchestration');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
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
      const staging = buildPublicationStaging(editorialQueue, execution, nextReviewQueue, { at:submittedAt });
      await Promise.all([
        store.setArtifact('content-review-queue', nextReviewQueue), store.setArtifact('publication-staging', staging),
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

async function processTrailSpecialistJobs(store,options={}){
  const workerId=options.workerId||`orma-worker-${randomUUID()}`;
  let queued=(await store.listJobs(['queued'])).filter(job=>['trail-verification-specialist','trail-claim-resolution'].includes(job.jobType));const outcomes=[];
  if(options.specialistCandidateId) queued=queued.filter(job=>job.candidateId===options.specialistCandidateId);
  const intake=await store.getArtifact('new-trail-intake');
  const trails=options.productionTrails||[...loadProductionTrails(path.resolve(__dirname,'../..')),...(intake?.candidates||[])];
  const trailById=new Map(trails.map(trail=>[trail.id,trail]));
  for(const pending of queued.slice(0,options.specialistLimit||5)){
    const job=await store.claimJob(pending.id,workerId);if(!job)continue;
    try{
      const trail=trailById.get(job.candidateId);if(!trail)throw new Error(`Production trail not found: ${job.candidateId}`);
      const context=[];
      for(const ref of job.inputRefs||[]){if(String(ref).startsWith('firestore:')){const artifact=await store.getArtifact(String(ref).slice(10));if(artifact)context.push(artifact);}}
      const response=await runTrailSpecialist({job,trail,context},options);
      await store.setArtifact(`trail-specialist-output-${job.id}`,response.result,{agentId:job.agentId,candidateId:job.candidateId});
      await store.completeSystemJob(job.id,{responseId:response.responseId,model:response.model,outputRef:`firestore:trail-specialist-output-${job.id}`});
      outcomes.push({jobId:job.id,agentId:job.agentId,status:'completed'});
    }catch(error){await store.failJob(job.id,error,{maximumFailures:3});outcomes.push({jobId:job.id,agentId:job.agentId,status:'retry-or-blocked',error:error.message});}
  }
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
        reviewedAt:iso(review.submittedAt), publicMutationAllowed:false };
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

async function ingestDossierReviews(store){
  const reviews=await store.listDossierReviews('queued'); const outcomes=[];
  for(const review of reviews){
    try{
      const [orchestration,reviewQueue]=await Promise.all([
        store.getArtifact('trail-orchestration'),store.getArtifact('dossier-review-queue'),
      ]);
      if(!orchestration||!reviewQueue)throw new Error('Trail orchestration artifacts are not seeded');
      const result=applyDossierReview(orchestration,reviewQueue,review,{at:iso(review.submittedAt)});
      for(const job of result.jobs)await store.putJob(job);
      const writes=[];
      if(result.verifiedDossier){
        const registry=await store.getArtifact('orma-verified-registry-live')||{contractVersion:'1.0.0',status:'active',verified:[],publicMutationAllowed:false,publicationAuthorized:false};
        registry.generatedAt=iso(review.submittedAt);registry.verified=[...(registry.verified||[]).filter(item=>item.candidateId!==result.verifiedRecord.candidateId),result.verifiedRecord];
        writes.push(store.setArtifact(`verified-dossier-${result.verifiedDossier.candidateId}`,result.verifiedDossier),store.setArtifact('orma-verified-registry-live',registry));
      }
      await Promise.all([
        store.setArtifact('trail-orchestration',result.orchestration),
        store.setArtifact('dossier-review-queue',result.reviewQueue),
        store.markDossierReview(review.id,'processed',{queuedJobIds:result.jobs.map(job=>job.id)}),
        ...writes,
      ]);
      outcomes.push({reviewId:review.id,status:'processed',queuedJobs:result.jobs.length,ormaVerified:!!result.verifiedDossier});
    }catch(error){
      await store.markDossierReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});
      outcomes.push({reviewId:review.id,status:'blocked',error:error.message});
    }
  }
  return outcomes;
}

async function runLiveBackofficeWorker(store, options = {}){
  const recoveredJobs = typeof store.recoverExpiredJobs === 'function'
    ? await store.recoverExpiredJobs(options)
    : [];
  const dossierReviews=await ingestDossierReviews(store);
  const advancementBefore=await advanceTrailOrchestration(store,options);
  const reviews = await ingestTrailReviews(store, options);
  const jobs = await processRevisionJobs(store, options);
  const specialistJobs=await processTrailSpecialistJobs(store,options);
  const advancementAfter=await advanceTrailOrchestration(store,options);
  const publications = await ingestPublicationReviews(store);
  return { workerId:options.workerId || null, recoveredJobs, dossierReviews, advancementBefore,reviews,jobs,specialistJobs,advancementAfter,publications,completedAt:new Date().toISOString() };
}

module.exports = { iso, ingestTrailReviews, processRevisionJobs,processTrailSpecialistJobs,ingestDossierReviews,ingestPublicationReviews,runLiveBackofficeWorker };
