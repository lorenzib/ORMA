#!/usr/bin/env node
'use strict';

// JOURNAL-03 — storage.rules against the Firebase Storage emulator. Unlike the
// Firestore one, the Storage emulator only ships inside firebase-tools, so it
// runs through the same pinned version the deploy workflows use. Like the
// Firestore emulator, it needs Java 21 for rule evaluation.

const path = require('path');
const { spawnSync } = require('child_process');
const { jestBinary } = require('./run-firestore-rules-tests.cjs');

const ROOT = path.join(__dirname, '..');
const FIREBASE_TOOLS = 'firebase-tools@15.26.0';

function main(){
  const jest = [
    JSON.stringify(process.execPath),
    JSON.stringify(jestBinary()),
    '--runInBand',
    '--testMatch',
    JSON.stringify('**/storage-emulator.spec.cjs'),
  ].join(' ');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, [
    '--yes', FIREBASE_TOOLS,
    'emulators:exec',
    '--only', 'storage',
    '--project', 'demo-dolopaws',
    jest,
  ], { cwd: ROOT, stdio: 'inherit' });
  if(result.error) throw result.error;
  process.exitCode = result.status == null ? 1 : result.status;
}

if(require.main === module) main();
