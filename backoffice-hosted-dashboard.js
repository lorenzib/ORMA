(function(){
  'use strict';
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  let loading=false;let seconds=15;
  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}

  async function api(){
    if(window.ORMABackoffice)return window.ORMABackoffice;
    await new Promise(resolve=>{let settled=false;const done=()=>{if(settled)return;settled=true;window.removeEventListener('dolopaws-auth-ready',done);resolve();};window.addEventListener('dolopaws-auth-ready',done);window.setTimeout(done,10000);});
    if(!window.ORMABackoffice)throw new Error('The protected backoffice connection could not start. Sign in again and reload.');return window.ORMABackoffice;
  }
  async function required(remote,id){const result=await remote.getArtifact(id);if(!result?.ok)throw new Error(`Could not load ${id}: ${result?.error||'unknown error'}`);return result.data||{};}
  async function optional(remote,id,fallback){const result=await remote.getArtifact(id);if(!result?.ok&&result?.error!=='artifact-not-found')throw new Error(`Could not load ${id}: ${result?.error||'unknown error'}`);return result?.ok?result.data:fallback;}
  function ownerClass(owner){return owner==='You'?'is-you':owner==='Agents'?'is-agents':'is-system';}

  function renderNext(model){
    const task=model.decisions[0];const action=document.getElementById('nextHandoffAction');const owner=document.getElementById('nextOwner');
    const failure=model.automationFailures?.[0];
    if(failure){owner.textContent='Automation blocked';owner.className='bo-owner-chip is-system';set('nextHandoffTitle',`${failure.targetTrailId||failure.candidateId||'Trail'} publication did not complete`);set('nextHandoffCopy',`The release stopped at ${(failure.failureStage||'publication automation').replace(/-/g,' ')}. ${failure.failureMessage||'A durable failure receipt was saved.'}`);const retry=failure.retryMode==='manual'?' Automatic retry is paused to prevent duplicate failure runs. After correcting the external setting, use Run workflow with “Force publication retry”.':failure.retryAfter?` Automatic retry is paused until ${new Date(failure.retryAfter).toLocaleString()}.`:'';set('nextHandoffAfter',`Your approval is retained. Do not approve again; ORMA can safely retry the same release after the problem is corrected.${retry}`);const href=failure.pullRequestUrl||failure.workflowRunUrl;if(href){action.href=href;action.textContent=failure.pullRequestUrl?'Open publication PR ↗':'Inspect failed automation run ↗';action.target='_blank';action.rel='noopener';action.hidden=false;}else action.hidden=true;return;}
    if(task){owner.textContent='Your turn';owner.className='bo-owner-chip is-you';set('nextHandoffTitle',task.title);set('nextHandoffCopy',`${task.stage} · ${task.description}`);set('nextHandoffAfter',task.next);action.href=task.href;action.textContent=`${task.actionLabel} ↗`;action.target=task.external?'_blank':'_self';action.rel=task.external?'noopener':'';action.hidden=false;return;}
    if(model.handoffsInFlight){owner.textContent='Saved in Firestore';owner.className='bo-owner-chip is-system';set('nextHandoffTitle','ORMA automation owns the next step');set('nextHandoffCopy',`${model.handoffsInFlight} saved decision${model.handoffsInFlight===1?' is':'s are'} queued for the secure cloud process. Its schedule target and actual health are shown below.`);set('nextHandoffAfter','You may close this page. Do not click again; the trail will return only if another decision is required.');action.hidden=true;return;}
    if(model.activeJobs.length){owner.textContent='Agents working';owner.className='bo-owner-chip is-agents';set('nextHandoffTitle','No action required from you right now');set('nextHandoffCopy',`${model.activeJobs.length} agent job${model.activeJobs.length===1?' is':'s are'} running or queued.`);set('nextHandoffAfter','When a result needs judgment, its named trail will return to “Exact decisions waiting for you.”');action.hidden=true;return;}
    owner.textContent='System watching';owner.className='bo-owner-chip is-system';set('nextHandoffTitle','You are caught up');set('nextHandoffCopy','No Existing Trails decision is waiting and no agent job is active.');set('nextHandoffAfter','The dashboard will refresh automatically when new protected work arrives.');action.hidden=true;
  }
  function renderPipeline(model){
    const pipeline=document.getElementById('workflowPipeline');pipeline.replaceChildren();
    model.pipeline.forEach(stage=>{const item=element('li','bo-pipeline-stage');const top=element('div','bo-pipeline-top');top.append(element('span','bo-pipeline-number',stage.number),element('span',`bo-owner-chip ${ownerClass(stage.owner)}`,stage.owner));item.append(top,element('h3','',stage.title),element('p','',stage.status));pipeline.append(item);});
  }
  function renderDecisions(model){
    const queue=document.getElementById('executiveDecisionQueue');queue.replaceChildren();
    for(const task of model.decisions){const card=element('article',`bo-exec-decision is-priority is-${task.kind}`);const owner=element('span','bo-owner-chip is-you','Your turn');const body=element('div','bo-exec-decision-body');body.append(element('small','',task.stage),element('h3','',task.title),element('p','',task.description),element('p','bo-decision-next',task.next));const link=element('a','',`${task.actionLabel} ↗`);link.href=task.href;if(task.external){link.target='_blank';link.rel='noopener';}card.append(owner,body,link);queue.append(card);}
    if(!queue.children.length)queue.append(element('p','bo-decision-empty','Nothing needs your decision. Agent work will return here automatically when it is ready.'));
  }
  function activityTitle(item){
    const action=item.action||(item.decisions||[]).map(decision=>decision.action).filter(Boolean).join(', ');
    const stream={dossier:'Evidence decision',content:'Trail content decision',publication:'Release decision','new-trail':'New Trail decision',hazard:'Groundskeeper decision'}[item.stream]||'Trail decision';
    return `${stream}${action?` · ${action.replace(/-/g,' ')}`:''}`;
  }
  function renderActivity(model){
    const list=document.getElementById('dashboardActivity');list.replaceChildren();
    for(const item of model.activity){const row=element('li',`bo-activity-item is-${item.status||'processed'}`);const marker=element('span','bo-activity-marker');const body=element('div');body.append(element('small','',activityTitle(item)),element('strong','',item.title),element('p','',item.message));const state=element('span','bo-activity-state',(item.status||'processed').replace(/-/g,' '));row.append(marker,body,state);const href=item.pullRequestUrl||item.workflowRunUrl;if(href){const link=element('a','',item.pullRequestUrl?'Open PR ↗':'Inspect failed run ↗');link.href=href;link.target='_blank';link.rel='noopener';row.append(link);}list.append(row);}
    if(!list.children.length)list.append(element('li','bo-decision-empty','No submitted decision receipt is available yet.'));
  }
  function renderWorkerHealth(model){
    const health=model.workerHealth;const card=document.getElementById('workerHealth');const action=document.getElementById('workerHealthAction');
    card.className=`bo-worker-health is-${health.state}`;set('workerHealthLabel',health.label);set('workerHealthTitle',health.title);set('workerHealthCopy',health.message);
    const meta=health.state==='failed'&&health.consecutiveFailures>1?`${health.consecutiveFailures} consecutive failures · protected Firestore receipt`:'Protected Firestore heartbeat · page refreshes every 15 seconds';set('workerHealthMeta',meta);
    if(health.runUrl){action.href=health.runUrl;action.hidden=false;}else action.hidden=true;
  }
  function renderCampaignHealth(model){
    const health=model.campaignHealth;const card=document.getElementById('campaignHealth');const action=document.getElementById('campaignHealthAction');
    card.className=`bo-worker-health is-${health.state}`;set('campaignHealthLabel',health.label);set('campaignHealthTitle',health.title);set('campaignHealthCopy',health.message);set('campaignHealthMeta',health.meta);
    if(health.runUrl){action.href=health.runUrl;action.hidden=false;}else action.hidden=true;
  }
  function render(model){
    set('needsReviewCount',model.summary.needsYou);set('agentWorkCount',model.summary.agentWork);set('publicWarningCount',model.summary.blockers);set('publishedCount',model.summary.prsReady);
    set('existingCatalogueProgress',`${model.trackedTrails} trails tracked · ${model.summary.needsYou} need you · ${model.summary.agentWork} agent jobs active · ${model.summary.blockers} blocked.`);
    set('newTrailProgress',`${model.newTrailProgress.candidates} candidates · ${model.newTrailProgress.waiting} need you · ${model.newTrailProgress.inFlight} decisions in handoff.`);
    set('groundskeeperProgress',`${model.groundskeeperProgress.active} protected warnings · ${model.groundskeeperProgress.waiting} removal reviews · ${model.groundskeeperProgress.sourceFailures} source failures.`);
    renderNext(model);renderWorkerHealth(model);renderCampaignHealth(model);renderPipeline(model);renderDecisions(model);renderActivity(model);
  }
  async function load(){
    if(loading)return;loading=true;const refresh=document.getElementById('refreshDashboard');refresh.disabled=true;set('dashboardUpdated','Refreshing protected Firestore…');
    try{const remote=await api();const [orchestration,dossiers,execution,publication,publicationRequests,workerHealth,campaignHealth,newTrailScouting,newTrailStatus,newTrailReviewResult,hazards,hazardQueue,hazardStatus,hazardReviewResult,jobResult,historyResult]=await Promise.all([
      required(remote,'trail-orchestration'),required(remote,'dossier-review-queue'),required(remote,'verified-trail-editorial-execution'),required(remote,'publication-staging'),optional(remote,'publication-requests',{requests:[]}),optional(remote,'worker-health',null),optional(remote,'trail-campaign-health',null),optional(remote,'new-trail-scouting',{candidates:[],summary:{}}),optional(remote,'new-trail-scouting-status',{}),remote.getNewTrailReviews(),optional(remote,'dynamic-hazards',{hazards:[]}),optional(remote,'hazard-review-queue',{items:[]}),optional(remote,'hazard-watch-status',{}),remote.getHazardReviews(),remote.getRevisionJobs(),remote.getDecisionHistory(),
    ]);if(!jobResult?.ok)throw new Error(`Could not load agent jobs: ${jobResult?.error||'unknown error'}`);if(!historyResult?.ok)throw new Error(`Could not load decision receipts: ${historyResult?.error||'unknown error'}`);
      if(!newTrailReviewResult?.ok)throw new Error(`Could not load New Trail decisions: ${newTrailReviewResult?.error||'unknown error'}`);if(!hazardReviewResult?.ok)throw new Error(`Could not load Groundskeeper decisions: ${hazardReviewResult?.error||'unknown error'}`);
      document.getElementById('executiveDecisionQueue').classList.remove('is-error');render(window.ORMADashboardModel.buildDashboardModel({orchestration,dossiers,execution,publication,publicationRequests,workerHealth,campaignHealth,newTrailScouting,newTrailStatus,newTrailReviews:newTrailReviewResult.reviews||[],hazards,hazardQueue,hazardStatus,hazardReviews:hazardReviewResult.reviews||[],jobs:jobResult.jobs||[],history:historyResult.decisions||[]}));seconds=15;const refreshed=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});set('dashboardUpdated',`Live · refreshed ${refreshed} · next refresh in ${seconds}s`);
    }catch(error){set('dashboardUpdated','Refresh failed — your last visible state is unchanged');const queue=document.getElementById('executiveDecisionQueue');queue.classList.add('is-error');if(!queue.children.length)queue.textContent=error.message;}
    finally{loading=false;refresh.disabled=false;}
  }
  document.getElementById('refreshDashboard').addEventListener('click',load);
  window.setInterval(()=>{if(loading)return;seconds-=1;if(seconds<=0){load();return;}const node=document.getElementById('dashboardUpdated');if(node&&node.textContent.startsWith('Live ·'))node.textContent=node.textContent.replace(/next refresh in \d+s/,`next refresh in ${seconds}s`);},1000);
  load();
})();
