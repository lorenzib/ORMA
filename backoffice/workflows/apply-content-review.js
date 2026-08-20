'use strict';

const fs = require('fs');
const path = require('path');

function safeSourcePath(root, sourceRef){
  if(typeof sourceRef !== 'string' || !sourceRef) throw new Error('Review packet has no sourceRef');
  const resolved = path.resolve(root, sourceRef);
  if(resolved === root || !resolved.startsWith(`${root}${path.sep}`)) throw new Error('Review packet sourceRef is outside the project');
  return resolved;
}

function applyExactChanges(source, changes){
  let next = source;
  for(const change of changes || []){
    if(typeof change.before !== 'string' || !change.before || typeof change.after !== 'string') throw new Error('Approved copy change is incomplete');
    const first = next.indexOf(change.before);
    if(first === -1) throw new Error(`Approved text was not found: ${change.section || 'unnamed section'}`);
    if(next.indexOf(change.before, first + change.before.length) !== -1) throw new Error(`Approved text is ambiguous: ${change.section || 'unnamed section'}`);
    next = `${next.slice(0, first)}${change.after}${next.slice(first + change.before.length)}`;
  }
  return next;
}

function applyReviewChanges(source,changes){
  let next=source;
  for(const change of changes||[]){
    if(typeof change.before!=='string'||!change.before||typeof change.after!=='string') throw new Error('Approved copy change is incomplete');
    const anchors=[change.before,...(change.beforeAlternatives||[])].filter((value,index,array)=>typeof value==='string'&&value&&array.indexOf(value)===index);
    const matches=anchors.map(anchor=>({anchor,index:next.indexOf(anchor)})).filter(match=>match.index!==-1);
    if(matches.length){
      if(matches.length>1) throw new Error(`Approved text is ambiguous: ${change.section||'unnamed section'}`);
      const {anchor,index}=matches[0];
      if(next.indexOf(anchor,index+anchor.length)!==-1) throw new Error(`Approved text is ambiguous: ${change.section||'unnamed section'}`);
      next=`${next.slice(0,index)}${change.after}${next.slice(index+anchor.length)}`;
      continue;
    }
    const afterIndex=next.indexOf(change.after);
    if(afterIndex===-1||next.indexOf(change.after,afterIndex+change.after.length)!==-1) throw new Error(`Approved text was not found: ${change.section||'unnamed section'}`);
  }
  return next;
}

async function applyContentReview(root, execution, decisions){
  const outcomes = [];
  const decisionByJob = new Map((decisions || []).map(item => [item.jobId, item]));
  for(const output of execution.outputs || []){
    const decision = decisionByJob.get(output.jobId);
    if(!decision) continue;
    if(decision.action !== 'approve'){
      outcomes.push({ jobId: output.jobId, action: decision.action, status: decision.action === 'request-revision' ? 'revision-queued' : 'rejected' });
      continue;
    }
    try {
      if(output.agentId === 'visualDirector'){
        const candidates = (output.result?.candidates || []).filter(candidate => candidate.status === 'ready');
        if(candidates.length !== 1) throw new Error('Exactly one ready picture candidate is required for automatic placement');
        const candidate = candidates[0];
        const placement = candidate.placement;
        if(!placement?.sourceRef || !placement.before || typeof placement.after !== 'string') throw new Error('Approved picture has no exact placement instruction');
        const asset = safeSourcePath(root, candidate.assetUrl);
        await fs.promises.access(asset);
        const target = safeSourcePath(root, placement.sourceRef);
        const source = await fs.promises.readFile(target, 'utf8');
        const updated = applyReviewChanges(source, [{ section: 'Picture placement', before: placement.before, after: placement.after }]);
        await fs.promises.writeFile(target, updated, 'utf8');
        outcomes.push({
          jobId: output.jobId, action: 'approve', status: 'applied-locally', sourceRefs: [placement.sourceRef, candidate.assetUrl],
          patches: [{ sourceRef: placement.sourceRef, changes: [{ section: 'Picture placement', before: placement.before, after: placement.after }] }],
          assetRefs: [candidate.assetUrl],
        });
        continue;
      }
      const target = safeSourcePath(root, execution.subject && execution.subject.sourceRef);
      const source = await fs.promises.readFile(target, 'utf8');
      const updated = applyReviewChanges(source, output.result && output.result.changes);
      await fs.promises.writeFile(target, updated, 'utf8');
      outcomes.push({
        jobId: output.jobId, action: 'approve', status: 'applied-locally', sourceRefs: [execution.subject.sourceRef],
        patches: [{ sourceRef: execution.subject.sourceRef, changes: output.result && output.result.changes }], assetRefs: [],
      });
    } catch(error){ outcomes.push({ jobId: output.jobId, action: 'approve', status: 'blocked', message: error.message }); }
  }
  return outcomes;
}

function recordVerifiedTrailReview(execution, decisions){
  const outputByJob = new Map((execution?.outputs || []).map(output => [output.jobId, output]));
  return (decisions || []).map(decision => {
    const output = outputByJob.get(decision.jobId);
    if(!output) return { jobId: decision.jobId, action: decision.action, status: 'blocked', message: 'Verified-trail review output was not found' };
    if(decision.action === 'request-revision') return { jobId: decision.jobId, action: decision.action, status: 'revision-queued' };
    if(decision.action === 'reject') return { jobId: decision.jobId, action: decision.action, status: 'rejected' };
    return {
      jobId: decision.jobId, action: 'approve',
      status: output.agentId === 'visualDirector' ? 'asset-and-licensing-approved' : 'editorial-approved',
      message: 'Approval recorded for the next staging step. No public file was changed.',
    };
  });
}

function assertVerifiedTrailReviewDecisions(execution,decisions){
  const outputs=new Map((execution?.outputs||[]).map(output=>[output.jobId,output]));
  for(const decision of decisions||[]){
    const output=outputs.get(decision.jobId);if(!output)throw new Error(`Verified-trail review output was not found: ${decision.jobId}`);
    if(decision.action!=='approve')continue;
    if(output.status!=='ready-for-review')throw new Error(`Only a ready proposal can be approved: ${decision.jobId}`);
    if(output.agentId==='visualDirector'){
      const ready=(output.result?.candidates||[]).filter(candidate=>candidate.status==='ready');
      if(ready.length!==1)throw new Error('Visual approval requires exactly one fully licensed ready image');
    }
  }
}

module.exports = { safeSourcePath, applyExactChanges, applyReviewChanges, applyContentReview, recordVerifiedTrailReview,assertVerifiedTrailReviewDecisions };
