#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const allowedStatuses = new Set(['passed', 'pending', 'accepted-exception', 'out-of-scope']);
const allowedPriorities = new Set(['P0', 'P1']);

function validateReadiness(readiness, baseDir = root){
  const errors = [];
  if(!readiness || readiness.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(readiness && readiness.asOf || '')) errors.push('asOf must use YYYY-MM-DD');
  if(!['not-ready', 'ready', 'reduced-scope'].includes(readiness && readiness.decision)){
    errors.push('decision must be not-ready, ready, or reduced-scope');
  }
  if(!Array.isArray(readiness && readiness.gates) || !readiness.gates.length){
    errors.push('gates must be a non-empty array');
    return errors;
  }

  const ids = new Set();
  readiness.gates.forEach((gate, index) => {
    const label = gate && gate.id ? gate.id : `gate[${index}]`;
    if(!gate || typeof gate !== 'object'){
      errors.push(`${label} must be an object`);
      return;
    }
    if(!/^[A-Z0-9-]+$/.test(gate.id || '')) errors.push(`${label} has an invalid id`);
    if(ids.has(gate.id)) errors.push(`${label} is duplicated`);
    ids.add(gate.id);
    if(!allowedPriorities.has(gate.priority)) errors.push(`${label} has an invalid priority`);
    if(!allowedStatuses.has(gate.status)) errors.push(`${label} has an invalid status`);
    if(typeof gate.owner !== 'string' || !gate.owner.trim()) errors.push(`${label} needs an owner`);
    if(typeof gate.summary !== 'string' || !gate.summary.trim()) errors.push(`${label} needs a summary`);
    if(typeof gate.evidence !== 'string' || !gate.evidence.trim()){
      errors.push(`${label} needs evidence`);
    } else if(!/^https?:\/\//.test(gate.evidence) && !fs.existsSync(path.resolve(baseDir, gate.evidence))){
      errors.push(`${label} evidence does not exist: ${gate.evidence}`);
    }
    if(gate.status === 'pending' && (!gate.safeFallback || !gate.safeFallback.trim())){
      errors.push(`${label} needs a safe fallback while pending`);
    }
    if(gate.status === 'accepted-exception' && gate.priority !== 'P1'){
      errors.push(`${label} cannot accept an exception for a P0 gate`);
    }
  });

  const blockers = readiness.gates.filter(gate => gate.status === 'pending');
  if(readiness.decision === 'ready' && blockers.length){
    errors.push('decision cannot be ready while pending gates remain');
  }
  return errors;
}

function summarise(readiness){
  const counts = readiness.gates.reduce((result, gate) => {
    result[gate.status] = (result[gate.status] || 0) + 1;
    return result;
  }, {});
  const blockers = readiness.gates.filter(gate => gate.status === 'pending');
  return { counts, blockers, ready:readiness.decision === 'ready' && blockers.length === 0 };
}

function run(argv = process.argv.slice(2)){
  const file = path.join(root, 'config', 'beta-readiness.json');
  const readiness = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validateReadiness(readiness);
  if(errors.length){
    errors.forEach(error => console.error(`[invalid] ${error}`));
    return 2;
  }
  const summary = summarise(readiness);
  console.log(`Beta readiness: ${readiness.decision} (${summary.counts.passed || 0} passed, ${summary.blockers.length} pending)`);
  summary.blockers.forEach(gate => console.log(`[pending ${gate.priority}] ${gate.id}: ${gate.summary}`));
  if(argv.includes('--require-ready') && !summary.ready) return 1;
  return 0;
}

if(require.main === module) process.exitCode = run();

module.exports = { validateReadiness, summarise, run };
