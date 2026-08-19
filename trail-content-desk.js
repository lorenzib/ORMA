(function(){
  'use strict';
  const URLS={queue:'backoffice-data/verified-trail-editorial-queue.json',execution:'backoffice-data/verified-trail-editorial-execution.json',staging:'backoffice-data/publication-staging.json',revisions:'backoffice-data/verified-trail-revision-queue.json',publicationReviews:'backoffice-data/publication-review-queue.json'};
  const STORAGE_KEY='orma-verified-trail-content-decisions-v1';
  const LOCAL_MODE=['localhost','127.0.0.1'].includes(location.hostname);
  const state=document.getElementById('trailContentState');
  const packets=document.getElementById('trailPackets');
  const submit=document.getElementById('submitTrailReview');
  const publicationMapper=document.getElementById('publicationMapper');
  const publicationSummary=document.getElementById('publicationSummary');
  const revisionActivity=document.getElementById('revisionActivity');
  const revisionJobs=document.getElementById('revisionJobs');
  const refreshRevisions=document.getElementById('refreshRevisions');
  let decisions=loadDecisions(); let execution; let queue; let staging; let revisions; let publicationRequests={requests:[]}; let publicationReviews=[]; let contentReviews=[];

  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function loadDecisions(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(error){return {};}}
  function saveDecisions(){localStorage.setItem(STORAGE_KEY,JSON.stringify(decisions));submit.disabled=!Object.keys(decisions).length;}
  async function getJson(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Could not load ${url} (${response.status})`);return response.json();}
  function dateValue(value){if(!value)return null;if(typeof value.toDate==='function')return value.toDate();if(value.seconds)return new Date(value.seconds*1000);return new Date(value);}
  async function waitForRemoteBackoffice(){
    if(window.ORMABackoffice)return window.ORMABackoffice;
    await new Promise(resolve=>{window.addEventListener('dolopaws-auth-ready',resolve,{once:true});window.setTimeout(resolve,10000);});
    if(!window.ORMABackoffice)throw new Error('The authenticated ORMA backoffice could not start. Reload and sign in with a moderator account.');
    return window.ORMABackoffice;
  }
  async function loadArtifact(id,url){if(LOCAL_MODE)return getJson(url);const api=await waitForRemoteBackoffice();const result=await api.getArtifact(id);if(!result.ok)throw new Error(`Could not load ${id}: ${result.error}`);return result.data;}
  async function loadRevisionJobs(){if(LOCAL_MODE)return getJson(URLS.revisions);const api=await waitForRemoteBackoffice();const result=await api.getRevisionJobs();if(!result.ok)throw new Error(`Could not load revision jobs: ${result.error}`);return {contractVersion:'1.0.0',jobs:result.jobs};}
  async function loadPublicationRequests(){
    if(LOCAL_MODE)return {requests:[]};
    const api=await waitForRemoteBackoffice();const result=await api.getArtifact('publication-requests');
    if(!result.ok&&result.error!=='artifact-not-found')throw new Error(`Could not load publication requests: ${result.error}`);
    return result.ok?result.data:{requests:[]};
  }
  async function loadPublicationReviews(){
    if(LOCAL_MODE){const queue=await getJson(URLS.publicationReviews);return (queue.decisions||[]).map((review,index)=>({id:`local-${index}`,...review,submittedAt:review.reviewedAt}));}
    const api=await waitForRemoteBackoffice();const result=await api.getPublicationReviews();
    if(!result.ok)throw new Error(`Could not load publication reviews: ${result.error}`);return result.reviews||[];
  }
  async function loadContentReviews(){
    if(LOCAL_MODE)return [];
    const api=await waitForRemoteBackoffice();const result=await api.getContentReviews();
    if(!result.ok)throw new Error(`Could not load content review receipts: ${result.error}`);return result.reviews||[];
  }
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
  function revisionFor(output){return window.ORMAContentReceiptModel.latestRevision(output,revisions?.jobs||[]);}
  function revisionStateText(){
    const jobs=revisions?.jobs||[];const queued=jobs.filter(job=>job.status==='queued').length;const running=jobs.filter(job=>job.status==='running').length;const ready=jobs.filter(job=>job.status==='ready-for-review').length;const blocked=jobs.filter(job=>job.status==='blocked').length;
    if(running)return `${running} trail revision ${running===1?'is':'are'} being processed. This page refreshes automatically.`;
    if(queued)return `${queued} trail revision ${queued===1?'is':'are'} queued for the agent runner. This page refreshes automatically.`;
    if(ready)return `${ready} revised trail proposal${ready===1?' is':'s are'} ready for your evaluation.`;
    if(blocked)return `${blocked} trail revision ${blocked===1?'is':'are'} blocked and needs attention.`;
    const publishable=staging?.summary?.readyForPreview||0;
    if(publishable)return `Step 1 is complete. ${publishable} trail${publishable===1?' is':'s are'} ready at Human gate 2 below. Review the website fields, then choose Approve for PR creation.`;
    return 'Review each trail output independently. Saved choices stay in this browser until submitted.';
  }
  function renderRevisionActivity(){
    const jobs=(revisions?.jobs||[]).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));revisionActivity.hidden=!jobs.length;revisionJobs.replaceChildren();
    jobs.forEach(job=>{const item=element('li',`bo-revision-job is-${job.status}`);const trail=queue.items.find(candidate=>candidate.candidateId===job.candidateId);const head=element('div','bo-revision-job-head');head.append(element('strong','',`${trail?.trailName||job.candidateId} · ${job.agentId} · attempt ${job.attempt}`),element('span','bo-content-status',job.status.replace(/-/g,' ')));item.append(head,element('p','',`“${job.instruction}”`),element('small','',`Requested ${dateValue(job.createdAt).toLocaleString()}${job.completedAt?` · completed ${dateValue(job.completedAt).toLocaleString()}`:''}`));if(job.resolution)item.append(element('p','',job.resolution));if(job.status==='ready-for-review'){const open=element('a','bo-source-link','Evaluate revision ↓');open.href=`#trail-${job.candidateId}`;item.append(open);}revisionJobs.append(item);});
  }
  function revisionPanel(output){
    const revision=revisionFor(output);if(!revision)return null;
    const panel=element('aside',`bo-revision-status is-${revision.status}`);
    panel.append(element('strong','',revision.status==='ready-for-review'?`Revision attempt ${revision.attempt} ready for evaluation`:`Revision attempt ${revision.attempt} ${revision.status.replace(/-/g,' ')}`),element('p','',`Your instruction: “${revision.instruction}”`));
    if(output.revision?.resolution)panel.append(element('p','',`Agent response: ${output.revision.resolution}`));
    if(revision.status==='ready-for-review')panel.append(element('small','',`Completed ${dateValue(revision.completedAt).toLocaleString()}. Review the highlighted before/after and choose Approve or Request revision below.`));
    return panel;
  }

  function reviewControls(output){
    const wrap=element('div','bo-content-review-actions');const receipt=window.ORMAContentReceiptModel.latestReceipt(output,contentReviews,revisions?.jobs||[]);const advanced=!window.ORMAContentReceiptModel.stillNeedsApproval(output,staging);const locked=Boolean(receipt||advanced);
    const note=element('textarea');note.placeholder=output.agentId==='visualDirector'?'Describe the required image, evidence, licence or attribution change…':'Describe exactly what the Copywriter should change…';note.value=decisions[output.jobId]?.note||receipt?.decision.note||'';note.disabled=locked;
    const actions=element('div','bo-actions');
    [['approve','Approve'],['request-revision','Request revision'],['reject','Reject'],['clear','Clear']].forEach(([action,label])=>{
      const selected=decisions[output.jobId]?.action===action||receipt?.decision.action===action;const button=element('button',selected?'is-selected':'',label);button.type='button';button.dataset.action=action;button.disabled=locked;
      button.addEventListener('click',()=>{
        if(action==='request-revision'&&!note.value.trim()){note.focus();state.textContent='Add a precise revision instruction before requesting revision.';return;}
        decisions=window.ORMAContentReviewDecisions.applyDecision(decisions,{jobId:output.jobId,agentId:output.agentId,action,note:note.value,reviewedBy:'local-editor'});
        saveDecisions();renderPackets();state.textContent=action==='clear'?'Decision cleared.':'Decision saved locally. Submit the trail review when you are ready.';
      });actions.append(button);
    });
    const status=element('p',`bo-decision${locked?' is-queued':''}`,locked?window.ORMAContentReceiptModel.receiptText(output,receipt,staging,revisions?.jobs||[]):decisionLabel(decisions[output.jobId]));wrap.append(note,actions,status);return wrap;
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
  function publicationRecordFor(item){
    const candidates=[
      ...(publicationReviews||[]).filter(review=>review.candidateId===item.candidateId).map(review=>({kind:'review',record:review,at:dateValue(review.submittedAt)?.getTime()||0})),
      ...(publicationRequests?.requests||[]).filter(request=>request.candidateId===item.candidateId).map(request=>({kind:'request',record:request,at:dateValue(request.acknowledgedAt||request.reviewedAt)?.getTime()||0})),
    ];
    return candidates.sort((a,b)=>b.at-a.at||String(b.record.id||'').localeCompare(String(a.record.id||'')))[0]||null;
  }
  function publicationReceipt(record){
    const wrap=element('div','bo-publication-receipt');const status=record.record.status||'queued';
    if(record.kind==='request'&&status==='pull-request-opened'){
      wrap.append(element('strong','','Publication PR ready for final review'),element('p','','ORMA automation processed this approval, validated the generated site and opened the final website diff.'));
      if(record.record.pullRequestUrl)wrap.append(link('Open publication pull request',record.record.pullRequestUrl));
      return wrap;
    }
    if(record.kind==='request'&&status==='publication-failed'){
      wrap.append(element('strong','','Publication automation needs attention'),element('p','',`Your approval is retained. ORMA stopped during ${String(record.record.failureStage||'publication').replace(/-/g,' ')} and can retry this same request after the failure is corrected.`));
      if(record.record.failureMessage)wrap.append(element('p','',record.record.failureMessage));
      if(record.record.workflowRunUrl)wrap.append(link('Open failed automation run',record.record.workflowRunUrl));
      return wrap;
    }
    const labels={queued:'Saved · awaiting ORMA automation',processed:'Decision processed',superseded:'Earlier duplicate safely superseded','approved-for-pr-creation':'Approval processed — preparing the PR','request-changes':'Changes requested',hold:'Publication held',blocked:'Decision blocked'};
    wrap.append(element('strong','',labels[status]||status.replace(/-/g,' ')));
    const when=dateValue(record.record.acknowledgedAt||record.record.reviewedAt||record.record.submittedAt);
    wrap.append(element('p','',`${record.record.action?`${record.record.action.replace(/-/g,' ')} · `:''}${when&&!Number.isNaN(when.getTime())?when.toLocaleString():'Recorded in the live queue'}.`));
    return wrap;
  }
  function mappingDetails(fields){const details=element('details','bo-publication-mapping');const count=Object.keys(fields||{}).length;details.append(element('summary','',`Inspect complete website mapping (${count} fields)`),fieldsList(fields));return details;}
  function renderStaging(next){
    staging=next;publicationSummary.replaceChildren();[['Trails',staging.summary.trails],['Ready for preview',staging.summary.readyForPreview],['Waiting for approvals',staging.summary.waitingForApprovals],['Public mutations',staging.summary.publicMutations]].forEach(([label,value])=>publicationSummary.append(element('span','',`${label}: ${value}`)));
    publicationMapper.replaceChildren();staging.items.forEach(item=>{const source=queue.items.find(candidate=>candidate.candidateId===item.candidateId);const card=element('article',`bo-publication-card is-${item.state}`);card.id=`publication-${item.candidateId}`;card.append(element('h3','',source?.trailName||item.targetTrailId),element('p','bo-content-status',item.state.replace(/-/g,' ')));
      if(item.state!=='ready-for-publication-preview'){card.append(element('p','bo-empty',`Still required: ${item.missingApprovals.join(', ')}. Review both proposals above and submit those decisions first.`));}
      else{const current=publicationRecordFor(item);card.append(element('p','',`${item.operation.replace(/-/g,' ')} · website trail ${item.targetTrailId}`));if(current)card.append(publicationReceipt(current));const note=element('textarea');note.placeholder='Optional publication note…';const actions=element('div','bo-actions');const locked=current&&['queued','processed','approved-for-pr-creation','publication-failed','pull-request-opened'].includes(current.record.status);const decisionState=element('p','bo-decision',current?'The recorded decision remains visible here after every refresh.':'No publication decision recorded yet.');[['approve-for-pr-creation','Approve for PR creation'],['request-changes','Request changes'],['hold','Hold']].forEach(([action,label])=>{const button=element('button','',label);button.type='button';button.disabled=Boolean(locked);button.addEventListener('click',()=>submitPublication(item,action,note.value,card,decisionState));actions.append(button);});note.disabled=Boolean(locked);card.append(note,actions,decisionState,mappingDetails(item.proposedWebsiteFields));}
      publicationMapper.append(card);});
  }
  async function submitPublication(item,action,note,card,decisionState){
    const buttons=card.querySelectorAll('button');buttons.forEach(button=>button.disabled=true);state.textContent='Recording publication decision…';
    try{let body;if(LOCAL_MODE){const response=await fetch('/api/publication-reviews/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId:item.candidateId,action,note})});body=await responseBody(response);if(!response.ok)throw new Error(body.error||`Server returned ${response.status}`);}else{body=await (await waitForRemoteBackoffice()).submitPublicationReview({candidateId:item.candidateId,action,note});if(!body.ok)throw new Error(body.error);}publicationReviews=[{id:body.reviewId||`local-${Date.now()}`,candidateId:item.candidateId,action,note,status:'queued',submittedAt:new Date().toISOString()},...(publicationReviews||[])];renderStaging(staging);state.classList.remove('is-error');state.textContent=LOCAL_MODE?`${body.message} Trail: ${item.targetTrailId}.`:`Approval saved in Firestore. ORMA automation will collect trail ${item.targetTrailId} within five minutes, validate the website change and place the resulting PR on Backoffice Home. You may close this page.`;}
    catch(error){state.classList.add('is-error');state.textContent=`Could not record publication decision: ${error.message}`;buttons.forEach(button=>button.disabled=false);}
  }
  submit.addEventListener('click',async()=>{
    const payload=window.ORMAContentReviewDecisions.exportRecord(decisions);submit.disabled=true;state.classList.remove('is-error');state.textContent='Submitting trail-only decisions…';
    try{let body;if(LOCAL_MODE){const response=await fetch('/api/content-reviews/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});body=await responseBody(response);if(!response.ok)throw new Error(body.error||`Server returned ${response.status}`);}else{body=await (await waitForRemoteBackoffice()).submitTrailReview(payload);if(!body.ok)throw new Error(body.error);}const queued=body.revisionJobs?.length||0;if(queued)revisions.jobs=[...(revisions.jobs||[]),...body.revisionJobs];if(!LOCAL_MODE)contentReviews=[{id:body.reviewId,status:'queued',submittedAt:new Date().toISOString(),decisions:payload.decisions},...contentReviews];decisions={};saveDecisions();renderPackets();if(body.publicationStaging)renderStaging(body.publicationStaging);const ready=body.publicationStaging?.summary?.readyForPreview||0;state.textContent=ready?`Step 1 recorded. ${ready} trail${ready===1?' is':'s are'} now ready at Human gate 2. Review the website fields and choose Approve for PR creation.`:(LOCAL_MODE?`Trail review recorded. ${queued?`${queued} trail-agent revision job${queued===1?'':'s'} queued. `:''}Nothing was published.`:`Trail review ${body.reviewId} is safely saved in Firestore. Its buttons are locked. ORMA automation will collect it within five minutes, and the next result will appear on Backoffice Home. You may close this page.`);if(ready)document.getElementById('publicationGate').scrollIntoView({behavior:'smooth',block:'start'});}
    catch(error){state.classList.add('is-error');state.textContent=`Could not submit trail review: ${error.message}`;submit.disabled=false;}
  });
  async function refreshRevisionState(){
    refreshRevisions.disabled=true;
    try{[execution,staging,revisions,publicationRequests,publicationReviews,contentReviews]=await Promise.all([loadArtifact('verified-trail-editorial-execution',URLS.execution),loadArtifact('publication-staging',URLS.staging),loadRevisionJobs(),loadPublicationRequests(),loadPublicationReviews(),loadContentReviews()]);renderPackets();renderStaging(staging);state.classList.remove('is-error');state.textContent=revisionStateText();}
    catch(error){state.classList.add('is-error');state.textContent=`Could not refresh revision status: ${error.message}`;}
    finally{refreshRevisions.disabled=false;}
  }
  refreshRevisions.addEventListener('click',refreshRevisionState);
  Promise.all([loadArtifact('verified-trail-editorial-queue',URLS.queue),loadArtifact('verified-trail-editorial-execution',URLS.execution),loadArtifact('publication-staging',URLS.staging),loadRevisionJobs(),loadPublicationRequests(),loadPublicationReviews(),loadContentReviews()]).then(values=>{[queue,execution,staging,revisions,publicationRequests,publicationReviews,contentReviews]=values;renderPackets();renderStaging(staging);state.textContent=revisionStateText();window.setInterval(refreshRevisionState,10000);}).catch(error=>{state.classList.add('is-error');state.textContent=error.message;});
})();
