'use strict';

const {randomUUID}=require('crypto');
const {applyProductIdeaReview}=require('./product-ideas-review');
const {runFocusedInvestigation}=require('./run-product-discovery');
const {createStructuredResponse}=require('../services/openai-responses-client');

const PRODUCT_MOCKUP_SCHEMA={type:'object',additionalProperties:false,properties:{
  mockupTitle:{type:'string'},userProblem:{type:'string'},decisionRationale:{type:'string'},
  screens:{type:'array',minItems:1,maxItems:5,items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},objective:{type:'string'},blocks:{type:'array',minItems:1,maxItems:8,items:{type:'object',additionalProperties:false,properties:{label:{type:'string'},content:{type:'string'},interaction:{type:'string'}},required:['label','content','interaction']}}},required:['name','objective','blocks']}},
  userFlow:{type:'array',items:{type:'string'}},successCriteria:{type:'array',items:{type:'string'}},constraints:{type:'array',items:{type:'string'}},implementationNotes:{type:'array',items:{type:'string'}},
},required:['mockupTitle','userProblem','decisionRationale','screens','userFlow','successCriteria','constraints','implementationNotes']};

function iso(value){if(!value)return new Date().toISOString();if(typeof value==='string')return value;if(typeof value.toDate==='function')return value.toDate().toISOString();return new Date(value).toISOString();}
function latestBySubject(reviews){const latest=new Map();for(const review of reviews){const key=`${review.subjectType||'idea'}:${review.ideaId}`;const current=latest.get(key);const stamp=`${iso(review.submittedAt)}:${review.id}`;const currentStamp=current?`${iso(current.submittedAt)}:${current.id}`:'';if(!current||stamp>currentStamp)latest.set(key,review);}return latest;}

async function runProductDesigner(idea,focus,previousMockup,options={}){
  const runAgent=options.runAgent||createStructuredResponse;const response=await runAgent({schemaName:'orma_product_mockup',schema:PRODUCT_MOCKUP_SCHEMA,webSearch:false,messages:[{role:'developer',content:[
    'You are the ORMA Product Designer. Turn one CEO-prioritised Analyst opportunity into a concrete reviewable low-fidelity product mock-up.',
    'Describe screens as structured interface blocks so the protected backoffice can render them as wireframes.',
    'Respect ORMA dog-first hiking, evidence, safety and premium design principles. Do not write implementation code and do not claim development is authorised.',
    previousMockup?'Revise the prior mock-up literally according to the CEO note.':'Create the first mock-up.',
  ].join('\n')},{role:'user',content:`Opportunity:\n${JSON.stringify(idea,null,2)}\n\nCEO direction:\n${focus||idea.ormaOpportunity}${previousMockup?`\n\nPrevious mock-up:\n${JSON.stringify(previousMockup,null,2).slice(0,30000)}`:''}`} ]},options.clientOptions||{});
  return {contractVersion:'1.0.0',ideaId:idea.id,generatedAt:options.at||new Date().toISOString(),mode:'design-review-only',implementationAuthorized:false,publicMutationAllowed:false,model:response.model||null,responseId:response.responseId||null,...response.data};
}

async function ingestAnalystReviews(store){
  if(typeof store.listAnalystReviews!=='function')return [];
  const reviews=await store.listAnalystReviews('queued');const outcomes=[];const effective=latestBySubject(reviews);let queue=await store.getArtifact('product-ideas-review')||{contractVersion:'1.0.0',decisions:[],jobs:[]};
  for(const review of reviews){const selected=effective.get(`${review.subjectType||'idea'}:${review.ideaId}`);if(selected?.id===review.id)continue;await store.markAnalystReview(review.id,'superseded',{supersededBy:selected.id});outcomes.push({reviewId:review.id,status:'superseded'});}
  for(const review of effective.values()){
    try{
      const packet=await store.getArtifact('product-ideas');const idea=(packet?.ideas||[]).find(item=>item.id===review.ideaId);if(!idea)throw new Error('Analyst opportunity is unavailable');const at=iso(review.submittedAt);
      if((review.subjectType||'idea')==='mockup'){
        const designs=await store.getArtifact('product-design-results')||{items:[]};const prior=(designs.items||[]).filter(item=>item.ideaId===review.ideaId).sort((a,b)=>String(b.generatedAt).localeCompare(String(a.generatedAt)))[0];if(!prior)throw new Error('Designer mock-up is unavailable');
        if(review.action==='approve-mockup-for-developer-brief'){
          const job={id:`product-development-handoff-${review.ideaId}-${review.id}`,jobType:'product-development-handoff',agentId:'developer',status:'ready-for-review',createdAt:at,ideaId:review.ideaId,reviewId:review.id,inputRef:'firestore:product-design-results',humanGate:'implementation-scope-approval',implementationAuthorized:false,publicMutationAllowed:false};await (typeof store.putJobIfAbsent==='function'?store.putJobIfAbsent(job):store.putJob(job));const receipt={status:'developer-handoff-ready',jobId:job.id,next:'Explicit implementation scope approval, implementation checks, then Release.',implementationAuthorized:false,publicMutationAllowed:false};await store.markAnalystReview(review.id,'processed',{outcome:receipt});outcomes.push({reviewId:review.id,status:'processed',action:review.action,jobId:job.id});continue;
        }
        if(review.action==='reject-mockup'){await store.markAnalystReview(review.id,'processed',{outcome:{status:'mockup-rejected',implementationAuthorized:false,publicMutationAllowed:false}});outcomes.push({reviewId:review.id,status:'processed',action:review.action});continue;}
        if(review.action!=='request-mockup-revision')throw new Error('Mock-up action is invalid');
        const job={id:`hosted-product-design-revision-${review.ideaId}-${review.id}`,jobType:'hosted-product-design',agentId:'productDesigner',status:'queued',createdAt:at,ideaId:review.ideaId,reviewId:review.id,focus:String(review.note||'').trim(),previousMockup:prior,humanGate:'ceo-mockup-approval',implementationAuthorized:false,publicMutationAllowed:false};await (typeof store.putJobIfAbsent==='function'?store.putJobIfAbsent(job):store.putJob(job));await store.markAnalystReview(review.id,'processing',{outcome:{status:'queued',jobId:job.id,next:'revised-mockup-review'}});outcomes.push({reviewId:review.id,status:'processing',jobId:job.id});continue;
      }
      if(!['prioritise','investigate-further','park','dismiss'].includes(review.action))throw new Error('Analyst idea action is invalid');
      queue=applyProductIdeaReview(packet,queue,{ideaId:review.ideaId,action:review.action,note:review.note},at);const decision=queue.decisions.find(item=>item.ideaId===review.ideaId);if(decision)decision.reviewedBy=review.submittedBy||'moderator';await store.setArtifact('product-ideas-review',queue,{lastReviewId:review.id});const planned=(queue.jobs||[]).filter(job=>job.ideaId===review.ideaId&&job.status==='queued').at(-1);
      if(!planned){await store.markAnalystReview(review.id,'processed',{outcome:{status:review.action,implementationAuthorized:false,publicMutationAllowed:false}});outcomes.push({reviewId:review.id,status:'processed',action:review.action});continue;}
      const jobType=planned.agentId==='marketOpportunity'?'hosted-product-investigation':'hosted-product-design';const job={...planned,id:planned.jobId,jobType,reviewId:review.id,status:'queued',focus:planned.focus||planned.brief||'',implementationAuthorized:false};const created=typeof store.putJobIfAbsent==='function'?await store.putJobIfAbsent(job):(await store.putJob(job),true);await store.markAnalystReview(review.id,'processing',{outcome:{status:created?'queued':'already-queued',jobId:job.id,next:jobType==='hosted-product-investigation'?'expanded-investigation':'designer-mockup'}});outcomes.push({reviewId:review.id,status:'processing',jobId:job.id});
    }catch(error){await store.markAnalystReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({reviewId:review.id,status:'blocked',error:error.message});}
  }
  return outcomes;
}

async function processAnalystJobs(store,options={}){
  const workerId=options.workerId||`orma-worker-${randomUUID()}`;const queued=(await store.listJobs(['queued'])).filter(job=>['hosted-product-investigation','hosted-product-design'].includes(job.jobType));const outcomes=[];
  for(const pending of queued.slice(0,options.analystLimit||2)){
    const job=await store.claimJob(pending.id,workerId);if(!job)continue;
    try{
      const packet=await store.getArtifact('product-ideas');const idea=(packet?.ideas||[]).find(item=>item.id===job.ideaId);if(!idea)throw new Error('Analyst opportunity is unavailable');let result;let resultArtifact;
      if(job.jobType==='hosted-product-investigation'){result=await (options.runFocusedInvestigation||runFocusedInvestigation)(idea,job.focus,{at:options.at,...(options.investigationOptions||{})});resultArtifact='product-investigation-results';}
      else{result=await (options.runProductDesigner||runProductDesigner)(idea,job.focus,job.previousMockup,{at:options.at,...(options.designerOptions||{})});resultArtifact='product-design-results';}
      const artifact=await store.getArtifact(resultArtifact)||{contractVersion:'1.0.0',items:[]};const next={...artifact,updatedAt:result.generatedAt,items:[...(artifact.items||[]),{...result,reviewId:job.reviewId,jobId:job.id}].slice(-100)};let queue=await store.getArtifact('product-ideas-review')||{contractVersion:'1.0.0',decisions:[],jobs:[]};queue={...queue,updatedAt:result.generatedAt,jobs:(queue.jobs||[]).map(item=>item.jobId===job.id?{...item,status:'ready-for-review',completedAt:result.generatedAt,result}:item)};const outcome={status:job.jobType==='hosted-product-investigation'?'investigation-ready':'mockup-ready',outputRef:`firestore:${resultArtifact}`,generatedAt:result.generatedAt,implementationAuthorized:false,publicMutationAllowed:false};await Promise.all([store.setArtifact(resultArtifact,next,{lastWorkerId:workerId}),store.setArtifact('product-ideas-review',queue,{lastWorkerId:workerId}),store.completeSystemJob(job.id,{outputRef:`firestore:${resultArtifact}`}),store.markAnalystReview(job.reviewId,'processed',{outcome})]);outcomes.push({jobId:job.id,reviewId:job.reviewId,status:outcome.status});
    }catch(error){const failures=Number(job.systemFailures||0)+1;await store.failJob(job.id,error,{maximumFailures:3});if(failures>=3)await store.markAnalystReview(job.reviewId,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({jobId:job.id,status:'retry-or-blocked',error:error.message});}
  }
  return outcomes;
}

module.exports={PRODUCT_MOCKUP_SCHEMA,iso,latestBySubject,runProductDesigner,ingestAnalystReviews,processAnalystJobs};
