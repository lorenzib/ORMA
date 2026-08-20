'use strict';

const fs=require('fs/promises');
const path=require('path');
const {runEditorialCycle}=require('./run-editorial-cycle');
const {auditImageCoverage}=require('./audit-image-coverage');

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

async function runLiveStrategyCycle(store,options={}){
  const root=options.root||path.resolve(__dirname,'../..');
  const at=options.at||new Date().toISOString();
  const runId=options.runId||process.env.GITHUB_RUN_ID||null;
  const workflowRunUrl=options.workflowRunUrl||null;
  const metadata={runId,workflowRunUrl,publicMutationAllowed:false};
  const statusBase={contractVersion:'1.0.0',runId,workflowRunUrl,startedAt:at,publicMutationAllowed:false};
  await store.setArtifact('strategy-cycle-status',{...statusBase,status:'running'});
  try{
    await hydrate(store,root,'editorial-ledger','backoffice-data/editorial-ledger.json',{contractVersion:'1.0.0',items:[]});
    for(let slot=1;slot<=3;slot++)await hydrate(store,root,`editorial-review-packet-${slot}`,`backoffice-data/editorial-review-packet-${slot}.json`,null);

    const editorial=await (options.runEditorialCycle||runEditorialCycle)(root,{at,limit:3,...(options.editorialOptions||{})});
    const ledger=await readJson(path.join(root,'backoffice-data/editorial-ledger.json'),{contractVersion:'1.0.0',items:[]});
    await store.setArtifact('editorial-ledger',ledger,metadata);
    const packets=[];
    for(let slot=1;slot<=3;slot++){
      const packet=await readJson(path.join(root,`backoffice-data/editorial-review-packet-${slot}.json`),null);
      if(packet){packets.push(packet);await store.setArtifact(`editorial-review-packet-${slot}`,packet,{...metadata,slot});}
    }

    const imageAudit=await (options.auditImageCoverage||auditImageCoverage)(root,{at});
    await store.setArtifact('image-coverage',imageAudit,metadata);
    const summary={
      editorialActive:packets.filter(packet=>(packet.outputs||[]).some(output=>output.status==='ready-for-review')).length,
      editorialPreserved:editorial.preserved.length,
      editorialGenerated:editorial.generated.length,
      editorialBlocked:editorial.blocked.length,
      imagePagesScanned:Number(imageAudit.summary?.pagesScanned||0),
      imageGaps:Number(imageAudit.summary?.missing||0),
    };
    const completedAt=options.completedAt||new Date().toISOString();
    await store.setArtifact('strategy-cycle-status',{...statusBase,status:'healthy',completedAt,lastSuccessfulAt:completedAt,summary,failures:editorial.blocked,publicMutationAllowed:false});
    return {editorial,packets,ledger,imageAudit,summary};
  }catch(error){
    const failedAt=new Date().toISOString();
    await store.setArtifact('strategy-cycle-status',{...statusBase,status:'failed',completedAt:failedAt,lastFailure:{failedAt,stage:'editorial-and-image-refresh',message:String(error.message||error).slice(0,2000),workflowRunUrl},publicMutationAllowed:false});
    throw error;
  }
}

module.exports={readJson,writeJson,hydrate,runLiveStrategyCycle};
