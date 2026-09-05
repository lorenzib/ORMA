(function(){
  'use strict';

  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  const REFRESH_SECONDS=900;
  let loading=false;
  let seconds=REFRESH_SECONDS;
  let lastLoadedAt=null;

  function element(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }

  async function api(){
    if(window.ORMABackoffice)return window.ORMABackoffice;
    await new Promise(resolve=>{
      let settled=false;
      const done=()=>{if(settled)return;settled=true;window.removeEventListener('dolopaws-auth-ready',done);resolve();};
      window.addEventListener('dolopaws-auth-ready',done);
      window.setTimeout(done,10000);
    });
    if(!window.ORMABackoffice)throw new Error('The protected backoffice connection could not start. Sign in again and reload.');
    return window.ORMABackoffice;
  }

  async function required(remote,id){
    const result=await remote.getArtifact(id);
    if(!result?.ok)throw new Error(`Could not load ${id}: ${result?.error||'unknown error'}`);
    return result.data||{};
  }

  async function optional(remote,id,fallback){
    const result=await remote.getArtifact(id);
    if(!result?.ok&&result?.error!=='artifact-not-found')throw new Error(`Could not load ${id}: ${result?.error||'unknown error'}`);
    return result?.ok?result.data:fallback;
  }

  function renderDecisions(model,community){
    const queue=document.getElementById('executiveDecisionQueue');
    queue.replaceChildren();
    if(community.items.length){
      const count=community.items.length;
      const types=new Set(community.items.map(item=>item.type));
      const card=element('article','bo-exec-decision is-priority is-community');
      const owner=element('span','bo-owner-chip is-you','Your turn');
      const body=element('div','bo-exec-decision-body');
      body.append(element('small','','Community gate'),element('h3','',`${count} user submission${count===1?'':'s'} need review`),
        element('p','',`Check ${Array.from(types).map(type=>({flag:'hazards',photo:'photos',review:'reviews',placeDog:'place reports'}[type]||type)).join(', ')} before anything changes on the public site.`));
      const link=element('a','',`Review community queue ↗`);link.href='community-moderation-desk.html';
      card.append(owner,body,link);queue.append(card);
    }
    for(const task of model.decisions){
      const card=element('article',`bo-exec-decision is-priority is-${task.kind}`);
      const owner=element('span','bo-owner-chip is-you','Your turn');
      const body=element('div','bo-exec-decision-body');
      body.append(element('small','',task.stage),element('h3','',task.title),element('p','',task.description));
      const link=element('a','',`${task.actionLabel} ↗`);
      link.href=task.href;
      if(task.external){link.target='_blank';link.rel='noopener';}
      card.append(owner,body,link);
      queue.append(card);
    }
    if(!queue.children.length)queue.append(element('p','bo-decision-empty','Nothing needs your decision. ORMA will return work here when it is ready.'));
  }

  function activityTitle(item){
    const action=item.action||(item.decisions||[]).map(decision=>decision.action).filter(Boolean).join(', ');
    const stream={dossier:'Evidence',content:'Trail content',publication:'Release','image-publication':'Trail photo','new-trail':'New Trail',hazard:'Hazard',image:'Trail photo'}[item.stream]||'Workflow';
    return `${stream}${action?` · ${action.replace(/-/g,' ')}`:''}`;
  }

  function renderActivity(model){
    const list=document.getElementById('dashboardActivity');
    list.replaceChildren();
    for(const item of model.activity.slice(0,5)){
      const row=element('li',`bo-activity-item is-${item.status||'processed'}`);
      const marker=element('span','bo-activity-marker');
      const body=element('div');
      body.append(element('small','',activityTitle(item)),element('strong','',item.title),element('p','',item.message));
      const state=element('span','bo-activity-state',(item.status||'processed').replace(/-/g,' '));
      row.append(marker,body,state);
      const published=item.status==='published';
      const href=published?(item.publicUrl||item.deploymentRunUrl||item.pullRequestUrl):(item.pullRequestUrl||item.workflowRunUrl);
      if(href){
        const link=element('a','',published&&item.publicUrl?'Open live trail ↗':item.pullRequestUrl?'Open PR ↗':'Inspect run ↗');
        link.href=href;link.target='_blank';link.rel='noopener';row.append(link);
      }
      list.append(row);
    }
    if(!list.children.length)list.append(element('li','bo-decision-empty','No recent decision receipt is available.'));
  }

  function renderHealth(id,health,meta){
    const card=document.getElementById(id);
    const action=document.getElementById(`${id}Action`);
    card.className=`bo-health-item is-${health.state}`;
    set(`${id}Label`,health.label);
    set(`${id}Title`,health.title);
    set(`${id}Copy`,health.message);
    set(`${id}Meta`,meta);
    if(health.runUrl){action.href=health.runUrl;action.hidden=false;}else action.hidden=true;
  }

  function render(model,community){
    set('needsReviewCount',model.summary.needsYou+community.items.length);
    set('agentWorkCount',model.summary.agentWork);
    set('publicWarningCount',model.summary.blockers);
    set('publishedCount',model.summary.prsReady);
    set('existingCatalogueProgress',`${model.trackedTrails} tracked · ${model.summary.agentWork} jobs active · ${model.summary.blockers} blocked`);
    set('newTrailProgress',`${model.newTrailProgress.candidates} candidates · ${model.newTrailProgress.waiting} need you`);
    set('photoProgress',`${model.editorialProgress.imageGaps} priority reviews active`);
    set('groundskeeperProgress',`${model.groundskeeperProgress.active} warnings · ${model.groundskeeperProgress.waiting} need review`);
    set('communityProgress',community.items.length?`${community.items.length} submissions need you`:'Queue clear');
    const workerMeta=model.workerHealth.state==='blocked'
      ?'Agent queues remain active · publication waits for green CI'
      :model.workerHealth.state==='failed'&&model.workerHealth.consecutiveFailures>1
      ?`${model.workerHealth.consecutiveFailures} consecutive failures`
      :'Protected heartbeat';
    renderHealth('workerHealth',model.workerHealth,workerMeta);
    renderHealth('campaignHealth',model.campaignHealth,model.campaignHealth.meta);
    renderDecisions(model,community);
    renderActivity(model);
  }

  async function load(){
    if(loading)return;
    loading=true;
    const refresh=document.getElementById('refreshDashboard');
    refresh.disabled=true;
    set('dashboardUpdated','Refreshing protected Firestore…');
    try{
      const remote=await api();
      const [orchestration,dossiers,execution,publication,publicationRequests,workerHealth,campaignHealth,newTrailScouting,newTrailStatus,newTrailReviewResult,hazards,hazardQueue,hazardStatus,hazardReviewResult,imageAudit,imageResults,imagePublicationRequests,imageStatus,imageReviewResult,jobResult,historyResult,communityResult]=await Promise.all([
        required(remote,'trail-orchestration'),
        required(remote,'dossier-review-queue'),
        required(remote,'verified-trail-editorial-execution'),
        required(remote,'publication-staging'),
        optional(remote,'publication-requests',{requests:[]}),
        optional(remote,'worker-health',null),
        optional(remote,'trail-campaign-health',null),
        optional(remote,'new-trail-scouting',{candidates:[],summary:{}}),
        optional(remote,'new-trail-scouting-status',{}),
        remote.getNewTrailReviews(),
        optional(remote,'dynamic-hazards',{hazards:[]}),
        optional(remote,'hazard-review-queue',{items:[]}),
        optional(remote,'hazard-watch-status',{}),
        remote.getHazardReviews(),
        optional(remote,'image-coverage',{gaps:[],summary:{}}),
        optional(remote,'image-coverage-results',{items:[]}),
        optional(remote,'trail-image-publication-requests',{requests:[]}),
        optional(remote,'trail-image-coverage-status',{}),
        remote.getImageReviews(),
        remote.getRevisionJobs(),
        remote.getDecisionHistory(),
        remote.getModerationQueue(),
      ]);
      if(!jobResult?.ok)throw new Error(`Could not load agent jobs: ${jobResult?.error||'unknown error'}`);
      if(!historyResult?.ok)throw new Error(`Could not load decision receipts: ${historyResult?.error||'unknown error'}`);
      if(!newTrailReviewResult?.ok)throw new Error(`Could not load New Trail decisions: ${newTrailReviewResult?.error||'unknown error'}`);
      if(!hazardReviewResult?.ok)throw new Error(`Could not load hazard decisions: ${hazardReviewResult?.error||'unknown error'}`);
      if(!imageReviewResult?.ok)throw new Error(`Could not load image decisions: ${imageReviewResult?.error||'unknown error'}`);
      if(!communityResult?.ok)throw new Error(`Could not load community moderation: ${communityResult?.error||'unknown error'}`);

      const strategyStatus={summary:{editorialStatus:'parked for MVP',newsletterStatus:'parked for MVP',productStatus:'parked for MVP'}};
      const model=window.ORMADashboardModel.buildDashboardModel({orchestration,dossiers,execution,publication,publicationRequests,workerHealth,campaignHealth,newTrailScouting,newTrailStatus,newTrailReviews:newTrailReviewResult.reviews||[],hazards,hazardQueue,hazardStatus,hazardReviews:hazardReviewResult.reviews||[],strategyStatus,imageAudit,imageResults,imagePublicationRequests,imageStatus,imageReviews:imageReviewResult.reviews||[],jobs:jobResult.jobs||[],history:historyResult.decisions||[]});
      document.getElementById('executiveDecisionQueue').classList.remove('is-error');
      render(model,communityResult);
      seconds=REFRESH_SECONDS;
      lastLoadedAt=Date.now();
      const refreshed=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      set('dashboardUpdated',`Live · ${refreshed} · refresh in ${seconds}s`);
    }catch(error){
      set('dashboardUpdated','Refresh failed — last visible state is unchanged');
      const queue=document.getElementById('executiveDecisionQueue');
      queue.classList.add('is-error');
      if(queue.querySelector('.bo-dashboard-loading'))queue.replaceChildren(element('p','bo-decision-empty',error.message));
    }finally{
      loading=false;
      refresh.disabled=false;
    }
  }

  document.getElementById('refreshDashboard').addEventListener('click',load);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden||loading)return;
    // Refocusing is not new information. Only re-read when the visible state is
    // already older than one refresh interval.
    const age=lastLoadedAt?Date.now()-lastLoadedAt:Infinity;
    if(age<REFRESH_SECONDS*1000){
      seconds=Math.max(1,REFRESH_SECONDS-Math.round(age/1000));
      return;
    }
    seconds=REFRESH_SECONDS;
    load();
  });
  window.setInterval(()=>{
    if(loading||document.hidden)return;
    seconds-=1;
    if(seconds<=0){load();return;}
    const node=document.getElementById('dashboardUpdated');
    if(node&&node.textContent.startsWith('Live ·'))node.textContent=node.textContent.replace(/refresh in \d+s/,`refresh in ${seconds}s`);
  },1000);
  load();
})();
