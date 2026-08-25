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
      queue=applyImageCoverageReview(audit,queue,{slug:review.slug,trailId:review.trailId,action:review.action,note:review.note,
        assetRef:review.assetRef,uploadPath:review.uploadPath,fileName:review.fileName,mimeType:review.mimeType,
        fileSize:review.fileSize,width:review.width,height:review.height,creator:review.creator,
        rightsBasis:review.rightsBasis,altText:review.altText,sourcePageUrl:review.sourcePageUrl,
        license:review.license,licenseUrl:review.licenseUrl,sourceType:review.sourceType},iso(review.submittedAt));
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
      }else if(job.sourcePreference==='upload-owner-photo'){
        result={contractVersion:'2.0.0',slug:gap.slug,trailId:gap.trailId||gap.slug,generatedAt:new Date().toISOString(),sourcePreference:job.sourcePreference,
          summary:'Your uploaded trail photo is ready for visual and rights approval.',candidates:[{title:job.fileName||gap.title,sourcePageUrl:null,
            assetUrl:null,storagePath:job.uploadPath,creator:job.creator||'ORMA',license:job.rightsBasis==='permission-granted'?'Permission granted':'ORMA-owned',
            licenseUrl:null,rightsEvidence:job.rightsBasis==='permission-granted'?'Uploader confirmed permission to publish.':'Uploader confirmed that ORMA owns this photo.',
            altText:job.altText||`${gap.title} trail`,status:'ready-for-asset-review',generationPrompt:null,width:job.width||null,height:job.height||null,
            mimeType:job.mimeType||null,fileSize:job.fileSize||null}],publicMutationAllowed:false};
      }else if(job.sourcePreference==='approve-uploaded-photo'){
        const previous=await store.getArtifact('image-coverage-results')||{items:[]};
        const prior=(previous.items||[]).find(item=>item.slug===job.slug);
        const candidate=(prior?.candidates||[]).find(item=>item.storagePath===job.uploadPath&&item.status==='ready-for-asset-review');
        if(!candidate)throw new Error('The uploaded photo must complete visual preview review before publication approval');
        const requests=await store.getArtifact('trail-image-publication-requests')||{contractVersion:'1.0.0',requests:[]};
        const request={id:job.reviewId,trailId:gap.trailId||gap.slug,title:gap.title,storagePath:job.uploadPath,fileName:job.fileName||candidate.title,
          mimeType:job.mimeType||candidate.mimeType,fileSize:job.fileSize||candidate.fileSize,width:job.width||candidate.width,height:job.height||candidate.height,
          creator:job.creator||candidate.creator,rightsBasis:job.rightsBasis,altText:job.altText||candidate.altText,status:'approved-for-pr-creation',
          approvedAt:new Date().toISOString(),approvedBy:'moderator',publicMutationAllowed:false};
        await store.setArtifact('trail-image-publication-requests',{...requests,updatedAt:request.approvedAt,
          requests:[...(requests.requests||[]).filter(item=>item.id!==request.id&&!(item.trailId===request.trailId&&item.status==='approved-for-pr-creation')),request]},
          {lastReviewId:job.reviewId,publicMutationAllowed:false});
        result={...prior,contractVersion:'2.0.0',generatedAt:request.approvedAt,sourcePreference:job.sourcePreference,
          summary:'Photo approved and sent to the pull-request publishing lane.',status:'approved-for-pr-creation',
          candidates:(prior.candidates||[]).map(item=>item.storagePath===job.uploadPath?{...item,status:'approved-for-publication'}:item),publicMutationAllowed:false};
      }else if(job.sourcePreference==='approve-image-candidate'){
        const previous=await store.getArtifact('image-coverage-results')||{items:[]};const prior=(previous.items||[]).find(item=>item.slug===job.slug);
        const candidate=(prior?.candidates||[]).find(item=>item.assetUrl===job.assetRef&&item.status==='ready-for-asset-review');
        if(!candidate)throw new Error('The owned or licensed image must complete exact preview review before publication approval');
        const assetRef=String(candidate.assetUrl||'');if(!/^(?:images\/|https:\/\/)/i.test(assetRef))throw new Error('The approved image source is not publishable');
        const approvedAt=new Date().toISOString();const requests=await store.getArtifact('trail-image-publication-requests')||{contractVersion:'1.0.0',requests:[]};
        const request={id:job.reviewId,trailId:gap.trailId||gap.slug,title:gap.title,assetRef,sourcePageUrl:candidate.sourcePageUrl||job.sourcePageUrl||null,
          creator:job.creator||candidate.creator,rightsBasis:job.rightsBasis||candidate.license,license:job.license||candidate.license,
          licenseUrl:job.licenseUrl||candidate.licenseUrl||null,sourceType:job.sourceType||(assetRef.startsWith('images/')?'orma-library':'licensed-source'),
          altText:job.altText||candidate.altText,status:'approved-for-pr-creation',approvedAt,approvedBy:'moderator',publicMutationAllowed:false};
        await store.setArtifact('trail-image-publication-requests',{...requests,updatedAt:approvedAt,
          requests:[...(requests.requests||[]).filter(item=>item.id!==request.id&&!(item.trailId===request.trailId&&item.status==='approved-for-pr-creation')),request]},
          {lastReviewId:job.reviewId,publicMutationAllowed:false});
        result={...prior,contractVersion:'2.0.0',generatedAt:approvedAt,sourcePreference:job.sourcePreference,summary:'Image approved and sent to the pull-request publishing lane.',status:'approved-for-pr-creation',
          candidates:(prior.candidates||[]).map(item=>item.assetUrl===assetRef?{...item,status:'approved-for-publication'}:item),publicMutationAllowed:false};
      }else result=await runImageSourcing(gap,job,options);
      const artifact=await store.getArtifact('image-coverage-results')||{contractVersion:'1.0.0',items:[]};const next={...artifact,updatedAt:result.generatedAt,items:[...(artifact.items||[]).filter(item=>item.slug!==job.slug),{...result,reviewId:job.reviewId}].slice(-500)};
      await Promise.all([store.setArtifact('image-coverage-results',next,{lastWorkerId:workerId}),store.completeSystemJob(job.id,{outputRef:'firestore:image-coverage-results'}),store.markImageReview(job.reviewId,'processed',{outcome:{status:(result.candidates||[]).some(item=>item.status==='ready-for-asset-review')?'asset-review-ready':result.status||'sourcing-complete',outputRef:'firestore:image-coverage-results',publicMutationAllowed:false}})]);
      outcomes.push({jobId:job.id,reviewId:job.reviewId,status:'completed'});
    }catch(error){const failures=Number(job.systemFailures||0)+1;await store.failJob(job.id,error,{maximumFailures:3});if(failures>=3)await store.markImageReview(job.reviewId,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({jobId:job.id,status:'retry-or-blocked',error:error.message});}
  }
  return outcomes;
}

module.exports={IMAGE_SOURCE_SCHEMA,runImageSourcing,latestBySlug,ingestImageReviews,processImageJobs};
