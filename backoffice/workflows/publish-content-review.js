'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const runFile = promisify(execFile);

function publishablePaths(root, review){
  const refs = (review?.outcomes || [])
    .filter(outcome => outcome.status === 'applied-locally')
    .flatMap(outcome => outcome.sourceRefs || (outcome.sourceRef ? [outcome.sourceRef] : []));
  const unique = [...new Set(refs)];
  if(!unique.length) throw new Error('This review has no approved local updates to publish');
  unique.forEach(ref => {
    const resolved = path.resolve(root, ref);
    if(resolved === root || !resolved.startsWith(`${root}${path.sep}`)) throw new Error('Publish path is outside the project');
  });
  return unique;
}

function groupedPatches(review){
  const grouped=new Map();
  (review?.outcomes||[]).filter(outcome=>outcome.status==='applied-locally').flatMap(outcome=>outcome.patches||[])
    .forEach(patch=>grouped.set(patch.sourceRef,[...(grouped.get(patch.sourceRef)||[]),...(patch.changes||[])]));
  return grouped;
}

async function git(root, args){
  const result = await runFile('git', args, { cwd: root, maxBuffer: 1024 * 1024 });
  return result.stdout.trim();
}

async function gitRaw(root,args){
  const result=await runFile('git',args,{cwd:root,maxBuffer:4*1024*1024});
  return result.stdout;
}

async function publishContentReview(root, review){
  const paths = publishablePaths(root, review);
  const branch = await git(root, ['branch', '--show-current']);
  if(branch !== 'main') throw new Error(`Publishing requires the main branch; current branch is ${branch || 'detached'}`);
  const alreadyStaged = await git(root, ['diff', '--cached', '--name-only']);
  if(alreadyStaged) throw new Error('Other files are already staged. Unstage them before publishing editorial work.');
  await runFile('npm', ['run', 'test:static'], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  await runFile('npm', ['run', 'test:backoffice'], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  const changed = await git(root, ['status', '--porcelain', '--', ...paths]);
  if(!changed) throw new Error('Approved files contain no unpublished changes');
  const assetRefs = [...new Set((review.outcomes || []).flatMap(outcome => outcome.status === 'applied-locally' ? (outcome.assetRefs || []) : []))];
  for(const [sourceRef, changes] of groupedPatches(review)){
    const base = await gitRaw(root, ['show', `HEAD:${sourceRef}`]);
    // Build the staged file from HEAD, while accepting a patch whose approved
    // result is already present. This makes a repeated approval safe when an
    // earlier publication already installed the same image or copy block.
    const approved = require('./apply-content-review').applyReviewChanges(base, changes);
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'orma-editorial-'));
    const tempFile = path.join(tempDir, 'approved-content');
    try {
      await fs.promises.writeFile(tempFile, approved, 'utf8');
      const blob = await git(root, ['hash-object', '-w', tempFile]);
      await git(root, ['update-index', '--add', '--cacheinfo', '100644', blob, sourceRef]);
    } finally { await fs.promises.rm(tempDir, { recursive: true, force: true }); }
  }
  if(assetRefs.length) await git(root, ['add', '--', ...assetRefs]);
  const staged = (await git(root, ['diff', '--cached', '--name-only'])).split('\n').filter(Boolean);
  const unexpected = staged.filter(file => !paths.includes(file));
  if(unexpected.length) throw new Error(`Unexpected staged files: ${unexpected.join(', ')}`);
  const message = `Editorial: publish approved content (${review.submissionId})`;
  await git(root, ['commit', '-m', message]);
  const commit = await git(root, ['rev-parse', 'HEAD']);
  await git(root, ['push', 'origin', 'HEAD:main']);
  return { commit, branch: 'main', paths, deployment: 'github-pages-triggered' };
}

module.exports = { publishablePaths, groupedPatches, publishContentReview };
