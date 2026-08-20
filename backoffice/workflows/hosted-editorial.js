'use strict';

const fs=require('fs/promises');
const path=require('path');
const {execFile}=require('child_process');
const {promisify}=require('util');
const runFile=promisify(execFile);
const {applyReviewChanges}=require('./apply-content-review');
const {runEditorialRevision}=require('./run-editorial-revision');
const {contentFingerprint,recordEditorialOutcome}=require('./editorial-ledger');
const {packetFingerprint,sourcesFingerprint}=require('./run-editorial-cycle');

function iso(value){
  if(!value)return new Date().toISOString();
  if(typeof value==='string')return value;
  if(typeof value.toDate==='function')return value.toDate().toISOString();
  return new Date(value).toISOString();
}

function slug(value){return String(value||'editorial').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,100);}

function applyEditedCopy(packet,edits=[]){
  const next=JSON.parse(JSON.stringify(packet));
  const editByJob=new Map(edits.map(item=>[item.jobId,item]));
  for(const output of next.outputs||[]){
    if(output.agentId!=='copywriter'||output.status!=='ready-for-review')continue;
    const edit=editByJob.get(output.jobId);if(!edit)continue;
    const changes=output.result?.changes||[];
    if(!Array.isArray(edit.afterByIndex)||edit.afterByIndex.length!==changes.length)throw new Error('Edited copy does not match the reviewed recommendation');
    edit.afterByIndex.forEach((after,index)=>{
      if(typeof after!=='string'||!after.trim()||after.length>10000||/<script\b|javascript:|\son\w+\s*=/i.test(after))throw new Error('Edited copy contains invalid or unsafe markup');
      const original=changes[index].after;const originalTag=String(original).trim().match(/^<([a-z][a-z0-9-]*)\b/i)?.[1];const editedTag=after.trim().match(/^<([a-z][a-z0-9-]*)\b/i)?.[1];
      if(originalTag&&editedTag!==originalTag)throw new Error('Edited copy must keep the proposed content block type');
      if(after!==original)changes[index].beforeAlternatives=[...new Set([...(changes[index].beforeAlternatives||[]),original])];
      changes[index].after=after;
    });
  }
  return next;
}

async function findPacket(store,review){
  for(let slot=1;slot<=3;slot++){
    const packet=await store.getArtifact(`editorial-review-packet-${slot}`);
    if(packet?.generatedAt===review.packetGeneratedAt&&packet?.subject?.sourceRef===review.sourceRef)return {packet,slot};
  }
  throw new Error('The editorial packet changed. Reload the current review queue.');
}

function latestByPacket(reviews){
  const latest=new Map();
  for(const review of reviews){
    const key=`${review.packetGeneratedAt}:${review.sourceRef}`;const current=latest.get(key);
    const stamp=`${iso(review.submittedAt)}:${review.id}`;const currentStamp=current?`${iso(current.submittedAt)}:${current.id}`:'';
    if(!current||stamp>currentStamp)latest.set(key,review);
  }
  return latest;
}

async function ingestEditorialReviews(store){
  if(typeof store.listEditorialReviews!=='function')return [];
  const reviews=await store.listEditorialReviews('queued');const outcomes=[];const effective=latestByPacket(reviews);
  for(const review of reviews){
    const selected=effective.get(`${review.packetGeneratedAt}:${review.sourceRef}`);if(selected?.id===review.id)continue;
    await store.markEditorialReview(review.id,'superseded',{supersededBy:selected.id});outcomes.push({reviewId:review.id,status:'superseded'});
  }
  for(const review of effective.values()){
    try{
      const {packet,slot}=await findPacket(store,review);const at=iso(review.submittedAt);
      if(review.action==='request-revision'&&!String(review.note||'').trim())throw new Error('A revision note is required');
      const approved=review.action==='approve'?applyEditedCopy(packet,review.edits||[]):packet;
      const artifactId=`editorial-review-input-${review.id}`;
      await store.setArtifact(artifactId,{packet:approved,note:String(review.note||'').trim(),slot,reviewId:review.id,submittedAt:at},{publicMutationAllowed:false});
      const jobType=review.action==='approve'?'hosted-editorial-publication':'hosted-editorial-revision';
      const job={id:`${jobType}-${slug(packet.subject?.id)}-${review.id}`,jobType,agentId:review.action==='approve'?'publicationMapper':'copywriter',
        status:'queued',createdAt:at,reviewId:review.id,slot,sourceRef:packet.subject.sourceRef,inputRef:`firestore:${artifactId}`,
        humanGate:review.action==='approve'?'editorial-approval-consumed':'editorial-re-review',publicMutationAllowed:false};
      const created=typeof store.putJobIfAbsent==='function'?await store.putJobIfAbsent(job):(await store.putJob(job),true);
      await store.markEditorialReview(review.id,'processing',{outcome:{status:created?'queued':'already-queued',jobId:job.id,next:review.action==='approve'?'validate-and-publish':'prepare-revision'}});
      outcomes.push({reviewId:review.id,status:'processing',action:review.action,jobId:job.id});
    }catch(error){await store.markEditorialReview(review.id,'blocked',{error:String(error.message||error).slice(0,2000)});outcomes.push({reviewId:review.id,status:'blocked',error:error.message});}
  }
  return outcomes;
}

async function command(root,file,args,options={}){
  if(options.runCommand)return options.runCommand(file,args,{cwd:root});
  const result=await runFile(file,args,{cwd:root,maxBuffer:8*1024*1024,env:process.env});return result.stdout.trim();
}

async function publishEditorialPacket(root,packet,reviewId,options={}){
  const sourceRef=packet?.subject?.sourceRef;const target=path.resolve(root,String(sourceRef||''));
  if(!sourceRef||target===root||!target.startsWith(`${root}${path.sep}`))throw new Error('Editorial source is outside the project');
  const original=await fs.readFile(target,'utf8');let updated=original;
  const outputs=(packet.outputs||[]).filter(output=>output.agentId==='copywriter'&&output.status==='ready-for-review');
  if(outputs.length!==1)throw new Error('Exactly one reviewable copy recommendation is required');
  updated=applyReviewChanges(updated,outputs[0].result?.changes||[]);
  if(updated===original)throw new Error('Approved editorial packet contains no unpublished change');
  await fs.writeFile(target,updated,'utf8');
  let committed=false;
  try{
    await command(root,'npm',['run','test:static'],options);
    await command(root,'npm',['run','test:backoffice'],options);
    const changed=(await command(root,'git',['status','--porcelain'],options)).split('\n').filter(Boolean).map(line=>line.slice(3));
    const unexpected=changed.filter(file=>file!==sourceRef);
    if(unexpected.length)throw new Error(`Unexpected workspace changes prevent editorial publication: ${unexpected.join(', ')}`);
    await command(root,'git',['config','user.name','ORMA Backoffice'],options);
    await command(root,'git',['config','user.email','orma-backoffice@users.noreply.github.com'],options);
    await command(root,'git',['add','--',sourceRef],options);
    await command(root,'git',['commit','-m',`Editorial: publish approved ${packet.subject.id} (${reviewId})`],options);
    committed=true;
    const commit=await command(root,'git',['rev-parse','HEAD'],options);
    await command(root,'git',['push','origin','HEAD:main'],options);
    return {status:'published',commit,paths:[sourceRef],deployment:'github-pages-triggered',publishedAt:new Date().toISOString()};
  }catch(error){
    if(!committed)await fs.writeFile(target,original,'utf8');
    throw error;
  }
}

async function processEditorialJobs(store,options={}){
  const root=options.root||path.resolve(__dirname,'../..');const workerId=options.workerId||'orma-worker';
  const queued=(await store.listJobs(['queued'])).filter(job=>['hosted-editorial-revision','hosted-editorial-publication'].includes(job.jobType));const outcomes=[];
  for(const pending of queued.slice(0,options.editorialOperationsLimit||2)){
    const job=await store.claimJob(pending.id,workerId);if(!job)continue;
    try{
      const artifactId=String(job.inputRef||'').replace(/^firestore:/,'');const input=await store.getArtifact(artifactId);
      if(!input?.packet)throw new Error('Editorial review input is unavailable');
      if(job.jobType==='hosted-editorial-revision'){
        const revised=await (options.runEditorialRevision||runEditorialRevision)(root,input.packet,input.note,{at:options.at||new Date().toISOString(),...(options.revisionOptions||{})});
        await store.setArtifact(`editorial-review-packet-${job.slot}`,revised,{slot:job.slot,lastWorkerId:workerId,publicMutationAllowed:false});
        const ledger=await store.getArtifact('editorial-ledger')||{contractVersion:'1.0.0',items:[]};
        const nextLedger=recordEditorialOutcome(ledger,{at:revised.generatedAt,contentId:`${revised.subject.type}-${revised.subject.id}`,type:revised.subject.type,sourceRef:revised.subject.sourceRef,action:'in-review',contentFingerprint:contentFingerprint(revised.subject.original),sourcesFingerprint:sourcesFingerprint(revised),packetFingerprint:packetFingerprint(revised),safetyCritical:!!revised.subject.safetyCritical});
        await Promise.all([store.setArtifact('editorial-ledger',nextLedger,{lastWorkerId:workerId}),store.completeSystemJob(job.id,{outputRef:`firestore:editorial-review-packet-${job.slot}`}),store.markEditorialReview(job.reviewId,'processed',{outcome:{status:'revision-ready',slot:job.slot,generatedAt:revised.generatedAt}})]);
        outcomes.push({jobId:job.id,reviewId:job.reviewId,status:'revision-ready'});
      }else{
        const receipt=await (options.publishEditorialPacket||publishEditorialPacket)(root,input.packet,job.reviewId,options);
        const ledger=await store.getArtifact('editorial-ledger')||{contractVersion:'1.0.0',items:[]};
        const nextLedger=recordEditorialOutcome(ledger,{at:receipt.publishedAt,contentId:`${input.packet.subject.type}-${input.packet.subject.id}`,type:input.packet.subject.type,sourceRef:input.packet.subject.sourceRef,action:'approve',contentFingerprint:contentFingerprint(await fs.readFile(path.resolve(root,input.packet.subject.sourceRef),'utf8')),sourcesFingerprint:sourcesFingerprint(input.packet),packetFingerprint:packetFingerprint(input.packet),safetyCritical:!!input.packet.subject.safetyCritical});
        const receipts=await store.getArtifact('editorial-publication-receipts')||{contractVersion:'1.0.0',receipts:[]};
        const nextReceipts={...receipts,updatedAt:receipt.publishedAt,receipts:[...(receipts.receipts||[]).filter(item=>item.reviewId!==job.reviewId),{reviewId:job.reviewId,sourceRef:job.sourceRef,...receipt}].slice(-100)};
        await Promise.all([store.setArtifact('editorial-ledger',nextLedger,{lastWorkerId:workerId}),store.setArtifact('editorial-publication-receipts',nextReceipts,{lastWorkerId:workerId}),store.completeSystemJob(job.id,{commit:receipt.commit,deployment:receipt.deployment}),store.markEditorialReview(job.reviewId,'processed',{outcome:receipt})]);
        outcomes.push({jobId:job.id,reviewId:job.reviewId,status:'published',commit:receipt.commit});
      }
    }catch(error){
      const failures=Number(job.systemFailures||0)+1;await store.failJob(job.id,error,{maximumFailures:3});
      const failedAt=new Date().toISOString();const receipts=await store.getArtifact('editorial-publication-receipts')||{contractVersion:'1.0.0',receipts:[]};
      const failure={reviewId:job.reviewId,sourceRef:job.sourceRef,status:job.jobType==='hosted-editorial-publication'?'publication-failed':'revision-failed',failedAt,attempt:failures,retryMode:failures>=3?'manual':'automatic',failureMessage:String(error.message||error).slice(0,2000),publicMutationAllowed:false};
      await store.setArtifact('editorial-publication-receipts',{...receipts,updatedAt:failedAt,receipts:[...(receipts.receipts||[]).filter(item=>item.reviewId!==job.reviewId),failure].slice(-100)},{lastWorkerId:workerId});
      if(failures>=3)await store.markEditorialReview(job.reviewId,'blocked',{error:failure.failureMessage,outcome:failure});
      outcomes.push({jobId:job.id,reviewId:job.reviewId,status:'retry-or-blocked',error:error.message});
    }
  }
  return outcomes;
}

module.exports={iso,slug,applyEditedCopy,findPacket,latestByPacket,ingestEditorialReviews,publishEditorialPacket,processEditorialJobs};
