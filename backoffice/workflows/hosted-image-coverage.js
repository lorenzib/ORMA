'use strict';

const {randomUUID}=require('crypto');
const {applyImageCoverageReview}=require('./image-coverage-review');
const {createStructuredResponse}=require('../services/openai-responses-client');

const IMAGE_SOURCE_SCHEMA={type:'object',additionalProperties:false,properties:{
  summary:{type:'string'},candidates:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{
    title:{type:'string'},sourcePageUrl:{type:['string','null']},assetUrl:{type:['string','null']},creator:{type:'string'},license:{type:'string'},licenseUrl:{type:['string','null']},rightsEvidence:{type:'string'},altText:{type:'string'},status:{type:'string',enum:['ready-for-asset-review','blocked','needs-generation']},generationPrompt:{type:['string','null']},
  },required:['title','sourcePageUrl','assetUrl','creator','license','licenseUrl','rightsEvidence','altText','status','generationPrompt']}},
},required:['summary','candidates']};

function iso(value){if(!value)return new Date().toISOString();if(typeof value==='string')return value;if(typeof value.toDate==='function')return value.toDate().toISOString();return new Date(value).toISOString();}

async function runImageSourcing(gap,job,options={}){
  const runAgent=options.runAgent||createStructuredResponse;const ai=job.sourcePreference==='generate-ai';
  const response=await runAgent({schemaName:'orma_image_coverage_source',schema:IMAGE_SOURCE_SCHEMA,webSearch:!ai,messages:[{role:'developer',content:[
    'You are the ORMA Visual Director. Work on one documented website image gap.',
    ai?'Prepare one precise AI image-generation brief. Do not claim an image exists; assetUrl must be null and status must be needs-generation.':'Find at most three genuinely reusable image candidates. Prefer authoritative first-party repositories such as Wikimedia Commons and verify creator, license, licence URL and direct asset URL. Mark uncertain rights as blocked.',
    'Never place or publish an image. Every actual asset must return for visual and rights approval.',
  ].join('\n')},{role:'user',content:`Image gap:\n${JSON.stringify(gap,null,2)}\n\nCEO direction:\n${job.brief||''}`} ]},options.clientOptions||{});
  return {contractVersion:'1.0.0',slug:gap.slug,generatedAt:options.at||new Date().toISOString(),sourcePreference:job.sourcePreference,publicMutationAllowed:false,...response.data};
}

function latestBySlug(reviews){const latest=new Map();for(const review of reviews){const current=latest.get(review.slug);const key=`${iso(review.submittedAt)}:${review.id}`;const currentKey=current?`${iso(current.submittedAt)}:${current.id}`:'';if(!current||key>currentKey)latest.set(review.slug,review);}return latest;}

async function ingestImageReviews(store){
  if(typeof store.listImageReviews!=='function')return [];
  const reviews=await store.listImageReviews('queued');const outcomes=[];const effective=latestBySlug(reviews);let queue=await store.getArtifact('image-coverage-review')||{contractVersion:'1.0.0',decisions:[],jobs:[]};
  for(const review of reviews){const selected=effective.get(review.slug);if(selected?.id===review.id)continue;await store.markImageReview(review.id,'superseded',{supersededBy:selected.id});outcomes.push({reviewId:review.id,status:'superseded'});}
  for(const review of effective.values()){
    try{
      const audit=await store.getArtifact('image-coverage');if(!audit)throw new Error('Image coverage audit is unavailable');
      queue=applyImageCoverageReview(audit,queue,{slug:review.slug,action:review.action,note:review.note,assetRef:review.assetRef},iso(review.submittedAt));
      const planned=(queue.jobs||[]).filter(job=>job.slug===review.slug&&job.status==='queued').at(-1);
      if(planned){const job={...planned,id:planned.jobId,jobType:'hosted-image-sourcing',reviewId:review.id,status:'queued',humanGate:'asset-and-rights-approval'};const created=typeof store.putJobIfAbsent==='function'?await store.putJobIfAbsent(job):(await store.putJob(job),true);await store.markImageReview(review.id,'processing',{outcome:{status:created?'queued':'already-queued',jobId:job.id,next:'visual-and-rights-review'}});outcomes.push({reviewId:review.id,status:'processing',jobId:job.id});}
      else{await store.markImageReview(review.id,'processed',{outcome:{status:'parked',publicMutationAllowed:false}});outcomes.push({reviewId:review.id,status:'processed',action:'park'});}
      await store.setArtifact('image-coverage-review',queue,{lastReviewId:review.id,publicMutationAllowed:false});
    }catch(error){await store.markImageReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({reviewId:review.id,status:'blocked',error:error.message});}
  }
  return outcomes;
}

async function processImageJobs(store,options={}){
  const workerId=options.workerId||`orma-worker-${randomUUID()}`;const queued=(await store.listJobs(['queued'])).filter(job=>job.jobType==='hosted-image-sourcing');const outcomes=[];
  for(const pending of queued.slice(0,options.imageLimit||2)){
    const job=await store.claimJob(pending.id,workerId);if(!job)continue;
    try{
      const audit=await store.getArtifact('image-coverage');const gap=(audit?.gaps||[]).find(item=>item.slug===job.slug);if(!gap)throw new Error('Image gap no longer exists');let result;
      if(job.sourcePreference==='use-orma-library'){
        const match=(gap.libraryMatches||[]).find(item=>(item.sourceRef||item.fileName)===job.assetRef);
        if(!match)throw new Error('The selected ORMA-owned image is no longer available');
        result={contractVersion:'1.0.0',slug:gap.slug,generatedAt:new Date().toISOString(),sourcePreference:job.sourcePreference,summary:'One ORMA-owned candidate is ready for visual placement review.',candidates:[{title:match.fileName||gap.title,sourcePageUrl:null,assetUrl:match.sourceRef||job.assetRef,creator:'ORMA',license:'ORMA-owned',licenseUrl:null,rightsEvidence:'Selected from the protected ORMA repository inventory.',altText:gap.title,status:'ready-for-asset-review',generationPrompt:null}],publicMutationAllowed:false};
      }else if(job.sourcePreference==='check-personal-library'){
        result={contractVersion:'1.0.0',slug:gap.slug,generatedAt:new Date().toISOString(),sourcePreference:job.sourcePreference,summary:'The hosted worker cannot inspect a private Mac photo folder. Upload or register the chosen owned photo before asset approval.',candidates:[],status:'needs-owner-upload',publicMutationAllowed:false};
      }else result=await runImageSourcing(gap,job,options);
      const artifact=await store.getArtifact('image-coverage-results')||{contractVersion:'1.0.0',items:[]};const next={...artifact,updatedAt:result.generatedAt,items:[...(artifact.items||[]).filter(item=>item.slug!==job.slug),{...result,reviewId:job.reviewId}].slice(-100)};
      await Promise.all([store.setArtifact('image-coverage-results',next,{lastWorkerId:workerId}),store.completeSystemJob(job.id,{outputRef:'firestore:image-coverage-results'}),store.markImageReview(job.reviewId,'processed',{outcome:{status:(result.candidates||[]).some(item=>item.status==='ready-for-asset-review')?'asset-review-ready':result.status||'sourcing-complete',outputRef:'firestore:image-coverage-results',publicMutationAllowed:false}})]);
      outcomes.push({jobId:job.id,reviewId:job.reviewId,status:'completed'});
    }catch(error){const failures=Number(job.systemFailures||0)+1;await store.failJob(job.id,error,{maximumFailures:3});if(failures>=3)await store.markImageReview(job.reviewId,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({jobId:job.id,status:'retry-or-blocked',error:error.message});}
  }
  return outcomes;
}

module.exports={IMAGE_SOURCE_SCHEMA,runImageSourcing,latestBySlug,ingestImageReviews,processImageJobs};
