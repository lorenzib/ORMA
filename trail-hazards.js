(function(){
  'use strict';
  function trailIdentity(){
    const queryId=new URLSearchParams(location.search).get('id');
    const cta=document.querySelector('a[href*="trail.html?id="]');
    const linked=cta?new URL(cta.href,location.href).searchParams.get('id'):null;
    const slug=location.pathname.split('/').pop().replace(/\.html$/,'');
    return {id:queryId||linked,slug};
  }
  function severityRank(value){return {extreme:3,severe:2,moderate:1}[value]||0;}
  function installStyles(){
    if(document.getElementById('ormaHazardStyles'))return;
    const style=document.createElement('style');style.id='ormaHazardStyles';style.textContent=
      '.orma-hazard-stack{display:grid;gap:10px;margin:14px 0 22px}.orma-hazard-report{margin:0 0 22px}.orma-hazard-report>button{padding:8px 14px;border:1px solid #c9bfae;border-radius:999px;background:#fff;color:#4a4136;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.orma-hazard-report form{display:grid;gap:9px;margin-top:10px;padding:14px 15px;border:1px solid #d9d2c6;border-radius:11px;background:#fbf8f2}.orma-hazard-report label{display:grid;gap:4px;font-size:12px;font-weight:700;color:#4a4136}.orma-hazard-report select,.orma-hazard-report textarea,.orma-hazard-report input{padding:8px 10px;border:1px solid #cfc6b7;border-radius:8px;font:inherit;font-size:13px;background:#fff}.orma-hazard-report textarea{min-height:74px;resize:vertical}.orma-hazard-report .orma-hazard-report__note{margin:0;color:#6b625a;font-size:11px;line-height:1.45;font-weight:400}.orma-hazard-report__status{margin:0;font-size:12px;line-height:1.45}.orma-hazard-report__status.is-error{color:#8a2f24}.orma-hazard{padding:15px 17px;border:1px solid #d6934d;border-left:6px solid #b9582e;border-radius:10px;background:#fff6e8;color:#352a22}.orma-hazard.is-extreme{border-left-color:#91352d;background:#fff0ed}.orma-hazard.is-unverified{border-style:dashed;border-left-color:#8a7a63;background:#faf6ee}.orma-hazard strong{display:block;margin-bottom:6px;font-size:15px}.orma-hazard p{margin:0 0 8px;font-size:13px;line-height:1.5}.orma-hazard small{display:block;color:#6b625a;font-size:11px;line-height:1.4}.orma-hazard a{color:inherit;font-weight:800}';
    document.head.appendChild(style);
  }

  const HAZARD_KINDS=[['closure','Trail or path closed'],['route-damage','Damaged path, bridge or crossing'],
    ['livestock','Livestock or guardian dogs'],['water','Water crossing or missing water'],
    ['snow-or-ice','Snow or ice'],['rockfall','Rockfall or landslide'],['other','Something else']];

  // Reporting is one control, not a page: the reader picks what they saw, describes it,
  // and the Hazard Analyst decides whether and how it is published. Nothing is shown
  // to other readers on the strength of the report alone.
  function installReportControl(trail,anchor){
    const community=window.DoloPawsCommunity;
    if(!community||typeof community.reportTrailHazard!=='function'||!trail.id)return;
    const wrap=document.createElement('section');wrap.className='orma-hazard-report';
    const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Report a hazard on this trail';
    toggle.setAttribute('aria-expanded','false');wrap.append(toggle);

    const form=document.createElement('form');form.hidden=true;
    const kindLabel=document.createElement('label');kindLabel.append(document.createTextNode('What did you see?'));
    const kind=document.createElement('select');
    HAZARD_KINDS.forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;kind.append(option);});
    kindLabel.append(kind);
    const textLabel=document.createElement('label');textLabel.append(document.createTextNode('Describe it'));
    const text=document.createElement('textarea');text.maxLength=600;text.required=true;
    text.placeholder='Where on the trail, and what makes it a problem?';textLabel.append(text);
    const dateLabel=document.createElement('label');dateLabel.append(document.createTextNode('When did you see it?'));
    const observedOn=document.createElement('input');observedOn.type='date';
    observedOn.max=new Date().toISOString().slice(0,10);observedOn.value=observedOn.max;dateLabel.append(observedOn);
    const note=document.createElement('p');note.className='orma-hazard-report__note';
    note.textContent='ORMA checks your report against official sources. If it is confirmed it appears as a warning with its sources; if it cannot be confirmed but looks credible it appears clearly marked as unconfirmed.';
    const submit=document.createElement('button');submit.type='submit';submit.textContent='Send report';
    const status=document.createElement('p');status.className='orma-hazard-report__status';status.setAttribute('role','status');
    form.append(kindLabel,textLabel,dateLabel,note,submit,status);wrap.append(form);

    toggle.addEventListener('click',()=>{
      form.hidden=!form.hidden;toggle.setAttribute('aria-expanded',String(!form.hidden));
      if(!form.hidden)text.focus();
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();submit.disabled=true;status.classList.remove('is-error');
      status.textContent='Checking your report against official sources…';
      try{
        const result=await community.reportTrailHazard({id:trail.id,name:trail.name,area:trail.area},
          kind.value,text.value,observedOn.value);
        status.textContent=result&&result.message?result.message:'Thanks, ORMA is checking this now.';
        if(result&&result.ok){form.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='Report sent';}
        else{status.classList.add('is-error');submit.disabled=false;}
      }catch(error){
        status.classList.add('is-error');status.textContent='Could not send your report, please try again.';submit.disabled=false;
      }
    });
    anchor.insertAdjacentElement('afterend',wrap);
  }

  async function load(){
    const identity=trailIdentity();if(!identity.id&&!identity.slug)return;
    const heading=document.querySelector('main h1');
    const trail={id:identity.id||identity.slug,name:heading?heading.textContent.trim():identity.slug,
      area:(document.querySelector('[data-trail-area]')||{}).textContent||''};
    const prefix=location.pathname.includes('/trails/')?'../':'';
    // trail.html has no .sp-badges strip and no <main>, so both the warning
    // stack and the report control silently vanished there. #ormaHazardMount is
    // the explicit anchor that page provides.
    const anchorFor=()=>document.getElementById('ormaHazardMount')||document.querySelector('.sp-badges')||document.querySelector('main h1')||document.querySelector('main');
    // window.DoloPawsCommunity is assigned near the end of firebase-init.js, an
    // ES module, while this file is injected dynamically by mobile-nav.js. A
    // dynamically created script ignores defer and runs as soon as it loads, so
    // it wins that race and used to sample the module before it existed --
    // silently skipping the report control on every trail page. Wait for the
    // ready signal firebase-init.js already dispatches.
    const reportAnchor=anchorFor();
    if(reportAnchor&&reportAnchor.parentNode){
      const install=()=>installReportControl(trail,reportAnchor);
      if(window.DoloPawsAuthReady) install();
      else window.addEventListener('dolopaws-auth-ready', install, { once:true });
    }
    const response=await fetch(`${prefix}data/dynamic-hazards.json`,{cache:'no-store'});if(!response.ok)return;
    const data=await response.json();const hazards=(data.hazards||[]).filter(item=>(item.trailIds||[]).includes(identity.id)||(item.trailSlugs||[]).includes(identity.slug)).sort((a,b)=>severityRank(b.severity)-severityRank(a.severity));
    if(!hazards.length)return;installStyles();
    const stack=document.createElement('section');stack.className='orma-hazard-stack';stack.setAttribute('aria-label','Current area warnings');
    hazards.forEach(item=>{const card=document.createElement('article');card.className=`orma-hazard is-${item.severity}`;
      const title=document.createElement('strong');title.textContent=item.title;
      const copy=document.createElement('p');copy.textContent=item.message;
      const detail=document.createElement('small');
      if(item.sourceUrl){const source=document.createElement('a');source.href=item.sourceUrl;source.target='_blank';source.rel='noopener';source.textContent=`Check ${item.sourceLabel} ↗`;detail.append(source);}
      else detail.append(document.createTextNode(item.sourceLabel||'Hiker report'));
      detail.append(document.createTextNode(`${item.expiresAt?` · source expiry ${new Date(item.expiresAt).toLocaleString()}`:''}`));
      if(item.verificationState==='reported-unverified')card.classList.add('is-unverified');
      card.append(title,copy,detail);stack.append(card);});
    // A safety warning must never be dropped for want of an anchor: fall back
    // to the top of the document rather than discarding the stack.
    const anchor=anchorFor();
    if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',stack);
    else if(document.body)document.body.prepend(stack);
  }
  load().catch(()=>{});
})();
