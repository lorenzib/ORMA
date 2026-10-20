'use strict';

const fs=require('fs');
const path=require('path');

// A publication commit holds the website files the publication generated, and
// nothing else. The guard that enforces that is `git diff --quiet` after an
// explicit `git add`, and it is deliberately fail-closed: anything tracked and
// unstaged stops the pull request rather than riding along unseen.
//
// Regeneration also rewrites the promoter's elevation caches, which are not
// website output. With them left dirty the guard fired on every approved
// publication, so the first five never opened a pull request at all.
const WORKER=fs.readFileSync(
  path.resolve(__dirname,'..','.github','workflows','orma-backoffice-worker.yml'),'utf8');

const CACHES=['data/elevation-cache-dolomites.json','data/elevation-cache-savoy.json'];

// The step that builds the commit, on its own: `git diff --quiet` also appears
// earlier, where an unrelated step asks whether a publication happened at all.
const PR_STEP=WORKER.slice(WORKER.indexOf('- name: Open publication pull request'),
  WORKER.indexOf('- name: Record publication pull request receipt'));

describe('a publication commit holds only what the publication generated',()=>{
  test('the promoter caches are restored, not committed',()=>{
    const restore=PR_STEP.match(/git checkout -- (data\/elevation-cache[^\n]*)/);
    expect(restore).not.toBeNull();
    for(const cache of CACHES) expect(restore[1]).toContain(cache);
    // Restored, never staged: a promoter memo in a publication PR is the other
    // way this goes wrong.
    const staged=PR_STEP.match(/git add ([^\n]*)/);
    for(const cache of CACHES) expect(staged[1]).not.toContain(cache);
  });

  test('every cache the promoter writes is accounted for',()=>{
    const promoter=fs.readFileSync(
      path.resolve(__dirname,'..','scripts','promote-osm-trails.js'),'utf8');
    // The promoter names its cache by region key, so a new region adds a file
    // this step would then trip over.
    expect(promoter).toMatch(/elevation-cache-\$\{REGION_KEY\}\.json/);
    const regions=fs.readdirSync(path.resolve(__dirname,'..','data'))
      .filter(name=>/^elevation-cache-.*\.json$/.test(name));
    expect(regions.sort()).toEqual(CACHES.map(cache=>path.basename(cache)).sort());
  });

  test('the guard still fails closed, and runs after the restore',()=>{
    expect(PR_STEP).toContain('git diff --quiet');
    expect(PR_STEP.indexOf('git checkout -- data/elevation-cache'))
      .toBeLessThan(PR_STEP.indexOf('git diff --quiet'));
    expect(PR_STEP).toContain('Publication generation left tracked files unstaged:');
    expect(PR_STEP).toContain('exit 1');
  });
});
