(function(){
  'use strict';

  const URLS={
    orchestration:'backoffice-data/trail-orchestration.json',
    catalogueCampaign:'backoffice-data/catalogue-campaign.json',
    dossiers:'backoffice-data/dossier-review-queue.json',
    specialistJobs:'backoffice-data/trail-specialist-job-queue.json',
    trailExecution:'backoffice-data/verified-trail-editorial-execution.json',
    publication:'backoffice-data/publication-staging.json',
    ledger:'backoffice-data/editorial-ledger.json',
    reviewQueue:'backoffice-data/content-review-queue.json',
    lastReview:'backoffice-data/content-review-last-result.json',
    newsletter:'backoffice-data/newsletter-review-packet.json',
    websitePackets:[
      'backoffice-data/editorial-review-packet.json',
      'backoffice-data/editorial-review-packet-1.json',
      'backoffice-data/editorial-review-packet-2.json',
      'backoffice-data/editorial-review-packet-3.json',
    ],
  };

  async function loadJson(url,fallback){
    try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json():fallback;}
    catch(error){return fallback;}
  }

  function setText(id,value){const node=document.getElementById(id);if(node)node.textContent=value;}
  function plural(count,singular,pluralForm=`${singular}s`){return `${count} ${count===1?singular:pluralForm}`;}
  function reviewableOutputs(packet,resolvedJobs){
    return (packet?.outputs||[]).filter(output=>output.status==='ready-for-review'&&!resolvedJobs.has(output.jobId));
  }
  function setStatus(id,label,state){
    const node=document.getElementById(id);if(!node)return;
    node.textContent=label;node.className=`bo-life-status${state?` is-${state}`:''}`;
  }
  function decision(count,title,description,href,label,priority=false){
    const article=document.createElement('article');article.className=`bo-exec-decision${priority?' is-priority':''}`;
    const number=document.createElement('span');number.className='bo-decision-count';number.textContent=String(count);
    const copy=document.createElement('div');const heading=document.createElement('h3');heading.textContent=title;
    const paragraph=document.createElement('p');paragraph.textContent=description;copy.append(heading,paragraph);
    const link=document.createElement('a');link.href=href;link.textContent=label;
    article.append(number,copy,link);return article;
  }

  async function loadDashboard(){
    const [orchestration,catalogueCampaign,dossiers,specialistJobs,trailExecution,publication,ledger,reviewQueue,lastReview,newsletter,...websitePackets]=await Promise.all([
      loadJson(URLS.orchestration,{trails:[]}),loadJson(URLS.catalogueCampaign,{summary:{},selectedTrailIds:[]}),loadJson(URLS.dossiers,{items:[]}),loadJson(URLS.specialistJobs,{jobs:[]}),
      loadJson(URLS.trailExecution,{outputs:[]}),loadJson(URLS.publication,{items:[]}),loadJson(URLS.ledger,{items:[]}),
      loadJson(URLS.reviewQueue,{submissions:[]}),loadJson(URLS.lastReview,null),loadJson(URLS.newsletter,null),
      ...URLS.websitePackets.map(url=>loadJson(url,null)),
    ]);

    const completed=[...(reviewQueue.submissions||[]),lastReview].filter(item=>item&&['published','processed'].includes(item.status));
    const resolvedJobs=new Set(completed.flatMap(item=>(item.decisions||[]).map(item=>item.jobId)));
    const publishedItems=new Map((ledger.items||[]).filter(item=>item.status==='published').map(item=>[item.contentId,item]));
    const resolvedByLedger=packet=>{const item=publishedItems.get(`${packet?.subject?.type}-${packet?.subject?.id}`);return item&&new Date(item.lastPublishedAt||0)>=new Date(packet.generatedAt||0);};
    const websiteWaiting=websitePackets.filter(packet=>!resolvedByLedger(packet)&&reviewableOutputs(packet,resolvedJobs).length>0);
    const newsletterReady=reviewableOutputs(newsletter,resolvedJobs).length>0;
    const trailReadyJobs=reviewableOutputs(trailExecution,resolvedJobs);
    const trailContentWaiting=new Set(trailReadyJobs.map(output=>output.candidateId||output.subjectId||output.jobId.split('-copy')[0].split('-visual')[0])).size;
    const dossierWaiting=(dossiers.items||[]).filter(item=>item.state!=='processed'&&item.approvalAllowed!==false).length;
    const agentWork=(specialistJobs.jobs||[]).filter(job=>['queued','running','in-progress','processing'].includes(job.status)).length;
    const blockedJobs=(specialistJobs.jobs||[]).filter(job=>job.status==='blocked').length;
    const blockedTrails=(orchestration.trails||[]).filter(trail=>(trail.blockers||[]).length||/blocked|source-exhausted/.test(`${trail.state} ${trail.stage}`)).length;
    const publicationReady=(publication.items||[]).filter(item=>item.state==='ready-for-publication-preview').length;
    const sevenDaysAgo=Date.now()-7*24*60*60*1000;
    const recentlyPublished=(ledger.items||[]).filter(item=>item.status==='published'&&new Date(item.lastPublishedAt||0).getTime()>=sevenDaysAgo).length;
    const totalReview=websiteWaiting.length+(newsletterReady?1:0)+trailContentWaiting+dossierWaiting+publicationReady;

    setText('needsReviewCount',totalReview);
    setText('agentWorkCount',agentWork);
    setText('readyToPublishCount',publicationReady);
    setText('publishedCount',recentlyPublished);
    setText('dashboardUpdated',`Live data · refreshed ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`);

    const queue=document.getElementById('executiveDecisionQueue');queue.replaceChildren();
    if(websiteWaiting.length)queue.append(decision(websiteWaiting.length,'Website copy ready','Compare current and proposed copy, edit if needed, then approve to commit and deploy.','content-desk.html','Review and publish ↗',true));
    if(publicationReady)queue.append(decision(publicationReady,'Trail releases ready','Review the final website field mapping for internally verified trail packages.','trail-content-desk.html','Review trail release ↗',true));
    if(dossierWaiting)queue.append(decision(dossierWaiting,'Trail evidence dossiers ready','Resolve the human evidence gates before these trails can advance to content.','trail-dossier-desk.html','Review evidence ↗'));
    if(trailContentWaiting)queue.append(decision(trailContentWaiting,'Verified trail content ready','Review staged copy and media created from locked trail evidence.','trail-content-desk.html','Review trail content ↗'));
    if(newsletterReady)queue.append(decision(1,'Newsletter draft ready','Review the issue assembled from newly published trails and editorial updates.','content-desk.html','Review newsletter ↗'));
    if(!queue.children.length){const empty=document.createElement('p');empty.className='bo-decision-empty';empty.textContent='Nothing needs your approval right now. Automated work continues in the lifecycle below.';queue.append(empty);}

    const existingBatch=(catalogueCampaign.selectedTrailIds||[]).length;
    const existingRemaining=catalogueCampaign.summary?.remainingQueueable||0;
    setText('existingCatalogueProgress',`${plural(existingBatch,'trail')} in the current batch · ${plural(existingRemaining,'trail')} still queueable.`);
    setText('newScoutingProgress','Not activated · no net-new candidates have been queued.');
    setText('editorialRefinementProgress',`${plural(websiteWaiting.length,'review')} waiting · safety guides, collections, articles and library.`);
    setText('discoverProgress',`${plural(existingBatch,'existing trail')} in verification now · new trail scouting is not yet active.`);
    setText('verifyProgress',`${plural(agentWork,'specialist task')} queued or running · ${plural(dossierWaiting,'dossier')} waiting · ${plural(blockedJobs+blockedTrails,'blocker')}.`);
    setStatus('verifyStatus',dossierWaiting?'Review needed':blockedJobs+blockedTrails?'Blocked':'In progress',dossierWaiting?'review':blockedJobs+blockedTrails?'blocked':'running');
    setText('produceProgress',`${plural(trailContentWaiting,'trail content packet')} waiting · ${plural(websiteWaiting.length,'editorial refinement review')} waiting.`);
    setText('publishProgress',`${plural(publicationReady,'trail package')} at publication preview · ${plural(recentlyPublished,'editorial update')} published in the last 7 days.`);
    setStatus('publishStatus',publicationReady||websiteWaiting.length?'Review needed':'Up to date',publicationReady||websiteWaiting.length?'review':'running');
    setText('distributeProgress',newsletterReady?'1 newsletter draft is ready for review. Social media remains inactive.':'Newsletter runs every other Thursday at 09:00. Social media remains inactive.');
    setStatus('distributeStatus',newsletterReady?'Review needed':'Scheduled',newsletterReady?'review':'scheduled');
    document.getElementById('newsletterReviewLink').hidden=!newsletterReady;
  }

  loadDashboard().catch(error=>{
    setText('dashboardUpdated','Progress data could not be refreshed');
    const queue=document.getElementById('executiveDecisionQueue');queue.textContent=`Could not load the executive dashboard: ${error.message}`;
  });
})();
