(function(){
  'use strict';

  const URLS={
    orchestration:'backoffice-data/trail-orchestration.json',
    campaign:'backoffice-data/catalogue-campaign.json',
    dossiers:'backoffice-data/dossier-review-queue.json',
    jobs:'backoffice-data/trail-specialist-job-queue.json',
    trailExecution:'backoffice-data/verified-trail-editorial-execution.json',
    publication:'backoffice-data/publication-staging.json',
    ledger:'backoffice-data/editorial-ledger.json',
    reviewQueue:'backoffice-data/content-review-queue.json',
    lastReview:'backoffice-data/content-review-last-result.json',
    newsletter:'backoffice-data/newsletter-review-packet.json',
    newsletterReview:'backoffice-data/newsletter-review.json',
    ideas:'backoffice-data/product-ideas.json',
    ideasReview:'backoffice-data/product-ideas-review.json',
    images:'backoffice-data/image-coverage.json',
    imageReview:'backoffice-data/image-coverage-review.json',
    hazards:'data/dynamic-hazards.json',
    hazardStatus:'backoffice-data/hazard-watch-status.json',
    scouting:'backoffice-data/new-trail-scouting.json',
    scoutingReview:'backoffice-data/new-trail-scouting-review.json',
    packets:[
      'backoffice-data/editorial-review-packet.json',
      'backoffice-data/editorial-review-packet-1.json',
      'backoffice-data/editorial-review-packet-2.json',
      'backoffice-data/editorial-review-packet-3.json',
    ],
  };
  const LOCAL_MODE=['localhost','127.0.0.1'].includes(location.hostname);

  async function json(url,fallback){
    try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json():fallback;}
    catch(error){return fallback;}
  }
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  const plural=(count,singular,pluralForm=`${singular}s`)=>`${count} ${count===1?singular:pluralForm}`;
  const ready=(packet,resolved)=>((packet?.outputs)||[]).filter(output=>output.status==='ready-for-review'&&!resolved.has(output.jobId));

  async function waitForRemote(){
    if(LOCAL_MODE)return null;if(window.ORMABackoffice)return window.ORMABackoffice;
    await new Promise(resolve=>{let settled=false;const done=()=>{if(settled)return;settled=true;window.removeEventListener('dolopaws-auth-ready',done);resolve();};window.addEventListener('dolopaws-auth-ready',done);if(window.ORMABackoffice)done();else window.setTimeout(done,10000);});
    return window.ORMABackoffice||null;
  }

  async function hydrateLiveFleet(data){
    const remote=await waitForRemote();if(!remote)return {live:false,reason:'sign-in-required'};
    const [orchestration,dossiers,jobs,trailExecution,publication,reviewQueue]=await Promise.all([
      remote.getArtifact('trail-orchestration'),remote.getArtifact('dossier-review-queue'),remote.getRevisionJobs(),
      remote.getArtifact('verified-trail-editorial-execution'),remote.getArtifact('publication-staging'),remote.getArtifact('content-review-queue'),
    ]);
    const artifacts={orchestration,dossiers,trailExecution,publication,reviewQueue};let loaded=0;let reason=null;
    Object.entries(artifacts).forEach(([key,result])=>{if(result?.ok){data[key]=result.data;loaded+=1;}else if(!reason)reason=result?.error||'live-read-failed';});
    if(jobs?.ok){data.jobs={jobs:jobs.jobs.filter(job=>['trail-verification-specialist','verified-trail-editorial-revision'].includes(job.jobType)||String(job.id||'').startsWith('trail-revision-'))};loaded+=1;}
    else if(!reason)reason=jobs?.error||'job-read-failed';
    return {live:loaded>0,loaded,reason};
  }

  function decision(count,title,copy,href,label,priority=false){
    const card=document.createElement('article');card.className=`bo-exec-decision${priority?' is-priority':''}`;
    const number=document.createElement('span');number.className='bo-decision-count';number.textContent=String(count);
    const body=document.createElement('div');const heading=document.createElement('h3');heading.textContent=title;
    const paragraph=document.createElement('p');paragraph.textContent=copy;body.append(heading,paragraph);
    const link=document.createElement('a');link.href=href;link.textContent=label;card.append(number,body,link);return card;
  }

  async function load(){
    const keys=['orchestration','campaign','dossiers','jobs','trailExecution','publication','ledger','reviewQueue','lastReview','newsletter','newsletterReview','ideas','ideasReview','images','imageReview','hazards','hazardStatus','scouting','scoutingReview'];
    const values=await Promise.all([...keys.map(key=>json(URLS[key],{})),...URLS.packets.map(url=>json(url,null))]);
    const data=Object.fromEntries(keys.map((key,index)=>[key,values[index]]));const packets=values.slice(keys.length).filter(Boolean);
    const liveState=await hydrateLiveFleet(data);
    const completed=[...(data.reviewQueue.submissions||[]),data.lastReview].filter(item=>item&&['published','processed'].includes(item.status));
    const resolved=new Set(completed.flatMap(item=>(item.decisions||[]).map(item=>item.jobId)));
    const publishedById=new Map((data.ledger.items||[]).filter(item=>item.status==='published').map(item=>[item.contentId,item]));
    const websiteWaiting=packets.filter(packet=>{const item=publishedById.get(`${packet.subject?.type}-${packet.subject?.id}`);return !(item&&new Date(item.lastPublishedAt||0)>=new Date(packet.generatedAt||0))&&ready(packet,resolved).length;});
    const trailReady=ready(data.trailExecution,resolved);const trailContentWaiting=new Set(trailReady.map(output=>output.candidateId||output.subjectId||output.jobId)).size;
    const publicationReady=(data.publication.items||[]).filter(item=>item.state==='ready-for-publication-preview').length;
    const dossierItems=(data.dossiers.items||[]).filter(item=>item.state==='awaiting-human');const dossierWaiting=dossierItems.length;const dossierBlocked=dossierItems.filter(item=>item.approvalAllowed===false).length;
    const productDone=new Set((data.ideasReview.decisions||[]).map(item=>item.ideaId));const ideaWaiting=(data.ideas.ideas||[]).filter(item=>!productDone.has(item.id)).length;
    const imageDone=new Set((data.imageReview.decisions||[]).map(item=>item.slug));const imageWaiting=(data.images.gaps||[]).filter(item=>!imageDone.has(item.slug)).length;
    const scoutingDone=new Set((data.scoutingReview.decisions||[]).map(item=>item.candidateId));const scoutingWaiting=(data.scouting.candidates||[]).filter(item=>!scoutingDone.has(item.id)).length;
    const hazardRemoval=(data.hazards.hazards||[]).filter(item=>item.state==='resolution-review').length;const activeHazards=(data.hazards.hazards||[]).filter(item=>item.state==='active').length;
    const newsletterDecided=(data.newsletterReview.decisions||[]).some(item=>item.generatedAt===data.newsletter.generatedAt);const newsletterReady=ready(data.newsletter,resolved).length>0&&!newsletterDecided;
    const specialistJobs=data.jobs.jobs||[];const researchJobs=[...(data.ideasReview.jobs||[]),...(data.imageReview.jobs||[])];
    const runningJobs=[...specialistJobs,...researchJobs].filter(item=>['queued','running','in-progress','processing'].includes(item.status)).length;
    const blockedJobs=specialistJobs.filter(item=>item.status==='blocked').length+(data.orchestration.trails||[]).filter(trail=>(trail.blockers||[]).length||/blocked|source-exhausted/.test(`${trail.state} ${trail.stage}`)).length;
    const sourceFailures=data.hazardStatus.summary?.sourceFailures||0;const cutoff=Date.now()-7*86400000;
    const published=(data.ledger.items||[]).filter(item=>item.status==='published'&&new Date(item.lastPublishedAt||0).getTime()>=cutoff).length;
    const reviewCount=websiteWaiting.length+trailContentWaiting+publicationReady+dossierWaiting+ideaWaiting+imageWaiting+hazardRemoval+scoutingWaiting+(newsletterReady?1:0);

    set('needsReviewCount',reviewCount);set('agentWorkCount',runningJobs);set('publicWarningCount',activeHazards+hazardRemoval);set('publishedCount',published);
    const refreshed=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});set('dashboardUpdated',liveState.live?`Live Firestore · refreshed ${refreshed}`:LOCAL_MODE?`Local review state · refreshed ${refreshed}`:`Saved snapshot · sign in as moderator for live trail progress · refreshed ${refreshed}`);
    const queue=document.getElementById('executiveDecisionQueue');queue.replaceChildren();
    if(hazardRemoval)queue.append(decision(hazardRemoval,'Hazard removal checks','A source warning expired. Confirm whether its public notice can be removed.','hazard-review-desk.html','Review warnings ↗',true));
    if(dossierWaiting)queue.append(decision(dossierWaiting,'Existing Trail evidence',dossierBlocked?`${plural(dossierBlocked,'dossier')} locked by evidence findings; revise or reject before trails advance.`:'Resolve the human evidence gates before trails advance.','trail-dossier-desk.html','Review evidence ↗',true));
    if(publicationReady)queue.append(decision(publicationReady,'Trail releases ready','Review the final website mapping for internally verified trail packages.','trail-content-desk.html','Review trail release ↗',true));
    if(trailContentWaiting)queue.append(decision(trailContentWaiting,'Verified trail content','Review staged copy and media created from locked trail evidence.','trail-content-desk.html','Review trail content ↗'));
    if(scoutingWaiting)queue.append(decision(scoutingWaiting,'New Trail candidates','Choose which nearby loops deserve full verification.','new-trail-scouting-desk.html','Review candidates ↗'));
    if(websiteWaiting.length)queue.append(decision(websiteWaiting.length,'Editorial copy','Compare current and proposed copy, edit if needed, then approve and publish.','content-desk.html','Review copy ↗',true));
    if(imageWaiting)queue.append(decision(imageWaiting,'Editorial image gaps','Route each gap to owned photography, licensed sourcing, approved AI or park it.','image-coverage-desk.html','Review images ↗'));
    if(newsletterReady)queue.append(decision(1,'Newsletter issue','Review one assembled issue built only from approved inputs.','newsletter-desk.html','Review issue ↗'));
    if(ideaWaiting)queue.append(decision(ideaWaiting,'Analyst opportunities','Choose which sourced signals deserve deeper work.','product-ideas-desk.html','Review analysis ↗'));
    if(!queue.children.length){const empty=document.createElement('p');empty.className='bo-decision-empty';empty.textContent='Nothing needs your approval right now. The teams continue their scheduled work.';queue.append(empty);}

    const batch=(data.campaign.selectedTrailIds||[]).length;const remaining=data.campaign.summary?.remainingQueueable||0;
    set('existingCatalogueProgress',`${plural(batch,'trail')} in the current batch · ${plural(remaining,'trail')} queueable · ${plural(blockedJobs+dossierBlocked,'blocker')} · ${plural(activeHazards,'active area warning')}.`);
    set('newScoutingProgress',`${plural(scoutingWaiting,'candidate')} awaiting selection · ${(data.scoutingReview.intake||[]).length} sent to verification.`);
    set('editorialRefinementProgress',`${plural(websiteWaiting.length,'copy review')}, ${plural(imageWaiting,'image decision')}, ${plural(trailContentWaiting,'verified trail packet')} and ${plural(publicationReady,'release preview')} waiting.`);
    set('newsletterProgress',newsletterReady?'One complete issue is ready for review.':'No issue waiting · next run remains fortnightly.');
    set('analystProgress',`${plural(ideaWaiting,'opportunity','opportunities')} awaiting direction · ${(data.ideasReview.jobs||[]).length} deeper investigations recorded.`);
    set('discoverProgress',`${plural(scoutingWaiting,'candidate')} awaiting selection; ${(data.scoutingReview.intake||[]).length} already entered verification.`);
    set('verifyProgress',`${plural(runningJobs,'agent task')} queued or running · ${plural(dossierWaiting,'dossier')} waiting · ${plural(blockedJobs+dossierBlocked,'blocker')} · ${plural(sourceFailures,'hazard-source failure')}.`);
    set('produceProgress',`${plural(websiteWaiting.length,'copy packet')}, ${plural(imageWaiting,'image gap')} and ${plural(publicationReady,'trail release')} awaiting Editorial review.`);
    set('newsletterLifecycleProgress',newsletterReady?'One issue is ready for CEO review.':'Waiting for the next fortnightly assembly.');
  }

  load().catch(error=>{set('dashboardUpdated','Progress could not be refreshed');document.getElementById('executiveDecisionQueue').textContent=error.message;});
})();
