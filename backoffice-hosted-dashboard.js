(function(){
  'use strict';
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  const plural=(count,singular,pluralForm=`${singular}s`)=>`${count} ${count===1?singular:pluralForm}`;

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

  function decision(count,title,copy,href,label){
    const card=document.createElement('article');card.className='bo-exec-decision is-priority';
    const number=document.createElement('span');number.className='bo-decision-count';number.textContent=String(count);
    const body=document.createElement('div');const heading=document.createElement('h3');heading.textContent=title;
    const paragraph=document.createElement('p');paragraph.textContent=copy;body.append(heading,paragraph);
    const link=document.createElement('a');link.href=href;link.textContent=label;card.append(number,body,link);return card;
  }

  async function required(remote,id){
    const result=await remote.getArtifact(id);
    if(!result?.ok)throw new Error(`Could not load ${id}: ${result?.error||'unknown error'}`);
    return result.data||{};
  }

  async function load(){
    const remote=await api();
    const [orchestration,dossiers,execution,publication,jobResult]=await Promise.all([
      required(remote,'trail-orchestration'),required(remote,'dossier-review-queue'),
      required(remote,'verified-trail-editorial-execution'),required(remote,'publication-staging'),
      remote.getRevisionJobs(),
    ]);
    if(!jobResult?.ok)throw new Error(`Could not load agent jobs: ${jobResult?.error||'unknown error'}`);
    const jobs=(jobResult.jobs||[]).filter(job=>job.jobType==='trail-verification-specialist'||job.jobType==='verified-trail-editorial-revision'||String(job.id||'').startsWith('trail-revision-'));
    const dossierItems=(dossiers.items||[]).filter(item=>item.state==='awaiting-human');
    const dossierBlocked=dossierItems.filter(item=>item.approvalAllowed===false).length;
    const contentCandidates=new Set((execution.outputs||[]).filter(output=>output.status==='ready-for-review').map(output=>output.candidateId||output.subjectId||output.jobId));
    const releaseItems=(publication.items||[]).filter(item=>item.state==='ready-for-publication-preview');
    const activeJobs=jobs.filter(job=>['queued','running','in-progress','processing'].includes(job.status));
    const jobBlockers=jobs.filter(job=>job.status==='blocked').length;
    const trailBlockers=(orchestration.trails||[]).filter(trail=>(trail.blockers||[]).length||/blocked|source-exhausted/.test(`${trail.state||''} ${trail.stage||''}`)).length;
    const blockers=dossierBlocked+jobBlockers+trailBlockers;
    const humanDecisions=dossierItems.length+contentCandidates.size+releaseItems.length;

    set('needsReviewCount',humanDecisions);set('agentWorkCount',activeJobs.length);set('publicWarningCount',blockers);set('publishedCount',releaseItems.length);
    const refreshed=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    set('dashboardUpdated',`Protected Firestore · refreshed ${refreshed}`);
    set('existingCatalogueProgress',`${plural(orchestration.summary?.trails||(orchestration.trails||[]).length,'trail')} tracked · ${plural(dossierItems.length,'evidence gate')} · ${plural(activeJobs.length,'agent job')} active · ${plural(blockers,'blocker')}.`);
    set('verifyProgress',dossierItems.length?`${plural(dossierItems.length,'dossier')} waiting for you; ${plural(activeJobs.length,'agent job')} active.`:'No evidence dossier is waiting for you.');
    set('produceProgress',contentCandidates.size?`${plural(contentCandidates.size,'trail packet')} ready for content review.`:'No verified trail content packet is waiting.');
    set('releaseProgress',releaseItems.length?`${plural(releaseItems.length,'release preview')} waiting at human gate 2.`:'No release preview is waiting.');

    const queue=document.getElementById('executiveDecisionQueue');queue.replaceChildren();
    if(dossierItems.length)queue.append(decision(dossierItems.length,'Existing Trail evidence',dossierBlocked?`${plural(dossierBlocked,'dossier')} locked by evidence findings; revise or reject before advancing.`:'Resolve the evidence gates before trails advance.','trail-dossier-desk.html','Review evidence ↗'));
    if(contentCandidates.size)queue.append(decision(contentCandidates.size,'Verified trail content','Review staged copy and media created from locked trail evidence.','trail-content-desk.html','Review trail content ↗'));
    if(releaseItems.length)queue.append(decision(releaseItems.length,'Trail releases ready','Review the final website mapping before permitting PR preparation.','trail-content-desk.html#publicationGate','Review release ↗'));
    if(!queue.children.length){const empty=document.createElement('p');empty.className='bo-decision-empty';empty.textContent='No trail decision needs you right now. The live fleet continues its current jobs automatically.';queue.append(empty);}
  }

  function fail(error){
    set('dashboardUpdated','Protected trail progress could not be refreshed');
    const queue=document.getElementById('executiveDecisionQueue');queue.textContent=error.message;queue.classList.add('is-error');
  }
  load().catch(fail);
  window.setInterval(()=>load().catch(fail),15000);
})();
