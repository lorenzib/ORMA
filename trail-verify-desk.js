(function(){
  'use strict';
  /**
   * Trail verification, as one queue of plain questions.
   *
   * The older desks were organised around the pipeline: evidence on one page,
   * content on another, release on a third, each with its own vocabulary. One
   * trail therefore cost four visits. This desk keeps the same gates and the
   * same submit APIs, but presents them as a single list of trails, each with
   * the question that trail is actually waiting on.
   *
   * The rule for every card: the human check comes first, the machine's
   * workings go behind "Show the evidence". Nothing here publishes; the final
   * website diff stays a separate, deliberate check further down the page.
   */
  const URLS={
    dossier:'backoffice-data/dossier-review-queue.json',
    orchestration:'backoffice-data/trail-orchestration.json',
    editorial:'backoffice-data/verified-trail-editorial-execution.json',
    staging:'backoffice-data/publication-staging.json',
  };
  const LOCAL_MODE=['localhost','127.0.0.1'].includes(location.hostname);
  const DRAFT_KEY='orma-verify-notes-v1';
  const RECEIPT_KEY='orma-verify-receipts-v1';

  const stateNode=document.getElementById('verifyState');
  const queueNode=document.getElementById('verifyQueue');
  const countNode=document.getElementById('verifyCount');
  const workingNode=document.getElementById('verifyWorking');
  const prNode=document.getElementById('verifyPr');
  const prCountNode=document.getElementById('verifyPrCount');
  const refreshBtn=document.getElementById('verifyRefresh');

  let dossier={items:[]},orchestration={trails:[],summary:{}},editorial={outputs:[]},staging={items:[]},publication={requests:[]};
  let drafts=stored(DRAFT_KEY),receipts=stored(RECEIPT_KEY);

  function stored(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(error){return {};}}
  function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(error){/* convenience only */}}
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function num(value,suffix=''){return value===undefined||value===null||value===''?'—':`${value}${suffix}`;}
  function plural(count,word){return `${count} ${word}${count===1?'':'s'}`;}

  async function getJson(url,fallback){
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok){if(fallback!==undefined)return fallback;throw new Error(`Could not load ${url} (${response.status})`);}
    return response.json();
  }
  async function remote(){
    if(window.ORMABackoffice)return window.ORMABackoffice;
    await new Promise(resolve=>{window.addEventListener('dolopaws-auth-ready',resolve,{once:true});window.setTimeout(resolve,10000);});
    if(!window.ORMABackoffice)throw new Error('Sign in with a moderator account, then reload this page.');
    return window.ORMABackoffice;
  }
  async function artifact(id,url,fallback){
    if(LOCAL_MODE)return getJson(url,fallback);
    const result=await (await remote()).getArtifact(id);
    if(!result.ok){if(result.error==='artifact-not-found'&&fallback!==undefined)return fallback;throw new Error(`Could not load ${id}: ${result.error}`);}
    return result.data;
  }

  // ---- turning pipeline gates into questions a person can answer ----

  const GATES={
    'geometry-approval':{
      label:'Check the route',
      question:'Does this route match the official one?',
      checklist:[
        'The drawn line follows the official route',
        'The name and trail numbers match',
        'Branches and road crossings look right',
      ],
      scope:'This is about the route only. Parking and trail facts are checked separately.',
      approve:'Route looks right',
    },
    'dossier-approval':{
      label:'Check the trail facts',
      question:'Are these findings about the trail correct?',
      checklist:[],
      scope:'Approving marks the trail verified. It still does not change the website.',
      approve:'Mark verified',
    },
    content:{
      label:'Check the description',
      question:'Is the written description right for this trail?',
      checklist:[
        'The summary matches what the route actually is',
        'Nothing claims a fact the evidence did not establish',
      ],
      scope:'Approving releases the text for publishing. The website diff is still checked at the end.',
      approve:'Description is right',
    },
    publish:{
      label:'Approve for publishing',
      question:'Ready to prepare this trail for the website?',
      checklist:['The trail page maps to the right existing trail or a new one'],
      scope:'This prepares a pull request. You still review the website diff before anything goes live.',
      approve:'Prepare for publishing',
    },
  };

  function geometryFacts(result){
    const comparison=result.comparison||{},assessment=result.assessment||{};
    return [
      ['Measured',num(comparison.reconstructedDistanceKm,' km')],
      ['Official',num(comparison.officialDistanceKm,' km')],
      ['Difference',num(comparison.distanceDeltaPercent,'%')],
      ['Closed loop',assessment.isClosed===undefined?'—':(assessment.isClosed?`Yes · ${num(assessment.closureDistanceM,' m')} gap`:'No')],
    ];
  }

  function routeSvg(coordinates){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 700 300');svg.setAttribute('role','img');
    svg.setAttribute('aria-label','Route drawn from the mapped data');svg.classList.add('bo-route-svg');
    if(!coordinates||!coordinates.length)return svg;
    const xs=coordinates.map(point=>point[0]),ys=coordinates.map(point=>point[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const dx=maxX-minX||1,dy=maxY-minY||1;
    const points=coordinates.map(([x,y])=>`${30+(x-minX)/dx*640},${270-(y-minY)/dy*240}`).join(' ');
    const line=document.createElementNS(svg.namespaceURI,'polyline');
    line.setAttribute('points',points);line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');
    line.setAttribute('stroke-width','5');line.setAttribute('stroke-linejoin','round');line.setAttribute('stroke-linecap','round');
    svg.append(line);return svg;
  }

  function evidenceBlock(item){
    const details=el('details','vd-evidence');
    details.append(el('summary','','Show the evidence'));
    (item.specialistOutputs||[]).forEach(output=>{
      const result=output.result||{};
      const panel=el('div','vd-evidence-panel');
      panel.append(el('h4','',`${output.agentId} · ${result.summary||result.assessment?.status||'result'}`));
      if(result.geometry?.coordinates)panel.append(routeSvg(result.geometry.coordinates));
      if(result.source?.url){
        const link=el('a','','Open the official source');
        link.href=result.source.url;link.target='_blank';link.rel='noopener';
        panel.append(link);
      }
      const raw=el('details','vd-raw');
      raw.append(el('summary','','Machine output'),el('pre','',JSON.stringify(result,null,2)));
      panel.append(raw);
      details.append(panel);
    });
    if(item.claimResolution&&item.claimResolution.length){
      const history=el('div','vd-evidence-panel');
      history.append(el('h4','','What the agents already retried'));
      history.append(el('p','',item.claimResolution.map(entry=>`${entry.category}: ${String(entry.state||'').replace(/-/g,' ')}`).join(' · ')));
      details.append(history);
    }
    return details;
  }

  function claimLines(item){
    const claims=[];
    (item.specialistOutputs||[]).forEach(output=>(output.result?.claims||[]).forEach(claim=>claims.push(claim)));
    return claims;
  }

  function fromDossier(){
    return (dossier.items||[]).filter(item=>item.state==='awaiting-human').map(item=>({
      key:item.reviewId,
      gate:GATES[item.gateType]||GATES['dossier-approval'],
      trailName:item.trailName||item.candidateId,
      candidateId:item.candidateId,
      blockers:item.blockingReasons||[],
      ready:item.approvalAllowed!==false,
      facts:(()=>{const carto=(item.specialistOutputs||[]).find(output=>output.agentId==='cartographer');return carto?geometryFacts(carto.result||{}):[];})(),
      claims:claimLines(item),
      evidence:()=>evidenceBlock(item),
      // Revision goes back to whoever raised the finding, so there is no
      // "revision owner" dropdown to think about.
      targetAgent:(item.specialistOutputs||[])[0]?.agentId||'auditor',
      submit:(action,note)=>send('dossier',{reviewId:item.reviewId,candidateId:item.candidateId,action,targetAgent:(item.specialistOutputs||[])[0]?.agentId||'auditor',note}),
    }));
  }

  function fromContent(){
    return (editorial.outputs||[]).filter(output=>output.state==='awaiting-human'||output.reviewState==='awaiting-human').map(output=>({
      key:`content-${output.candidateId}`,
      gate:GATES.content,
      trailName:output.result?.title||output.trailName||output.candidateId,
      candidateId:output.candidateId,
      blockers:output.blockers||[],
      ready:true,
      facts:[],
      claims:[],
      summary:output.result?.summary||output.result?.intro||'',
      evidence:()=>{const details=el('details','vd-evidence');details.append(el('summary','','Show the evidence'));const raw=el('pre','',JSON.stringify(output.result||output,null,2));details.append(raw);return details;},
      submit:(action,note)=>send('content',{candidateId:output.candidateId,action,note}),
    }));
  }

  function fromPublish(){
    return (staging.items||[]).filter(item=>item.state==='awaiting-human').map(item=>({
      key:`publish-${item.candidateId}`,
      gate:GATES.publish,
      trailName:item.trailName||item.targetTrailId||item.candidateId,
      candidateId:item.candidateId,
      blockers:item.blockers||[],
      ready:true,
      facts:[['Maps to',item.targetTrailId||'new trail']],
      claims:[],
      evidence:()=>{const details=el('details','vd-evidence');details.append(el('summary','','Show the evidence'),el('pre','',JSON.stringify(item,null,2)));return details;},
      submit:(action,note)=>send('publication',{candidateId:item.candidateId,action,note}),
    }));
  }

  async function send(kind,payload){
    if(LOCAL_MODE)return {ok:true,reviewId:'local'};
    const api=await remote();
    if(kind==='dossier')return api.submitDossierReview(payload);
    if(kind==='publication')return api.submitPublicationReview(payload);
    return api.submitTrailReview({gate:'content-review',decisions:[payload]});
  }

  // ---- rendering ----

  function card(decision){
    const article=el('article',`vd-card${decision.ready?'':' is-blocked'}`);
    const head=el('div','vd-card-head');
    const heading=el('div');
    heading.append(el('p','vd-gate',decision.gate.label),el('h2','',decision.trailName));
    head.append(heading);
    if(!decision.ready)head.append(el('span','vd-lock','Blocked'));
    article.append(head,el('p','vd-question',decision.gate.question));

    if(decision.blockers.length){
      const blockers=el('div','vd-blockers');
      blockers.append(el('h3','','Fix before approving'));
      const list=el('ul');decision.blockers.forEach(reason=>list.append(el('li','',String(reason))));
      blockers.append(list);article.append(blockers);
    }

    if(decision.summary)article.append(el('p','vd-summary',decision.summary));

    // The checklist is the job. It used to be one sentence at the bottom of
    // the cartographer panel; here it is the first thing on the card.
    const checks=decision.gate.checklist.slice();
    decision.claims.forEach(claim=>checks.push(`${claim.category}: ${claim.proposedValue}`));
    if(checks.length){
      const list=el('ul','vd-checklist');
      checks.forEach(text=>list.append(el('li','',text)));
      article.append(el('h3','vd-checklist-title','What to check'),list);
    }

    if(decision.facts.length){
      const facts=el('div','vd-facts');
      decision.facts.forEach(([label,value])=>{const box=el('div');box.append(el('small','',label),el('strong','',value));facts.append(box);});
      article.append(facts);
    }

    article.append(decision.evidence());

    const receipt=receipts[decision.key];
    const note=el('textarea');
    note.placeholder='If it needs work, say exactly what is wrong.';
    note.value=(drafts[decision.key]||receipt?.note||'');
    note.addEventListener('input',()=>{drafts[decision.key]={note:note.value};persist(DRAFT_KEY,drafts);});

    const actions=el('div','vd-actions');
    const status=el('p','vd-status',receipt?`Saved ${new Date(receipt.at).toLocaleTimeString()}. The next automation run picks it up.`:'');
    [['approve',decision.gate.approve,'is-approve'],['request-revision','Needs work',''],['reject','Reject','is-reject']].forEach(([action,label,cls])=>{
      const button=el('button',cls,label);button.type='button';
      if(receipt||(action==='approve'&&!decision.ready)){
        button.disabled=true;
        if(action==='approve'&&!decision.ready)button.title='Clear the blockers first';
      }
      button.addEventListener('click',()=>decide(decision,action,note,article,status));
      actions.append(button);
    });
    if(receipt){note.disabled=true;}
    article.append(note,actions,status,el('p','vd-scope',decision.gate.scope));
    return article;
  }

  async function decide(decision,action,note,article,status){
    if(action!=='approve'&&!note.value.trim()){
      status.textContent='Say what needs fixing before sending it back.';
      note.focus();return;
    }
    article.querySelectorAll('button').forEach(button=>button.disabled=true);
    status.textContent='Saving…';
    try{
      const result=await decision.submit(action,note.value.trim());
      if(result&&result.ok===false)throw new Error(result.error||'submit-failed');
      receipts[decision.key]={action,note:note.value.trim(),at:new Date().toISOString()};persist(RECEIPT_KEY,receipts);
      delete drafts[decision.key];persist(DRAFT_KEY,drafts);
      status.textContent='Saved. The next automation run picks it up.';
      note.disabled=true;
      window.setTimeout(load,1200);
    }catch(error){
      status.textContent=`Could not save: ${error.message}`;
      article.querySelectorAll('button').forEach(button=>{button.disabled=false;});
    }
  }

  function renderPullRequests(){
    const requests=(publication.requests||[]).filter(request=>request.state==='awaiting-human'||request.status==='awaiting-review');
    prCountNode.textContent=requests.length?plural(requests.length,'website change'):'Nothing waiting';
    prNode.replaceChildren();
    if(!requests.length){prNode.append(el('p','vd-empty','No website changes are waiting for a final look.'));return;}
    requests.forEach(request=>{
      const row=el('article','vd-pr');
      row.append(el('h3','',request.title||request.targetTrailId||request.candidateId));
      if(request.pullRequestUrl){
        const link=el('a','','Open the website diff');
        link.href=request.pullRequestUrl;link.target='_blank';link.rel='noopener';
        row.append(link);
      }
      row.append(el('p','vd-scope','Merging this pull request is what changes the live website.'));
      prNode.append(row);
    });
  }

  function render(){
    const decisions=[...fromDossier(),...fromContent(),...fromPublish()];
    countNode.textContent=decisions.length?plural(decisions.length,'trail'):'Nothing waiting';
    queueNode.replaceChildren();
    if(!decisions.length){
      queueNode.append(el('p','vd-empty','Nothing needs you right now.'));
    }else{
      decisions.forEach(decision=>queueNode.append(card(decision)));
    }
    const summary=orchestration.summary||{};
    const running=Number(summary.running||0);
    workingNode.textContent=running?`The system is working on ${plural(running,'trail')}.`:'The system has no trails in progress.';
    renderPullRequests();
  }

  async function load(){
    refreshBtn.disabled=true;
    try{
      [dossier,orchestration,editorial,staging,publication]=await Promise.all([
        artifact('dossier-review-queue',URLS.dossier,{items:[]}),
        artifact('trail-orchestration',URLS.orchestration,{trails:[],summary:{}}),
        artifact('verified-trail-editorial-execution',URLS.editorial,{outputs:[]}),
        artifact('publication-staging',URLS.staging,{items:[]}),
        artifact('publication-requests',null,{requests:[]}),
      ]);
      stateNode.textContent='';
      stateNode.classList.remove('is-error');
      render();
    }catch(error){
      stateNode.classList.add('is-error');
      stateNode.textContent=error.message;
    }finally{
      refreshBtn.disabled=false;
    }
  }

  refreshBtn.addEventListener('click',load);
  load();
  window.setInterval(load,30000);
})();
