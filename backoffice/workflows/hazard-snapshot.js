'use strict';

const fs = require('fs/promises');
const path = require('path');

// The public site reads a committed snapshot, data/dynamic-hazards.json. The
// live hazard watch keeps the authoritative copy in protected Firestore, so
// without this step the snapshot only moved when a person committed one by
// hand, and warnings kept showing long past their own expiry.
//
// The snapshot carries exactly the public contract (no protection flags), and
// it is only rewritten when the warning set itself changes: generatedAt moves
// on every run, and a pull request every three hours for a timestamp would be
// noise.

const PUBLIC_FILE = path.join('data', 'dynamic-hazards.json');

function publicSnapshot(artifact){
  const source = artifact && typeof artifact === 'object' ? artifact : {};
  return {
    contractVersion: source.contractVersion || '1.0.0',
    generatedAt: source.generatedAt || new Date().toISOString(),
    hazards: Array.isArray(source.hazards) ? source.hazards : [],
  };
}

function hazardsDiffer(previous, next){
  const before = previous && Array.isArray(previous.hazards) ? previous.hazards : [];
  return JSON.stringify(before) !== JSON.stringify(next.hazards);
}

async function readJson(file, fallback){
  try{ return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch(error){ if(error.code === 'ENOENT') return fallback; throw error; }
}

async function writePublicSnapshot(root, artifact){
  const file = path.join(root, PUBLIC_FILE);
  const previous = await readJson(file, { hazards: [] });
  const next = publicSnapshot(artifact);
  if(!hazardsDiffer(previous, next)){
    return { changed:false, file, hazards:next.hazards.length };
  }
  await fs.mkdir(path.dirname(file), { recursive:true });
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return { changed:true, file, hazards:next.hazards.length };
}

module.exports = { PUBLIC_FILE, publicSnapshot, hazardsDiffer, writePublicSnapshot };
