'use strict';

const DEFAULT_API_BASE='https://api.github.com';
const DEFAULT_WORKFLOW_NAME='pages build and deployment';

function bounded(value,maximum=1000){return String(value||'').trim().slice(0,maximum);}

function validRepository(value){
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(bounded(value,200));
}

function selectSuccessfulPagesDeployment(runs,options={}){
  const workflowName=bounded(options.workflowName,200)||DEFAULT_WORKFLOW_NAME;
  const branch=bounded(options.branch,200)||'main';
  const commitSha=bounded(options.commitSha,80);
  const match=(Array.isArray(runs)?runs:[]).find(run=>
    run?.name===workflowName&&run?.head_branch===branch&&run?.conclusion==='success'&&
    (!commitSha||run?.head_sha===commitSha));
  if(!match)return null;
  return {
    found:true,
    commitSha:bounded(match.head_sha,80),
    deploymentRunUrl:bounded(match.html_url),
    deploymentRunId:Number(match.id)||null,
    createdAt:bounded(match.created_at,80)||null,
  };
}

async function findSuccessfulPagesDeployment(options={}){
  const repository=bounded(options.repository,200);
  const token=bounded(options.token,1000);
  const commitSha=bounded(options.commitSha,80);
  const branch=bounded(options.branch,200)||'main';
  const workflowName=bounded(options.workflowName,200)||DEFAULT_WORKFLOW_NAME;
  const apiBase=(bounded(options.apiBase)||DEFAULT_API_BASE).replace(/\/+$/,'');
  const fetchImpl=options.fetchImpl||global.fetch;
  if(!validRepository(repository))throw new Error('GitHub repository must use owner/name format');
  if(!token)throw new Error('GitHub token is required to verify Pages deployment');
  if(typeof fetchImpl!=='function')throw new Error('A fetch implementation is required');
  const maximumPages=commitSha?10:1;
  for(let page=1;page<=maximumPages;page+=1){
    const url=new URL(`${apiBase}/repos/${repository}/actions/runs`);
    url.searchParams.set('branch',branch);url.searchParams.set('status','success');
    url.searchParams.set('per_page','100');url.searchParams.set('page',String(page));
    const response=await fetchImpl(url,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'}});
    if(!response.ok){
      const detail=bounded(await response.text(),300);
      throw new Error(`GitHub Actions deployment lookup failed (${response.status})${detail?`: ${detail}`:''}`);
    }
    const payload=await response.json();const runs=Array.isArray(payload?.workflow_runs)?payload.workflow_runs:[];
    const match=selectSuccessfulPagesDeployment(runs,{workflowName,branch,commitSha});
    if(match)return match;
    if(runs.length<100)break;
  }
  return null;
}

module.exports={DEFAULT_API_BASE,DEFAULT_WORKFLOW_NAME,bounded,validRepository,selectSuccessfulPagesDeployment,findSuccessfulPagesDeployment};
