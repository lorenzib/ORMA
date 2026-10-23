#!/usr/bin/env node
'use strict';

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {pullRequestNumber,recordPublicationPullRequestStates}=require('../workflows/publication-pull-request-receipts');

async function fetchPullRequestState(url,env,fetchImpl){
  const number=pullRequestNumber(url);
  if(!number)return null;
  const repository=env.GITHUB_REPOSITORY||'benedettalorenzi/dolopaws';
  const response=await fetchImpl(`https://api.github.com/repos/${repository}/pulls/${number}`,{
    headers:{accept:'application/vnd.github+json',...(env.GH_TOKEN?{authorization:`Bearer ${env.GH_TOKEN}`}:{})},
  });
  if(!response.ok)throw new Error(`GitHub answered ${response.status} for pull request #${number}`);
  const body=await response.json();
  return {state:body.state,merged:Boolean(body.merged_at),mergedAt:body.merged_at||null,closedAt:body.closed_at||null};
}

async function main(options={}){
  const env=options.env||process.env;
  const fetchImpl=options.fetch||fetch;
  const store=options.store||new FirestoreBackofficeStore();
  const artifact=await store.getArtifact('publication-requests');
  if(!artifact){console.log('[orma-publication] No publication requests to reconcile.');return {closed:0,merged:0};}
  const urls=[...new Set((artifact.requests||[]).filter(request=>request.status==='pull-request-opened'&&request.pullRequestUrl&&!request.pullRequestMergedAt).map(request=>request.pullRequestUrl))];
  const states=new Map();
  for(const url of urls){
    const state=await fetchPullRequestState(url,env,fetchImpl);
    if(state)states.set(url,state);
  }
  const result=recordPublicationPullRequestStates(artifact,states,{at:options.at});
  if(result.closed||result.merged)await store.setArtifact('publication-requests',result.artifact);
  console.log(`[orma-publication] ${urls.length} publication pull request(s) checked: ${result.closed} closed without merging, ${result.merged} merged.`);
  return result;
}

if(require.main===module)main().catch(error=>{console.error(`[orma-publication] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main,fetchPullRequestState};
