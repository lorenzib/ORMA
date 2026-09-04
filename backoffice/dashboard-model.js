(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ORMADashboardModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ACTIVE_JOB_STATES=new Set(['queued','running','in-progress','processing']);
  const PUBLICATION_OWNED_STATES=new Set(['queued','processed','approved-for-pr-creation','publication-failed','pull-request-opened','published','hold','request-changes']);
  const PAUSED_SAFETY_GUIDES=new Set(['alpine-plants-for-dogs','altitude-with-your-dog','breed-group-caveats','dogs-at-rifugi','dogs-on-cable-cars','heat-overheating','livestock-guard-dogs','paw-protection','water-for-dogs-on-trail']);

  function isPausedSafetyPacket(packet){return packet?.subject?.type==='page'&&packet.subject.id==='safety-guide'||packet?.subject?.type==='guide'&&PAUSED_SAFETY_GUIDES.has(packet.subject.id);}

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
    const expected=Number(artifact?.expectedIntervalMinutes||15);
    const delayedAfter=Number(artifact?.delayAfterMinutes||45);
    const staleAfter=Number(artifact?.staleAfterMinutes||90);
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
  function deriveCampaignHealth(artifact,options={}){
    const nowMs=options.nowMs??Date.now();const runUrl=artifact?.workflowRunUrl||artifact?.lastFailure?.workflowRunUrl||null;
    if(!artifact||!artifact.status)return {state:'unknown',label:'No campaign receipt',title:'Catalogue intake has not run yet',message:'No protected intake receipt exists yet. Enabling the campaign will create one without publishing any trail.',meta:'Capacity remains limited to 15 trails in verification',runUrl:null};
    if(artifact.status==='running')return {state:'running',label:'Checking catalogue',title:'ORMA is admitting the next eligible trails',message:'A due-only campaign pass is running now. It cannot exceed the 15-trail verification capacity.',meta:`Started ${minutesSince(artifact.startedAt,nowMs)??0} minute(s) ago · protected Firestore receipt`,runUrl};
    if(artifact.status==='failed'){const failure=artifact.lastFailure||{};return {state:'failed',label:'Intake failed',title:'The catalogue campaign needs attention',message:failure.message||'The latest campaign failed without a captured diagnostic.',meta:`Retry eligible ${artifact.nextEligibleAt?new Date(artifact.nextEligibleAt).toLocaleString():'after the next worker pass'} · no trail was published`,runUrl};}
    const result=artifact.lastResult||{};const next=artifact.nextEligibleAt?new Date(artifact.nextEligibleAt).toLocaleString():'not recorded';
    const routeProgress=Number.isFinite(Number(result.routeNumberGuidanceOutstanding))
      ? ` Trail-number guidance remains to be verified for ${Number(result.routeNumberGuidanceOutstanding)} trail(s).`
      : '';
    return {state:'healthy',label:'Intake active',title:'Catalogue admission is automatic and capacity-limited',message:`The last pass admitted ${Number(result.admitted||0)} trail(s); ${Number(result.remainingQueueable||0)} remain eligible outside the active verification fleet.${routeProgress}`,meta:`Next due check ${next} · no public mutation`,runUrl};
  }
  function latestPublicationState(history,requests){
    const latest=new Map();
    const records=[
      ...(history||[]).filter(item=>item.stream==='publication'),
      ...((requests&&requests.requests)||[]).map(item=>({...item,stream:'publication-request'})),
    ];
    for(const record of records){
      if(!record.candidateId)continue;
      const at=dateMs(record.deployedAt||record.publishedAt||record.acknowledgedAt||record.processedAt||record.reviewedAt||record.submittedAt);
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
    if(status==='awaiting-pr-merge')return 'The tested trail-photo diff is ready for your final GitHub review.';
    if(status==='pr-materialized')return 'The approved trail photo has been materialized and the publishing worker is preparing its pull request.';
    if(status==='published')return `Published on the ORMA website from commit ${String(item.publicationCommit||'unknown').slice(0,7)}. The successful deployment receipt and live trail link are saved.`;
    if(status==='approved-for-pr-creation')return 'Approval consumed. ORMA automation is preparing the website pull request.';
    if(item.stream==='dossier'&&item.action==='request-revision')return 'Revision handed to the selected trail specialist.';
    if(item.stream==='content')return 'Content decision consumed; the trail advances when both outputs are approved.';
    if(item.stream==='new-trail')return item.action==='send-to-verification'?'Selection consumed; the candidate is entering the capacity-limited Existing Trails verification fleet.':'New Trail decision consumed and retained in the scouting audit trail.';
    if(item.stream==='hazard')return 'Groundskeeper decision consumed in the protected warning layer; the public website has not been changed.';
    if(item.stream==='editorial')return item.action==='approve'?'Editorial approval consumed; validation and publication have a separate durable receipt.':'Copywriter revision handed off; the revised comparison returns to Editorial.';
    if(item.stream==='image')return 'Image sourcing route consumed. Actual asset and rights approval remain a separate human gate.';
    if(item.stream==='newsletter')return item.action==='approve'?'Newsletter approved for launch-gated handoff. No email was sent.':'Newsletter revision handed to the agent; the complete issue returns to the same desk.';
    if(item.stream==='analyst')return 'Analyst decision consumed. Design, implementation and Release retain their named human gates.';
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
  function latestReviewBy(reviews,key){
    const latest=new Map();for(const review of reviews||[]){const id=review[key];if(!id)continue;const current=latest.get(id);if(!current||dateMs(review.processedAt||review.submittedAt)>=dateMs(current.processedAt||current.submittedAt))latest.set(id,review);}return latest;
  }

  function buildDashboardModel(input={}){
    const orchestration=input.orchestration||{};const dossiers=input.dossiers||{};const execution=input.execution||{};
    const publication=input.publication||{};const publicationRequests=input.publicationRequests||{requests:[]};
    const newTrailScouting=input.newTrailScouting||{candidates:[],summary:{}};const newTrailReviews=input.newTrailReviews||[];const newTrailStatus=input.newTrailStatus||{};
    const hazards=input.hazards||{hazards:[]};const hazardQueue=input.hazardQueue||{items:[]};const hazardReviews=input.hazardReviews||[];const hazardStatus=input.hazardStatus||{};
    const editorialPackets=(input.editorialPackets||[]).filter(packet=>!isPausedSafetyPacket(packet));const editorialReviews=input.editorialReviews||[];const editorialReceipts=input.editorialReceipts||{receipts:[]};const strategyStatus=input.strategyStatus||{};
    const imageAudit=input.imageAudit||{gaps:[],summary:{}};const imageReviews=input.imageReviews||[];const imageResults=input.imageResults||{items:[]};
    const imagePublicationRequests=input.imagePublicationRequests||{requests:[]};const imageStatus=input.imageStatus||{};
    const newsletterPacket=input.newsletterPacket||null;const newsletterReviews=input.newsletterReviews||[];const approvedNewsletters=input.approvedNewsletters||{issues:[]};
    const productIdeas=input.productIdeas||{ideas:[]};const analystReviews=input.analystReviews||[];const productInvestigations=input.productInvestigations||{items:[]};const productDesigns=input.productDesigns||{items:[]};
    const history=input.history||[];const allJobs=input.jobs||[];const timing=input.nowMs==null?{}:{nowMs:input.nowMs};const workerHealth=deriveWorkerHealth(input.workerHealth,timing);const campaignHealth=deriveCampaignHealth(input.campaignHealth,timing);
    const newsletterParked=String(strategyStatus.summary?.newsletterStatus||'').startsWith('parked');
    const editorialParked=!strategyStatus.summary?.editorialStatus||String(strategyStatus.summary.editorialStatus).startsWith('parked');
    const analystParked=!strategyStatus.summary?.productStatus||String(strategyStatus.summary.productStatus).startsWith('parked');
    const trailJobs=allJobs.filter(job=>['trail-verification-specialist','trail-claim-resolution','verified-trail-editorial-first-pass','verified-trail-editorial-revision'].includes(job.jobType)||String(job.id||'').startsWith('trail-revision-'));
    const hostedTeamJobs=allJobs.filter(job=>['hosted-editorial-revision','hosted-editorial-publication','hosted-image-sourcing','hosted-newsletter-revision','hosted-product-investigation','hosted-product-design','product-development-handoff'].includes(job.jobType)
      &&(!newsletterParked||job.jobType!=='hosted-newsletter-revision')
      &&(!editorialParked||!['hosted-editorial-revision','hosted-editorial-publication'].includes(job.jobType))
      &&(!analystParked||!['hosted-product-investigation','hosted-product-design','product-development-handoff'].includes(job.jobType)));
    const jobs=[...trailJobs,...hostedTeamJobs];const activeTrailJobs=trailJobs.filter(job=>ACTIVE_JOB_STATES.has(job.status));
    const activeJobs=jobs.filter(job=>ACTIVE_JOB_STATES.has(job.status));
    const names=new Map();
    for(const trail of orchestration.trails||[])names.set(trail.candidateId||trail.trailId,trail.trailName||trail.name||trail.candidateId);
    for(const item of dossiers.items||[])names.set(item.candidateId,item.trailName||names.get(item.candidateId)||item.candidateId);
    for(const output of execution.outputs||[])if(output.candidateId&&!names.has(output.candidateId))names.set(output.candidateId,output.result?.title||output.candidateId);
    for(const item of publication.items||[])if(!names.has(item.candidateId))names.set(item.candidateId,item.targetTrailId||item.candidateId);
    for(const item of newTrailScouting.candidates||[])names.set(item.id,item.name||item.id);
    const hazardNames=new Map((hazards.hazards||[]).map(item=>[item.id,item.title||item.id]));
    const productNames=new Map((productIdeas.ideas||[]).map(item=>[item.id,item.title||item.id]));

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
    const latestNewTrailReviews=latestReviewBy(newTrailReviews,'candidateId');
    const newTrailItems=(newTrailScouting.candidates||[]).filter(candidate=>{const review=latestNewTrailReviews.get(candidate.id);return !review||['blocked','superseded'].includes(review.status);});
    const latestHazardReviews=latestReviewBy(hazardReviews,'hazardId');
    const hazardItems=(hazardQueue.items||[]).filter(hazard=>{const review=latestHazardReviews.get(hazard.id);return !review||['blocked','superseded'].includes(review.status);});
    const newTrailHandoffs=newTrailReviews.filter(review=>review.status==='queued').length;
    const hazardHandoffs=hazardReviews.filter(review=>review.status==='queued').length;
    const latestEditorialReviews=new Map();for(const review of editorialReviews){const key=`${review.packetGeneratedAt}:${review.sourceRef}`;const current=latestEditorialReviews.get(key);if(!current||dateMs(review.processedAt||review.submittedAt)>=dateMs(current.processedAt||current.submittedAt))latestEditorialReviews.set(key,review);}
    const editorialItems=editorialParked?[]:editorialPackets.filter(packet=>{const review=latestEditorialReviews.get(`${packet.generatedAt}:${packet.subject?.sourceRef}`);return !review||['blocked','superseded'].includes(review.status);});
    const latestImageReviews=latestReviewBy(imageReviews,'slug');const imageResultBySlug=new Map((imageResults.items||[]).map(item=>[item.slug,item]));
    const imageRequestByTrail=new Map((imagePublicationRequests.requests||[]).map(item=>[item.trailId,item]));
    const imageItems=(imageAudit.gaps||[]).filter(gap=>{const review=latestImageReviews.get(gap.slug);const result=imageResultBySlug.get(gap.slug);const request=imageRequestByTrail.get(gap.trailId||gap.slug);
      const previewReady=(result?.candidates||[]).some(candidate=>candidate.status==='ready-for-asset-review');return !request&&(!review||['blocked','superseded'].includes(review.status)||previewReady);})
      .sort((a,b)=>Number((imageResultBySlug.get(b.slug)?.candidates||[]).some(candidate=>candidate.status==='ready-for-asset-review'))-Number((imageResultBySlug.get(a.slug)?.candidates||[]).some(candidate=>candidate.status==='ready-for-asset-review')))
      .slice(0,15);
    const editorialHandoffs=editorialParked?0:editorialReviews.filter(review=>['queued','processing'].includes(review.status)).length;
    const imageHandoffs=imageReviews.filter(review=>['queued','processing'].includes(review.status)).length+(imagePublicationRequests.requests||[]).filter(request=>['approved-for-pr-creation','pr-materialized'].includes(request.status)).length;
    const imagePrItems=(imagePublicationRequests.requests||[]).filter(request=>request.status==='awaiting-pr-merge'&&request.publicationPrUrl);
    const latestNewsletter=(newsletterReviews||[]).filter(review=>review.packetGeneratedAt===newsletterPacket?.generatedAt).sort((a,b)=>dateMs(b.processedAt||b.submittedAt)-dateMs(a.processedAt||a.submittedAt))[0];
    const newsletterItem=!newsletterParked&&newsletterPacket&&(newsletterPacket.outputs||[]).some(output=>output.status==='ready-for-review')&&(!latestNewsletter||['blocked','superseded'].includes(latestNewsletter.status))?newsletterPacket:null;
    const analystIdeaReviews=latestReviewBy((analystReviews||[]).filter(review=>(review.subjectType||'idea')==='idea'),'ideaId');
    const analystMockupReviews=latestReviewBy((analystReviews||[]).filter(review=>review.subjectType==='mockup'),'ideaId');
    const investigationIds=new Set((productInvestigations.items||[]).map(item=>item.ideaId));
    const latestDesignByIdea=new Map();for(const design of productDesigns.items||[]){const current=latestDesignByIdea.get(design.ideaId);if(!current||dateMs(design.generatedAt)>=dateMs(current.generatedAt))latestDesignByIdea.set(design.ideaId,design);}
    const analystIdeaItems=analystParked?[]:(productIdeas.ideas||[]).filter(idea=>{const review=analystIdeaReviews.get(idea.id);return !review||['blocked','superseded'].includes(review.status)||(review.status==='processed'&&review.action==='investigate-further'&&investigationIds.has(idea.id));});
    const analystMockupItems=analystParked?[]:[...latestDesignByIdea.values()].filter(design=>{const review=analystMockupReviews.get(design.ideaId);return !review||['blocked','superseded'].includes(review.status)||(review.status==='processed'&&review.action==='request-mockup-revision');});
    const newsletterHandoffs=newsletterParked?0:newsletterReviews.filter(review=>['queued','processing'].includes(review.status)).length;
    const analystHandoffs=analystParked?0:analystReviews.filter(review=>['queued','processing'].includes(review.status)).length;

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
    for(const request of imagePrItems)decisions.push({id:`image-pr-${request.id}`,kind:'pull-request',stage:'Trail photos · Final website diff',title:request.title||request.trailId,
      description:'The approved trail photo and its rights metadata are in a tested website pull request.',next:'After you merge, the normal website deployment adds the photo to the trail.',
      href:request.publicationPrUrl,actionLabel:'Review photo PR',external:true});
    if(newTrailItems.length)decisions.push({id:'new-trail-selection',kind:'new-trail',stage:'New Trails · Candidate selection',title:`${plural(newTrailItems.length,'candidate')} ready`,description:'Ranked loop candidates are waiting for selection, parking or rejection.',next:'A selected candidate enters Cartographer verification under the shared 15-trail capacity; it is not published.',href:'new-trail-scouting-desk.html',actionLabel:'Review New Trails'});
    if(hazardItems.length)decisions.push({id:'hazard-resolution',kind:'hazard',stage:'Existing Trails · Groundskeeper',title:`${plural(hazardItems.length,'warning')} awaiting removal review`,description:'An authoritative warning expired, but ORMA has retained it until you confirm removal.',next:'Your decision updates the protected warning state. The public website remains unchanged until its release integration is approved.',href:'hazard-review-desk.html',actionLabel:'Review warnings'});
    if(editorialItems.length)decisions.push({id:'editorial-copy',kind:'editorial',stage:'Editorial · Guide copy',title:`${plural(editorialItems.length,'copy packet')} ready`,description:'Compare current and proposed guide copy, edit it directly, then publish or request one revision.',next:'Approval validates and commits only the reviewed guide. A revision returns to the same desk.',href:'editorial-desk.html',actionLabel:'Review copy'});
    if(imageItems.length)decisions.push({id:'editorial-images',kind:'image',stage:'Editorial · Trail photos',title:`${plural(imageItems.length,'trail photo')} ${imageItems.length===1?'needs':'need'} routing`,description:'Upload your photo, choose an owned asset, request licensed sourcing or explicitly prepare an AI option.',next:'The Visual Director returns the exact asset for visual and rights approval before any publishing PR.',href:'image-coverage-desk.html',actionLabel:'Review trail photos'});
    if(newsletterItem)decisions.push({id:'newsletter-issue',kind:'newsletter',stage:'Newsletter · Complete issue',title:newsletterItem.outputs?.find(output=>output.status==='ready-for-review')?.result?.issueTitle||'One issue ready',description:'Review the complete reader-facing issue, subject options and source links.',next:'Approval hands it to launch-gated Social and any future sending integration. No email is sent automatically.',href:'newsletter-desk.html',actionLabel:'Review issue'});
    if(analystIdeaItems.length)decisions.push({id:'analyst-opportunities',kind:'analyst',stage:'Analyst · Evidence and opportunity',title:`${plural(analystIdeaItems.length,'opportunity')} needs direction`,description:'Review source-linked evidence separately from ORMA inference, then investigate, send to Designer, park or dismiss.',next:'Only “Send to Designer” authorises a mock-up. No implementation starts.',href:'product-ideas-desk.html',actionLabel:'Review opportunities'});
    if(analystMockupItems.length)decisions.push({id:'analyst-mockups',kind:'analyst',stage:'Design · Visual prototype gate',title:`${plural(analystMockupItems.length,'prototype')} ready`,description:'Click through the actual proposed screens and inspect the interaction flow.',next:'Approval creates a protected Developer handoff; implementation and Release remain separately gated.',href:'designer-desk.html',actionLabel:'Review prototypes'});

    const blockedCandidates=new Set();
    for(const item of dossierItems)if(item.approvalAllowed===false)blockedCandidates.add(item.candidateId||item.reviewId);
    for(const job of jobs)if(job.status==='blocked')blockedCandidates.add(job.candidateId||job.id);
    for(const request of automationFailures)blockedCandidates.add(request.candidateId||request.id);
    for(const trail of orchestration.trails||[])if((trail.blockers||[]).length||/blocked|source-exhausted/.test(`${trail.state||''} ${trail.stage||''}`))blockedCandidates.add(trail.candidateId||trail.trailId);
    if(newTrailStatus.status==='failed')blockedCandidates.add('new-trail-scouting');
    if(hazardStatus.status==='failed'||Number(hazardStatus.summary?.sourceFailures||0)>0)blockedCandidates.add('groundskeeper');
    if(strategyStatus.status==='failed')blockedCandidates.add('strategy-cycle');
    if(imageStatus.status==='failed')blockedCandidates.add('trail-photo-coverage');
    if(String(strategyStatus.summary?.productStatus||'').startsWith('blocked:'))blockedCandidates.add('analyst-refresh');

    const activityById=new Map();
    for(const item of history){
      const candidateId=candidateFromActivity(item,names);
      const title=item.stream==='hazard'?hazardNames.get(item.hazardId)
        :item.stream==='analyst'?productNames.get(item.ideaId)||item.ideaId
          :item.stream==='newsletter'?item.issueId||'Newsletter issue'
            :item.stream==='editorial'?item.sourceRef||'Guide copy'
              :item.stream==='image'?item.slug||'Image coverage'
                :names.get(candidateId)||item.trailName||candidateId;
      activityById.set(`${item.stream}:${item.id}`,{...item,candidateId,title:title||'Trail workflow',at:dateMs(item.processedAt||item.submittedAt)});
    }
    for(const request of publicationRequests.requests||[]){
      activityById.set(`publication:${request.id}`,{...request,stream:'publication',title:names.get(request.candidateId)||request.targetTrailId||'Trail release',at:dateMs(request.deployedAt||request.publishedAt||request.acknowledgedAt||request.failedAt||request.reviewedAt)});
    }
    for(const request of imagePublicationRequests.requests||[]){
      activityById.set(`image-publication:${request.id}`,{...request,stream:'image-publication',pullRequestUrl:request.publicationPrUrl,title:request.title||request.trailId||'Trail photo',at:dateMs(request.deployedAt||request.publishedAt||request.prCreatedAt||request.approvedAt)});
    }
    const activity=[...activityById.values()].sort((a,b)=>b.at-a.at).slice(0,8).map(item=>({...item,message:activityMessage(item)}));
    return {
      decisions,activity,activeJobs,dossierItems,contentItems,releaseItems,prItems,imagePrItems,newTrailItems,hazardItems,editorialItems,imageItems,newsletterItem,analystIdeaItems,analystMockupItems,publicationInFlight,handoffsInFlight:handoffsInFlight+newTrailHandoffs+hazardHandoffs+editorialHandoffs+imageHandoffs+newsletterHandoffs+analystHandoffs,automationFailures,workerHealth,campaignHealth,
      blockerCount:blockedCandidates.size,trackedTrails:orchestration.summary?.trails||(orchestration.trails||[]).length,
      newTrailProgress:{candidates:(newTrailScouting.candidates||[]).length,waiting:newTrailItems.length,inFlight:newTrailHandoffs,status:newTrailStatus.status||'not-run'},
      groundskeeperProgress:{active:(hazards.hazards||[]).filter(item=>item.state==='active').length,waiting:hazardItems.length,sourceFailures:Number(hazardStatus.summary?.sourceFailures||0),status:hazardStatus.status||'not-run'},
      editorialProgress:{active:editorialParked?0:editorialPackets.length,waiting:editorialItems.length,inFlight:editorialHandoffs,imageGaps:imageItems.length,published:(editorialReceipts.receipts||[]).filter(item=>item.status==='published').length,pausedSafetyLibrary:true,status:strategyStatus.summary?.editorialStatus||'parked for MVP'},
      newsletterProgress:{ready:newsletterItem?1:0,inFlight:newsletterHandoffs,approved:(approvedNewsletters.issues||[]).length,status:strategyStatus.summary?.newsletterStatus||'not-run'},
      analystProgress:{ideas:analystParked?0:(productIdeas.ideas||[]).length,waiting:analystIdeaItems.length,mockups:analystMockupItems.length,inFlight:analystHandoffs,developerHandoffs:analystParked?0:allJobs.filter(job=>job.jobType==='product-development-handoff'&&job.status==='ready-for-review').length,status:strategyStatus.summary?.productStatus||'parked for MVP'},
      summary:{needsYou:decisions.length,agentWork:activeJobs.length,blockers:blockedCandidates.size,prsReady:prItems.length+imagePrItems.length},
      pipeline:[
        {number:1,title:'Evidence',owner:dossierItems.length?'You':queuedDossierReviews.length?'System':activeTrailJobs.length?'Agents':'System',status:dossierItems.length?`${plural(dossierItems.length,'decision')} waiting`:queuedDossierReviews.length?`${plural(queuedDossierReviews.length,'decision')} being handed off`:activeTrailJobs.length?`${plural(activeTrailJobs.length,'job')} in progress`:'No decision waiting'},
        {number:2,title:'Agent resolution',owner:'Agents',status:activeTrailJobs.length?`${plural(activeTrailJobs.length,'job')} running or queued`:'No agent work queued'},
        {number:3,title:'Trail content',owner:contentItems.length?'You':queuedContentReviews.length?'System':'System',status:contentItems.length?`${plural(contentItems.length,'trail')} needs review`:queuedContentReviews.length?`${plural(queuedContentReviews.length,'decision')} being handed off`:'No content decision waiting'},
        {number:4,title:'Release mapping',owner:releaseItems.length?'You':automationFailures.length?'System':publicationInFlight?'System':'System',status:releaseItems.length?`${plural(releaseItems.length,'trail')} needs approval`:automationFailures.length?`${plural(automationFailures.length,'release')} blocked with a saved failure receipt`:publicationInFlight?`${plural(publicationInFlight,'approval')} being processed`:'No release approval waiting'},
        {number:5,title:'Final PR',owner:prItems.length+imagePrItems.length?'You':'System',status:prItems.length+imagePrItems.length?`${plural(prItems.length+imagePrItems.length,'PR')} ready`:automationFailures.length?'PR creation is blocked until automation recovers':'No final PR waiting'},
      ],
    };
  }
  return {buildDashboardModel,dateMs,deriveWorkerHealth,deriveCampaignHealth,latestPublicationState,activityMessage,candidateFromActivity,isPausedSafetyPacket};
});
