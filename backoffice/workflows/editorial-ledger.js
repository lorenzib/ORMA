'use strict';

const crypto=require('crypto');
const {validateEditorialLedger}=require('../contracts/editorial-ledger-v1');

const DAY_MS=24*60*60*1000;
const PRIORITY=Object.freeze({
  'revision-requested':0,
  'safety-critical':1,
  core:2,
  gap:3,
  stale:4,
});

function editorialText(html){
  return String(html||'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}

function fingerprint(value){ return crypto.createHash('sha256').update(String(value||'')).digest('hex'); }
function contentFingerprint(html){ return fingerprint(editorialText(html)); }
function dateAt(value){ const date=new Date(value); if(Number.isNaN(date.getTime())) throw new Error('date is invalid'); return date; }
function addDays(value,days){ return new Date(dateAt(value).getTime()+days*DAY_MS).toISOString(); }

function eligibility(candidate,record,asOf){
  if(!record) return {eligible:true,reason:'gap',priority:PRIORITY.gap};
  if(record.status==='revision-requested') return {eligible:true,reason:'revision-requested',priority:PRIORITY['revision-requested']};
  if(record.status==='in-review'&&record.activePacketFingerprint===candidate.packetFingerprint) return {eligible:false,reason:'already-in-review'};
  if(record.contentFingerprint!==candidate.contentFingerprint) return {eligible:true,reason:candidate.safetyCritical?'safety-critical':'core',priority:candidate.safetyCritical?PRIORITY['safety-critical']:PRIORITY.core};
  if(candidate.sourcesFingerprint&&record.sourcesFingerprint!==candidate.sourcesFingerprint) return {eligible:true,reason:candidate.safetyCritical?'safety-critical':'stale',priority:candidate.safetyCritical?PRIORITY['safety-critical']:PRIORITY.stale};
  if(record.nextEligibleAt&&dateAt(record.nextEligibleAt)<=dateAt(asOf)) return {eligible:true,reason:candidate.safetyCritical?'safety-critical':'stale',priority:candidate.safetyCritical?PRIORITY['safety-critical']:PRIORITY.stale};
  return {eligible:false,reason:'cooldown'};
}

function selectEditorialWork(candidates,ledger,options={}){
  const asOf=options.asOf||new Date().toISOString(); const limit=options.limit??1;
  const byId=new Map((ledger?.items||[]).map(item=>[item.contentId,item]));
  return candidates.map(candidate=>({...candidate,selection:eligibility(candidate,byId.get(candidate.contentId),asOf)}))
    .filter(candidate=>candidate.selection.eligible)
    .sort((a,b)=>a.selection.priority-b.selection.priority||a.contentId.localeCompare(b.contentId)).slice(0,limit);
}

function recordEditorialOutcome(ledger,input){
  const next={contractVersion:'1.0.0',updatedAt:input.at||new Date().toISOString(),items:[...(ledger?.items||[])]};
  const index=next.items.findIndex(item=>item.contentId===input.contentId); const previous=index===-1?{}:next.items[index];
  const status=input.action==='request-revision'?'revision-requested':input.action==='approve'?'published':input.action==='reject'?'rejected':'in-review';
  const intervalDays=input.safetyCritical?7:(input.reviewIntervalDays||42);
  const item={...previous,contentId:input.contentId,type:input.type,sourceRef:input.sourceRef,status,contentFingerprint:input.contentFingerprint,
    sourcesFingerprint:input.sourcesFingerprint||null,lastDecision:input.action,lastReviewedAt:next.updatedAt,
    lastPublishedAt:status==='published'?next.updatedAt:(previous.lastPublishedAt||null),nextEligibleAt:status==='revision-requested'?next.updatedAt:addDays(next.updatedAt,intervalDays),
    activePacketFingerprint:status==='in-review'?input.packetFingerprint:null};
  if(index===-1) next.items.push(item); else next.items[index]=item;
  const errors=validateEditorialLedger(next); if(errors.length) throw new Error(errors.join('; ')); return next;
}

module.exports={PRIORITY,editorialText,fingerprint,contentFingerprint,eligibility,selectEditorialWork,recordEditorialOutcome};
