'use strict';

const fs=require('fs/promises');
const path=require('path');
const {guideInventory,runGuideContent,runPageContent}=require('./run-guide-content');
const {contentFingerprint,fingerprint,selectEditorialWork,recordEditorialOutcome}=require('./editorial-ledger');

const PRIORITY_EDITORIAL_PAGES=Object.freeze([
  {pageId:'privacy',sourceRef:'privacy.html',reviewIntervalDays:180},
  {pageId:'terms',sourceRef:'terms.html',reviewIntervalDays:180},
]);

async function readJson(file,fallback=null){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}}
async function writeJson(file,value){await fs.writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');}
function packetFingerprint(packet){return fingerprint(JSON.stringify(packet));}
function sourcesFingerprint(packet){return fingerprint((packet.outputs||[]).flatMap(output=>output.result?.sources||[]).map(source=>`${source.url}|${source.checkedAt||''}`).sort().join('\n'));}

async function runEditorialCycle(root,options={}){
  const at=options.at||new Date().toISOString();const limit=options.limit||3;const data=path.join(root,'backoffice-data');
  const packetPaths=Array.from({length:limit},(_,index)=>path.join(data,`editorial-review-packet-${index+1}.json`));
  let ledger=await readJson(path.join(data,'editorial-ledger.json'),{contractVersion:'1.0.0',items:[]});
  const records=new Map((ledger.items||[]).map(item=>[item.contentId,item]));
  const packetRecords=(await Promise.all(packetPaths.map(async file=>({file,packet:await readJson(file)})))).filter(item=>item.packet);
  const active=[];
  for(const item of packetRecords){
    const contentId=`${item.packet.subject?.type}-${item.packet.subject?.id}`;const record=records.get(contentId);let currentFingerprint=null;
    try{currentFingerprint=contentFingerprint(await fs.readFile(path.resolve(root,item.packet.subject.sourceRef),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(record?.status==='in-review'&&record.activePacketFingerprint===packetFingerprint(item.packet)&&record.contentFingerprint===currentFingerprint&&(item.packet.outputs||[]).some(output=>output.status==='ready-for-review')) active.push(item);
  }
  const activeFiles=new Set(active.map(item=>item.file));const activeIds=new Set(active.map(item=>`${item.packet.subject.type}-${item.packet.subject.id}`));
  const freePaths=packetPaths.filter(file=>!activeFiles.has(file));
  const inventory=await guideInventory(root);const candidates=[];
  for(const page of PRIORITY_EDITORIAL_PAGES){
    const file=path.resolve(root,page.sourceRef);
    try{
      const html=await fs.readFile(file,'utf8');const current=contentFingerprint(html);const contentId=`page-${page.pageId}`;
      if(!activeIds.has(contentId)) candidates.push({...page,contentId,type:'page',contentFingerprint:current,packetFingerprint:current,priorityPage:true,safetyCritical:false});
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  for(const guide of inventory){
    const html=await fs.readFile(guide.file,'utf8');const current=contentFingerprint(html);const contentId=`guide-${guide.id}`;
    if(!activeIds.has(contentId)) candidates.push({contentId,type:'guide',guideId:guide.id,sourceRef:path.relative(root,guide.file),contentFingerprint:current,packetFingerprint:current,safetyCritical:/heat|water|altitude|paw|plant|livestock|safety|emergency/i.test(guide.id)});
  }
  const selected=selectEditorialWork(candidates,ledger,{asOf:at,limit:freePaths.length});const generated=[];const blocked=[];
  for(let index=0;index<selected.length;index++){
    const candidate=selected[index];const file=freePaths[index];
    try{
      const packet=candidate.type==='page'
        ? await (options.runPage||runPageContent)(root,{pageId:candidate.pageId,sourceRef:candidate.sourceRef,at,...(options.runPageOptions||{})})
        : await (options.runGuide||runGuideContent)(root,{guideId:candidate.guideId,at,...(options.runGuideOptions||{})});
      packet.workstream='website-editorial';packet.subject.safetyCritical=candidate.safetyCritical;packet.subject.reviewIntervalDays=candidate.reviewIntervalDays||42;
      await writeJson(file,packet);
      if(packet.summary.readyForReview){
        ledger=recordEditorialOutcome(ledger,{at,contentId:candidate.contentId,type:candidate.type,sourceRef:candidate.sourceRef,action:'in-review',contentFingerprint:candidate.contentFingerprint,sourcesFingerprint:sourcesFingerprint(packet),packetFingerprint:packetFingerprint(packet),safetyCritical:candidate.safetyCritical,reviewIntervalDays:candidate.reviewIntervalDays||42});
        generated.push({contentId:candidate.contentId,file:path.basename(file)});
      }else blocked.push({contentId:candidate.contentId,error:(packet.outputs||[]).map(output=>output.error).filter(Boolean).join(' · ')||'No reviewable copy was produced'});
    }catch(error){blocked.push({contentId:candidate.contentId,error:error.message});}
  }
  await writeJson(path.join(data,'editorial-ledger.json'),ledger);
  return {preserved:active.map(item=>`${item.packet.subject.type}-${item.packet.subject.id}`),generated,blocked,availableSlots:freePaths.length-generated.length};
}

module.exports={PRIORITY_EDITORIAL_PAGES,packetFingerprint,sourcesFingerprint,runEditorialCycle};
