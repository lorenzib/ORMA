(function(){
  'use strict';

  // Backoffice Home: the trail board.
  //
  // One artifact the worker writes every pass (`trail-board`), one heartbeat,
  // and the newest trail requests. Filtering and opening rows never reads
  // Firestore again. Refreshes every fifteen minutes while the tab is visible,
  // which is the cadence the old dashboard kept against the free-tier quota.

  const REFRESH_SECONDS=900;
  const REQUEST_LIMIT=25;
  const STAGES=[
    ['queued','Not started'],['route','Route check'],['research','Research'],
    ['publish','Publishing'],['passed','Passed'],['stopped','Stopped'],
  ];
  const STAGE_HINT={
    queued:'Waiting for the daily intake',
    route:'Line and distance against the source',
    research:'Agents gather directions and safety facts',
    publish:'Approved, going to the site',
  };
  const STAGE_INDEX={route:0,research:1,publish:2,passed:3};
  const BADGE={verified:['tb-p-ver','Verified'],reviewed:['tb-p-rev','Reviewed'],imported:['tb-p-imp','Imported']};
  const CHECKS=['photo','route','trail numbers','map points','elevation','water','heat','exposure','livestock','ground','dog access'];
  const ACTIONS={
    start:['Start verification','Admits it now instead of waiting for the daily intake.'],
    prioritise:['Work on this next','Runs a worker pass for this trail only.'],
    resurvey:['Re-measure the route','Takes the map survey again. Free: no AI credits. The trail stays where it is.'],
    'retry-publication':['Retry publishing','Retries the failed publication now. Use once the cause is fixed.'],
    reconsider:['Look at it again','Returns a rejected trail to the agent that rejected it. Use when the cause is fixed or a new source exists.'],
  };
  const REQUEST_STATE={
    queued:['tb-r-wait','Requested'],dispatched:['tb-r-run','Running'],done:['tb-r-done','Done'],
    refused:['tb-r-bad','Refused'],failed:['tb-r-bad','Failed'],
  };

  let board=null;let requests=new Map();
  let stage=null;let flag='all';let search='';let open=null;
  let loading=false;let seconds=REFRESH_SECONDS;let lastLoadedAt=null;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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

  function when(value){
    if(!value)return '';
    const date=typeof value.toDate==='function'?value.toDate():new Date(value.seconds?value.seconds*1000:value);
    if(Number.isNaN(date.getTime()))return '';
    return date.toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  }

  function latestRequests(list){
    const out=new Map();
    for(const request of list){if(request.trailId&&!out.has(request.trailId))out.set(request.trailId,request);}
    return out;
  }

  function renderHealth(artifact){
    const model=window.ORMADashboardModel;
    const health=model?model.deriveWorkerHealth(artifact):null;
    const node=$('tbHealth');
    node.dataset.state=health?health.state:'unknown';
    $('tbHealthText').textContent=health?`${health.label} · ${health.ageMinutes===null||health.ageMinutes===undefined?'':`last pass ${health.ageMinutes} min ago`}`.replace(/ · $/,''):'Automation status unavailable';
    node.title=health?health.message:'';
  }

  function renderJourney(){
    const counts=board.summary.stages||{};const stopped=board.summary.stopped||{};
    const hints={...STAGE_HINT,
      passed:`${board.summary.verified} Verified · ${board.summary.reviewed} Reviewed on the site`,
      stopped:`${stopped.resting||0} resting · ${stopped.rejected||0} rejected · ${stopped.blocked||0} blocked`};
    $('tbJourney').innerHTML=STAGES.map(([key,label])=>`<button type="button" class="tb-step${key==='stopped'?' tb-step-stopped':''}" data-stage="${key}" aria-pressed="${stage===key}">
      <span class="tb-n">${Number(counts[key]||0)}</span><span class="tb-l">${label}</span><span class="tb-h">${esc(hints[key])}</span></button>`).join('');
  }

  function renderFlags(){
    const near=board.trails.filter(entry=>entry.stage==='passed'&&entry.badge!=='verified'&&entry.checks>=8).length;
    const open=board.trails.filter(entry=>requests.has(entry.id)&&['queued','dispatched'].includes(requests.get(entry.id).status)).length;
    const chips=[
      ['all','All',null,''],
      ['stuck','stuck, nothing will move them',board.summary.stuck,'tb-chip-bad'],
      ['disagree','record and site disagree',board.summary.disagree,'tb-chip-warn'],
      ['withdrawn','taken off the site pending review',board.summary.withdrawn||0,'tb-chip-bad'],
      ['audit','need a document read by hand',board.summary.audit||0,'tb-chip-warn'],
      ['near','close to Verified',near,''],
      ['requested','with a request in progress',open,''],
    ];
    $('tbFlags').innerHTML=chips.map(([key,label,count,cls])=>`<button type="button" class="tb-chip ${cls}" data-flag="${key}" aria-pressed="${flag===key}">${count===null?'':`<b>${count}</b> `}${label}</button>`).join('');
  }

  function track(entry){
    let html='';
    for(let index=0;index<4;index+=1){
      let cls='tb-seg';
      if(entry.stage==='passed')cls+=' is-done';
      else if(entry.stage==='stopped'){
        const at=entry.state==='imported'?1:0;
        cls+=index<at?' is-done':index===at?(entry.stopKind==='resting'?' is-rest':' is-bad'):'';
      }else if(entry.stage!=='queued'){
        const at=STAGE_INDEX[entry.stage];
        cls+=index<at?' is-done':index===at?(entry.flag==='stuck'?' is-bad':' is-now'):'';
      }
      html+=`<span class="${cls}"></span>`;
    }
    return `<div class="tb-track">${html}<span class="tb-stg">${esc(entry.stageLabel)}</span></div>`;
  }

  function requestChip(entry){
    const request=requests.get(entry.id);
    if(!request)return '';
    const [cls,label]=REQUEST_STATE[request.status]||['tb-r-wait',request.status];
    return `<span class="tb-req ${cls}">${label}: ${esc((ACTIONS[request.action]||[request.action])[0])}</span>`;
  }

  function flagChip(entry){
    if(entry.flag==='stuck')return '<span class="tb-flag tb-f-bad">Stuck</span>';
    if(entry.flag==='disagree')return '<span class="tb-flag tb-f-warn">Record and site disagree</span>';
    if(entry.flag==='withdrawn')return '<span class="tb-flag tb-f-bad">Off the site</span>';
    if(entry.flag==='audit')return '<span class="tb-flag tb-f-warn">Hand audit</span>';
    if(entry.stopKind==='resting')return '<span class="tb-flag tb-f-rest">Resting</span>';
    if(entry.stopKind==='rejected')return '<span class="tb-flag tb-f-bad">Rejected</span>';
    return '';
  }

  function detail(entry){
    const missing=new Set(entry.missing||[]);
    const checks=CHECKS.map(check=>`<div class="tb-ck ${missing.has(check)?'is-miss':'is-ok'}"><span>${check[0].toUpperCase()+check.slice(1)}</span><span aria-hidden="true">${missing.has(check)?'–':'✓'}</span></div>`).join('');
    const request=requests.get(entry.id);
    const pending=request&&['queued','dispatched'].includes(request.status);
    let actions='';
    if(pending){
      actions=`<p class="tb-acthelp">${requestChip(entry)} asked ${esc(when(request.submittedAt))}. The automation checks for requests every 15 minutes${request.runUrl?`; <a href="${esc(request.runUrl)}" target="_blank" rel="noopener">see the run ↗</a>`:''}.</p>`;
    }else if((entry.actions||[]).length){
      actions=`<div class="tb-acts">${entry.actions.map((key,index)=>`<button type="button" class="tb-act${index?' is-ghost':''}" data-act="${esc(key)}" data-id="${esc(entry.id)}">${esc((ACTIONS[key]||[key])[0])}</button>`).join('')}</div>
        <p class="tb-acthelp">${entry.actions.map(key=>`<b>${esc((ACTIONS[key]||[key])[0])}:</b> ${esc((ACTIONS[key]||['',''])[1])}`).join(' ')}</p>`;
    }else{
      actions='<p class="tb-acthelp">No request applies at this stage; the automation moves it on its own.</p>';
    }
    const last=request&&!pending?`<p class="tb-acthelp">Last request: ${requestChip(entry)} ${esc(when(request.submittedAt))}${request.note?` · ${esc(request.note)}`:''}${request.runUrl?` · <a href="${esc(request.runUrl)}" target="_blank" rel="noopener">run ↗</a>`:''}</p>`:'';
    const facts=[
      ['Now',entry.next],['Detail',entry.detail],
      ['Pipeline state',entry.state?entry.state.replace(/-/g,' '):'not in the pipeline'],
      ['Since',entry.since||'—'],
      ...((entry.audit||[]).map(item=>['Read by hand',`${item.claimId}: ${(item.sources||[]).join(' ')||'no address given'}`])),
    ];
    return `<tr class="tb-detail"><td colspan="5"><div class="tb-det">
      <div><h3>Where it is</h3><dl class="tb-facts">${facts.map(([key,value])=>`<dt>${key}</dt><dd>${esc(value)}</dd>`).join('')}</dl>
        <div class="tb-links">${entry.slug?`<a href="https://www.app-orma.com/trails/${encodeURIComponent(entry.slug)}.html" target="_blank" rel="noopener">Public page ↗</a>`:''}<a href="trail-verify-desk.html">Trail desk ↗</a></div></div>
      <div><h3>${missing.size?'What Verified still needs':'All eleven checks'}</h3><div class="tb-grid11">${checks}</div>${actions}${last}</div>
    </div></td></tr>`;
  }

  function visible(entry){
    if(stage&&entry.stage!==stage)return false;
    if(flag==='stuck'&&entry.flag!=='stuck')return false;
    if(flag==='disagree'&&entry.flag!=='disagree')return false;
    if(flag==='withdrawn'&&entry.flag!=='withdrawn')return false;
    if(flag==='audit'&&entry.flag!=='audit')return false;
    if(flag==='near'&&!(entry.stage==='passed'&&entry.badge!=='verified'&&entry.checks>=8))return false;
    if(flag==='requested'&&!(requests.has(entry.id)&&['queued','dispatched'].includes(requests.get(entry.id).status)))return false;
    if(search&&!`${entry.name} ${entry.area} ${entry.id}`.toLowerCase().includes(search))return false;
    return true;
  }

  function renderRows(){
    const rows=board.trails.filter(visible);
    $('tbRows').innerHTML=rows.map(entry=>{
      const [cls,label]=BADGE[entry.badge]||BADGE.imported;
      return `<tr class="tb-row" tabindex="0" data-id="${esc(entry.id)}" aria-expanded="${open===entry.id}">
        <td><div class="tb-name">${esc(entry.name)}</div><div class="tb-area">${esc(entry.area)}</div></td>
        <td>${track(entry)}</td>
        <td class="tb-checks">${Number(entry.checks||0)}<small>/11</small></td>
        <td><span class="tb-pill ${cls}">${label}</span></td>
        <td class="tb-next">${requestChip(entry)}${flagChip(entry)}${esc(entry.next)}<span class="tb-who">${esc(entry.detail)}</span></td>
      </tr>${open===entry.id?detail(entry):''}`;
    }).join('');
    $('tbEmpty').hidden=rows.length>0;
  }

  function render(){
    if(!board)return;
    renderJourney();renderFlags();renderRows();
  }

  function notice(text,isError){
    const node=$('tbNotice');node.textContent=text;node.hidden=!text;node.classList.toggle('is-error',Boolean(isError));
  }

  async function load(){
    if(loading)return;loading=true;$('tbRefresh').disabled=true;$('tbUpdated').textContent='Refreshing…';
    try{
      const remote=await api();
      const [boardResult,health,requestResult]=await Promise.all([
        remote.getArtifact('trail-board'),remote.getArtifact('worker-health'),remote.getTrailRequests(REQUEST_LIMIT)]);
      if(!boardResult.ok){
        $('tbRows').innerHTML=`<tr><td colspan="5" class="tb-empty">${boardResult.error==='artifact-not-found'
          ?'The trail board has not been written yet. It appears after the next worker pass.'
          :'The trail board could not be read. Sign in again and reload.'}</td></tr>`;
        return;
      }
      board=boardResult.data;requests=latestRequests(requestResult.ok?requestResult.requests:[]);
      renderHealth(health.ok?health.data:null);
      $('tbSubtitle').textContent=`All ${board.summary.trails} catalogue trails and how far each has got towards Verified.`;
      lastLoadedAt=Date.now();seconds=REFRESH_SECONDS;
      $('tbUpdated').textContent=`Board from ${when(board.generatedAt)}`;
      render();
    }catch(error){
      notice(error.message,true);$('tbUpdated').textContent='Not connected';
    }finally{loading=false;$('tbRefresh').disabled=false;}
  }

  async function ask(button){
    const entry=board&&board.trails.find(item=>item.id===button.dataset.id);
    if(!entry)return;
    button.disabled=true;
    try{
      const remote=await api();
      const result=await remote.submitTrailRequest({trailId:entry.id,trailName:entry.name,action:button.dataset.act});
      if(!result.ok)throw new Error(result.error==='moderator-required'?'Your sign-in has expired. Sign in again.':'The request could not be saved.');
      requests.set(entry.id,{id:result.requestId,trailId:entry.id,action:button.dataset.act,status:'queued',submittedAt:new Date()});
      notice(`Saved: ${(ACTIONS[button.dataset.act]||[button.dataset.act])[0]} for ${entry.name}. The automation picks it up within 15 minutes.`);
      render();
    }catch(error){button.disabled=false;notice(error.message,true);}
  }

  $('tbJourney').addEventListener('click',event=>{
    const button=event.target.closest('[data-stage]');if(!button)return;
    stage=stage===button.dataset.stage?null:button.dataset.stage;render();
  });
  $('tbFlags').addEventListener('click',event=>{
    const button=event.target.closest('[data-flag]');if(!button)return;
    flag=button.dataset.flag;render();
  });
  $('tbSearch').addEventListener('input',event=>{search=event.target.value.trim().toLowerCase();render();});
  $('tbRows').addEventListener('click',event=>{
    const act=event.target.closest('.tb-act');if(act){ask(act);return;}
    if(event.target.closest('a'))return;
    const row=event.target.closest('tr.tb-row');if(!row)return;
    open=open===row.dataset.id?null:row.dataset.id;render();
  });
  $('tbRows').addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('tr.tb-row')){event.preventDefault();event.target.click();}
  });
  $('tbRefresh').addEventListener('click',load);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden||loading)return;
    const age=lastLoadedAt?Date.now()-lastLoadedAt:Infinity;
    if(age>=REFRESH_SECONDS*1000)load();
  });
  window.setInterval(()=>{
    if(loading||document.hidden)return;
    seconds-=1;if(seconds<=0)load();
  },1000);
  load();
})();
