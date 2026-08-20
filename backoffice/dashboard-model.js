(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ORMADashboardModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ACTIVE_JOB_STATES=new Set(['queued','running','in-progress','processing']);
  const PUBLICATION_OWNED_STATES=new Set(['queued','processed','approved-for-pr-creation','publication-failed','pull-request-opened','hold','request-changes']);

  function dateMs(value){
    if(!value)return 0;
    if(typeof value.toDate==='function')return value.toDate().getTime();
    if(value.seconds)return Number(value.seconds)*1000;
    const parsed=new Date(value).getTime();return Number.isNaN(parsed)?0:parsed;
  }
  function plural(count,singular,pluralForm=`${singular}s`){return `${count} ${count===1?singular:pluralForm}`;}
  function minutesSince(value,nowMs){const at=dateMs(value);return at?Math.max(0,Math.floor((nowMs-at)/60000)):null;}
  function deriveWorkerHealth(artifact,options={}){
    const nowMs=options.nowMs??Date.now();
    const expected=Number(artifact?.expectedIntervalMinutes||5);
    const delayedAfter=Number(artifact?.delayAfterMinutes||15);
    const staleAfter=Number(artifact?.staleAfterMinutes||30);
    const runUrl=artifact?.workflowRunUrl||artifact?.lastFailure?.workflowRunUrl||null;
    if(!artifact||!artifact.status)return {state:'unknown',label:'No heartbeat',title:'Worker health is not available yet',message:'No protected worker heartbeat has been recorded. Saved decisions remain safe, but automation timing cannot be verified.',runUrl:null,ageMinutes:null,expectedIntervalMinutes:expected};
    if(artifact.status==='running'){
      const ageMinutes=minutesSince(artifact.startedAt,nowMs);
      if(ageMinutes!==null&&ageMinutes>=staleAfter)return {state:'stale',label:'Run appears stuck',title:'ORMA automation has exceeded its run window',message:`Run ${artifact.runId||'unknown'} started ${ageMinutes} minutes ago and has not recorded completion. Inspect the run before submitting anything again.`,runUrl,ageMinutes,expectedIntervalMinutes:expected};
      return {state:'running',label:'Agents working',title:'ORMA automation is running now',message:`Run ${artifact.runId||'unknown'} started ${ageMinutes??0} minute${ageMinutes===1?'':'s'} ago. This page will refresh when it completes.`,runUrl,ageMinutes,expectedIntervalMinutes:expected};
    }
    if(artifact.status==='failed'){
      const failure=artifact.lastFailure||{};const ageMinutes=minutesSince(artifact.completedAt||failure.failedAt,nowMs);
      return {state:'failed',label:'Action needed',title:`Worker failed at ${String(failure.stage||'execution').replace(/-/g,' ')}`,message:failure.message||'The latest worker run failed without a captured diagnostic.',runUrl,ageMinutes,expectedIntervalMinutes:expected,consecutiveFailures:Number(artifact.consecutiveFailures||1)};
    }
    const completedAt=artifact.lastSuccessfulAt||artifact.completedAt;const ageMinutes=minutesSince(completedAt,nowMs);
    if(ageMinutes===null)return {state:'unknown',label:'Incomplete heartbeat',title:'Worker completion time is missing',message:'The protected heartbeat exists but has no successful completion time.',runUrl,ageMinutes,expectedIntervalMinutes:expected};
    if(ageMinutes>=staleAfter)return {state:'stale',label:'Worker stale',title:'No recent successful worker run',message:`The last success was ${ageMinutes} minutes ago. The schedule target is every ${expected} minutes; saved decisions are safe but are not advancing.`,runUrl,ageMinutes,expectedIntervalMinutes:expected};
    if(ageMinutes>=delayedAfter)return {state:'delayed',label:'Scheduler delayed',title:'The next worker run is late',message:`The last success was ${ageMinutes} minutes ago. GitHub has exceeded ORMA’s ${expected}-minute schedule target; no decision needs to be submitted again.`,runUrl,ageMinutes,expectedIntervalMinutes:expected};
    return {state:'healthy',label:'Healthy',title:'ORMA automation is responding',message:`The last successful run completed ${ageMinutes} minute${ageMinutes===1?'':'s'} ago. Schedule target: every ${expected} minutes.`,runUrl,ageMinutes,expectedIntervalMinutes:expected};
  }
  function latestPublicationState(history,requests){
    const latest=new Map();
    const records=[
      ...(history||[]).filter(item=>item.stream==='publication'),
      ...((requests&&requests.requests)||[]).map(item=>({...item,stream:'publication-request'})),
    ];
    for(const record of records){
      if(!record.candidateId)continue;
      const at=dateMs(record.acknowledgedAt||record.processedAt||record.reviewedAt||record.submittedAt);
      const current=latest.get(record.candidateId);
      if(!current||at>current.at||(at===current.at&&record.stream==='publication-request'))latest.set(record.candidateId,{record,at});
    }
    return latest;
  }
  function activityMessage(item){
    const status=item.status||'queued';
    if(status==='queued')return 'Saved in Firestore. ORMA automation will collect this on its next successful run; current worker health is shown above.';
    if(status==='superseded')return 'Replaced safely by your later decision.';
    if(status==='blocked')return 'ORMA automation could not complete this handoff; it needs attention.';
    if(status==='publication-failed')return `Publication stopped at ${(item.failureStage||'automation').replace(/-/g,' ')}. Your approval is retained and the failure receipt is linked.${item.retryMode==='manual'?' Automatic retries are paused until the external setting is corrected and a forced manual run is started.':item.retryAfter?` Automatic retry paused until ${new Date(item.retryAfter).toLocaleString()}.`:''}`;
    if(status==='pull-request-opened')return 'The tested website diff is ready for your final GitHub review.';
    if(status==='approved-for-pr-creation')return 'Approval consumed. ORMA automation is preparing the website pull request.';
    if(item.stream==='dossier'&&item.action==='request-revision')return 'Revision handed to the selected trail specialist.';
    if(item.stream==='content')return 'Content decision consumed; the trail advances when both outputs are approved.';
    if(item.stream==='publication')return 'Publication decision consumed by ORMA automation.';
    return 'Decision processed and retained in the audit trail.';
  }
  function candidateFromActivity(item,names){
    if(item.candidateId)return item.candidateId;
    const jobIds=(item.decisions||[]).map(decision=>decision.jobId).filter(Boolean);
    for(const candidateId of names.keys()){
      if(jobIds.some(jobId=>jobId===`verified-${candidateId}-copy`||jobId===`verified-${candidateId}-visual`))return candidateId;
    }
    return '';
  }

  function buildDashboardModel(input={}){
    const orchestration=input.orchestration||{};const dossiers=input.dossiers||{};const execution=input.execution||{};
    const publication=input.publication||{};const publicationRequests=input.publicationRequests||{requests:[]};
    const history=input.history||[];const allJobs=input.jobs||[];const workerHealth=deriveWorkerHealth(input.workerHealth,input.nowMs==null?{}:{nowMs:input.nowMs});
    const jobs=allJobs.filter(job=>['trail-verification-specialist','trail-claim-resolution','verified-trail-editorial-revision'].includes(job.jobType)||String(job.id||'').startsWith('trail-revision-'));
    const activeJobs=jobs.filter(job=>ACTIVE_JOB_STATES.has(job.status));
    const names=new Map();
    for(const trail of orchestration.trails||[])names.set(trail.candidateId||trail.trailId,trail.trailName||trail.name||trail.candidateId);
    for(const item of dossiers.items||[])names.set(item.candidateId,item.trailName||names.get(item.candidateId)||item.candidateId);
    for(const output of execution.outputs||[])if(output.candidateId&&!names.has(output.candidateId))names.set(output.candidateId,output.result?.title||output.candidateId);
    for(const item of publication.items||[])if(!names.has(item.candidateId))names.set(item.candidateId,item.targetTrailId||item.candidateId);

    const queuedDossierReviews=(history||[]).filter(item=>item.stream==='dossier'&&item.status==='queued');
    const dossierItems=(dossiers.items||[]).filter(item=>item.state==='awaiting-human'&&!queuedDossierReviews.some(review=>review.reviewId===item.reviewId));
    const queuedContentReviews=(history||[]).filter(item=>item.stream==='content'&&item.status==='queued');
    const queuedContentJobs=new Set(queuedContentReviews.flatMap(review=>(review.decisions||[]).map(decision=>decision.jobId)));
    const contentItems=(publication.items||[]).filter(item=>{
      if(item.state!=='waiting-content-approvals'||!(item.missingApprovals||[]).length)return false;
      const required=[];
      if(item.missingApprovals.includes('editorial-approval'))required.push(`verified-${item.candidateId}-copy`);
      if(item.missingApprovals.includes('asset-and-licensing-approval'))required.push(`verified-${item.candidateId}-visual`);
      return required.some(jobId=>!queuedContentJobs.has(jobId));
    });
    const latestPublication=latestPublicationState(history,publicationRequests);
    const releaseItems=(publication.items||[]).filter(item=>{
      if(item.state!=='ready-for-publication-preview')return false;
      const latest=latestPublication.get(item.candidateId)?.record;
      return !latest||!PUBLICATION_OWNED_STATES.has(latest.status||'queued');
    });
    const publicationInFlight=[...latestPublication.values()].filter(({record})=>['queued','processed','approved-for-pr-creation'].includes(record.status)).length;
    const automationFailures=[...latestPublication.values()].map(({record})=>record).filter(record=>record.status==='publication-failed');
    const handoffsInFlight=queuedDossierReviews.length+queuedContentReviews.length+publicationInFlight;
    const prItems=(publicationRequests.requests||[]).filter(request=>request.status==='pull-request-opened'&&request.pullRequestUrl);

    const decisions=[];
    for(const item of dossierItems)decisions.push({
      id:`evidence-${item.candidateId}`,kind:'evidence',stage:'1 · Evidence',title:names.get(item.candidateId)||item.trailName||item.candidateId,
      description:item.approvalAllowed===false?'Evidence findings prevent approval. Request a targeted revision or reject the candidate.':'The evidence packet is ready for your verification decision.',
      next:'After your decision: approved evidence advances automatically; a revision goes straight to the selected specialist and returns to this desk.',
      href:`trail-dossier-desk.html#review-${item.reviewId}`,actionLabel:'Review evidence',
    });
    for(const item of contentItems){
      const missing=(item.missingApprovals||[]).map(value=>value==='editorial-approval'?'copy':value==='asset-and-licensing-approval'?'image/licence':value.replace(/-/g,' '));
      decisions.push({id:`content-${item.candidateId}`,kind:'content',stage:'3 · Trail content',title:names.get(item.candidateId)||item.targetTrailId,
        description:`Still needs ${missing.join(' and ')} approval.`,next:'After both approvals: the final website field mapping opens automatically at the release gate.',
        href:`trail-content-desk.html#trail-${item.candidateId}`,actionLabel:'Review content'});
    }
    for(const item of releaseItems)decisions.push({
      id:`release-${item.candidateId}`,kind:'release',stage:'4 · Release mapping',title:names.get(item.candidateId)||item.targetTrailId,
      description:'Copy, image and locked evidence are approved. Review the exact fields that will enter the website.',
      next:'After approval: ORMA automation validates the generated site and opens a GitHub pull request. Its link will appear here.',
      href:`trail-content-desk.html#publication-${item.candidateId}`,actionLabel:'Review release',
    });
    for(const request of prItems)decisions.push({
      id:`pr-${request.id}`,kind:'pull-request',stage:'5 · Final website diff',title:names.get(request.candidateId)||request.targetTrailId,
      description:'ORMA automation generated and tested the website change. This pull request is the final public-mutation gate.',
      next:'After you merge: the normal website deployment publishes the approved trail change.',href:request.pullRequestUrl,actionLabel:'Review GitHub PR',external:true,
    });

    const blockedCandidates=new Set();
    for(const item of dossierItems)if(item.approvalAllowed===false)blockedCandidates.add(item.candidateId||item.reviewId);
    for(const job of jobs)if(job.status==='blocked')blockedCandidates.add(job.candidateId||job.id);
    for(const request of automationFailures)blockedCandidates.add(request.candidateId||request.id);
    for(const trail of orchestration.trails||[])if((trail.blockers||[]).length||/blocked|source-exhausted/.test(`${trail.state||''} ${trail.stage||''}`))blockedCandidates.add(trail.candidateId||trail.trailId);

    const activityById=new Map();
    for(const item of history){
      const candidateId=candidateFromActivity(item,names);
      activityById.set(`${item.stream}:${item.id}`,{...item,candidateId,title:names.get(candidateId)||item.trailName||candidateId||'Trail workflow',at:dateMs(item.processedAt||item.submittedAt)});
    }
    for(const request of publicationRequests.requests||[]){
      activityById.set(`publication:${request.id}`,{...request,stream:'publication',title:names.get(request.candidateId)||request.targetTrailId||'Trail release',at:dateMs(request.acknowledgedAt||request.failedAt||request.reviewedAt)});
    }
    const activity=[...activityById.values()].sort((a,b)=>b.at-a.at).slice(0,8).map(item=>({...item,message:activityMessage(item)}));
    return {
      decisions,activity,activeJobs,dossierItems,contentItems,releaseItems,prItems,publicationInFlight,handoffsInFlight,automationFailures,workerHealth,
      blockerCount:blockedCandidates.size,trackedTrails:orchestration.summary?.trails||(orchestration.trails||[]).length,
      summary:{needsYou:decisions.length,agentWork:activeJobs.length,blockers:blockedCandidates.size,prsReady:prItems.length},
      pipeline:[
        {number:1,title:'Evidence',owner:dossierItems.length?'You':queuedDossierReviews.length?'System':activeJobs.length?'Agents':'System',status:dossierItems.length?`${plural(dossierItems.length,'decision')} waiting`:queuedDossierReviews.length?`${plural(queuedDossierReviews.length,'decision')} being handed off`:activeJobs.length?`${plural(activeJobs.length,'job')} in progress`:'No decision waiting'},
        {number:2,title:'Agent resolution',owner:'Agents',status:activeJobs.length?`${plural(activeJobs.length,'job')} running or queued`:'No agent work queued'},
        {number:3,title:'Trail content',owner:contentItems.length?'You':queuedContentReviews.length?'System':'System',status:contentItems.length?`${plural(contentItems.length,'trail')} needs review`:queuedContentReviews.length?`${plural(queuedContentReviews.length,'decision')} being handed off`:'No content decision waiting'},
        {number:4,title:'Release mapping',owner:releaseItems.length?'You':automationFailures.length?'System':publicationInFlight?'System':'System',status:releaseItems.length?`${plural(releaseItems.length,'trail')} needs approval`:automationFailures.length?`${plural(automationFailures.length,'release')} blocked with a saved failure receipt`:publicationInFlight?`${plural(publicationInFlight,'approval')} being processed`:'No release approval waiting'},
        {number:5,title:'Final PR',owner:prItems.length?'You':'System',status:prItems.length?`${plural(prItems.length,'PR')} ready`:automationFailures.length?'PR creation is blocked until automation recovers':'No final PR waiting'},
      ],
    };
  }
  return {buildDashboardModel,dateMs,deriveWorkerHealth,latestPublicationState,activityMessage,candidateFromActivity};
});
