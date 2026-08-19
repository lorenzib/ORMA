(function(){
  'use strict';
  const packetUrl='backoffice-data/product-ideas.json';
  const reviewUrl='backoffice-data/product-ideas-review.json';
  let packet=null;let review={decisions:[],jobs:[]};

  async function json(url,fallback){try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json():fallback;}catch(error){return fallback;}}
  function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
  function setState(text,error=false){const el=document.getElementById('productIdeasState');el.textContent=text;el.className=`bo-state${error?' is-error':''}`;}
  function decisionFor(id){return (review.decisions||[]).find(item=>item.ideaId===id);}
  function sourceLink(source){const a=node('a','bo-source-pill',source.label);a.href=source.url;a.target='_blank';a.rel='noopener';a.title=source.supports;return a;}

  async function decide(idea,action,note,button){
    button.disabled=true;setState('Saving your decision…');
    try{
      const response=await fetch('/api/product-ideas/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ideaId:idea.id,action,note})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save decision');
      review=result.review;render();
      setState(result.message||`Decision saved: ${action.replace('-', ' ')}. Nothing was built or published.`,result.researchStatus==='blocked');
    }catch(error){setState(`Could not save: ${error.message}. Make sure the backoffice background service is running.`,true);}
    finally{button.disabled=false;}
  }

  function card(idea){
    const decision=decisionFor(idea.id);const investigation=(review.jobs||[]).filter(job=>job.ideaId===idea.id).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];const article=node('article',`bo-idea-card${decision?' is-decided':''}`);
    const top=node('div','bo-idea-top');const category=node('span','bo-stream-type',idea.category.replace('-', ' '));const badges=node('div','bo-idea-badges');
    badges.append(node('span',`bo-impact is-${idea.impact}`,`${idea.impact} impact`),node('span','bo-confidence',`${idea.confidence} confidence`));top.append(category,badges);
    article.append(top,node('h3','',idea.title));
    const signal=node('div','bo-idea-section');signal.append(node('strong','', 'Market signal'),node('p','',idea.signal));article.append(signal);
    const opportunity=node('div','bo-idea-section is-opportunity');opportunity.append(node('strong','', 'ORMA opportunity'),node('p','',idea.ormaOpportunity));article.append(opportunity);
    const why=node('p','bo-idea-why',idea.whyNow);article.append(why);
    const details=node('details','bo-idea-investigation');const summary=node('summary','', 'Questions for deeper investigation');const list=node('ul');idea.suggestedInvestigation.forEach(item=>list.append(node('li','',item)));details.append(summary,list);article.append(details);
    if(investigation){
      const expanded=node('section',`bo-expanded-research is-${investigation.status}`);expanded.append(node('strong','',investigation.status==='ready-for-review'?'Expanded investigation':'Expanded investigation status'));
      if(investigation.result){
        expanded.append(node('p','',investigation.result.conclusion),node('span','bo-impact',`Recommendation: ${investigation.result.recommendation}`));
        const findings=node('ul');investigation.result.findings.forEach(item=>findings.append(node('li','',`${item.competitor}: ${item.finding} ORMA: ${item.implicationForOrma}`)));expanded.append(findings);
        const expandedSources=node('div','bo-source-links');investigation.result.sources.forEach(source=>expandedSources.append(sourceLink(source)));expanded.append(expandedSources);
      }else expanded.append(node('p','',investigation.error||`Research is ${investigation.status}.`));
      article.append(expanded);
    }
    const sources=node('div','bo-source-links');idea.sources.forEach(source=>sources.append(sourceLink(source)));article.append(sources);
    const controls=node('div','bo-idea-controls');const note=node('textarea');note.placeholder='Optional: tell the agent what to focus on…';note.value=decision?.note||'';controls.append(note);
    const actions=node('div','bo-actions');[
      ['prioritise','Send to designer'],['investigate-further','Investigate further'],['park','Park'],['dismiss','Dismiss'],
    ].forEach(([action,label])=>{const button=node('button',decision?.action===action?'is-selected':'',label);button.dataset.action=action;button.addEventListener('click',()=>decide(idea,action,note.value,button));actions.append(button);});
    controls.append(actions,node('small','bo-decision',decision?`Saved ${new Date(decision.reviewedAt).toLocaleString()} · ${decision.action.replace('-', ' ')}`:'Awaiting your decision.'));article.append(controls);
    return article;
  }

  function render(){
    document.getElementById('ideaReviewCount').textContent=String((packet.ideas||[]).filter(idea=>!decisionFor(idea.id)).length);
    document.getElementById('ideaHighImpactCount').textContent=String((packet.ideas||[]).filter(idea=>idea.impact==='high').length);
    document.getElementById('ideaResearchJobs').textContent=String((review.jobs||[]).length);
    document.getElementById('ideaExecutiveSummary').textContent=packet.executiveSummary;
    const grid=document.getElementById('productIdeaGrid');grid.replaceChildren(...packet.ideas.map(card));
  }

  async function load(){
    [packet,review]=await Promise.all([json(packetUrl,null),json(reviewUrl,{decisions:[],jobs:[]})]);
    if(!packet){setState('No product investigation packet is available yet.',true);return;}
    render();setState(`Research refreshed ${new Date(packet.generatedAt).toLocaleString()} · ${packet.ideas.length} opportunities. Sources open in their original pages.`);
  }

  document.getElementById('runProductDiscovery').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;setState('The agents are checking current product launches and evidence. This may take a few minutes…');
    try{const response=await fetch('/api/product-ideas/run',{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Research failed');packet=result.packet;render();setState(`New research packet ready · ${packet.ideas.length} opportunities.`);}
    catch(error){setState(`Could not refresh research: ${error.message}`,true);}finally{event.currentTarget.disabled=false;}
  });
  load();
})();
