#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const generatedTargets = [
  'browse-trails.html',
  'sitemap.xml',
  'trails',
  'data/regions',
  'data/trail-details',
  'data/regions-manifest.json',
  'regions-runtime-manifest.js',
  'data/generated/trail-validation-report.json',
];

function run(command, args, cwd, options = {}){
  const result = spawnSync(command, args, {
    cwd,
    encoding:'utf8',
    stdio:options.capture ? 'pipe' : 'inherit',
  });
  if(result.error) throw result.error;
  if(result.status !== 0){
    const detail = options.capture ? `${result.stdout || ''}${result.stderr || ''}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.${detail ? `\n${detail}` : ''}`);
  }
  return result.stdout || '';
}

function trackedFiles(){
  return run('git', ['ls-files', '-z'], root, { capture:true })
    .split('\0')
    .filter(Boolean);
}

function copyTrackedTree(target){
  trackedFiles().forEach(relative => {
    const source = path.join(root, relative);
    if(!fs.existsSync(source)) return;
    const destination = path.join(target, relative);
    fs.mkdirSync(path.dirname(destination), { recursive:true });
    fs.copyFileSync(source, destination);
  });
}

function filesWithin(base, relative){
  const absolute = path.join(base, relative);
  if(!fs.existsSync(absolute)) return [];
  if(fs.statSync(absolute).isFile()) return [relative];
  return fs.readdirSync(absolute, { withFileTypes:true })
    .flatMap(entry => filesWithin(base, path.join(relative, entry.name)))
    .sort();
}

function normalized(relative, contents){
  let text = contents.toString('utf8');
  if(relative === 'data/regions-manifest.json' || relative === 'regions-runtime-manifest.js'){
    text = text.replace(/"generatedAt":"?[0-9TZ:.+-]+"?/g, '"generatedAt":"<generated>"');
    text = text.replace(/"generatedAt":\s*"[0-9TZ:.+-]+"/g, '"generatedAt": "<generated>"');
  }
  return text;
}

function compareTrees(generatedRoot){
  const expected = new Set(generatedTargets.flatMap(target => filesWithin(root, target)));
  const actual = new Set(generatedTargets.flatMap(target => filesWithin(generatedRoot, target)));
  const all = [...new Set([...expected, ...actual])].sort();
  return all.filter(relative => {
    if(!expected.has(relative) || !actual.has(relative)) return true;
    const committed = normalized(relative, fs.readFileSync(path.join(root, relative)));
    const regenerated = normalized(relative, fs.readFileSync(path.join(generatedRoot, relative)));
    return committed !== regenerated;
  });
}

function main(){
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dolopaws-generated-'));
  try{
    copyTrackedTree(temporaryRoot);
    run(process.execPath, ['scripts/validate-production-trails.js', '--report', 'data/generated/trail-validation-report.json'], temporaryRoot);
    run(process.execPath, ['scripts/generate-trail-pages.js'], temporaryRoot);
    run(process.execPath, ['scripts/build-regional-runtime-data.js'], temporaryRoot);
    const changed = compareTrees(temporaryRoot);
    if(changed.length){
      console.error('Generated artifacts are out of date:');
      changed.slice(0, 30).forEach(file => console.error(`  - ${file}`));
      if(changed.length > 30) console.error(`  - and ${changed.length - 30} more`);
      console.error('Run `npm run generate:artifacts`, review the changes, and commit them.');
      process.exitCode = 1;
      return;
    }
    console.log(`Generated artifact check passed across ${actualCount(temporaryRoot)} files.`);
  }finally{
    fs.rmSync(temporaryRoot, { recursive:true, force:true });
  }
}

function actualCount(base){
  return new Set(generatedTargets.flatMap(target => filesWithin(base, target))).size;
}

if(require.main === module) main();

module.exports = { generatedTargets, normalized, filesWithin, compareTrees };
