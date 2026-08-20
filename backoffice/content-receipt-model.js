(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ORMAContentReceiptModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function dateMs(value){
    if(!value)return 0;
    if(typeof value.toDate==='function')return value.toDate().getTime();
    if(value.seconds)return Number(value.seconds)*1000;
    const parsed=new Date(value).getTime();return Number.isNaN(parsed)?0:parsed;
  }
  function latestRevision(output,jobs){
    return (jobs||[]).filter(job=>job.jobId===output.jobId&&job.jobType!=='verified-trail-editorial-first-pass')
      .sort((a,b)=>dateMs(b.createdAt)-dateMs(a.createdAt))[0]||null;
  }
  function latestReceipt(output,reviews,jobs){
    const matches=(reviews||[]).flatMap(review=>(review.decisions||[]).filter(decision=>decision.jobId===output.jobId).map(decision=>({review,decision,at:dateMs(review.submittedAt)}))).sort((a,b)=>b.at-a.at);
    const current=matches[0]||null;if(!current)return null;
    const revision=latestRevision(output,jobs);const revisionAt=dateMs(revision?.completedAt);
    if(current.decision.action==='request-revision'&&revision?.status==='ready-for-review'&&revisionAt>current.at)return null;
    return current;
  }
  function stillNeedsApproval(output,staging){
    const item=(staging?.items||[]).find(candidate=>candidate.candidateId===output.candidateId);if(!item)return true;
    const gate=output.agentId==='visualDirector'?'asset-and-licensing-approval':'editorial-approval';return (item.missingApprovals||[]).includes(gate);
  }
  function receiptText(output,receipt,staging,jobs,formatDate=value=>new Date(value).toLocaleString()){
    if(!stillNeedsApproval(output,staging))return 'Approved and processed. This output has advanced to the next trail gate.';
    if(!receipt)return '';
    const action=receipt.decision.action.replace(/-/g,' ');const status=receipt.review.status||'queued';const at=dateMs(receipt.review.processedAt||receipt.review.submittedAt);const timestamp=at?formatDate(at):'recorded in Firestore';
    if(status==='queued')return `${action} saved in Firestore ${timestamp}. ORMA automation will collect it on its next successful run; Backoffice Home shows live health. You may close this page. Do not click again.`;
    if(status==='blocked')return `${action} could not be processed. The submission is retained and needs operator attention; do not submit a duplicate.`;
    const revision=latestRevision(output,jobs);
    if(receipt.decision.action==='request-revision'&&revision?.status==='blocked')return `Revision blocked after ${timestamp}. The submission is retained and needs operator attention.`;
    if(receipt.decision.action==='request-revision')return `Revision instruction processed ${timestamp}. The ${output.agentId==='visualDirector'?'Visual Director':'Copywriter'} is preparing the next proposal.`;
    if(receipt.decision.action==='reject')return `Rejected and processed ${timestamp}. This output will not advance.`;
    return `${action} processed ${timestamp}. This output has advanced.`;
  }
  return {dateMs,latestRevision,latestReceipt,stillNeedsApproval,receiptText};
});
