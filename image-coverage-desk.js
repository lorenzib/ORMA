(function(){
  'use strict';
  let audit=null;let review={decisions:[],jobs:[]};
  async function json(url,fallback){try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json():fallback;}catch(error){return fallback;}}
  function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
  function setState(text,error=false){const el=document.getElementById('imageCoverageState');el.textContent=text;el.className=`bo-state${error?' is-error':''}`;}
  function decisionFor(slug){return (review.decisions||[]).find(item=>item.slug===slug);}
  function actionLabel(action){return ({'use-orma-library':'Review ORMA image','find-licensed':'Find licensed image','generate-ai':'Prepare AI option','park':'Park'})[action]||action;}

  async function decide(gap,action,note,assetSelect,button){
    button.disabled=true;setState('Saving the image brief…');
    try{
      const response=await fetch('/api/image-coverage/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:gap.slug,action,note,assetRef:assetSelect?.value||null})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save image route');
      review=result.review;render();
      setState(action==='park'?'Gap parked. No image work was queued.':`${actionLabel(action)} queued for the Visual Director. It will return here for asset approval; nothing was published.`);
    }catch(error){setState(`Could not save: ${error.message}. Make sure the backoffice background service is running.`,true);}
    finally{button.disabled=false;}
  }

  function libraryCandidates(gap){
    const ormaMatches=gap.libraryMatches.filter(match=>match.source==='orma-library');
    if(!ormaMatches.length)return null;
    const wrap=node('div','bo-library-candidates');wrap.append(node('strong','', 'Possible owned matches'));
    const select=node('select','bo-asset-select');select.setAttribute('aria-label',`Owned image for ${gap.title}`);
    ormaMatches.forEach(match=>{
      const option=node('option','',`${match.fileName} · matched ${match.matchedTerms.join(', ')}`);option.value=match.sourceRef||match.fileName;select.append(option);
    });
    const preview=node('img','bo-library-preview');
    const update=()=>{const match=ormaMatches.find(item=>(item.sourceRef||item.fileName)===select.value);preview.src=match?.sourceRef||'';preview.alt=`Possible image for ${gap.title}`;};
    select.addEventListener('change',update);wrap.append(select,preview);update();return {wrap,select};
  }

  function card(gap){
    const decision=decisionFor(gap.slug);const article=node('article',`bo-image-gap-card${decision?' is-decided':''}`);
    const top=node('div','bo-image-gap-head');const copy=node('div');copy.append(node('span','bo-stream-type',gap.priority==='high'?'High-priority gap':'Coverage gap'),node('h3','',gap.title));
    const page=node('a','bo-source-pill','Open current page ↗');page.href=gap.sourceRef;page.target='_blank';top.append(copy,page);article.append(top);
    const reasons=node('ul','bo-image-reasons');gap.reasons.forEach(reason=>reasons.append(node('li','',reason)));article.append(reasons);
    const candidates=libraryCandidates(gap);if(candidates)article.append(candidates.wrap);
    else article.append(node('p','bo-no-match','No likely filename match was found in the ORMA repository. Use the protected hosted desk to upload your own photograph, or request another source.'));
    const controls=node('div','bo-idea-controls');const note=node('textarea');note.placeholder='Optional: location, shoot, folder, dog, framing or other direction…';note.value=decision?.note||'';controls.append(note);
    const actions=node('div','bo-actions');const choices=[
      ...(candidates?[['use-orma-library','Use selected ORMA image']]:[]),
      ['find-licensed','Find licensed image'],['generate-ai','Prepare AI option'],['park','Park'],
    ];
    choices.forEach(([action,label])=>{const button=node('button',decision?.action===action?'is-selected':'',label);button.dataset.action=action;button.addEventListener('click',()=>decide(gap,action,note.value,candidates?.select,button));actions.append(button);});
    controls.append(actions,node('small','bo-decision',decision?`Saved ${new Date(decision.reviewedAt).toLocaleString()} · ${actionLabel(decision.action)}`:'Awaiting your source decision.'));article.append(controls);return article;
  }

  function render(){
    document.getElementById('imagePagesScanned').textContent=String(audit.summary.trailsScanned||audit.summary.pagesScanned);
    document.getElementById('imageMissingCount').textContent=String(audit.summary.missing);
    document.getElementById('imageCoveredCount').textContent=String(audit.summary.covered);
    document.getElementById('imageJobsCount').textContent=String((review.jobs||[]).filter(job=>job.status==='queued').length);
    document.getElementById('imageLibraryStatus').textContent=`ORMA repository: ${audit.library.ormaAssetsScanned} images scanned. Upload your own photograph from the protected hosted backoffice.`;
    const grid=document.getElementById('imageGapGrid');grid.replaceChildren(...audit.gaps.map(card));
  }

  async function load(){
    [audit,review]=await Promise.all([json('backoffice-data/image-coverage.json',null),json('backoffice-data/image-coverage-review.json',{decisions:[],jobs:[]})]);
    if(!audit){setState('No image coverage scan is available yet. Select “Scan website now”.',true);return;}
    render();setState(`Coverage scanned ${new Date(audit.generatedAt).toLocaleString()} · ${audit.summary.missing} trail-photo gaps are ready for routing.`);
  }

  document.getElementById('scanImageCoverage').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;setState('Scanning published trails and owned image indexes…');
    try{const response=await fetch('/api/image-coverage/scan',{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Scan failed');audit=result.audit;render();setState(`Fresh scan complete · ${audit.summary.missing} gaps found.`);}
    catch(error){setState(`Could not scan: ${error.message}`,true);}finally{event.currentTarget.disabled=false;}
  });
  load();
})();
