#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const {findSuccessfulPagesDeployment}=require('../workflows/github-pages-deployment');

async function writeOutputs(outputPath,evidence){
  if(!outputPath)return;
  const lines=evidence?[
    'found=true',
    `commit_sha=${evidence.commitSha}`,
    `run_url=${evidence.deploymentRunUrl}`,
    `run_id=${evidence.deploymentRunId||''}`,
  ]:['found=false'];
  await fs.appendFile(outputPath,`${lines.join('\n')}\n`,'utf8');
}

async function main(options={}){
  const env=options.env||process.env;
  const evidence=await findSuccessfulPagesDeployment({
    repository:env.GITHUB_REPOSITORY,
    token:env.GH_TOKEN||env.GITHUB_TOKEN,
    commitSha:env.ORMA_PUBLICATION_COMMIT_SHA,
    branch:env.ORMA_PUBLICATION_BRANCH||'main',
    fetchImpl:options.fetchImpl,
  });
  await writeOutputs(env.GITHUB_OUTPUT,evidence);
  if(!evidence){
    console.log('[orma-publication] No successful GitHub Pages deployment matches yet; the next scheduled reconciliation will check again.');
    return {found:false};
  }
  console.log(`[orma-publication] Verified successful Pages deployment ${evidence.deploymentRunUrl} for ${evidence.commitSha}.`);
  return evidence;
}

if(require.main===module)main().catch(error=>{console.error(`[orma-publication] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main,writeOutputs};
