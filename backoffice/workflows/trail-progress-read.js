'use strict';

/**
 * Why one trail is not moving.
 *
 * Four trails sat at evidence-resolution with no blockers and no claimable
 * work, and two passes each moved none of them. "Nothing standing" read as
 * ready; it was a stall.
 *
 * Advancement out of evidence-resolution ends at queueProvenanceAudit, which
 * requires a COMPLETED job for each of the three base agents -- `latest()`
 * filters on status 'completed'. A base agent whose job ended blocked, or was
 * cancelled, or never ran, leaves the trail there for good: no blocker to
 * report, nothing queued, nothing to do. Nothing said so.
 */

const BASE_AGENTS=Object.freeze(['logistics','regulatoryRanger','terrainPoi']);

function agentOf(jobId){
  const match=/-(logistics|regulatoryRanger|terrainPoi|cartographer|evidenceLibrarian|redTeam)-\d+-/.exec(String(jobId||''));
  return match?match[1]:null;
}

/** The newest job per agent, by the timestamp its own id carries. */
function jobsByAgent(jobs){
  const byAgent=new Map();
  for(const job of jobs||[]){
    const agentId=job.agentId||agentOf(job.id);
    if(!agentId)continue;
    const current=byAgent.get(agentId);
    if(!current||String(job.id)>String(current.id))byAgent.set(agentId,job);
  }
  return byAgent;
}

/**
 * What the trail is waiting for, in the terms advancement actually uses.
 *
 * `blockedBy` is the answer the stall needed: the base agents with no completed
 * job, which is the condition that silently holds a trail at
 * evidence-resolution.
 */
function trailProgress(trail,jobs){
  const byAgent=jobsByAgent(jobs);
  const base=BASE_AGENTS.map(agentId=>{
    const job=byAgent.get(agentId)||null;
    return {agentId,status:job?String(job.status||'unknown'):'never ran',jobId:job?job.id:null};
  });
  const ledger=Object.values(trail?.claimResolution||{});
  return {
    trailId:trail?.trailId||trail?.candidateId||null,
    state:String(trail?.state||'unknown'),
    blockers:(trail?.blockers||[]).length,
    base,
    blockedBy:base.filter(entry=>entry.status!=='completed').map(entry=>entry.agentId),
    claims:{
      total:ledger.length,
      researchable:ledger.filter(e=>e.state==='researchable').length,
      supported:ledger.filter(e=>e.state==='supported').length,
      exhausted:ledger.filter(e=>e.state==='source-exhausted').length,
    },
    queued:(jobs||[]).filter(job=>String(job.status)==='queued').length,
  };
}

module.exports={BASE_AGENTS,agentOf,jobsByAgent,trailProgress};
