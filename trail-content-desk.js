(function(){
  'use strict';
  const URLS={queue:'backoffice-data/verified-trail-editorial-queue.json',execution:'backoffice-data/verified-trail-editorial-execution.json',staging:'backoffice-data/publication-staging.json',revisions:'backoffice-data/verified-trail-revision-queue.json'};
  const STORAGE_KEY='orma-verified-trail-content-decisions-v1';
  const state=document.getElementById('trailContentState');
  const packets=document.getElementById('trailPackets');
  const submit=document.getElementById('submitTrailReview');
  const publicationMapper=document.getElementById('publicationMapper');
  const publicationSummary=document.getElementById('publicationSummary');
  const revisionActivity=document.getElementById('revisionActivity');
  const revisionJobs=document.getElementById('revisionJobs');
  const refreshRevisions=document.getElementById('refreshRevisions');
  let decisions=loadDecisions(); let execution; let queue; let staging; let revisions;

  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function loadDecisions(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(error){return {};}}
  function saveDecisions(){localStorage.setItem(STORAGE_KEY,JSON.stringify(decisions));submit.disabled=!Object.keys(decisions).length;}
  async function getJson(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Could not load ${url} (${response.status})`);return response.json();}
  async function responseBody(response){
    const text=await response.text();
    try{return text?JSON.parse(text):{};}
    catch(error){
      if(response.status===501 || /<!doctype html/i.test(text)){
        throw new Error('The page is being served by a static server. Stop it and run npm run backoffice:review, then refresh this page. Your saved decisions will remain here.');
      }
      throw new Error(`Server returned ${response.status}: ${text.slice(0,160)}`);
    }
  }
  function link(label,url){const node=element('a','',`${label} ↗`);node.href=url;node.target='_blank';node.rel='noopener';return node;}
  function decisionLabel(decision){return decision?`${decision.action.replace(/-/g,' ')} saved${decision.note?` · “${decision.note}”`:''}`:'No decision saved yet.';}
  function revisionFor(output){return (revisions?.jobs||[]).filter(job=>job.jobId===output.jobId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0]||null;}
  function revisionStateText(){
    const jobs=revisions?.jobs||[];const queued=jobs.filter(job=>job.status==='queued').length;const running=jobs.filter(job=>job.status==='running').length;const ready=jobs.filter(job=>job.status==='ready-for-review').length;const blocked=jobs.filter(job=>job.status==='blocked').length;
    if(running)return `${running} trail revision ${running===1?'is':'are'} being processed. This page refreshes automatically.`;
    if(queued)return `${queued} trail revision ${queued===1?'is':'are'} queued for the agent runner. This page refreshes automatically.`;
    if(ready)return `${ready} revised trail proposal${ready===1?' is':'s are'} ready for your evaluation.`;
    if(blocked)return `${blocked} trail revision ${blocked===1?'is':'are'} blocked and needs attention.`;
    return 'Review each trail output independently. Saved choices stay in this browser until submitted.';
  }
  function renderRevisionActivity(){
    const jobs=(revisions?.jobs||[]).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));revisionActivity.hidden=!jobs.length;revisionJobs.replaceChildren();
    jobs.forEach(job=>{const item=element('li',`bo-revision-job is-${job.status}`);const trail=queue.items.find(candidate=>candidate.candidateId===job.candidateId);const head=element('div','bo-revision-job-head');head.append(element('strong','',`${trail?.trailName||job.candidateId} · ${job.agentId} · attempt ${job.attempt}`),element('span','bo-content-status',job.status.replace(/-/g,' ')));item.append(head,element('p','',`“${job.instruction}”`),element('small','',`Requested ${new Date(job.createdAt).toLocaleString()}${job.completedAt?` · completed ${new Date(job.completedAt).toLocaleString()}`:''}`));if(job.resolution)item.append(element('p','',job.resolution));if(job.status==='ready-for-review'){const open=element('a','bo-source-link','Evaluate revision ↓');open.href=`#trail-${job.candidateId}`;item.append(open);}revisionJobs.append(item);});
  }
  function revisionPanel(output){
    const revision=revisionFor(output);if(!revision)return null;
    const panel=element('aside',`bo-revision-status is-${revision.status}`);
    panel.append(element('strong','',revision.status==='ready-for-review'?`Revision attempt ${revision.attempt} ready for evaluation`:`Revision attempt ${revision.attempt} ${revision.status.replace(/-/g,' ')}`),element('p','',`Your instruction: “${revision.instruction}”`));
    if(output.revision?.resolution)panel.append(element('p','',`Agent response: ${output.revision.resolution}`));
    if(revision.status==='ready-for-review')panel.append(element('small','',`Completed ${new Date(revision.completedAt).toLocaleString()}. Review the highlighted before/after and choose Approve or Request revision below.`));
    return panel;
  }

  function reviewControls(output){
    const wrap=element('div','bo-content-review-actions');
    const note=element('textarea');note.placeholder=output.agentId==='visualDirector'?'Describe the required image, evidence, licence or attribution change…':'Describe exactly what the Copywriter should change…';note.value=decisions[output.jobId]?.note||'';
    const actions=element('div','bo-actions');
    [['approve','Approve'],['request-revision','Request revision'],['reject','Reject'],['clear','Clear']].forEach(([action,label])=>{
      const button=element('button',decisions[output.jobId]?.action===action?'is-selected':'',label);button.type='button';button.dataset.action=action;
      button.addEventListener('click',()=>{
        if(action==='request-revision'&&!note.value.trim()){note.focus();state.textContent='Add a precise revision instruction before requesting revision.';return;}
        decisions=window.ORMAContentReviewDecisions.applyDecision(decisions,{jobId:output.jobId,agentId:output.agentId,action,note:note.value,reviewedBy:'local-editor'});
        saveDecisions();renderPackets();state.textContent=action==='clear'?'Decision cleared.':'Decision saved locally. Submit the trail review when you are ready.';
      });actions.append(button);
    });
    wrap.append(note,actions,element('p','bo-decision',decisionLabel(decisions[output.jobId])));return wrap;
  }

  function copyOutput(output){
    const card=element('article','bo-content-result is-ready-for-review');card.append(element('div','bo-content-result-head','Copywriter proposal'),element('h4','',output.result.title),element('p','',output.result.summary));const revision=revisionPanel(output);if(revision)card.append(revision);
    (output.result.changes||[]).forEach(change=>{const diff=element('div','bo-content-diff');diff.append(element('strong','',change.section));if(change.before&&change.before!=='No verified editorial draft.')diff.append(element('del','',change.before));diff.append(element('ins','',change.after),element('small','',change.reason));card.append(diff);});
    const sources=element('div','bo-source-links');(output.result.sources||[]).forEach(source=>sources.append(link(source.label,source.url)));card.append(sources,reviewControls(output));return card;
  }
  function visualOutput(output){
    const card=element('article','bo-content-result is-ready-for-review');card.append(element('div','bo-content-result-head','Visual Director proposal'),element('p','',output.result.searchSummary));
    const grid=element('div','bo-picture-grid');(output.result.candidates||[]).forEach(candidate=>{const item=element('article',`bo-picture-candidate is-${candidate.status}`);if(candidate.assetUrl){const image=element('img');image.src=candidate.assetUrl;image.alt=candidate.altText||'';item.append(image);}item.append(element('strong','',candidate.title),element('p','',candidate.matchEvidence),element('small','',`${candidate.creator} · ${candidate.license}`),link('Source and licence',candidate.sourcePageUrl));grid.append(item);});card.append(grid);
    (output.result.coverageGaps||[]).forEach(gap=>card.append(element('p','bo-empty',gap)));card.append(reviewControls(output));return card;
  }
  function renderPackets(){
    packets.replaceChildren();
    queue.items.forEach(item=>{const card=element('article','bo-trail-packet');card.id=`trail-${item.candidateId}`;const head=element('div','bo-content-head');const intro=element('div');intro.append(element('p','eyebrow','ORMA Verified trail'),element('h2','',item.trailName),link('Open locked evidence dossier',item.dossierRef));head.append(intro,element('span','bo-content-status','Trail only'));card.append(head);
      const outputs=execution.outputs.filter(output=>output.candidateId===item.candidateId&&output.status==='ready-for-review');const grid=element('div','bo-trail-output-grid');outputs.forEach(output=>grid.append(output.agentId==='visualDirector'?visualOutput(output):copyOutput(output)));card.append(grid);packets.append(card);});
    submit.disabled=!Object.keys(decisions).length;renderRevisionActivity();
  }
  function fieldsList(fields){const list=element('dl','bo-publication-fields');Object.entries(fields||{}).forEach(([key,value])=>{list.append(element('dt','',key),element('dd','',typeof value==='object'?JSON.stringify(value,null,2):String(value)));});return list;}
  function renderStaging(next){
    staging=next;publicationSummary.replaceChildren();[['Trails',staging.summary.trails],['Ready for preview',staging.summary.readyForPreview],['Waiting for approvals',staging.summary.waitingForApprovals],['Public mutations',staging.summary.publicMutations]].forEach(([label,value])=>publicationSummary.append(element('span','',`${label}: ${value}`)));
    publicationMapper.replaceChildren();staging.items.forEach(item=>{const source=queue.items.find(candidate=>candidate.candidateId===item.candidateId);const card=element('article',`bo-publication-card is-${item.state}`);card.append(element('h3','',source?.trailName||item.targetTrailId),element('p','bo-content-status',item.state.replace(/-/g,' ')));
      if(item.state!=='ready-for-publication-preview'){card.append(element('p','bo-empty',`Still required: ${item.missingApprovals.join(', ')}. Review both proposals above and submit those decisions first.`));}
      else{card.append(element('p','',`${item.operation.replace(/-/g,' ')} · website trail ${item.targetTrailId}`),fieldsList(item.proposedWebsiteFields));const note=element('textarea');note.placeholder='Optional publication note…';const actions=element('div','bo-actions');[['approve-for-pr-creation','Approve for PR creation'],['request-changes','Request changes'],['hold','Hold']].forEach(([action,label])=>{const button=element('button','',label);button.type='button';button.addEventListener('click',()=>submitPublication(item,action,note.value,card));actions.append(button);});card.append(note,actions);}
      publicationMapper.append(card);});
  }
  async function submitPublication(item,action,note,card){
    const buttons=card.querySelectorAll('button');buttons.forEach(button=>button.disabled=true);state.textContent='Recording publication decision…';
    try{const response=await fetch('/api/publication-reviews/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId:item.candidateId,action,note})});const body=await responseBody(response);if(!response.ok)throw new Error(body.error||`Server returned ${response.status}`);state.textContent=`${body.message} Trail: ${item.targetTrailId}.`;}
    catch(error){state.classList.add('is-error');state.textContent=`Could not record publication decision: ${error.message}`;buttons.forEach(button=>button.disabled=false);}
  }
  submit.addEventListener('click',async()=>{
    const payload=window.ORMAContentReviewDecisions.exportRecord(decisions);submit.disabled=true;state.classList.remove('is-error');state.textContent='Submitting trail-only decisions…';
    try{const response=await fetch('/api/content-reviews/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await responseBody(response);if(!response.ok)throw new Error(body.error||`Server returned ${response.status}`);const queued=body.revisionJobs?.length||0;if(queued)revisions.jobs=[...(revisions.jobs||[]),...body.revisionJobs];decisions={};saveDecisions();renderPackets();if(body.publicationStaging)renderStaging(body.publicationStaging);state.textContent=`Trail review recorded. ${queued?`${queued} trail-agent revision job${queued===1?'':'s'} queued. `:''}Nothing was published.`;}
    catch(error){state.classList.add('is-error');state.textContent=`Could not submit trail review: ${error.message}`;submit.disabled=false;}
  });
  async function refreshRevisionState(){
    refreshRevisions.disabled=true;
    try{[execution,staging,revisions]=await Promise.all([getJson(URLS.execution),getJson(URLS.staging),getJson(URLS.revisions)]);renderPackets();renderStaging(staging);state.classList.remove('is-error');state.textContent=revisionStateText();}
    catch(error){state.classList.add('is-error');state.textContent=`Could not refresh revision status: ${error.message}`;}
    finally{refreshRevisions.disabled=false;}
  }
  refreshRevisions.addEventListener('click',refreshRevisionState);
  Promise.all([getJson(URLS.queue),getJson(URLS.execution),getJson(URLS.staging),getJson(URLS.revisions)]).then(values=>{[queue,execution,staging,revisions]=values;renderPackets();renderStaging(staging);state.textContent=revisionStateText();window.setInterval(refreshRevisionState,10000);}).catch(error=>{state.classList.add('is-error');state.textContent=error.message;});
})();
