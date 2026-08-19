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
      '.orma-hazard-stack{display:grid;gap:10px;margin:14px 0 22px}.orma-hazard{padding:15px 17px;border:1px solid #d6934d;border-left:6px solid #b9582e;border-radius:10px;background:#fff6e8;color:#352a22}.orma-hazard.is-extreme{border-left-color:#91352d;background:#fff0ed}.orma-hazard strong{display:block;margin-bottom:6px;font-size:15px}.orma-hazard p{margin:0 0 8px;font-size:13px;line-height:1.5}.orma-hazard small{display:block;color:#6b625a;font-size:11px;line-height:1.4}.orma-hazard a{color:inherit;font-weight:800}';
    document.head.appendChild(style);
  }
  async function load(){
    const identity=trailIdentity();if(!identity.id&&!identity.slug)return;
    const prefix=location.pathname.includes('/trails/')?'../':'';
    const response=await fetch(`${prefix}data/dynamic-hazards.json`,{cache:'no-store'});if(!response.ok)return;
    const data=await response.json();const hazards=(data.hazards||[]).filter(item=>(item.trailIds||[]).includes(identity.id)||(item.trailSlugs||[]).includes(identity.slug)).sort((a,b)=>severityRank(b.severity)-severityRank(a.severity));
    if(!hazards.length)return;installStyles();
    const stack=document.createElement('section');stack.className='orma-hazard-stack';stack.setAttribute('aria-label','Current area warnings');
    hazards.forEach(item=>{const card=document.createElement('article');card.className=`orma-hazard is-${item.severity}`;
      const title=document.createElement('strong');title.textContent=item.state==='resolution-review'?`${item.title} · awaiting removal review`:item.title;
      const copy=document.createElement('p');copy.textContent=item.message;
      const detail=document.createElement('small');const source=document.createElement('a');source.href=item.sourceUrl;source.target='_blank';source.rel='noopener';source.textContent=`Check ${item.sourceLabel} ↗`;
      detail.append(source,document.createTextNode(`${item.expiresAt?` · source expiry ${new Date(item.expiresAt).toLocaleString()}`:''}`));card.append(title,copy,detail);stack.append(card);});
    const anchor=document.querySelector('.sp-badges')||document.querySelector('main h1')||document.querySelector('main');
    if(anchor?.parentNode)anchor.insertAdjacentElement(anchor.classList.contains('sp-badges')?'afterend':'afterend',stack);
  }
  load().catch(()=>{});
})();
