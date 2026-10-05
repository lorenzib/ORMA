'use strict';

function clean(value,maximum=1000){return String(value||'').trim().replace(/\s+/g,' ').slice(0,maximum);}

// Validation takes about ninety seconds, and the worker runs on a schedule that
// can land inside that window: on 2 October it checked 31 seconds after a push
// to main and found nothing completed. "Still running" is not "never ran" and
// is not "failed" -- publication must wait for all three, but only two of them
// are a fault, and reporting a run that will pass in a minute as blocked raises
// an alarm on the desk that nobody needs to answer.
function inFlight(runs,sha){
  return (Array.isArray(runs)?runs:[])
    .filter(run=>run&&run.status&&run.status!=='completed'&&(!sha||run.head_sha===sha))
    .sort((left,right)=>new Date(right.created_at||0)-new Date(left.created_at||0))[0]||null;
}

function evaluatePublicationGate(runs,commitSha){
  const sha=clean(commitSha,120);
  const completed=(Array.isArray(runs)?runs:[])
    .filter(run=>run&&run.status==='completed'&&(!sha||run.head_sha===sha))
    .sort((left,right)=>new Date(right.updated_at||right.created_at||0)-new Date(left.updated_at||left.created_at||0));
  const latest=completed[0];
  if(!latest){
    // Still withheld -- nobody knows yet whether this commit is good -- but the
    // answer is coming on its own, so it is a wait rather than something broken.
    const running=inFlight(runs,sha);
    if(running)return {
      allowed:false,pending:true,status:'pending',conclusion:clean(running.status,40)||'in-progress',
      commitSha:sha||running.head_sha||null,validationRunUrl:running.html_url||null,
      message:`Website publication is waiting for Validate ORMA, which is still running for commit ${sha||'unknown'}. Nothing is wrong; the next worker pass will publish if it passes.`,
    };
    return {
      allowed:false,pending:false,status:'blocked',conclusion:'missing',commitSha:sha||null,validationRunUrl:null,
      message:`Website publication is paused because Validate ORMA has no completed result for commit ${sha||'unknown'}. Queue and agent work may continue; approvals stay saved.`,
    };
  }
  if(latest.conclusion==='success')return {
    allowed:true,pending:false,status:'open',conclusion:'success',commitSha:sha||latest.head_sha||null,
    validationRunUrl:latest.html_url||null,message:'Website publication gate is open because Validate ORMA passed for this commit.',
  };
  return {
    allowed:false,pending:false,status:'blocked',conclusion:clean(latest.conclusion,80)||'unknown',commitSha:sha||latest.head_sha||null,
    validationRunUrl:latest.html_url||null,
    message:`Website publication is paused because Validate ORMA concluded ${clean(latest.conclusion,80)||'without a result'} for this commit. Queue and agent work may continue; approvals stay saved.`,
  };
}

module.exports={clean,inFlight,evaluatePublicationGate};
