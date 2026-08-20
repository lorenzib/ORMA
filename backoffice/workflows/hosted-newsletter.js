'use strict';

const {randomUUID}=require('crypto');
const {runNewsletter}=require('./run-newsletter');

function iso(value){if(!value)return new Date().toISOString();if(typeof value==='string')return value;if(typeof value.toDate==='function')return value.toDate().toISOString();return new Date(value).toISOString();}
function latestByPacket(reviews){const latest=new Map();for(const review of reviews){const current=latest.get(review.packetGeneratedAt);const key=`${iso(review.submittedAt)}:${review.id}`;const currentKey=current?`${iso(current.submittedAt)}:${current.id}`:'';if(!current||key>currentKey)latest.set(review.packetGeneratedAt,review);}return latest;}

async function ingestNewsletterReviews(store){
  if(typeof store.listNewsletterReviews!=='function')return [];
  const reviews=await store.listNewsletterReviews('queued');const outcomes=[];const effective=latestByPacket(reviews);let ledger=await store.getArtifact('newsletter-review-ledger')||{contractVersion:'1.0.0',updatedAt:null,decisions:[]};
  for(const review of reviews){const selected=effective.get(review.packetGeneratedAt);if(selected?.id===review.id)continue;await store.markNewsletterReview(review.id,'superseded',{supersededBy:selected.id});outcomes.push({reviewId:review.id,status:'superseded'});}
  for(const review of effective.values()){
    try{
      const packet=await store.getArtifact('newsletter-review-packet');if(!packet||packet.generatedAt!==review.packetGeneratedAt)throw new Error('The newsletter draft changed. Reload the latest issue.');if(review.action==='request-revision'&&!String(review.note||'').trim())throw new Error('A revision note is required');const at=iso(review.submittedAt);
      const decision={reviewId:review.id,generatedAt:packet.generatedAt,issueId:packet.subject?.id,action:review.action,note:String(review.note||'').trim(),reviewedAt:at,reviewedBy:review.submittedBy||'moderator',status:review.action==='approve'?'approved-for-social-handoff':'revision-requested',publicMutationAllowed:false,sendingStatus:'not-connected'};
      ledger={...ledger,updatedAt:at,decisions:[...(ledger.decisions||[]).filter(item=>item.generatedAt!==packet.generatedAt),decision]};await store.setArtifact('newsletter-review-ledger',ledger,{lastReviewId:review.id});
      if(review.action==='approve'){
        const approved=await store.getArtifact('approved-newsletters')||{contractVersion:'1.0.0',issues:[]};const receipt={reviewId:review.id,issueId:packet.subject?.id,status:'approved-for-social-handoff',approvedAt:at,sendingStatus:'not-connected',socialStatus:'launch-gated',message:'Approved issue retained for Social and any future sending integration. Nothing was sent.',publicMutationAllowed:false};const next={...approved,updatedAt:at,issues:[...(approved.issues||[]).filter(item=>item.issueId!==receipt.issueId),{...receipt,packet}].slice(-30)};await Promise.all([store.setArtifact('approved-newsletters',next,{lastReviewId:review.id}),store.markNewsletterReview(review.id,'processed',{outcome:receipt})]);outcomes.push({reviewId:review.id,status:'processed',action:'approve',sendingStatus:'not-connected'});continue;
      }
      const inputId=`newsletter-review-input-${review.id}`;await store.setArtifact(inputId,{packet,note:decision.note,reviewId:review.id,submittedAt:at},{publicMutationAllowed:false});const job={id:`hosted-newsletter-revision-${review.id}`,jobType:'hosted-newsletter-revision',agentId:'copywriter',status:'queued',createdAt:at,reviewId:review.id,inputRef:`firestore:${inputId}`,humanGate:'newsletter-re-review',publicMutationAllowed:false};const created=typeof store.putJobIfAbsent==='function'?await store.putJobIfAbsent(job):(await store.putJob(job),true);await store.markNewsletterReview(review.id,'processing',{outcome:{status:created?'queued':'already-queued',jobId:job.id,next:'revised-issue-review'}});outcomes.push({reviewId:review.id,status:'processing',jobId:job.id});
    }catch(error){await store.markNewsletterReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({reviewId:review.id,status:'blocked',error:error.message});}
  }
  return outcomes;
}

async function processNewsletterJobs(store,options={}){
  const workerId=options.workerId||`orma-worker-${randomUUID()}`;const queued=(await store.listJobs(['queued'])).filter(job=>job.jobType==='hosted-newsletter-revision');const outcomes=[];
  for(const pending of queued.slice(0,options.newsletterLimit||1)){
    const job=await store.claimJob(pending.id,workerId);if(!job)continue;
    try{const input=await store.getArtifact(String(job.inputRef||'').replace(/^firestore:/,''));const inputs=await store.getArtifact('newsletter-inputs');if(!input?.packet||!inputs)throw new Error('Newsletter revision inputs are unavailable');const revised=await (options.runNewsletter||runNewsletter)(inputs,{root:options.root,at:options.at||new Date().toISOString(),revisionNote:input.note,previousPacket:input.packet,...(options.newsletterOptions||{})});if(!revised.summary.readyForReview)throw new Error(revised.outputs?.[0]?.error||'No reviewable newsletter revision was produced');await Promise.all([store.setArtifact('newsletter-review-packet',revised,{lastWorkerId:workerId}),store.completeSystemJob(job.id,{outputRef:'firestore:newsletter-review-packet'}),store.markNewsletterReview(job.reviewId,'processed',{outcome:{status:'revision-ready',generatedAt:revised.generatedAt,issueId:revised.subject?.id}})]);outcomes.push({jobId:job.id,reviewId:job.reviewId,status:'revision-ready'});}
    catch(error){const failures=Number(job.systemFailures||0)+1;await store.failJob(job.id,error,{maximumFailures:3});if(failures>=3)await store.markNewsletterReview(job.reviewId,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({jobId:job.id,status:'retry-or-blocked',error:error.message});}
  }
  return outcomes;
}

module.exports={iso,latestByPacket,ingestNewsletterReviews,processNewsletterJobs};
