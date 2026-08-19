#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { runGuideContent } = require('../workflows/run-guide-content');

async function main(args = process.argv.slice(2)){
  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required to run Content Desk agents');
  const root = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'content-execution.json')));
  const execution = await runGuideContent(root, { guideId: option(args, '--guide', null) });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(execution, null, 2)}\n`, 'utf8');
  console.log(`[content-runner] Guide: ${execution.subject.id}`);
  console.log(`[content-runner] Ready for review: ${execution.summary.readyForReview}`);
  console.log(`[content-runner] Blocked: ${execution.summary.blocked}`);
  console.log(`[content-runner] Review: http://127.0.0.1:4173/backoffice-review.html#contentDesk`);
}

if(require.main === module){
  main().catch(error => { console.error(`[content-runner] ${error.message}`); process.exitCode = 1; });
}

module.exports = { main };
