(function(){
  'use strict';
  const state=document.getElementById('newsletterState');const inputs=document.getElementById('newsletterInputs');const draft=document.getElementById('newsletterDraft');
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  async function loadJson(url,fallback){try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json():fallback;}catch(error){return fallback;}}
  function renderMetrics(sourceInputs,ready){
    inputs.replaceChildren();
    [['New trail signals',(sourceInputs.newlyPublishedTrails||[]).length],['Published guide changes',(sourceInputs.publishedEditorialChanges||[]).length],['Timely signals',(sourceInputs.timelySafetySignals||[]).length+(sourceInputs.currentEditorialSignals||[]).length],['Drafts ready',ready.length?1:0]].forEach(([label,value])=>{const card=el('article');card.append(el('strong','',String(value)),el('span','',label));inputs.append(card);});
  }
  function renderIssue(output){
    const result=output.result;const preview=el('div','bo-newsletter-preview');
    const subjectBlock=el('section','bo-newsletter-subjects');subjectBlock.append(el('strong','','Subject options'));
    const subjects=el('ol');(result.subjectOptions||[]).forEach(subject=>subjects.append(el('li','',subject)));subjectBlock.append(subjects);preview.append(subjectBlock);
    const issue=el('article','bo-newsletter-issue');issue.append(el('span','bo-newsletter-preheader',result.preheader),el('h4','',result.issueTitle),el('p','bo-newsletter-intro',result.introduction));
    (result.sections||[]).forEach(section=>{const block=el('section');block.append(el('h5','',section.heading),el('p','',section.body));if(section.linkUrl){const link=el('a','',`${section.linkUrl} ↗`);link.href=section.linkUrl;link.target='_blank';link.rel='noopener';block.append(link);}issue.append(block);});
    issue.append(el('p','bo-newsletter-closing',result.closing));preview.append(issue);
    if((result.sources||[]).length){const sources=el('details','bo-newsletter-sources');sources.append(el('summary','',`${result.sources.length} checked sources`));const list=el('div');result.sources.forEach(source=>{const link=el('a','bo-source-pill',`${source.label} ↗`);link.href=source.url;link.target='_blank';link.rel='noopener';list.append(link);});sources.append(list);preview.append(sources);}
    return preview;
  }
  async function submit(packet,action,note,button){
    if(action==='request-revision'&&!note.value.trim()){note.focus();return;}
    button.disabled=true;state.textContent=action==='request-revision'?'Preparing the revised issue now…':'Saving approval…';
    const response=await fetch('/api/newsletter/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({generatedAt:packet.generatedAt,action,note:note.value})});
    const body=await response.json();if(!response.ok){state.textContent=`Could not save: ${body.error}`;button.disabled=false;return;}state.textContent=body.message;await load();
  }
  async function load(){
    const [packet,sourceInputs,review]=await Promise.all([loadJson('backoffice-data/newsletter-review-packet.json',null),loadJson('backoffice-data/newsletter-inputs.json',{newlyPublishedTrails:[],publishedEditorialChanges:[],timelySafetySignals:[],currentEditorialSignals:[]}),loadJson('backoffice-data/newsletter-review.json',{decisions:[]})]);
    const ready=(packet?.outputs||[]).filter(item=>item.status==='ready-for-review');renderMetrics(sourceInputs,ready);draft.replaceChildren();
    if(!ready.length){const card=el('article','bo-idea-card');card.append(el('span','bo-stream-type','Next scheduled issue'),el('h3','','No newsletter draft is waiting'),el('p','bo-idea-why','The agent will assemble the next issue from approved ORMA changes and timely source-linked topics. You review one complete issue here, not the underlying editorial work again.'));draft.append(card);state.textContent='No issue needs your attention right now.';return;}
    const decided=(review.decisions||[]).find(item=>item.generatedAt===packet.generatedAt);const card=el('article',`bo-idea-card${decided?' is-decided':''}`);const output=ready[0];
    card.append(el('span','bo-stream-type',`Issue · ${packet.subject?.id||'draft'}`),el('h3','',output.result.issueTitle||'Newsletter recommendation'),renderIssue(output));
    if(!decided){const controls=el('div','bo-idea-controls');const note=el('textarea');note.placeholder='One revision note, if needed';const actions=el('div','bo-actions');[['approve','Approve issue'],['request-revision','Request revision']].forEach(([action,label])=>{const button=el('button','',label);button.addEventListener('click',()=>submit(packet,action,note,button));actions.append(button);});controls.append(note,actions);card.append(controls);}
    draft.append(card);state.textContent=decided?'This issue has a recorded decision.':'One complete issue is ready for your review.';
  }
  load().catch(error=>state.textContent=error.message);
})();
