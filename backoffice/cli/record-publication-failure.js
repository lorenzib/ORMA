#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { recordPublicationFailure } = require('../workflows/publication-failure-receipts');

function summarizeFailureLog(value){
  const lines = String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const diagnostic = lines.filter(line => /^(?:FAIL\b|Error\b|npm ERR!|Test Suites:|Tests:|\[.*(?:error|failed).*\])/i.test(line));
  const selected = (diagnostic.length ? diagnostic : lines).slice(-16);
  return [...new Set(selected)].join('\n').slice(0, 3000)
    || 'Publication automation failed without a captured error message.';
}

async function readFailureMessage(env){
  if(env.ORMA_AUTOMATION_FAILURE_MESSAGE) return summarizeFailureLog(env.ORMA_AUTOMATION_FAILURE_MESSAGE);
  if(!env.ORMA_AUTOMATION_FAILURE_LOG) return summarizeFailureLog('');
  try{return summarizeFailureLog(await fs.readFile(env.ORMA_AUTOMATION_FAILURE_LOG, 'utf8'));}
  catch(error){return summarizeFailureLog(`Could not read the publication failure log: ${error.message}`);}
}

function workflowRunUrl(env){
  if(env.ORMA_AUTOMATION_RUN_URL) return env.ORMA_AUTOMATION_RUN_URL;
  if(env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID){
    return `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  }
  return null;
}

async function main(options = {}){
  const env = options.env || process.env;
  const store = options.store || new FirestoreBackofficeStore();
  const artifact = await store.getArtifact('publication-requests');
  const result = recordPublicationFailure(artifact, {
    stage:env.ORMA_AUTOMATION_FAILURE_STAGE,
    message:await readFailureMessage(env),
    workflowRunUrl:workflowRunUrl(env),
    pullRequestUrl:env.ORMA_PUBLICATION_PR_URL || null,
    retryable:env.ORMA_AUTOMATION_FAILURE_RETRYABLE !== 'false',
  }, { at:options.at || new Date().toISOString() });
  if(result.recorded) await store.setArtifact('publication-requests', result.artifact, { lastFailureStage:env.ORMA_AUTOMATION_FAILURE_STAGE });
  console.log(`[orma-publication] Recorded ${result.recorded} durable publication failure receipt(s).`);
  return result;
}

if(require.main === module) main().catch(error => {
  console.error(`[orma-publication] Could not record failure receipt: ${error.stack || error.message}`);
  process.exitCode = 1;
});

module.exports = { summarizeFailureLog, readFailureMessage, workflowRunUrl, main };
