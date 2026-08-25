'use strict';

const fs=require('fs/promises');
const path=require('path');
const {runEditorialCycle}=require('./run-editorial-cycle');
const {auditImageCoverage}=require('./audit-image-coverage');
const {runProductDiscovery}=require('./run-product-discovery');
const {runNewsletter,newsletterIsDue}=require('./run-newsletter');

async function readJson(file,fallback=null){
  try{return JSON.parse(await fs.readFile(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return fallback;throw error;}
}

async function writeJson(file,value){
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');
}

async function hydrate(store,root,artifactId,relativePath,fallback=null){
  const target=path.join(root,relativePath);
  const protectedValue=await store.getArtifact(artifactId);
  const value=protectedValue||await readJson(target,fallback);
  if(value)await writeJson(target,value);
  else await fs.rm(target,{force:true});
  return value;
}

function mergeProductPackets(previous,fresh,reviewLedger){
  if(!previous)return fresh;
  const terminal=new Set((reviewLedger?.decisions||[]).filter(item=>['park','dismiss'].includes(item.action)).map(item=>item.ideaId));
  const unresolved=(previous.ideas||[]).filter(idea=>!terminal.has(idea.id));const seen=new Set(unresolved.map(idea=>idea.id));
  const ideas=[...unresolved,...(fresh.ideas||[]).filter(idea=>!seen.has(idea.id))].slice(0,12);
  return {...fresh,ideas,summary:{total:ideas.length,awaitingReview:ideas.length,highImpact:ideas.filter(idea=>idea.impact==='high').length,categories:[...new Set(ideas.map(idea=>idea.category))]},preservedIdeaIds:unresolved.map(idea=>idea.id)};
}

function publishedTrailInputs(publication,publicationRequests){
  const staged=new Map((publication?.items||[]).map(item=>[item.candidateId,item]));
  const receipts=(publicationRequests?.requests||[]).filter(item=>item.status==='published');
  if(receipts.length)return receipts.map(receipt=>({...staged.get(receipt.candidateId),...receipt,state:'published',status:'published'}));
  return (publication?.items||[]).filter(item=>['published','deployed'].includes(item.state)||item.status==='published');
}

function buildNewsletterInputs({at,publication,publicationRequests,ledger,hazards,ideas,newsletterEnabled=false}){
  const cutoff=new Date(at).getTime()-14*24*60*60*1000;
  return {contractVersion:'1.0.0',generatedAt:at,issueCadence:'every-14-days-after-launch',status:newsletterEnabled?'ready-for-newsletter-agent':'parked-awaiting-content-readiness',publicMutationAllowed:false,
    newlyPublishedTrails:publishedTrailInputs(publication,publicationRequests),
    publishedEditorialChanges:(ledger?.items||[]).filter(item=>item.status==='published'&&new Date(item.lastPublishedAt||0).getTime()>=cutoff),
    timelySafetySignals:(hazards?.hazards||[]).filter(item=>item.state==='active').map(item=>({title:item.title,area:item.area,sourceLabel:item.sourceLabel,sourceUrl:item.sourceUrl,expiresAt:item.expiresAt,note:'Topic signal only; do not describe as a trail closure.'})),
    currentEditorialSignals:(ideas?.ideas||[]).filter(item=>item.category==='editorial-gap'),
    policy:'Use only approved ORMA facts and directly linked current sources. One assembled issue receives one CEO review.'};
}

async function runLiveStrategyCycle(store,options={}){
  const root=options.root||path.resolve(__dirname,'../..');
  const at=options.at||new Date().toISOString();
  const runId=options.runId||process.env.GITHUB_RUN_ID||null;
  const workflowRunUrl=options.workflowRunUrl||null;
  const newsletterEnabled=options.newsletterEnabled===true;
  const metadata={runId,workflowRunUrl,publicMutationAllowed:false};
  const statusBase={contractVersion:'1.0.0',runId,workflowRunUrl,startedAt:at,publicMutationAllowed:false};
  await store.setArtifact('strategy-cycle-status',{...statusBase,status:'running'});
  try{
    await hydrate(store,root,'editorial-ledger','backoffice-data/editorial-ledger.json',{contractVersion:'1.0.0',items:[]});
    await hydrate(store,root,'editorial-paused-packets','backoffice-data/editorial-paused-packets.json',{contractVersion:'1.0.0',updatedAt:null,reason:'safety-library-ui-review',packets:[]});
    for(let slot=1;slot<=3;slot++)await hydrate(store,root,`editorial-review-packet-${slot}`,`backoffice-data/editorial-review-packet-${slot}.json`,null);

    const editorial=await (options.runEditorialCycle||runEditorialCycle)(root,{at,limit:3,...(options.editorialOptions||{})});
    const ledger=await readJson(path.join(root,'backoffice-data/editorial-ledger.json'),{contractVersion:'1.0.0',items:[]});
    const pausedPackets=await readJson(path.join(root,'backoffice-data/editorial-paused-packets.json'),{contractVersion:'1.0.0',updatedAt:null,reason:'safety-library-ui-review',packets:[]});
    await Promise.all([store.setArtifact('editorial-ledger',ledger,metadata),store.setArtifact('editorial-paused-packets',pausedPackets,metadata)]);
    const packets=[];
    for(let slot=1;slot<=3;slot++){
      const packet=await readJson(path.join(root,`backoffice-data/editorial-review-packet-${slot}.json`),null);
      if(packet){packets.push(packet);await store.setArtifact(`editorial-review-packet-${slot}`,packet,{...metadata,slot});}
      else await store.setArtifact(`editorial-review-packet-${slot}`,{contractVersion:'1.0.0',generatedAt:at,status:'empty',subject:null,outputs:[],summary:{readyForReview:0,blocked:0},publicMutationAllowed:false},{...metadata,slot,status:'empty'});
    }

    const imageAudit=await (options.auditImageCoverage||auditImageCoverage)(root,{at});
    await store.setArtifact('image-coverage',imageAudit,metadata);

    const productReview=await store.getArtifact('product-ideas-review')||await readJson(path.join(root,'backoffice-data/product-ideas-review.json'),{contractVersion:'1.0.0',decisions:[],jobs:[]});
    await store.setArtifact('product-ideas-review',productReview,metadata);
    const previousProduct=await store.getArtifact('product-ideas')||await readJson(path.join(root,'backoffice-data/product-ideas.json'),null);
    const productAge=previousProduct?.generatedAt?new Date(at).getTime()-new Date(previousProduct.generatedAt).getTime():Infinity;
    let productPacket=previousProduct;let productStatus='still-fresh';
    if(productAge>=6.5*24*60*60*1000){
      try{const fresh=await (options.runProductDiscovery||runProductDiscovery)({at,...(options.productOptions||{})});productPacket=mergeProductPackets(previousProduct,fresh,productReview);await store.setArtifact('product-ideas',productPacket,metadata);productStatus=`${productPacket.summary.total} ideas ready`;}
      catch(error){productStatus=`blocked: ${error.message}`;}
    }else if(productPacket)await store.setArtifact('product-ideas',productPacket,metadata);

    const [publication,publicationRequests,hazards,protectedNewsletterLedger,previousNewsletter]=await Promise.all([
      store.getArtifact('publication-staging'),store.getArtifact('publication-requests'),store.getArtifact('dynamic-hazards'),store.getArtifact('newsletter-review-ledger'),store.getArtifact('newsletter-review-packet'),
    ]);
    const newsletterLedger=protectedNewsletterLedger||await readJson(path.join(root,'backoffice-data/newsletter-review.json'),{contractVersion:'1.0.0',decisions:[]});
    await store.setArtifact('newsletter-review-ledger',newsletterLedger,metadata);
    const newsletterInputs=buildNewsletterInputs({at,publication,publicationRequests,ledger,hazards,ideas:productPacket,newsletterEnabled});await store.setArtifact('newsletter-inputs',newsletterInputs,metadata);
    let newsletterPacket=previousNewsletter||await readJson(path.join(root,'backoffice-data/newsletter-review-packet.json'),null);let newsletterStatus=newsletterEnabled?'not due':'parked until content readiness';
    if(newsletterEnabled&&newsletterIsDue(newsletterPacket,newsletterLedger,at)){
      newsletterPacket=await (options.runNewsletter||runNewsletter)(newsletterInputs,{root,at,...(options.newsletterOptions||{})});await store.setArtifact('newsletter-review-packet',newsletterPacket,metadata);
      newsletterStatus=newsletterPacket.summary.readyForReview?'draft ready':`blocked: ${newsletterPacket.outputs?.[0]?.error||'no draft produced'}`;
    }else if(newsletterPacket)await store.setArtifact('newsletter-review-packet',newsletterPacket,metadata);
    const summary={
      editorialActive:packets.filter(packet=>(packet.outputs||[]).some(output=>output.status==='ready-for-review')).length,
      editorialPreserved:editorial.preserved.length,
      editorialGenerated:editorial.generated.length,
      editorialPaused:Number(editorial.paused?.length||0),
      editorialBlocked:editorial.blocked.length,
      imagePagesScanned:Number(imageAudit.summary?.pagesScanned||0),
      imageGaps:Number(imageAudit.summary?.missing||0),
      productIdeas:Number(productPacket?.ideas?.length||0),
      productStatus,
      newsletterStatus,
      newsletterReady:Number(newsletterPacket?.summary?.readyForReview||0),
    };
    const completedAt=options.completedAt||new Date().toISOString();
    await store.setArtifact('strategy-cycle-status',{...statusBase,status:'healthy',completedAt,lastSuccessfulAt:completedAt,summary,failures:editorial.blocked,publicMutationAllowed:false});
    return {editorial,packets,ledger,imageAudit,productPacket,productStatus,newsletterInputs,newsletterPacket,newsletterStatus,summary};
  }catch(error){
    const failedAt=new Date().toISOString();
    await store.setArtifact('strategy-cycle-status',{...statusBase,status:'failed',completedAt:failedAt,lastFailure:{failedAt,stage:'editorial-and-image-refresh',message:String(error.message||error).slice(0,2000),workflowRunUrl},publicMutationAllowed:false});
    throw error;
  }
}

module.exports={readJson,writeJson,hydrate,mergeProductPackets,publishedTrailInputs,buildNewsletterInputs,runLiveStrategyCycle};
