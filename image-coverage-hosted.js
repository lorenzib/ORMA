(function(){
  'use strict';

  const state=document.getElementById('imageCoverageState');
  const grid=document.getElementById('imageGapGrid');
  const search=document.getElementById('trailImageSearch');
  const region=document.getElementById('trailImageRegion');
  let audit=null;let reviews=[];let results=[];let requests=[];let jobs=[];let remote=null;

  const el=(tag,cls,text)=>{const item=document.createElement(tag);if(cls)item.className=cls;if(text!==undefined)item.textContent=text;return item;};
  const set=(id,value)=>{const item=document.getElementById(id);if(item)item.textContent=String(value);};
  function stamp(value){if(!value)return 0;if(value.toDate)return value.toDate().getTime();if(value.seconds)return value.seconds*1000;return new Date(value).getTime()||0;}
  async function api(){if(window.ORMABackoffice)return window.ORMABackoffice;await new Promise(resolve=>window.addEventListener('dolopaws-auth-ready',resolve,{once:true}));return window.ORMABackoffice;}
  async function optional(target,id,fallback){const value=await target.getArtifact(id);if(value?.ok)return value.data;if(value?.error==='artifact-not-found')return fallback;throw new Error(`Could not load ${id}`);}
  function latest(slug){return reviews.filter(item=>item.slug===slug).sort((a,b)=>stamp(b.submittedAt)-stamp(a.submittedAt))[0]||null;}
  function resultFor(slug){return (results||[]).filter(item=>item.slug===slug).sort((a,b)=>new Date(b.generatedAt)-new Date(a.generatedAt))[0]||null;}
  function requestFor(slug){return (requests||[]).filter(item=>item.trailId===slug).sort((a,b)=>new Date(b.approvedAt||0)-new Date(a.approvedAt||0))[0]||null;}
  function jobFor(slug){return (jobs||[]).find(item=>item.slug===slug&&item.jobType==='hosted-image-sourcing'&&['queued','running'].includes(item.status))||null;}
  function routeLabel(action){return ({'use-orma-library':'ORMA-owned asset','upload-owner-photo':'uploaded photo','approve-uploaded-photo':'approved upload','approve-image-candidate':'approved image','find-licensed':'licensed-image research','generate-ai':'AI image brief',park:'parked'})[action]||action;}
  function message(text,error=false){state.classList.toggle('is-error',error);state.textContent=text;}

  async function decodeImage(file){
    if('createImageBitmap' in window)return createImageBitmap(file);
    const url=URL.createObjectURL(file);const image=new Image();
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Could not read this photo.'));image.src=url;});return image;}
    finally{URL.revokeObjectURL(url);}
  }

  async function prepareImage(file){
    if(!file||!/^image\/(?:jpeg|png|webp|avif)$/i.test(file.type||''))throw new Error('Choose a JPG, PNG, WebP or AVIF photo.');
    if(file.size>25*1024*1024)throw new Error('Choose a photo smaller than 25 MB.');
    const source=await decodeImage(file);let prepared=null;
    for(const maximum of [1600,1400,1200,1000]){
      const scale=Math.min(1,maximum/Math.max(source.width,source.height));const width=Math.max(1,Math.round(source.width*scale));const height=Math.max(1,Math.round(source.height*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d',{alpha:false}).drawImage(source,0,0,width,height);
      for(const quality of [0.82,0.70,0.58]){
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not prepare this photo.')),'image/jpeg',quality));
        if(blob.size<=560*1024){prepared={blob,width,height};break;}
      }
      if(prepared)break;
    }
    if(source.close)source.close();if(!prepared)throw new Error('This photo could not be compressed enough for the free publishing queue.');
    const stem=String(file.name||'trail-photo').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,120)||'trail-photo';
    return {file:new File([prepared.blob],`${stem}.jpg`,{type:'image/jpeg'}),width:prepared.width,height:prepared.height};
  }

  function publicationStatus(gap,review,result,request,job){
    if(request?.status==='published')return {label:'Live',tone:'is-ready',detail:'The approved photo is deployed on this trail.'};
    if(request?.status==='awaiting-pr-merge')return {label:'Publishing PR open',tone:'is-ready',detail:'The approved photo is in a reviewable pull request.'};
    if(request?.status==='pr-materialized')return {label:'Preparing publishing PR',tone:'is-running',detail:'The worker has materialized the approved photo.'};
    if(request?.status==='approved-for-pr-creation'||result?.status==='approved-for-pr-creation')return {label:'Approved for publishing',tone:'is-running',detail:'The next worker pass will prepare the repository change.'};
    if(review?.status==='queued'||review?.status==='processing')return {label:'Agent working',tone:'is-running',detail:`${routeLabel(review.action)} is being processed.`};
    if(job)return {label:'Agent working',tone:'is-running',detail:'Credited, correctly licensed photo candidates are being sourced.'};
    if((result?.candidates||[]).some(candidate=>candidate.status==='ready-for-asset-review'))return {label:'Preview needs approval',tone:'is-review',detail:'Check the exact image and rights information below.'};
    if(review?.status==='blocked')return {label:'Blocked',tone:'is-blocked',detail:review.error||'The saved image route needs attention.'};
    return {label:gap.region==='dolomites'?'Dolomites priority':'Photo needed',tone:'',detail:'Choose your own photo or another sourcing route.'};
  }

  async function submitRoute(gap,payload,button){
    if(button)button.disabled=true;message('Saving the trail-photo decision…');
    try{
      const response=await remote.submitImageReview({slug:gap.slug,trailId:gap.trailId||gap.slug,...payload});
      if(!response?.ok)throw new Error(response?.error||'unknown error');
      message(`Decision ${response.reviewId} saved. The image agent will collect it on the next worker pass.`);
      window.setTimeout(()=>window.location.reload(),1400);
    }catch(error){message(`Could not save: ${error.message}`,true);if(button)button.disabled=false;}
  }

  function uploadPanel(gap){
    const wrap=el('section','bo-trail-upload');wrap.append(el('h4','','Upload your photo'));
    wrap.append(el('p','bo-upload-helper','JPG, PNG, WebP or AVIF. ORMA compresses it locally, then sends your photo straight to a publishing pull request — your own photos need no second approval here. Check the preview below before you upload.'));
    const picker=el('input','bo-trail-upload__file');picker.type='file';picker.accept='image/jpeg,image/png,image/webp,image/avif';
    const preview=el('img','bo-trail-upload__preview');preview.alt='Selected trail photo preview';preview.hidden=true;
    const creator=el('input');creator.type='text';creator.placeholder='Photographer / creator';creator.value='Benedetta Lorenzi';creator.maxLength=160;
    const alt=el('input');alt.type='text';alt.placeholder=`Describe the photo for accessibility (for example: ${gap.title} in summer)`;alt.maxLength=500;
    const rightsKind=el('div','bo-trail-upload__rights-kind');const rightsKindLabel=el('label','','Photo rights');const rightsBasis=el('select');
    for(const [value,label] of [['orma-owned','I own this photo'],['permission-granted','I have permission from the creator']]){const option=el('option','',label);option.value=value;rightsBasis.append(option);}
    rightsKind.append(rightsKindLabel,rightsBasis);
    const rightsLabel=el('label','bo-trail-upload__rights');const rights=el('input');rights.type='checkbox';rightsLabel.append(rights,document.createTextNode(' I own this photo or have permission to publish it on ORMA.'));
    const upload=el('button','bo-primary-action','Upload and send to publishing');upload.type='button';upload.disabled=true;
    let prepared=null;
    picker.addEventListener('change',async()=>{
      upload.disabled=true;prepared=null;preview.hidden=true;
      try{prepared=await prepareImage(picker.files?.[0]);preview.src=URL.createObjectURL(prepared.file);preview.hidden=false;upload.disabled=false;}
      catch(error){message(error.message,true);picker.value='';}
    });
    upload.addEventListener('click',async()=>{
      if(!prepared||!rights.checked){message('Choose a photo and confirm that ORMA may publish it.',true);return;}
      if(!creator.value.trim()){message('Add the photographer or creator name.',true);return;}
      upload.disabled=true;picker.disabled=true;message(`Uploading a protected preview for ${gap.title}…`);
      const response=await remote.uploadTrailImage({file:prepared.file,trailId:gap.trailId||gap.slug,creator:creator.value.trim(),rightsBasis:rightsBasis.value,
        altText:alt.value.trim()||`${gap.title} trail`,width:prepared.width,height:prepared.height});
      if(!response?.ok){message(`Upload failed: ${response?.error||'unknown error'}`,true);upload.disabled=false;picker.disabled=false;return;}
      message('Photo uploaded. It goes straight to a publishing pull request for you to merge.');window.setTimeout(()=>window.location.reload(),1400);
    });
    wrap.append(picker,preview,creator,alt,rightsKind,rightsLabel,upload);return wrap;
  }

  async function attachCandidatePreview(image,candidate){
    if(candidate.assetUrl){image.src=/^https?:/i.test(candidate.assetUrl)?candidate.assetUrl:`https://app-orma.com/${String(candidate.assetUrl).replace(/^\//,'')}`;return;}
    if(candidate.uploadRef){const response=await remote.getTrailImagePreview(candidate.uploadRef);if(response?.ok)image.src=response.url;else image.replaceWith(el('p','bo-no-match','Protected preview could not be loaded.'));}
  }

  // A candidate is not required to carry an asset. The AI path deliberately
  // returns assetUrl:null with status needs-generation, and blocked rights land
  // the same way. Appending an <img> regardless left an empty picture frame with
  // no explanation, which is why the desk looked broken rather than busy.
  const NO_ASSET_COPY={
    'needs-generation':'No image yet. This candidate is an AI brief, not an asset.',
    'blocked':'No preview. Rights are blocked for this candidate.',
  };

  function candidatePreview(gap,candidate){
    if(candidate.assetUrl||candidate.uploadRef){
      const image=el('img');image.alt=candidate.altText||candidate.title||gap.title;
      attachCandidatePreview(image,candidate).catch(()=>image.replaceWith(el('p','bo-no-match','Preview unavailable.')));
      return image;
    }
    return el('p','bo-no-match',NO_ASSET_COPY[candidate.status]||'No image is attached to this candidate yet.');
  }

  function resultBlock(gap,result,request){
    const block=el('section','bo-expanded-research');block.append(el('strong','',result.summary||result.status||'Image agent result'));
    for(const candidate of result.candidates||[]){
      const item=el('article','bo-picture-candidate');
      item.append(candidatePreview(gap,candidate));
      item.append(el('h4','',candidate.title||gap.title),el('p','',candidate.rightsEvidence||'Rights evidence still needs review.'),
        el('small','',`${candidate.creator||'Unknown creator'} · ${candidate.license||'Rights pending'} · ${String(candidate.status||'pending').replace(/-/g,' ')}`));
      if(candidate.sourcePageUrl){const source=el('a','bo-source-pill','Open source ↗');source.href=candidate.sourcePageUrl;source.target='_blank';source.rel='noopener';item.append(source);}
      if(candidate.licenseUrl){const licence=el('a','bo-source-pill','Licence ↗');licence.href=candidate.licenseUrl;licence.target='_blank';licence.rel='noopener';item.append(licence);}
      if(candidate.generationPrompt)item.append(el('p','bo-decision-next',`AI brief: ${candidate.generationPrompt}`));
      if(candidate.status==='ready-for-asset-review'&&candidate.uploadRef&&!request){
        const approve=el('button','bo-primary-action','Approve photo for publishing');approve.type='button';
        approve.addEventListener('click',()=>submitRoute(gap,{action:'approve-uploaded-photo',assetRef:candidate.uploadRef,uploadRef:candidate.uploadRef,
          fileName:candidate.title,mimeType:candidate.mimeType||'',fileSize:candidate.fileSize||0,width:candidate.width||0,height:candidate.height||0,
          creator:candidate.creator||'ORMA',rightsBasis:candidate.license==='Permission granted'?'permission-granted':'orma-owned',altText:candidate.altText||`${gap.title} trail`,
          note:'Exact uploaded preview and rights record approved for the trail-photo publication PR.'},approve));item.append(approve);
      }else if(candidate.status==='ready-for-asset-review'&&candidate.assetUrl&&!request){
        const approve=el('button','bo-primary-action','Approve this image for publishing');approve.type='button';
        approve.addEventListener('click',()=>submitRoute(gap,{action:'approve-image-candidate',assetRef:candidate.assetUrl,uploadRef:'',
          creator:candidate.creator||'ORMA',rightsBasis:candidate.license==='ORMA-owned'?'orma-owned':'licensed',altText:candidate.altText||`${gap.title} trail`,
          sourcePageUrl:candidate.sourcePageUrl||'',license:candidate.license||'',licenseUrl:candidate.licenseUrl||'',
          sourceType:String(candidate.assetUrl).startsWith('images/')?'orma-library':'licensed-source',
          note:'Exact image preview, source and rights record approved for the trail-photo publication PR.'},approve));item.append(approve);
      }
      block.append(item);
    }
    if(!(result.candidates||[]).length)block.append(el('p','bo-no-match','No actual asset is ready yet. Follow the agent result before approving publication.'));
    return block;
  }

  function sourcingControls(gap,owned,review,job){
    const controls=el('div','bo-idea-controls');const note=el('textarea');note.placeholder='Optional: exact location, season, framing, dog or visual direction';
    let select=null;if(owned.length){const library=el('div','bo-library-candidates');library.append(el('strong','','Possible ORMA repository matches'));select=el('select','bo-asset-select');
      for(const match of owned){const option=el('option','',match.fileName||match.sourceRef);option.value=match.sourceRef||match.fileName;select.append(option);}library.append(select);controls.append(library);}
    const actions=el('div','bo-actions');const choices=[...(owned.length?[['use-orma-library','Review selected ORMA image']]:[]),['find-licensed','Find licensed options'],['generate-ai','Prepare an AI option'],['park','Park for now']];
    const busy=(review&&['queued','processing'].includes(review.status))||Boolean(job);
    for(const [action,label] of choices){const button=el('button','',label);button.disabled=!!busy;button.addEventListener('click',()=>submitRoute(gap,{action,note:note.value,assetRef:select?.value||''},button));actions.append(button);}
    controls.append(note,actions);return controls;
  }

  function card(gap){
    const review=latest(gap.slug);const result=resultFor(gap.slug);const request=requestFor(gap.slug);const job=jobFor(gap.slug);const status=publicationStatus(gap,review,result,request,job);
    const article=el('article','bo-image-gap-card bo-trail-image-card');
    const top=el('div','bo-image-gap-head');const copy=el('div');copy.append(el('span',`bo-life-status ${status.tone}`,status.label),el('h3','',gap.title),
      el('p','bo-trail-image-meta',[gap.area,gap.valley].filter(Boolean).join(' · ')||gap.region));
    const link=el('a','bo-source-pill','Open trail ↗');link.href=`https://app-orma.com/trail.html?id=${encodeURIComponent(gap.trailId||gap.slug)}`;link.target='_blank';link.rel='noopener';top.append(copy,link);article.append(top,el('p','bo-decision-next',status.detail));
    if(result)article.append(resultBlock(gap,result,request));
    if(!request&&!['queued','processing'].includes(review?.status))article.append(uploadPanel(gap));
    const owned=(gap.libraryMatches||[]).filter(item=>item.source==='orma-library');if(!request)article.append(sourcingControls(gap,owned,review,job));
    if(review)article.append(el('small','bo-decision',review.status==='blocked'?`Blocked: ${review.error||'See the automation receipt.'}`:`Latest decision: ${routeLabel(review.action)} · ${review.status}.`));
    return article;
  }

  function filteredGaps(){
    const query=String(search?.value||'').trim().toLowerCase();const selected=region?.value||'dolomites';
    return (audit?.gaps||[]).filter(gap=>(selected==='all'||gap.region===selected)&&(!query||`${gap.title} ${gap.area} ${gap.valley}`.toLowerCase().includes(query)));
  }

  function render(){
    set('imagePagesScanned',audit.summary?.trailsScanned||audit.summary?.pagesScanned||0);set('imageMissingCount',audit.summary?.missing||0);set('imageDolomitesCount',audit.summary?.dolomitesMissing||0);
    const active=(jobs||[]).filter(job=>['hosted-image-sourcing','hosted-image-publication'].includes(job.jobType)&&['queued','running'].includes(job.status)).length;
    const publishing=(requests||[]).filter(request=>['approved-for-pr-creation','pr-materialized','awaiting-pr-merge'].includes(request.status)).length;
    set('imageJobsCount',active+publishing);const visible=filteredGaps();set('trailImageVisibleCount',`${visible.length} trail${visible.length===1?'':'s'} shown`);
    grid.replaceChildren(...visible.map(card));if(!visible.length)grid.append(el('p','bo-state','No missing trail photos match these filters.'));
  }

  async function load(){
    remote=await api();const [auditValue,reviewsValue,resultValue,statusValue,jobsValue,requestsValue]=await Promise.all([
      optional(remote,'image-coverage',null),remote.getImageReviews(),optional(remote,'image-coverage-results',{items:[]}),optional(remote,'trail-image-coverage-status',{}),remote.getRevisionJobs(),optional(remote,'trail-image-publication-requests',{requests:[]}),
    ]);
    if(!auditValue)throw new Error('No protected trail-photo coverage audit exists yet.');if(!reviewsValue?.ok)throw new Error('Could not load image decisions.');if(!jobsValue?.ok)throw new Error('Could not load image jobs.');
    audit=auditValue;reviews=reviewsValue.reviews||[];results=resultValue.items||[];jobs=jobsValue.jobs||[];requests=requestsValue.requests||[];render();
    state.classList.toggle('is-error',statusValue.status==='failed');state.textContent=statusValue.status==='failed'
      ?`Coverage refresh failed: ${statusValue.lastFailure?.message||'unknown failure'}`:`${audit.summary?.missing||0} trails need photos; ${audit.summary?.dolomitesMissing||0} are in the Dolomites.`;
  }

  search?.addEventListener('input',render);region?.addEventListener('change',render);load().catch(error=>message(error.message,true));
})();
