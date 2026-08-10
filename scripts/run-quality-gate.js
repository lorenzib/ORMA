#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

const steps = [
  ['Canonical trail examples', ['run', 'validate:trail-schema']],
  ['Production trail catalog', ['run', 'validate:production-trails:check']],
  ['Trail evidence contract', ['run', 'audit:trail-trust']],
  ['Application and contract tests', ['test', '--', '--runInBand']],
  ['Firestore emulator authorization', ['run', 'test:firestore-rules']],
  ['Static links and local assets', ['run', 'test:static']],
  ['Generated artifact drift', ['run', 'check:generated']],
];

function requireJava(){
  const command = process.platform === 'win32' ? 'java.exe' : 'java';
  const result = spawnSync(command, ['-version'], { encoding:'utf8' });
  if((result.error && result.error.code === 'ENOENT') || result.status !== 0){
    console.error('Quality gate prerequisite missing: Java 21 is required for the local Firestore emulator.');
    console.error('Install a Java 21 JDK, ensure `java -version` works, then rerun `npm run quality:gate`.');
    process.exit(1);
  }
}

function main(){
  requireJava();
  for(const [label, args] of steps){
    console.log(`\n=== ${label} ===`);
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(command, args, { stdio:'inherit' });
    if(result.error) throw result.error;
    if(result.status !== 0){
      console.error(`\nQuality gate stopped at: ${label}`);
      process.exit(result.status || 1);
    }
  }
  console.log('\nQuality gate passed. No production credentials were used.');
}

if(require.main === module) main();

module.exports = { steps, requireJava };
