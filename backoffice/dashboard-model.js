(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ORMADashboardModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ACTIVE_JOB_STATES=new Set(['queued','running','in-progress','processing']);
  const PUBLICATION_OWNED_STATES=new Set(['queued','processed','approved-for-pr-creation','publication-failed','pull-request-opened','published','hold','request-changes']);
  const PAUSED_SAFETY_GUIDES=new Set(['alpine-plants-for-dogs','altitude-with-your-dog','breed-group-caveats','dogs-at-rifugi','dogs-on-cable-cars','heat-overheating','livestock-guard-dogs','paw-protection','water-for-dogs-on-trail']);

  // The verification pipeline, in the order a trail actually travels it.
  // `stage` alone cannot answer "is this waiting on me?" —
  // route-identity-and-geometry covers both the cartographer still running and
  // its finished audit sitting at an open human gate. The state decides, so
  // both are carried and both are matched on.
  const VERIFICATION_TOTAL_STEPS=8;
  const HUMAN_GATE_STATES=new Set(['geometry-human-gate','dossier-human-gate']);
  const VERIFICATION_STEPS=Object.freeze([
    {step:1,stage:'route-identity-and-geometry',state:'geometry-audit',label:'Checking route identity and geometry',by:'cartographer'},
    {step:2,stage:'route-identity-and-geometry',state:'geometry-human-gate',label:'Waiting for your geometry approval',by:'you'},
    {step:3,stage:'parallel-evidence-research',label:'Researching evidence',by:'logistics, ranger and terrain agents'},
    {step:4,stage:'autonomous-claim-resolution',label:'Re-researching claims the agents disagreed on',by:'agents'},
    {step:5,stage:'source-provenance-audit',label:'Auditing where each fact came from',by:'evidence librarian'},
    {step:6,stage:'counter-evidence-review',label:'Red team challenging the dossier',by:'red team'},
    {step:7,stage:'complete-evidence-dossier',label:'Waiting for your dossier approval',by:'you'},
    {step:8,stage:'verified-dossier-approved',label:'Approved, handed to editorial',by:'editorial'},
  ]);
  // Revision and retry stages are built as `${agentId}-revision`, so they are
  // matched by pattern and placed at the step that agent owns.
  const AGENT_STEP={cartographer:1,logistics:3,regulatoryRanger:3,terrainPoi:3,evidenceLibrarian:5,redTeam:6};
  const AGENT_NAME={cartographer:'cartographer',logistics:'logistics agent',regulatoryRanger:'regulatory ranger',
    terrainPoi:'terrain agent',evidenceLibrarian:'evidence librarian',redTeam:'red team'};

  /**
   * Turn an orchestration stage into something a person can act on: what is
   * happening, how far along it is, and — the only part that changes anyone's
   * afternoon — whether it is waiting on a human.
   */
  function describeVerificationStage(stage,state,blockers){
    const key=String(stage||'').trim();
    const current=String(state||'').trim();
    const stuck=(blockers||[]).length;
    const of=VERIFICATION_TOTAL_STEPS;
    const gate=HUMAN_GATE_STATES.has(current);
    if(current==='rejected')return {step:null,of,label:'Rejected',by:null,waitingOnYou:false,blockers:stuck};
    if(current==='blocked')return {step:null,of,label:'Blocked: automated attempts exhausted',by:'you',waitingOnYou:true,blockers:stuck};
    if(key==='agent-execution-failure')return {step:null,of,label:'Stuck: an agent run failed',by:'you',waitingOnYou:true,blockers:stuck};
    const revision=/^(.+)-revision$/.exec(key);
    if(revision)return {step:AGENT_STEP[revision[1]]||null,of,
      label:`Revising after your note (${AGENT_NAME[revision[1]]||revision[1]})`,by:'agents',waitingOnYou:false,blockers:stuck};
    const retry=/^(.+)-retry$/.exec(key);
    if(retry)return {step:AGENT_STEP[retry[1]]||null,of,
      label:`Retrying the ${AGENT_NAME[retry[1]]||retry[1]} run`,by:'agents',waitingOnYou:false,blockers:stuck};
    const entry=VERIFICATION_STEPS.find(item=>item.stage===key&&item.state===current)
      ||VERIFICATION_STEPS.find(item=>item.stage===key&&!item.state)
      ||VERIFICATION_STEPS.find(item=>item.stage===key);
    if(entry)return {step:entry.step,of,label:entry.label,by:entry.by,
      waitingOnYou:entry.by==='you'||gate,blockers:stuck};
    // An unmapped stage still reads as a stage rather than a raw slug, and is
    // never claimed to be waiting on a human when nothing says so.
    return {step:null,of,label:key?key.replace(/-/g,' '):'In verification',by:null,waitingOnYou:gate,blockers:stuck,unmapped:true};
  }

  function isPausedSafetyPacket(packet){return packet?.subject?.type==='page'&&packet.subject.id==='safety-guide'||packet?.subject?.type==='guide'&&PAUSED_SAFETY_GUIDES.has(packet.subject.id);}

  function dateMs(value){
    if(!value)return 0;
    if(typeof value.toDate==='function')return value.toDate().getTime();
    if(value.seconds)return Number(value.seconds)*1000;
    const parsed=new Date(value).getTime();return Number.isNaN(parsed)?0:parsed;
  }
  function plural(count,singular,pluralForm=`${singular}s`){return `${count} ${count===1?singular:pluralForm}`;}
  function minutesSince(value,nowMs){const at=dateMs(value);return at?Math.max(0,Math.floor((nowMs-at)/60000)):null;}
  // "122 hours" is a number to decode; "5 days" is a fact you feel.
  function spanOf(minutes){
    if(minutes===null||minutes===undefined)return null;
    if(minutes<90)return plural(Math.max(1,Math.round(minutes)),'minute');
    if(minutes<2880)return plural(Math.round(minutes/60),'hour');
    return plural(Math.round(minutes/1440),'day');
  }
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
    if(artifact.status==='blocked'){
      const gate=artifact.publicationGate||{};const ageMinutes=minutesSince(artifact.completedAt||gate.blockedAt,nowMs);
      return {state:'blocked',label:'Publishing paused',title:'Website validation is blocking publication',message:gate.message||'Validate ORMA must pass before approved website changes can be materialized. Queue and agent work may continue; approvals stay saved.',runUrl:gate.validationRunUrl||runUrl,ageMinutes,expectedIntervalMinutes:expected,consecutiveFailures:Number(artifact.consecutiveFailures||0)};
    }
    if(artifact.status==='degraded'){
      // The run finished cleanly and did nothing. Dated from the first such run
      // rather than the latest, because the number that matters is how long the
      // queue has been standing still -- forty green runs hid that once.
      const idle=artifact.lastUnproductive||{};const ageMinutes=minutesSince(artifact.completedAt,nowMs);
      const stalledMinutes=minutesSince(idle.since||artifact.lastProductiveAt,nowMs);
      const runs=Number(artifact.consecutiveUnproductiveRuns||1);
      return {state:'degraded',label:'Nothing getting done',title:idle.providerParked?'Agents cannot reach the model provider':'The worker is running but completing no work',
        message:idle.message||'The last run completed every step but finished no agent job.',
        meta:`${plural(runs,'run')} in a row with nothing completed${stalledMinutes===null?'':`, over the last ${spanOf(stalledMinutes)}`}. Decisions you have already saved are safe and will be applied when work resumes.`,
        runUrl:idle.workflowRunUrl||runUrl,ageMinutes,expectedIntervalMinutes:expected,
        consecutiveUnproductiveRuns:runs,lastProductiveAt:artifact.lastProductiveAt||null,providerParked:Boolean(idle.providerParked)};
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
    if(status==='published')return `Published on the ORMA website from commit ${String(item.publicationCommit||'unknown').slice(0,7)}. The successful deployment receipt and live trail link are saved.`;
    if(status==='approved-for-pr-creation')return 'Approval consumed. ORMA automation is preparing the website pull request.';
    if(item.stream==='route')return 'Route choice recorded and retained in the audit trail; this gate no longer waits on you.';
    if(item.stream==='dossier'&&item.action==='request-revision')return 'Revision handed to the selected trail specialist.';
    if(item.stream==='content')return 'Content decision consumed; the trail advances when both outputs are approved.';
    if(item.stream==='new-trail')return item.action==='send-to-verification'?'Selection consumed; the candidate is entering the capacity-limited Existing Trails verification fleet.':'New Trail decision consumed and retained in the scouting audit trail.';
    if(item.stream==='hazard')return 'Groundskeeper decision consumed in the protected warning layer; the public website has not been changed.';
    if(item.stream==='editorial')return item.action==='approve'?'Editorial approval consumed; validation and publication have a separate durable receipt.':'Copywriter revision handed off; the revised comparison returns to Editorial.';
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

  function blockerLabel(value){
    const first=String(value||'').split('\n')[0].trim();
    if(!first)return '';
    const key=first.includes(':')?first.split(':')[0].trim():first;
    const leaf=key.includes('/')?key.split('/').pop():key;
    if(!/^[A-Za-z0-9/_-]+$/.test(leaf))return first.length>180?`${first.slice(0,177)}…`:first;
    const words=leaf.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').trim().toLowerCase();
    return words.charAt(0).toUpperCase()+words.slice(1);
  }

  function buildDashboardModel(input={}){
    const orchestration=input.orchestration||{};const dossiers=input.dossiers||{};const execution=input.execution||{};
    const routeReview=input.routeReview||{items:[]};const routeReviews=input.routeReviews||[];
    const publication=input.publication||{};const publicationRequests=input.publicationRequests||{requests:[]};
    const newTrailScouting=input.newTrailScouting||{candidates:[],summary:{}};const newTrailReviews=input.newTrailReviews||[];const newTrailStatus=input.newTrailStatus||{};
    const hazards=input.hazards||{hazards:[]};const hazardQueue=input.hazardQueue||{items:[]};const hazardReviews=input.hazardReviews||[];const hazardStatus=input.hazardStatus||{};
    const editorialPackets=(input.editorialPackets||[]).filter(packet=>!isPausedSafetyPacket(packet));const editorialReviews=input.editorialReviews||[];const editorialReceipts=input.editorialReceipts||{receipts:[]};const strategyStatus=input.strategyStatus||{};
    const newsletterPacket=input.newsletterPacket||null;const newsletterReviews=input.newsletterReviews||[];const approvedNewsletters=input.approvedNewsletters||{issues:[]};
    const productIdeas=input.productIdeas||{ideas:[]};const analystReviews=input.analystReviews||[];const productInvestigations=input.productInvestigations||{items:[]};const productDesigns=input.productDesigns||{items:[]};
    const history=input.history||[];const allJobs=input.jobs||[];const timing=input.nowMs==null?{}:{nowMs:input.nowMs};const workerHealth=deriveWorkerHealth(input.workerHealth,timing);const campaignHealth=deriveCampaignHealth(input.campaignHealth,timing);
    const newsletterParked=String(strategyStatus.summary?.newsletterStatus||'').startsWith('parked');
    const editorialParked=!strategyStatus.summary?.editorialStatus||String(strategyStatus.summary.editorialStatus).startsWith('parked');
    const analystParked=!strategyStatus.summary?.productStatus||String(strategyStatus.summary.productStatus).startsWith('parked');
    const trailJobs=allJobs.filter(job=>['trail-verification-specialist','trail-claim-resolution','verified-trail-editorial-first-pass','verified-trail-editorial-revision'].includes(job.jobType)||String(job.id||'').startsWith('trail-revision-'));
    const hostedTeamJobs=allJobs.filter(job=>['hosted-editorial-revision','hosted-editorial-publication','hosted-newsletter-revision','hosted-product-investigation','hosted-product-design','product-development-handoff'].includes(job.jobType)
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
    const editorialHandoffs=editorialParked?0:editorialReviews.filter(review=>['queued','processing'].includes(review.status)).length;
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
    // A route choice already recorded is not waiting on anyone. The answer is
    // its own Firestore document while the question stays in the `route-review`
    // artifact, which only a cartographer run rebuilds — so without this the
    // same card is asked again on every refresh, long after it was answered.
    // The rule matches the dossier one: a recorded decision leaves the queue,
    // and a question genuinely asked again — a newer artifact, or a decision
    // automation could not apply — comes back.
    const latestRouteReviews=latestReviewBy(routeReviews,'candidateId');
    const routeAskedMs=dateMs(routeReview.generatedAt);
    const routeAnswered=new Set();
    for(const [candidateId,review] of latestRouteReviews){
      if(['blocked','superseded'].includes(review.status))continue;
      const answeredMs=dateMs(review.processedAt||review.submittedAt);
      if(answeredMs&&routeAskedMs&&answeredMs<routeAskedMs)continue;
      routeAnswered.add(candidateId);
    }
    const routeHandoffs=[...latestRouteReviews.values()]
      .filter(review=>review.status==='queued'&&routeAnswered.has(review.candidateId)).length;

    const decisions=[];
    // Route choices / geometry confirmations awaiting a human. These live in the
    // route-review artifact (separate from the dossier queue), so surface them
    // first — they are the earliest gate and were previously invisible here.
    const routeItems=(routeReview.items||[]).filter(item=>/human|direct-confirmation/i.test(item.reviewState||'')
      &&!routeAnswered.has(item.candidateId));
    for(const item of routeItems)decisions.push({
      id:`route-${item.candidateId}`,kind:'route',stage:'0 · Route choice',
      title:item.title||names.get(item.candidateId)||item.candidateId,
      description:item.reviewState==='ready-for-human-route-choice'
        ?'Choose which official route variant(s) to keep as ORMA trails.'
        :item.reviewState==='source-exhausted-direct-confirmation'
          ?'Automated sources are exhausted; this route needs your direct confirmation before it can advance.'
          :'A reconstructed route is ready for your review.',
      next:'After your choice, the selected route enters the evidence and geometry gates.',
      href:`trail-verify-desk.html#route-${item.candidateId}`,actionLabel:'Review route',
    });
    for(const item of dossierItems)decisions.push({
      id:`evidence-${item.candidateId}`,kind:'evidence',stage:'1 · Evidence',title:names.get(item.candidateId)||item.trailName||item.candidateId,
      description:item.approvalAllowed===false?'Evidence findings prevent approval. Request a targeted revision or reject the candidate.':'The evidence packet is ready for your verification decision.',
      next:'After your decision: approved evidence advances automatically; a revision goes straight to the selected specialist and returns to this desk.',
      href:`trail-verify-desk.html#review-${item.reviewId}`,actionLabel:'Review evidence',
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

    // The headline count used to be a Set with no inspection surface. That made
    // "24 blocked" impossible to reconcile: the same trail can occur in a
    // dossier, an exhausted job and orchestration, while only the aggregate was
    // shown. Keep the same de-duplication, but retain the explanation and the
    // handoff which can clear each trail.
    const blockedById=new Map();
    const ownerWeight={Agents:1,System:2,You:3};
    function addBlockingIssue(id,issue){
      if(!id)return;
      const current=blockedById.get(id)||{id,title:names.get(id)||issue.title||id,reasons:[],owner:'Agents',nextAction:'Await agent resolution',href:'',external:false};
      const reasons=new Set(current.reasons);
      for(const value of issue.reasons||[]){const label=blockerLabel(value);if(label)reasons.add(label);}
      current.reasons=[...reasons];
      if((ownerWeight[issue.owner]||0)>(ownerWeight[current.owner]||0)){
        current.owner=issue.owner;current.nextAction=issue.nextAction;current.href=issue.href||'';current.external=Boolean(issue.external);
      }
      if(!current.reasons.length)current.reasons.push('A blocking issue was recorded without a usable explanation');
      blockedById.set(id,current);
    }
    for(const item of dossierItems){
      if(item.approvalAllowed!==false)continue;
      const id=item.candidateId||item.reviewId;
      addBlockingIssue(id,{title:item.trailName,reasons:item.blockingReasons||item.blockers||['Evidence findings prevent approval'],owner:'You',nextAction:'Review evidence',href:`trail-verify-desk.html#review-${item.reviewId}`});
    }
    for(const job of jobs){
      if(job.status!=='blocked')continue;
      const id=job.candidateId||job.id;
      addBlockingIssue(id,{reasons:[job.lastError||job.error||`${job.agentId||job.jobType||'Agent'} exhausted its retry budget`],owner:'System',nextAction:'Inspect stopped work',href:'trail-verify-desk.html#verifyStuck'});
    }
    for(const request of automationFailures){
      const id=request.candidateId||request.id;
      addBlockingIssue(id,{title:request.targetTrailId,reasons:[request.failureMessage||request.error||'Website publication failed'],owner:'System',nextAction:request.workflowRunUrl?'Inspect failed run':'Inspect release failure',href:request.workflowRunUrl||'trail-verify-desk.html',external:Boolean(request.workflowRunUrl)});
    }
    for(const trail of orchestration.trails||[]){
      if(!(trail.blockers||[]).length&&!/blocked|source-exhausted/.test(`${trail.state||''} ${trail.stage||''}`))continue;
      const id=trail.candidateId||trail.trailId;
      const progress=describeVerificationStage(trail.stage,trail.state,trail.blockers);
      const stopped=trail.state==='blocked'||/source-exhausted/.test(`${trail.state||''} ${trail.stage||''}`);
      addBlockingIssue(id,{title:trail.trailName||trail.name,reasons:(trail.blockers||[]).length?trail.blockers:[stopped?'Automated research attempts exhausted':'Verification is blocked'],owner:progress.waitingOnYou?'You':'Agents',nextAction:stopped?'Inspect stopped trail':progress.waitingOnYou?'Review trail':'Await agent resolution',href:stopped?'trail-verify-desk.html#verifyBlocked':progress.waitingOnYou?'trail-verify-desk.html':''});
    }
    const blockingIssues=[...blockedById.values()].sort((a,b)=>{
      const ownerOrder={You:0,System:1,Agents:2};
      return (ownerOrder[a.owner]??3)-(ownerOrder[b.owner]??3)||a.title.localeCompare(b.title);
    });

    const activityById=new Map();
    for(const item of history){
      const candidateId=candidateFromActivity(item,names);
      const title=item.stream==='hazard'?hazardNames.get(item.hazardId)
        :item.stream==='analyst'?productNames.get(item.ideaId)||item.ideaId
          :item.stream==='newsletter'?item.issueId||'Newsletter issue'
            :item.stream==='editorial'?item.sourceRef||'Guide copy'
              :names.get(candidateId)||item.trailName||candidateId;
      activityById.set(`${item.stream}:${item.id}`,{...item,candidateId,title:title||'Trail workflow',at:dateMs(item.processedAt||item.submittedAt)});
    }
    for(const request of publicationRequests.requests||[]){
      activityById.set(`publication:${request.id}`,{...request,stream:'publication',title:names.get(request.candidateId)||request.targetTrailId||'Trail release',at:dateMs(request.deployedAt||request.publishedAt||request.acknowledgedAt||request.failedAt||request.reviewedAt)});
    }
    const activity=[...activityById.values()].sort((a,b)=>b.at-a.at).slice(0,8).map(item=>({...item,message:activityMessage(item)}));
    return {
      decisions,activity,activeJobs,dossierItems,contentItems,releaseItems,prItems,newTrailItems,hazardItems,editorialItems,newsletterItem,analystIdeaItems,analystMockupItems,publicationInFlight,handoffsInFlight:handoffsInFlight+routeHandoffs+newTrailHandoffs+hazardHandoffs+editorialHandoffs+newsletterHandoffs+analystHandoffs,automationFailures,workerHealth,campaignHealth,blockingIssues,
      blockerCount:blockingIssues.length,trackedTrails:orchestration.summary?.trails||(orchestration.trails||[]).length,
      newTrailProgress:{candidates:(newTrailScouting.candidates||[]).length,waiting:newTrailItems.length,inFlight:newTrailHandoffs,status:newTrailStatus.status||'not-run'},
      groundskeeperProgress:{active:(hazards.hazards||[]).filter(item=>item.state==='active').length,waiting:hazardItems.length,sourceFailures:Number(hazardStatus.summary?.sourceFailures||0),status:hazardStatus.status||'not-run'},
      editorialProgress:{active:editorialParked?0:editorialPackets.length,waiting:editorialItems.length,inFlight:editorialHandoffs,published:(editorialReceipts.receipts||[]).filter(item=>item.status==='published').length,pausedSafetyLibrary:true,status:strategyStatus.summary?.editorialStatus||'parked for MVP'},
      newsletterProgress:{ready:newsletterItem?1:0,inFlight:newsletterHandoffs,approved:(approvedNewsletters.issues||[]).length,status:strategyStatus.summary?.newsletterStatus||'not-run'},
      analystProgress:{ideas:analystParked?0:(productIdeas.ideas||[]).length,waiting:analystIdeaItems.length,mockups:analystMockupItems.length,inFlight:analystHandoffs,developerHandoffs:analystParked?0:allJobs.filter(job=>job.jobType==='product-development-handoff'&&job.status==='ready-for-review').length,status:strategyStatus.summary?.productStatus||'parked for MVP'},
      summary:{needsYou:decisions.length,agentWork:activeJobs.length,blockers:blockingIssues.length,prsReady:prItems.length},
      pipeline:[
        {number:1,title:'Evidence',owner:dossierItems.length?'You':queuedDossierReviews.length?'System':activeTrailJobs.length?'Agents':'System',status:dossierItems.length?`${plural(dossierItems.length,'decision')} waiting`:queuedDossierReviews.length?`${plural(queuedDossierReviews.length,'decision')} being handed off`:activeTrailJobs.length?`${plural(activeTrailJobs.length,'job')} in progress`:'No decision waiting'},
        {number:2,title:'Agent resolution',owner:'Agents',status:activeTrailJobs.length?`${plural(activeTrailJobs.length,'job')} running or queued`:'No agent work queued'},
        {number:3,title:'Trail content',owner:contentItems.length?'You':queuedContentReviews.length?'System':'System',status:contentItems.length?`${plural(contentItems.length,'trail')} needs review`:queuedContentReviews.length?`${plural(queuedContentReviews.length,'decision')} being handed off`:'No content decision waiting'},
        {number:4,title:'Release mapping',owner:releaseItems.length?'You':automationFailures.length?'System':publicationInFlight?'System':'System',status:releaseItems.length?`${plural(releaseItems.length,'trail')} needs approval`:automationFailures.length?`${plural(automationFailures.length,'release')} blocked with a saved failure receipt`:publicationInFlight?`${plural(publicationInFlight,'approval')} being processed`:'No release approval waiting'},
        {number:5,title:'Final PR',owner:prItems.length?'You':'System',status:prItems.length?`${plural(prItems.length,'PR')} ready`:automationFailures.length?'PR creation is blocked until automation recovers':'No final PR waiting'},
      ],
    };
  }

  // One row per trail in the verification pipeline (verified or in-flight),
  // annotated with any active or reported hazards. The point is inspection:
  // seeing where trails stand and which carry a warning without opening a desk.
  // Photos are sourced by hand outside the backoffice, so they are not tracked.
  function buildCoverageGrid({hazards,verifiedRegistry,orchestration}={}){
    const verified=new Set((verifiedRegistry?.verified||[]).map(item=>item.trailId||item.candidateId).filter(Boolean));
    const meta=new Map();
    const remember=(id,source)=>{
      if(!id)return;const existing=meta.get(id)||{};
      // Registry and hazard records can legitimately contain only the stable
      // trail id. Do not let that fallback mask the catalogue name carried by
      // the richer orchestration record that is read afterwards.
      const existingTitle=existing.title&&existing.title!==id?existing.title:'';
      meta.set(id,{
        title:existingTitle||source.title||source.trailName||source.name||id,
        area:existing.area||source.area||'',valley:existing.valley||source.valley||'',region:existing.region||source.region||'',
      });
    };
    for(const item of verifiedRegistry?.verified||[])remember(item.trailId||item.candidateId,item);
    const inFlight=new Map();
    for(const trail of orchestration?.trails||[]){
      const id=trail.trailId;if(!id)continue;remember(id,trail);
      if(!verified.has(id))inFlight.set(id,{stage:trail.stage||null,state:trail.state||null,
        blockers:Array.isArray(trail.blockers)?trail.blockers:[]});
    }
    const hazardsByTrail=new Map();
    for(const hazard of hazards?.hazards||[]){
      for(const trailId of hazard.trailIds||[]){
        const current=hazardsByTrail.get(trailId)||[];
        current.push({title:hazard.title,severity:hazard.severity||'moderate',
          verificationState:hazard.verificationState||(hazard.origin==='community'?'reported-unverified':'authoritative'),
          origin:hazard.origin||'feed'});
        hazardsByTrail.set(trailId,current);
        remember(trailId,{});
      }
    }
    const rows=[...meta.keys()].map(id=>{
      const info=meta.get(id);const trailHazards=hazardsByTrail.get(id)||[];
      return {
        trailId:id,title:info.title,area:info.area,valley:info.valley,region:info.region,
        verified:verified.has(id)?'verified':inFlight.has(id)?'in-progress':'not-started',
        verificationStage:inFlight.get(id)?(inFlight.get(id).stage||inFlight.get(id).state||'in verification'):null,
        verificationState:inFlight.get(id)?.state||null,
        verificationProgress:inFlight.has(id)
          ?describeVerificationStage(inFlight.get(id).stage,inFlight.get(id).state,inFlight.get(id).blockers)
          :null,
        hazards:trailHazards,
        hazardState:trailHazards.length
          ?(trailHazards.some(item=>item.verificationState!=='reported-unverified')?'active':'unconfirmed')
          :'clear',
      };
    }).sort((a,b)=>
      (Number(a.verified==='verified')-Number(b.verified==='verified'))
      ||(a.region===b.region?0:a.region==='dolomites'?-1:1)
      ||String(a.valley).localeCompare(String(b.valley))
      ||String(a.title).localeCompare(String(b.title)));
    const count=(field,value)=>rows.filter(row=>row[field]===value).length;
    return {rows,summary:{
      trails:rows.length,
      verified:count('verified','verified'),verificationInProgress:count('verified','in-progress'),
      trailsWithHazards:rows.filter(row=>row.hazards.length).length,
      unconfirmedHazards:count('hazardState','unconfirmed'),
      complete:count('verified','verified'),
    }};
  }

  // What each claim is actually about, in the words a person would use. The
  // board showed raw ids -- `logistics/route-number-switches` -- to a reader
  // who needs to know that eight trails are missing walking directions.
  const CLAIM_LABELS=Object.freeze({
    'logistics/recommended-start':'where the walk starts',
    'logistics/route-number-status':'whether the route is numbered',
    'logistics/route-number-sequence':'the order of the paths',
    'logistics/route-number-switches':'where the path changes',
    'logistics/parking':'parking',
    'logistics/road-access':'road access',
    'logistics/public-transport':'public transport',
    'logistics/pedestrian-connection':'getting from the car park to the trail',
    'logistics/recommended-direction':'which way round to walk it',
    'terrainPoi/water':'water on the route',
    'terrainPoi/shade':'shade',
    'terrainPoi/surface':'the ground underfoot',
    'terrainPoi/elevation':'how much climbing',
    'terrainPoi/exposure':'exposed sections',
    'terrainPoi/livestock':'livestock on the route',
    'terrainPoi/animals':'animals',
    'terrainPoi/mountain-huts':'mountain huts',
    'terrainPoi/food-drink':'food and drink',
    'terrainPoi/other-places':'other places worth naming',
    'regulatoryRanger/dog-access':'whether dogs are allowed',
    'regulatoryRanger/leash-rules':'lead rules',
    'regulatoryRanger/seasonal-restrictions':'seasonal rules',
    'regulatoryRanger/rifugio-dog-policy':'whether a refuge takes dogs',
    'regulatoryRanger/lift-dog-policy':'whether a lift takes dogs',
    'evidenceLibrarian/provenance':'where the facts came from',
  });

  function plainClaim(id){
    if(CLAIM_LABELS[id])return CLAIM_LABELS[id];
    // An id nobody has named yet still reads as words rather than a path.
    return String(id||'').split('/').pop().replace(/-/g,' ')||'an unnamed check';
  }

  // "unresolved 16" is the machine's word for "we looked and found nothing",
  // and it means something different from "sources disagreed" -- which is the
  // distinction that mattered most when this was diagnosed by hand.
  // One gap, as a line a person can read: what it is about, how many trails it
  // holds, how long, and how it failed.
  function gapRow(row){
    return {
      claim:row.claim,
      label:plainClaim(row.claim),
      open:row.open,
      oldestDays:row.oldestDays??null,
      why:plainFinding(row.firstFindings),
      unwaivable:!!row.unwaivable,
    };
  }

  function plainFinding(findings){
    const words={unresolved:'found nothing',conflicted:'sources disagreed',
      varies:'depends on the day','counter-evidence':'evidence against',
      'supported-proposal':'answered'};
    return Object.entries(findings||{})
      .sort((a,b)=>b[1]-a[1])
      .map(([finding,count])=>`${words[finding]||finding} ${count}×`)
      .join(', ');
  }

  /**
   * The three programmes, each answering the same five questions.
   *
   * Backoffice Home could say "needs you: 0" truthfully while eleven trails sat
   * on a question with no answer, because nothing on it described a programme's
   * own health. Finding that on 2026-10-08 meant dispatching a report, saving
   * the run log and parsing 124 records by hand.
   *
   * Every figure here is read from an artifact a worker pass already wrote, so
   * the screen costs three documents however long it is left open.
   */
  function buildProgrammeBoard(input={}){
    const health=input.programmeHealth||null;
    const coverage=input.regionalCoverage||null;
    const hazards=(input.hazards&&input.hazards.hazards)||[];
    const hazardStatus=input.hazardStatus||{};
    const nowMs=input.nowMs||Date.now();

    const ageHours=value=>{
      const at=dateMs(value);
      return at?Math.max(0,Math.round((nowMs-at)/3_600_000)):null;
    };

    const verification=health?(()=>{
      const t=health.throughput||{};
      const gaps=health.evidenceGaps||{};
      const retries=health.retries||{};
      const cost=health.cost||{};
      const fresh=health.freshness||{};
      const stage=state=>(t.stages||[]).find(row=>row.state===state)?.trails||0;
      return {
        available:true,
        // The number the programme exists to move, stated even at zero -- which
        // is the whole point of putting it on the wall.
        headline:Number(t.verified||0)
          ?`${t.verified} trail${t.verified===1?'':'s'} verified`
          :'No trail has finished yet',
        settled:Number(t.verified||0)>0,
        // Four, not six. A tile for every field turns the two numbers that
        // matter into wallpaper.
        throughput:[
          {label:'In progress',value:t.inPipeline||0},
          {label:'Finished',value:t.verified||0,emphasis:true},
          {label:'Needs you',value:stage('geometry-human-gate')+stage('dossier-human-gate'),
            warn:stage('geometry-human-gate')+stage('dossier-human-gate')>0},
          {label:'Stuck',value:t.stalled||0,warn:Number(t.stalled||0)>0},
        ],
        // The counts that only matter when they are not zero belong in a
        // sentence, not in a tile of their own.
        notes:[
          Number(t.inRedTeam||0)?`${t.inRedTeam} at the last check before the finish.`:null,
          Number(t.stalled||0)?`${t.stalled} stopped — no job will pick them up.`:null,
        ].filter(Boolean),
        // Split because they need different work: nobody can decide their way
        // out of an unwaivable gap.
        // Split into the two piles that need different work, each headed by a
        // sentence saying which is which. Counting them together is what hid
        // the directions problem behind a bigger livestock number.
        gaps:{
          unwaivable:gaps.unwaivableOpen||0,
          waivable:gaps.waivableOpen||0,
          groups:[
            {
              title:'Only an agent can supply these',
              note:'No decision of yours clears them.',
              rows:(gaps.byClaim||[]).filter(row=>row.unwaivable).slice(0,5).map(gapRow),
            },
            {
              title:'You could judge these',
              note:'Each can be accepted at the gate with a written reason.',
              rows:(gaps.byClaim||[]).filter(row=>!row.unwaivable).slice(0,5).map(gapRow),
            },
          ].filter(group=>group.rows.length),
        },
        retries:{
          // Was "79 out of attempts of 5", which is not a sentence.
          sentence:`${retries.exhausted||0} of ${retries.claims||0} questions have used all `
            +`${retries.maximumAttempts||5} tries and will not be asked again.`,
          // A strategy that has never resolved anything is a share of the
          // research budget buying nothing.
          neverPaid:(retries.strategyNeverPaid||[]).map(row=>row.strategy),
        },
        cost:{
          readsPerPass:cost.reads??null,readsPerJob:cost.readsPerJob??null,
          sentence:cost.reads
            ?`${cost.reads.toLocaleString('en-GB')} database lookups on the last run`
              +`${cost.readsPerJob?`, ${cost.readsPerJob} per job`:''}.`
            :'No cost recorded for the last run.',
          // What is actually left today, rather than what a whole free day
          // would fund. The old line said the same thing at 9am and at 9pm.
          todaySentence:cost.today?cost.today.sentence:null,
          todayShare:cost.today?cost.today.sharePercent:null,
          todayPassesLeft:cost.today?cost.today.passesLeft:null,
        },
        freshness:{
          writtenHoursAgo:ageHours(health.generatedAt),
          oldestClaimDays:fresh.oldestClaimDays??null,
          oldestStateDays:fresh.oldestStateDays??null,
        },
      };
    })():{available:false,headline:'No programme summary yet — the next worker pass writes one.'};

    const expansion=coverage?(()=>{
      const t=coverage.totals||{};
      const gaps=coverage.gaps||{};
      return {
        available:true,
        headline:`${t.covered||0} of ${t.valleys||0} valleys covered`,
        settled:false,
        throughput:[
          {label:'Valleys',value:t.valleys||0},
          {label:'Covered',value:t.covered||0,emphasis:true},
          {label:'Thin',value:t.thin||0},
          {label:'Candidates awaiting you',value:t.candidatesAwaitingSelection||0,
            warn:Number(t.candidatesAwaitingSelection||0)>0},
        ],
        notes:[
          `${t.started||0} started, ${t.unstarted||0} not started.`,
        ],
        // Only valleys that are actually thin. Listing a 27-trail valley under
        // "thinnest" because it sorted third is not a shortlist.
        thinnest:(coverage.valleys||[])
          .filter(row=>row.valley&&row.published>0
            &&row.published<(coverage.policy?.thinBelowPublished??5))
          .slice().sort((a,b)=>a.published-b.published).slice(0,6)
          .map(row=>({valley:row.valley,published:row.published,verified:row.verified,state:row.state})),
        // A valley with no evidence file cannot say what it still needs, and a
        // trail with no valley is in no figure at all.
        unmeasured:(gaps.valleysWithoutResearchFile||[]).length,
        unplacedTrails:gaps.unplacedTrails||0,
        freshness:{writtenHoursAgo:ageHours(coverage.generatedAt)},
      };
    })():{available:false,headline:'No coverage summary yet — the next worker pass writes one.'};

    const sourceFailures=Number(hazardStatus?.summary?.sourceFailures||0);
    const partial=(hazardStatus?.sources||[]).filter(source=>source.ok&&source.completeSnapshot===false).length;
    const carriedThroughOutage=hazards.filter(item=>item.sourceStatus==='unavailable').length;
    const safety={
      available:!!hazardStatus.checkedAt||hazards.length>0,
      headline:`${hazards.length} live warning${hazards.length===1?'':'s'}`,
      settled:sourceFailures===0&&partial===0,
      // A tile per field made four zeros as loud as the one number that moves.
      // Anything at zero is reassurance, and reassurance is a sentence.
      throughput:[
        {label:'Live warnings',value:hazards.length},
        {label:'Community-reported',value:hazards.filter(item=>item.origin==='community').length},
        // A source that answered badly may add but never remove: #682.
        ...(sourceFailures?[{label:'Source failures',value:sourceFailures,warn:true}]:[]),
        ...(partial?[{label:'Partial feeds',value:partial,warn:true}]:[]),
        ...(carriedThroughOutage?[{label:'Carried through an outage',value:carriedThroughOutage}]:[]),
      ],
      notes:[sourceFailures||partial||carriedThroughOutage
        ?null:'Every source answered in full; nothing is being carried through an outage.'].filter(Boolean),
      freshness:{writtenHoursAgo:ageHours(hazardStatus.checkedAt)},
    };

    return {
      generatedAt:new Date(nowMs).toISOString(),
      programmes:[
        {id:'catalogue-verification',name:'Catalogue verification',...verification},
        {id:'geographical-expansion',name:'Geographical expansion',...expansion},
        {id:'dynamic-safety',name:'Dynamic safety',...safety},
      ],
    };
  }

  return {buildDashboardModel,buildCoverageGrid,buildProgrammeBoard,describeVerificationStage,VERIFICATION_STEPS,VERIFICATION_TOTAL_STEPS,dateMs,deriveWorkerHealth,deriveCampaignHealth,latestPublicationState,activityMessage,candidateFromActivity,isPausedSafetyPacket};
});
