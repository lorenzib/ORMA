#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {FirestoreUsageMeter}=require('../services/firestore-usage');
const {runLiveBackofficeWorker}=require('../workflows/run-live-backoffice-worker');
const {drainVerificationQueue,CLEAN_STOPS}=require('../workflows/drain-verification-queue');
const {workerOptions,positiveInteger}=require('./live-worker');

function summaryMarkdown(ledger){
  const rows=ledger.passes.map(pass=>`| ${pass.index} | ${pass.outcome||'error'} | ${pass.succeeded??'-'}/${pass.attempted??'-'} | ${pass.reads} | ${pass.writes} | ${Math.round(pass.durationMs/60_000)} min |`);
  const averages=ledger.averages;
  return [
    `## Verification drain · stopped: ${ledger.stoppedBecause}`,
    '',
    `${ledger.totals.passes} passes · ${ledger.totals.succeeded} jobs done of ${ledger.totals.attempted} attempted · ${ledger.totals.reads} reads · ${ledger.totals.writes} writes · ${Math.round(ledger.durationMs/60_000)} min`,
    averages?`Per pass: ${averages.readsPerPass} reads, ${averages.writesPerPass} writes, ${averages.jobsPerPass} jobs, ${averages.minutesPerPass} min. Per job: ${averages.readsPerJob??'-'} reads, ${averages.writesPerJob??'-'} writes.`:'',
    '',
    ...(ledger.costliest&&ledger.costliest.length?[
      '### Where the reads went',
      '',
      '| call site | reads | writes | calls |','|---|---|---|---|',
      ...ledger.costliest.map(entry=>
        `| \`${entry.source}\` | ${entry.reads} | ${entry.writes} | ${entry.readCalls+entry.writeCalls} |`),
      '',
    ]:[]),
    '| pass | outcome | done/attempted | reads | writes | duration |','|---|---|---|---|---|---|',...rows,
  ].join('\n');
}

async function main(env=process.env){
  if(!env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is required');
  const workerId=`github-drain-${env.GITHUB_RUN_ID||'manual'}-${env.GITHUB_RUN_ATTEMPT||'1'}`;
  const usage=new FirestoreUsageMeter();
  const base=workerOptions(env,{workerId});
  const ledger=await drainVerificationQueue({
    usage,
    maxMinutes:positiveInteger(env.ORMA_DRAIN_MAX_MINUTES,undefined),
    readBudget:positiveInteger(env.ORMA_DRAIN_READ_BUDGET,undefined),
    writeBudget:positiveInteger(env.ORMA_DRAIN_WRITE_BUDGET,undefined),
    log:pass=>console.log(`[orma-drain] pass ${pass.index} · ${pass.outcome||'error'} · ${pass.succeeded??'-'}/${pass.attempted??'-'} jobs · ${pass.reads} reads · ${pass.writes} writes · ${Math.round(pass.durationMs/1000)}s${pass.error?` · ${pass.error}`:''}`),
    // A fresh store per pass: the store memoises artifacts and queue reads for
    // one pass, and a pass must see what the previous one wrote.
    runPass:()=>runLiveBackofficeWorker(new FirestoreBackofficeStore({usage}),base),
  });
  console.log(JSON.stringify(ledger,null,2));
  try{
    // One write, after the loop, so the desk and the state report can read
    // what a pass costs without anyone opening the Actions log.
    await new FirestoreBackofficeStore({usage}).setArtifact('verification-drain',ledger,{stoppedBecause:ledger.stoppedBecause,passes:ledger.totals.passes});
  }catch(error){console.error(`[orma-drain] ledger not written: ${error.message}`);}
  if(env.GITHUB_STEP_SUMMARY)await fs.appendFile(env.GITHUB_STEP_SUMMARY,`${summaryMarkdown(ledger)}\n`);
  if(env.GITHUB_OUTPUT)await fs.appendFile(env.GITHUB_OUTPUT,[
    `drain_stopped_because=${ledger.stoppedBecause}`,`drain_passes=${ledger.totals.passes}`,
    `drain_jobs_succeeded=${ledger.totals.succeeded}`,`drain_jobs_attempted=${ledger.totals.attempted}`,
    `drain_reads=${ledger.totals.reads}`,`drain_writes=${ledger.totals.writes}`,'',
  ].join('\n'));
  if(!CLEAN_STOPS.includes(ledger.stoppedBecause))process.exitCode=1;
  return ledger;
}

if(require.main===module)main().catch(error=>{console.error(`[orma-drain] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main,summaryMarkdown};
