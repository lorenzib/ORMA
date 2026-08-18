(function(){
  'use strict';
  const PACKET_URLS=['backoffice-data/editorial-review-packet.json','backoffice-data/newsletter-review-packet.json'];
  const REVIEW_RESULT_URL='backoffice-data/content-review-last-result.json';
  const state=document.getElementById('editorialState');
  const packet=document.getElementById('editorialPacket');
  const title=document.getElementById('packetTitle');
  const summary=document.getElementById('packetSummary');
  const copyReview=document.getElementById('copyReview');
  const pictureReview=document.getElementById('pictureReview');
  const note=document.getElementById('revisionNote');
  const approveButton=document.getElementById('approveAndPublish');
  const reviseButton=document.getElementById('requestEditorialChanges');
  let execution=null;

  function element(tag,className,text){ const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; }
  async function responseBody(response){ const text=await response.text(); try{return text?JSON.parse(text):{};}catch(error){throw new Error(`Server returned ${response.status}: ${text.slice(0,120)}`);} }
  function setBusy(busy){ approveButton.disabled=busy; reviseButton.disabled=busy; }
  function renderCopy(output){
    copyReview.replaceChildren(); if(!output?.result) return;
    const card=element('article','bo-content-result is-ready-for-review');
    card.append(element('div','bo-content-result-head','Copy recommendation'),element('h4','',output.result.title),element('p','',output.result.summary));
    output.result.changes.forEach(change=>{ const diff=element('div','bo-content-diff'); diff.append(element('strong','',change.section),element('del','',change.before),element('ins','',change.after),element('small','',change.reason)); card.append(diff); });
    const links=element('div','bo-source-links'); (output.result.sources||[]).forEach(source=>{const link=element('a','',`${source.label} ↗`);link.href=source.url;link.target='_blank';link.rel='noopener';links.append(link);}); card.append(links); copyReview.append(card);
  }
  function renderPicture(output){
    pictureReview.replaceChildren(); if(!output?.result) return;
    const card=element('article','bo-content-result is-ready-for-review'); card.append(element('div','bo-content-result-head','Picture recommendation'),element('p','',output.result.searchSummary));
    const grid=element('div','bo-picture-grid'); output.result.candidates.forEach(candidate=>{const item=element('article',`bo-picture-candidate is-${candidate.status}`);if(candidate.assetUrl){const image=element('img');image.src=candidate.assetUrl;image.alt=candidate.altText;item.append(image);}item.append(element('strong','',candidate.title),element('p','',candidate.matchEvidence),element('small','',`${candidate.creator} · ${candidate.license}`));grid.append(item);}); card.append(grid); pictureReview.append(card);
  }
  async function load(){
    const [packetResponses,receiptResponse]=await Promise.all([Promise.all(PACKET_URLS.map(url=>fetch(url,{cache:'no-store'}))),fetch(REVIEW_RESULT_URL,{cache:'no-store'})]);
    const packets=[]; for(const response of packetResponses){if(response.ok) packets.push(await response.json());}
    const receipt=receiptResponse.ok?await receiptResponse.json():null; const resolvedJobs=new Set((receipt?.decisions||[]).map(decision=>decision.jobId));
    execution=packets.filter(candidate=>candidate?.summary?.readyForReview>0&&candidate.outputs.some(output=>output.status==='ready-for-review'&&!resolvedJobs.has(output.jobId)))
      .sort((a,b)=>new Date(a.generatedAt)-new Date(b.generatedAt))[0]||null;
    if(!execution){state.textContent='Nothing is waiting for review. The next eligible workstream will appear here automatically.';return;}
    const ready=execution.outputs.filter(output=>output.status==='ready-for-review'); if(!ready.length) throw new Error('The latest editorial run produced no reviewable recommendation.');
    title.textContent=`${execution.subject.type} · ${execution.subject.id}`; summary.textContent=`${execution.workstream==='newsletter'?'Newsletter':'Website'} packet · ${ready.length} linked recommendations.`;
    renderCopy(ready.find(output=>output.agentId==='copywriter')); renderPicture(ready.find(output=>output.agentId==='visualDirector'));
    packet.hidden=false; state.textContent='Review the copy and picture below. Nothing changes until you choose an action.';
  }
  approveButton.addEventListener('click',async()=>{
    if(!execution||!window.confirm('Approve this copy and picture, commit them, push to main and publish the ORMA site?')) return;
    setBusy(true); state.classList.remove('is-error'); state.textContent='Applying, testing, committing and publishing…';
    try{const response=await fetch('/api/content-reviews/approve-and-publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({generatedAt:execution.generatedAt})});const body=await responseBody(response);if(!response.ok)throw new Error(body.error);state.textContent=`Published in commit ${body.publication.commit.slice(0,7)}. GitHub Pages deployment triggered.`;packet.hidden=true;}
    catch(error){state.classList.add('is-error');state.textContent=`Could not publish: ${error.message}`;setBusy(false);}
  });
  reviseButton.addEventListener('click',async()=>{
    if(!execution) return; if(!note.value.trim()){note.focus();state.textContent='Add a short revision note first.';return;}
    setBusy(true);state.textContent='Sending the packet back for revision…';
    const decisions=execution.outputs.filter(output=>output.status==='ready-for-review').map(output=>({jobId:output.jobId,agentId:output.agentId,action:'request-revision',note:note.value.trim(),reviewedBy:'local-editor',publicMutationAllowed:false}));
    try{const response=await fetch('/api/content-reviews/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractVersion:'1.0.0',gate:'content-review',decisions,publicMutationAllowed:false})});const body=await responseBody(response);if(!response.ok)throw new Error(body.error);state.textContent='Revision requested. Nothing was changed or published.';packet.hidden=true;}
    catch(error){state.classList.add('is-error');state.textContent=`Could not request revision: ${error.message}`;setBusy(false);}
  });
  load().catch(error=>{state.classList.add('is-error');state.textContent=error.message;});
})();
