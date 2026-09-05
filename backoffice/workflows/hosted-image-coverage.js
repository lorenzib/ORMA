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
    'An approved photo is copied into the ORMA repository, never hot-linked, so assetUrl must be an https link to a rendition under 2 MB in JPEG, PNG, WebP or AVIF. Prefer a sized rendition over a full-resolution original.',
    'Never place or publish an image. Every actual asset must return for visual and rights approval.',
  ].join('\n')},{role:'user',content:`Image gap:\n${JSON.stringify(gap,null,2)}\n\nCEO direction:\n${job.brief||''}`} ]},options.clientOptions||{});
  return {contractVersion:'1.0.0',slug:gap.slug,generatedAt:options.at||new Date().toISOString(),sourcePreference:job.sourcePreference,publicMutationAllowed:false,...response.data};
}

function latestBySlug(reviews){const latest=new Map();for(const review of reviews){const current=latest.get(review.slug);const key=`${iso(review.submittedAt)}:${review.id}`;const currentKey=current?`${iso(current.submittedAt)}:${current.id}`:'';if(!current||key>currentKey)latest.set(review.slug,review);}return latest;}

const DEFAULT_IMAGE_SOURCING_CAPACITY=15;
const IMAGE_RESULTS_SAFE_BYTES=850000;

function actionableImageResult(item){
  return (item?.candidates||[]).some(candidate=>['ready-for-asset-review','approved-for-publication'].includes(candidate.status))
    || ['upload-owner-photo','approve-uploaded-photo','approve-image-candidate','use-orma-library'].includes(item?.sourcePreference);
}

function compactImageResults(items,artifact={}){
  const actionable=items.filter(actionableImageResult);const history=items.filter(item=>!actionableImageResult(item));
  let kept=[...actionable,...history.slice(-40)];
  while(history.length&&Buffer.byteLength(JSON.stringify({...artifact,items:kept}),'utf8')>IMAGE_RESULTS_SAFE_BYTES){
    const removable=kept.findIndex(item=>!actionableImageResult(item));if(removable<0)break;kept.splice(removable,1);
  }
  return kept;
}

async function queuePriorityImageSourcing(store,audit,options={}){
  const at=options.at||new Date().toISOString();const capacity=options.capacity||DEFAULT_IMAGE_SOURCING_CAPACITY;
  const gapSlugs=new Set((audit?.gaps||[]).map(gap=>gap.slug));
  const [jobs,results,requests]=await Promise.all([
    store.listJobs(['queued','running','ready-for-review']),
    store.getArtifact('image-coverage-results'),
    store.getArtifact('trail-image-publication-requests'),
  ]);
  const occupied=new Set((jobs||[]).filter(job=>job.jobType==='hosted-image-sourcing'&&gapSlugs.has(job.slug)).map(job=>job.slug));
  for(const item of results?.items||[]){if(gapSlugs.has(item.slug)&&(item.candidates||[]).some(candidate=>candidate.status==='ready-for-asset-review'))occupied.add(item.slug);}
  for(const request of requests?.requests||[]){if(gapSlugs.has(request.trailId)&&request.status!=='published')occupied.add(request.trailId);}
  const queued=[];
  for(const gap of audit?.gaps||[]){
    if(occupied.size>=capacity)break;
    if(occupied.has(gap.slug))continue;
    const job={id:`image-coverage-auto-find-licensed-${gap.slug}`,jobType:'hosted-image-sourcing',agentId:'visualDirector',status:'queued',
      createdAt:at,slug:gap.slug,trailId:gap.trailId||gap.slug,sourceRef:gap.sourceRef,sourcePreference:'find-licensed',reviewId:null,
      brief:`Scout correctly licensed, credited photo candidates for ${gap.title}. Preserve creator, source page, licence URL and alt text.`,
      humanGate:'asset-and-rights-approval',requiresAssetApproval:true,requiresLicensingApproval:true,publicMutationAllowed:false};
    const created=typeof store.putJobIfAbsent==='function'?await store.putJobIfAbsent(job):(await store.putJob(job),true);
    if(created){queued.push(job.id);occupied.add(gap.slug);}
  }
  return {capacity,active:occupied.size,queued:queued.length,jobIds:queued};
}

async function ingestImageReviews(store){
  if(typeof store.listImageReviews!=='function')return [];
  const reviews=await store.listImageReviews('queued');const outcomes=[];const effective=latestBySlug(reviews);let queue=await store.getArtifact('image-coverage-review')||{contractVersion:'1.0.0',decisions:[],jobs:[]};
  for(const review of reviews){const selected=effective.get(review.slug);if(selected?.id===review.id)continue;await store.markImageReview(review.id,'superseded',{supersededBy:selected.id});outcomes.push({reviewId:review.id,status:'superseded'});}
  for(const review of effective.values()){
    try{
      const audit=await store.getArtifact('image-coverage');if(!audit)throw new Error('Image coverage audit is unavailable');
      queue=applyImageCoverageReview(audit,queue,{slug:review.slug,trailId:review.trailId,action:review.action,note:review.note,
        assetRef:review.assetRef,uploadRef:review.uploadRef,fileName:review.fileName,mimeType:review.mimeType,
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


// One place that turns an owner's uploaded photo into a publication request, used
// both by a fresh upload and by promoting uploads that are still waiting on the
// second approval this lane no longer asks for.
async function recordUploadPublicationRequest(store,gap,job,candidate,approvedAt){
  const requests=await store.getArtifact('trail-image-publication-requests')||{contractVersion:'1.0.0',requests:[]};
  const request={id:job.reviewId||`upload-${gap.slug}-${approvedAt}`,trailId:gap.trailId||gap.slug,title:gap.title,
    uploadRef:job.uploadRef,fileName:job.fileName||candidate.title,mimeType:job.mimeType||candidate.mimeType,
    fileSize:job.fileSize||candidate.fileSize,width:job.width||candidate.width,height:job.height||candidate.height,
    creator:job.creator||candidate.creator,rightsBasis:job.rightsBasis,altText:job.altText||candidate.altText,
    status:'approved-for-pr-creation',approvedAt,approvedBy:'owner-upload',publicMutationAllowed:false};
  await store.setArtifact('trail-image-publication-requests',{...requests,updatedAt:approvedAt,
    requests:[...(requests.requests||[]).filter(item=>item.id!==request.id&&!(item.trailId===request.trailId&&item.status==='approved-for-pr-creation')),request]},
    {lastReviewId:job.reviewId,publicMutationAllowed:false});
  return request;
}

// Uploads that completed before owner photos stopped needing a second approval are
// still sitting in preview. They are the owner's own photos, so they move on too.
// Licensed and AI candidates are untouched: those still need a look.
async function promotePendingOwnerUploads(store,options={}){
  const at=options.at||new Date().toISOString();
  const [results,requests,audit]=await Promise.all([
    store.getArtifact('image-coverage-results'),
    store.getArtifact('trail-image-publication-requests'),
    store.getArtifact('image-coverage'),
  ]);
  if(!results?.items?.length)return {promoted:[]};
  const open=new Set((requests?.requests||[]).filter(item=>item.status!=='published').map(item=>item.trailId));
  const gaps=new Map((audit?.gaps||[]).map(gap=>[gap.slug,gap]));
  const promoted=[];let items=results.items;
  for(const item of results.items){
    if(open.has(item.trailId||item.slug))continue;
    const gap=gaps.get(item.slug);if(!gap)continue;
    const candidate=(item.candidates||[]).find(entry=>entry.uploadRef&&entry.status==='ready-for-asset-review');
    if(!candidate)continue;
    const job={reviewId:item.reviewId,uploadRef:candidate.uploadRef,fileName:candidate.title,mimeType:candidate.mimeType,
      fileSize:candidate.fileSize,width:candidate.width,height:candidate.height,creator:candidate.creator,
      rightsBasis:candidate.license==='Permission granted'?'permission-granted':'orma-owned',altText:candidate.altText};
    await recordUploadPublicationRequest(store,gap,job,candidate,at);
    items=items.map(entry=>entry.slug!==item.slug?entry:{...entry,generatedAt:at,status:'approved-for-pr-creation',
      summary:'Your photo is in the pull-request publishing lane.',
      candidates:(entry.candidates||[]).map(one=>one.uploadRef===candidate.uploadRef?{...one,status:'approved-for-publication'}:one)});
    promoted.push(item.slug);
  }
  if(promoted.length)await store.setArtifact('image-coverage-results',{...results,updatedAt:at,items},{lastPromotedAt:at});
  return {promoted};
}

async function processImageJobs(store,options={}){
  const workerId=options.workerId||`orma-worker-${randomUUID()}`;const outcomes=[];const limit=options.imageLimit||2;
  const priority={
    'approve-uploaded-photo':0,
    'upload-owner-photo':1,
    'approve-image-candidate':2,
    'use-orma-library':3,
    'generate-ai':4,
    'find-licensed':5,
  };
  const queued=(await store.listJobs(['queued'])).filter(job=>job.jobType==='hosted-image-sourcing').sort((a,b)=>{
    const aPriority=(priority[a.sourcePreference]??10)-(a.reviewId?0:0.5);
    const bPriority=(priority[b.sourcePreference]??10)-(b.reviewId?0:0.5);
    return aPriority-bPriority||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  });
  for(const pending of queued){
    if(outcomes.length>=limit)break;
    const job=await store.claimJob(pending.id,workerId);if(!job)continue;
    try{
      const audit=await store.getArtifact('image-coverage');const gap=(audit?.gaps||[]).find(item=>item.slug===job.slug);if(!gap)throw new Error('Image gap no longer exists');let result;
      if(job.sourcePreference==='use-orma-library'){
        const match=(gap.libraryMatches||[]).find(item=>(item.sourceRef||item.fileName)===job.assetRef);
        if(!match)throw new Error('The selected ORMA-owned image is no longer available');
        result={contractVersion:'1.0.0',slug:gap.slug,generatedAt:new Date().toISOString(),sourcePreference:job.sourcePreference,summary:'One ORMA-owned candidate is ready for visual placement review.',candidates:[{title:match.fileName||gap.title,sourcePageUrl:null,assetUrl:match.sourceRef||job.assetRef,creator:'ORMA',license:'ORMA-owned',licenseUrl:null,rightsEvidence:'Selected from the protected ORMA repository inventory.',altText:gap.title,status:'ready-for-asset-review',generationPrompt:null}],publicMutationAllowed:false};
      }else if(job.sourcePreference==='upload-owner-photo'){
        // The uploader owns the photo, saw it in the upload preview, and declared its
        // creator, rights basis and alt text there. A second desk approval repeated
        // that without adding review, so an owner upload goes straight to the
        // publishing lane; the publication pull request remains the human gate.
        const approvedAt=new Date().toISOString();
        const candidate={title:job.fileName||gap.title,sourcePageUrl:null,
          assetUrl:null,uploadRef:job.uploadRef,creator:job.creator||'ORMA',license:job.rightsBasis==='permission-granted'?'Permission granted':'ORMA-owned',
          licenseUrl:null,rightsEvidence:job.rightsBasis==='permission-granted'?'Uploader confirmed permission to publish.':'Uploader confirmed that ORMA owns this photo.',
          altText:job.altText||`${gap.title} trail`,status:'approved-for-publication',generationPrompt:null,width:job.width||null,height:job.height||null,
          mimeType:job.mimeType||null,fileSize:job.fileSize||null};
        await recordUploadPublicationRequest(store,gap,job,candidate,approvedAt);
        result={contractVersion:'2.0.0',slug:gap.slug,trailId:gap.trailId||gap.slug,generatedAt:approvedAt,sourcePreference:job.sourcePreference,
          summary:'Your photo is in the pull-request publishing lane.',status:'approved-for-pr-creation',
          candidates:[candidate],publicMutationAllowed:false};
      }else if(job.sourcePreference==='approve-uploaded-photo'){
        const previous=await store.getArtifact('image-coverage-results')||{items:[]};
        const prior=(previous.items||[]).find(item=>item.slug===job.slug);
        const candidate=(prior?.candidates||[]).find(item=>item.uploadRef===job.uploadRef&&item.status==='ready-for-asset-review');
        if(!candidate)throw new Error('The uploaded photo must complete visual preview review before publication approval');
        const requests=await store.getArtifact('trail-image-publication-requests')||{contractVersion:'1.0.0',requests:[]};
        const request={id:job.reviewId,trailId:gap.trailId||gap.slug,title:gap.title,uploadRef:job.uploadRef,fileName:job.fileName||candidate.title,
          mimeType:job.mimeType||candidate.mimeType,fileSize:job.fileSize||candidate.fileSize,width:job.width||candidate.width,height:job.height||candidate.height,
          creator:job.creator||candidate.creator,rightsBasis:job.rightsBasis,altText:job.altText||candidate.altText,status:'approved-for-pr-creation',
          approvedAt:new Date().toISOString(),approvedBy:'moderator',publicMutationAllowed:false};
        await store.setArtifact('trail-image-publication-requests',{...requests,updatedAt:request.approvedAt,
          requests:[...(requests.requests||[]).filter(item=>item.id!==request.id&&!(item.trailId===request.trailId&&item.status==='approved-for-pr-creation')),request]},
          {lastReviewId:job.reviewId,publicMutationAllowed:false});
        result={...prior,contractVersion:'2.0.0',generatedAt:request.approvedAt,sourcePreference:job.sourcePreference,
          summary:'Photo approved and sent to the pull-request publishing lane.',status:'approved-for-pr-creation',
          candidates:(prior.candidates||[]).map(item=>item.uploadRef===job.uploadRef?{...item,status:'approved-for-publication'}:item),publicMutationAllowed:false};
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
      const artifact=await store.getArtifact('image-coverage-results')||{contractVersion:'1.0.0',items:[]};const merged=[...(artifact.items||[]).filter(item=>item.slug!==job.slug),{...result,reviewId:job.reviewId}];
      const next={...artifact,updatedAt:result.generatedAt,items:compactImageResults(merged,artifact)};
      const writes=[store.setArtifact('image-coverage-results',next,{lastWorkerId:workerId}),store.completeSystemJob(job.id,{outputRef:'firestore:image-coverage-results'})];
      if(job.reviewId)writes.push(store.markImageReview(job.reviewId,'processed',{outcome:{status:(result.candidates||[]).some(item=>item.status==='ready-for-asset-review')?'asset-review-ready':result.status||'sourcing-complete',outputRef:'firestore:image-coverage-results',publicMutationAllowed:false}}));
      await Promise.all(writes);
      outcomes.push({jobId:job.id,reviewId:job.reviewId,status:'completed'});
    }catch(error){const failures=Number(job.systemFailures||0)+1;await store.failJob(job.id,error,{maximumFailures:3});if(failures>=3&&job.reviewId)await store.markImageReview(job.reviewId,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({jobId:job.id,status:'retry-or-blocked',error:error.message});}
  }
  return outcomes;
}

module.exports={IMAGE_SOURCE_SCHEMA,recordUploadPublicationRequest,promotePendingOwnerUploads,DEFAULT_IMAGE_SOURCING_CAPACITY,runImageSourcing,latestBySlug,compactImageResults,queuePriorityImageSourcing,ingestImageReviews,processImageJobs};
