(function(){
  'use strict';
  const PACKET_URLS=[
    'backoffice-data/editorial-review-packet-1.json',
    'backoffice-data/editorial-review-packet-2.json',
    'backoffice-data/editorial-review-packet-3.json',
  ];
  const REVIEW_RESULT_URL='backoffice-data/content-review-last-result.json';
  const REVIEW_QUEUE_URL='backoffice-data/content-review-queue.json';
  const EDITORIAL_LEDGER_URL='backoffice-data/editorial-ledger.json';
  const state=document.getElementById('editorialState');
  const packet=document.getElementById('editorialPacket');
  const title=document.getElementById('packetTitle');
  const summary=document.getElementById('packetSummary');
  const copyReview=document.getElementById('copyReview');
  const pictureReview=document.getElementById('pictureReview');
  const note=document.getElementById('revisionNote');
  const approveButton=document.getElementById('approveAndPublish');
  const reviseButton=document.getElementById('requestEditorialChanges');
  const currentPreview=document.getElementById('currentPagePreview');
  const proposedPreview=document.getElementById('proposedPagePreview');
  let execution=null;
  let sourceHtml='';
  const editedCopy=new Map();

  function element(tag,className,text){ const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; }
  async function responseBody(response){ const text=await response.text(); try{return text?JSON.parse(text):{};}catch(error){throw new Error(`Server returned ${response.status}: ${text.slice(0,120)}`);} }
  function setBusy(busy){ approveButton.disabled=busy; reviseButton.disabled=busy; }
  function textFromHtml(value){const template=document.createElement('template');template.innerHTML=value;const root=template.content.firstElementChild;if(root?.tagName==='META')return root.getAttribute('content')||'';return template.content.textContent.trim();}
  function htmlWithText(original,text){const template=document.createElement('template');template.innerHTML=original.trim();const root=template.content.firstElementChild;if(root&&template.content.childElementCount===1){if(root.tagName==='META')root.setAttribute('content',text);else root.textContent=text;return root.outerHTML;}return text;}
  function proposedHtml(){
    let proposed=sourceHtml;
    execution.outputs.filter(output=>output.status==='ready-for-review').forEach(output=>{
      if(output.agentId==='copywriter') (output.result?.changes||[]).forEach((change,index)=>{const after=editedCopy.get(`${output.jobId}:${index}`)??change.after;proposed=proposed.replace(change.before,after);});
      if(output.agentId==='visualDirector') (output.result?.candidates||[]).filter(candidate=>candidate.status==='ready'&&candidate.placement).forEach(candidate=>{proposed=proposed.replace(candidate.placement.before,candidate.placement.after);});
    });
    const base=`<base href="${new URL(execution.subject.sourceRef,location.href).href}">`; return proposed.replace(/<head(\s[^>]*)?>/i,match=>`${match}${base}`);
  }
  function refreshProposedPreview(){proposedPreview.srcdoc=proposedHtml();}
  function renderCopy(output){
    copyReview.replaceChildren(); if(!output?.result) return;
    const card=element('article','bo-content-result is-ready-for-review');
    card.append(element('div','bo-content-result-head','Copy recommendation'),element('h4','',output.result.title),element('p','',output.result.summary));
    output.result.changes.forEach((change,index)=>{ const editor=element('div','bo-copy-editor');const label=element('label','',change.section);const textarea=element('textarea');textarea.value=textFromHtml(change.after);textarea.setAttribute('aria-label',`Edit proposed ${change.section}`);textarea.addEventListener('input',()=>{editedCopy.set(`${output.jobId}:${index}`,htmlWithText(change.after,textarea.value));refreshProposedPreview();});editor.append(label,element('small','',`Current: ${textFromHtml(change.before)}`),textarea,element('small','',change.reason));card.append(editor); });
    const links=element('div','bo-source-links'); (output.result.sources||[]).forEach(source=>{const link=element('a','',`${source.label} ↗`);link.href=source.url;link.target='_blank';link.rel='noopener';links.append(link);}); card.append(links); copyReview.append(card);
  }
  function renderPicture(output){
    pictureReview.replaceChildren(); pictureReview.hidden=!output?.result; if(!output?.result) return;
    const card=element('article','bo-content-result is-ready-for-review'); card.append(element('div','bo-content-result-head','Picture recommendation'),element('p','',output.result.searchSummary));
    const grid=element('div','bo-picture-grid'); output.result.candidates.forEach(candidate=>{const item=element('article',`bo-picture-candidate is-${candidate.status}`);if(candidate.assetUrl){const image=element('img');image.src=candidate.assetUrl;image.alt=candidate.altText;item.append(image);}item.append(element('strong','',candidate.title),element('p','',candidate.matchEvidence),element('small','',`${candidate.creator} · ${candidate.license}`));grid.append(item);}); card.append(grid); pictureReview.append(card);
  }
  async function load(){
    const [packetResponses,receiptResponse,queueResponse,ledgerResponse]=await Promise.all([Promise.all(PACKET_URLS.map(url=>fetch(url,{cache:'no-store'}))),fetch(REVIEW_RESULT_URL,{cache:'no-store'}),fetch(REVIEW_QUEUE_URL,{cache:'no-store'}),fetch(EDITORIAL_LEDGER_URL,{cache:'no-store'})]);
    const packets=[]; for(const response of packetResponses){if(response.ok) packets.push(await response.json());}
    const receipt=receiptResponse.ok?await receiptResponse.json():null;
    const queue=queueResponse.ok?await queueResponse.json():{submissions:[]};
    const ledger=ledgerResponse.ok?await ledgerResponse.json():{items:[]};
    const completed=[...(queue.submissions||[]),receipt].filter(item=>item&&['published','processed'].includes(item.status));
    const resolvedJobs=new Set(completed.flatMap(item=>(item.decisions||[]).map(decision=>decision.jobId)));
    const publishedItems=new Map((ledger.items||[]).filter(item=>item.status==='published').map(item=>[item.contentId,item]));
    const resolvedByLedger=candidate=>{const item=publishedItems.get(`${candidate?.subject?.type}-${candidate?.subject?.id}`);return item&&new Date(item.lastPublishedAt||0)>=new Date(candidate.generatedAt||0);};
    const waiting=packets.filter(candidate=>candidate?.summary?.readyForReview>0&&!resolvedByLedger(candidate)&&candidate.outputs.some(output=>output.status==='ready-for-review'&&!resolvedJobs.has(output.jobId)))
      .sort((a,b)=>new Date(a.generatedAt)-new Date(b.generatedAt));
    execution=waiting[0]||null;
    if(!execution){state.textContent=receipt?.status==='published'&&receipt.publication?.commit?`Published in commit ${receipt.publication.commit.slice(0,7)}. GitHub Pages deployment triggered.`:'Nothing is waiting for review. The next eligible workstream will appear here automatically.';return;}
    const ready=execution.outputs.filter(output=>output.status==='ready-for-review'); if(!ready.length) throw new Error('The latest editorial run produced no reviewable recommendation.');
    title.textContent=`${execution.subject.type} · ${execution.subject.id}`; summary.textContent=`Review 1 of ${waiting.length} waiting · Editorial copy only.`;
    const sourceResponse=await fetch(execution.subject.sourceRef,{cache:'no-store'});if(!sourceResponse.ok)throw new Error('The current source page could not be loaded.');sourceHtml=await sourceResponse.text();currentPreview.src=execution.subject.sourceRef;refreshProposedPreview();
    renderCopy(ready.find(output=>output.agentId==='copywriter')); renderPicture(ready.find(output=>output.agentId==='visualDirector'));
    packet.hidden=false; state.textContent=`${waiting.length} copy review${waiting.length===1?' is':'s are'} waiting. Nothing changes until you approve.`;
  }
  approveButton.addEventListener('click',async()=>{
    if(!execution||!window.confirm('Approve this copy, commit it, push to main and publish the ORMA site?')) return;
    setBusy(true); state.classList.remove('is-error'); state.textContent='Applying, testing, committing and publishing…';
    const edits=execution.outputs.filter(output=>output.agentId==='copywriter'&&output.status==='ready-for-review').map(output=>({jobId:output.jobId,afterByIndex:(output.result?.changes||[]).map((change,index)=>editedCopy.get(`${output.jobId}:${index}`)??change.after)}));
    try{const response=await fetch('/api/content-reviews/approve-and-publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({generatedAt:execution.generatedAt,edits})});const body=await responseBody(response);if(!response.ok)throw new Error(body.error);state.textContent=`Published in commit ${body.publication.commit.slice(0,7)}. Loading the next review…`;packet.hidden=true;setTimeout(()=>window.location.reload(),1600);}
    catch(error){state.classList.add('is-error');state.textContent=`Could not publish: ${error.message}`;setBusy(false);}
  });
  reviseButton.addEventListener('click',async()=>{
    if(!execution) return; if(!note.value.trim()){note.focus();state.textContent='Add a short revision note first.';return;}
    setBusy(true);state.classList.remove('is-error');state.textContent='Preparing the revised recommendation now… This normally takes a few minutes.';
    try{const response=await fetch('/api/content-reviews/revise-now',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({generatedAt:execution.generatedAt,note:note.value.trim()})});const body=await responseBody(response);if(!response.ok)throw new Error(body.error);state.textContent='Revision ready. Loading the new comparison…';packet.hidden=true;window.location.reload();}
    catch(error){state.classList.add('is-error');state.textContent=`Could not request revision: ${error.message}`;setBusy(false);}
  });
  load().catch(error=>{state.classList.add('is-error');state.textContent=error.message;});
})();
