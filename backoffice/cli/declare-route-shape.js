#!/usr/bin/env node
'use strict';

// Says that a trail is not meant to be a loop.
//
// The geometry check faulted every route that did not return to its start, so
// an out-and-back or a point-to-point was rejected as broken geometry and never
// reached verification. The shape is not something the geometry can tell you --
// a walk that retraces its outward leg looks identical to one that failed to
// close -- so it is a human statement, recorded like any other verified fact in
// data/verified-trail-overrides.json.
//
//   npm run backoffice:route-shape -- --trail <id> --shape out-and-back \
//     --note "Signposted there and back from the church."
//
// Writes the file. Nothing is deployed until you commit it.

const fs = require('fs');
const path = require('path');
const { ROUTE_SHAPES } = require('../services/geometry-validator');

const root = path.resolve(__dirname, '../..');
const OVERRIDES = path.join(root, 'data', 'verified-trail-overrides.json');

function arg(name){
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
}

function main(){
  const trailId = arg('trail');
  const shape = arg('shape');
  const note = arg('note');

  if(!trailId || !shape || !note){
    console.error('Usage: --trail <id> --shape <' + ROUTE_SHAPES.join('|') + '> --note "why"');
    process.exitCode = 1; return;
  }
  if(!ROUTE_SHAPES.includes(shape)){
    console.error(`Unknown shape "${shape}". Use one of: ${ROUTE_SHAPES.join(', ')}`);
    process.exitCode = 1; return;
  }
  // A shape without a reason is an assertion nobody can check later.
  if(note.length < 10){
    console.error('The note should say why, in enough words to be useful later.');
    process.exitCode = 1; return;
  }

  const artifact = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));
  artifact.trails = Array.isArray(artifact.trails) ? artifact.trails : [];
  const at = new Date().toISOString();
  const entry = {
    id: trailId,
    verificationScope: 'routeShape',
    generatedAt: at,
    fields: { routeShape: shape, routeShapeNote: note },
  };

  // One declaration per trail: a later one replaces the earlier rather than
  // leaving two answers in the file.
  const index = artifact.trails.findIndex(item =>
    item && item.id === trailId && item.verificationScope === 'routeShape');
  if(index >= 0) artifact.trails[index] = entry; else artifact.trails.push(entry);
  artifact.updatedAt = at;

  fs.writeFileSync(OVERRIDES, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[route-shape] ${trailId} is ${shape}.`);
  console.log(`[route-shape] ${index >= 0 ? 'Replaced the previous declaration' : 'Recorded'} in data/verified-trail-overrides.json.`);
  console.log('[route-shape] Nothing is deployed until you commit it.');
}

if(require.main === module) main();
module.exports = { main };
