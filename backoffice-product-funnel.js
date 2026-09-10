(function(){
  'use strict';

  let days=7;
  let loading=false;
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  const rate=value=>Number.isInteger(value)?`${value}%`:'—';

  async function remote(){
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

  function renderRows(model){
    const body=document.getElementById('funnelRows');
    body.replaceChildren();
    model.steps.forEach((step,index)=>{
      const row=document.createElement('tr');
      const stepCell=document.createElement('th');
      stepCell.scope='row';
      stepCell.innerHTML=`<span>${index+1}</span><strong>${step.label}</strong>`;
      const browsers=document.createElement('td');browsers.textContent=String(step.browsers);
      const reach=document.createElement('td');reach.textContent=rate(step.rate);
      const events=document.createElement('td');events.textContent=String(step.eventCount);
      row.append(stepCell,browsers,reach,events);
      body.append(row);
    });
  }

  function render(result){
    const model=window.ORMAProductFunnelModel.build(result.events);
    set('funnelBrowsers',String(model.consentedBrowsers));
    set('funnelPrimary',rate(model.primaryActionRate));
    set('funnelMap',rate(model.mapInteractionRate));
    set('funnelAdjusted',rate(model.adjustmentRate));
    set('funnelNoResults',rate(model.noResultRate));
    renderRows(model);
    const windowLabel=`Last ${result.days} days`;
    const limited=result.truncated?` Showing the newest ${result.limit} events; the result is capped.`:'';
    set('funnelSample',`${windowLabel} · ${model.eventCount} recorded events · ${model.recommendationBrowsers} browsers in the recommendation cohort.${limited}`);
    set('funnelStatus',model.eventCount
      ? `Live aggregate · refreshed ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`
      : `No consented product events were recorded in the last ${result.days} days.`);
    document.getElementById('funnelStatus').classList.remove('is-error');
  }

  async function load(){
    if(loading)return;
    loading=true;
    const refresh=document.getElementById('refreshFunnel');
    refresh.disabled=true;
    set('funnelStatus','Refreshing protected analytics…');
    try{
      const api=await remote();
      const result=await api.getProductEvents({days});
      if(!result?.ok)throw new Error(`Could not load product events: ${result?.error||'unknown error'}`);
      render(result);
    }catch(error){
      const status=document.getElementById('funnelStatus');
      status.classList.add('is-error');
      status.textContent=error.message;
    }finally{
      loading=false;
      refresh.disabled=false;
    }
  }

  document.querySelectorAll('[data-funnel-days]').forEach(button=>{
    button.addEventListener('click',()=>{
      days=Number(button.dataset.funnelDays)===30?30:7;
      document.querySelectorAll('[data-funnel-days]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
      load();
    });
  });
  document.getElementById('refreshFunnel').addEventListener('click',load);
  load();
})();
