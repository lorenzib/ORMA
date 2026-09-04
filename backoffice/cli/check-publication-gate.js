#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const {evaluatePublicationGate}=require('../workflows/publication-gate');

function apiUrl(env){
  const repository=String(env.GITHUB_REPOSITORY||'').trim();
  const sha=String(env.GITHUB_SHA||'').trim();
  if(!repository||!sha)throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required');
  return `https://api.github.com/repos/${repository}/actions/workflows/validate.yml/runs?head_sha=${encodeURIComponent(sha)}&status=completed&per_page=10`;
}

async function latestValidationRuns(env,request=fetch){
  const token=env.GH_TOKEN||env.GITHUB_TOKEN;
  if(!token)throw new Error('GH_TOKEN or GITHUB_TOKEN is required');
  const response=await request(apiUrl(env),{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)throw new Error(`GitHub validation lookup failed with HTTP ${response.status}`);
  const payload=await response.json();
  return payload.workflow_runs||[];
}

async function writeOutputs(file,gate){
  if(!file)return;
  const output=[
    `publication_allowed=${gate.allowed?'true':'false'}`,
    `status=${gate.status}`,
    `conclusion=${gate.conclusion}`,
    `validation_run_url=${gate.validationRunUrl||''}`,
    `message=${gate.message}`,
  ].join('\n')+'\n';
  await fs.appendFile(file,output,'utf8');
}

async function main(options={}){
  const env=options.env||process.env;
  let gate;
  try{gate=evaluatePublicationGate(await latestValidationRuns(env,options.fetch||fetch),env.GITHUB_SHA);}
  catch(error){gate=evaluatePublicationGate([],env.GITHUB_SHA);gate.message=`Website publication is paused because validation health could not be checked: ${String(error.message||error).replace(/\s+/g,' ').slice(0,600)} Queue and agent work may continue; approvals stay saved.`;}
  await writeOutputs(env.GITHUB_OUTPUT,gate);
  console.log(`[orma-publication-gate] ${gate.allowed?'open':'blocked'} · ${gate.conclusion} · ${gate.validationRunUrl||'no validation run URL'}`);
  if(!gate.allowed)console.log(`[orma-publication-gate] ${gate.message}`);
  return gate;
}

if(require.main===module)main().catch(error=>{console.error(`[orma-publication-gate] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={apiUrl,latestValidationRuns,main,writeOutputs};
