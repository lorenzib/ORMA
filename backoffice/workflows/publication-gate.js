'use strict';

function clean(value,maximum=1000){return String(value||'').trim().replace(/\s+/g,' ').slice(0,maximum);}

function evaluatePublicationGate(runs,commitSha){
  const sha=clean(commitSha,120);
  const completed=(Array.isArray(runs)?runs:[])
    .filter(run=>run&&run.status==='completed'&&(!sha||run.head_sha===sha))
    .sort((left,right)=>new Date(right.updated_at||right.created_at||0)-new Date(left.updated_at||left.created_at||0));
  const latest=completed[0];
  if(!latest)return {
    allowed:false,status:'blocked',conclusion:'missing',commitSha:sha||null,validationRunUrl:null,
    message:`Website publication is paused because Validate ORMA has no completed result for commit ${sha||'unknown'}. Queue and agent work may continue; approvals stay saved.`,
  };
  if(latest.conclusion==='success')return {
    allowed:true,status:'open',conclusion:'success',commitSha:sha||latest.head_sha||null,
    validationRunUrl:latest.html_url||null,message:'Website publication gate is open because Validate ORMA passed for this commit.',
  };
  return {
    allowed:false,status:'blocked',conclusion:clean(latest.conclusion,80)||'unknown',commitSha:sha||latest.head_sha||null,
    validationRunUrl:latest.html_url||null,
    message:`Website publication is paused because Validate ORMA concluded ${clean(latest.conclusion,80)||'without a result'} for this commit. Queue and agent work may continue; approvals stay saved.`,
  };
}

module.exports={clean,evaluatePublicationGate};
