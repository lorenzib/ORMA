const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { DEFAULT_FILES, loadProductionTrails } = require('./scripts/load-production-trails');
const {
  isVerified, staleReason, stalePackages, prunePackages, parseArguments, PILOT_IDS,
} = require('./scripts/build-offline-packages');

const root = __dirname;
const packagesDir = path.join(root, 'offline', 'packages');
const workflowText = fs.readFileSync(path.join(root, '.github', 'workflows', 'orma-offline-packages.yml'), 'utf8');
const workflow = yaml.load(workflowText);
const steps = workflow.jobs['build-packages'].steps;
const runText = steps.map(step => step.run || '').join('\n');
const trails = loadProductionTrails(root);

function tempPackages(ids){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-offline-packages-'));
  ids.forEach(id => fs.cpSync(path.join(packagesDir, id), path.join(dir, id), { recursive:true }));
  return dir;
}

// A Verified, non-pilot trail that already has a package, with a stored profile
// and a water point so every comparison has something to compare.
const sample = trails.find(trail => isVerified(trail) && !PILOT_IDS.includes(trail.id) &&
  fs.existsSync(path.join(packagesDir, trail.id, 'manifest.json')) &&
  Array.isArray(trail.elevationProfile) && trail.elevationProfile.length >= 2);

describe('the offline-package workflow runs without anyone remembering (OFF-07)', () => {
  test('it runs every morning, by hand, and after a push that can change the seal', () => {
    // js-yaml reads the bare `on:` key as true.
    const on = workflow.on || workflow[true];
    expect(on.workflow_dispatch).toBeDefined();
    expect(on.schedule).toEqual([{ cron:'40 5 * * *', timezone:'Europe/Rome' }]);
    expect(on.push.branches).toEqual(['main']);
    // Every file the seal and the route are read from, taken from the loader
    // itself so a new source cannot be missed here.
    const sources = [
      ...DEFAULT_FILES,
      'data/verified-trail-overrides.json',
      'data/lift-access.json',
      'data/trail-slug-overrides.json',
      'trust/evidence-v1.js',
      'scripts/load-production-trails.js',
      'scripts/build-offline-packages.js',
    ];
    const loader = fs.readFileSync(path.join(root, 'scripts', 'load-production-trails.js'), 'utf8');
    ['verified-trail-overrides.json', 'lift-access.json'].forEach(file => expect(loader).toContain(file));
    expect(on.push.paths.sort()).toEqual(sources.sort());
  });

  test('one builder at a time, on the one Overpass mirror that answers', () => {
    expect(workflow.concurrency).toEqual({ group:'orma-offline-packages', 'cancel-in-progress':false });
    expect(workflow.jobs['build-packages'].env.OVERPASS_URL).toBe('https://overpass-api.de/api/interpreter');
    expect(runText.match(/build-offline-packages\.js/g)).toHaveLength(1);
  });

  test('it prunes, builds only stale packages, then rebuilds what reads them', () => {
    const build = runText.indexOf('node scripts/build-offline-packages.js --prune --stale');
    const routing = runText.indexOf('npm run build:trail-routing');
    const bundle = runText.indexOf('npm run build:trail-page-bundle');
    expect(build).toBeGreaterThan(-1);
    expect(routing).toBeGreaterThan(build);
    expect(bundle).toBeGreaterThan(routing);
    expect(parseArguments(['--prune', '--stale'])).toMatchObject({ prune:true, stale:true });
  });

  test('the corridor extracts are kept between runs in an actions cache', () => {
    const restore = steps.find(step => String(step.uses).startsWith('actions/cache/restore@'));
    const save = steps.find(step => String(step.uses).startsWith('actions/cache/save@'));
    expect(restore.with.path).toBe('.cache/offline-map-sources');
    expect(save.with.path).toBe('.cache/offline-map-sources');
    expect(save.if).toBe('always()');
    expect(fs.readFileSync(path.join(root, 'scripts', 'build-offline-packages.js'), 'utf8'))
      .toContain("path.join(ROOT, '.cache', 'offline-map-sources')");
  });

  test('it publishes like the hazard snapshot: its own PR, approved, merged, deployed', () => {
    expect(runText).toContain('branch="orma-bot/offline-packages"');
    expect(runText).toContain('generated=(offline/packages offline-packages.js trail-routing-coverage.js trail-app.bundle.js)');
    expect(runText).toContain('git add -A -- "${generated[@]}"');
    // The guard runs after the generated files are staged, so it may only look
    // at unstaged changes: `git status --porcelain` lists staged files too and
    // failed every run that had a package to publish (24 Oct 2026).
    const guard = runText.slice(runText.indexOf('git add -A -- "${generated[@]}"'), runText.indexOf('git commit -m'));
    expect(guard).toContain('if ! git diff --quiet; then');
    expect(guard).not.toContain('git status --porcelain');
    expect(runText).toContain('gh api -X POST "repos/${GITHUB_REPOSITORY}/actions/runs/${run}/approve"');
    expect(runText).toContain('gh pr merge "$pr" --auto --squash');
    expect(runText).toContain('gh workflow run validate.yml --ref main');
    expect(runText).toContain('gh workflow run deploy-pages.yml --ref main');
    expect(workflow.permissions).toEqual({ contents:'write', 'pull-requests':'write', actions:'write' });
  });
});

describe('which packages a run builds and removes', () => {
  test('the committed packages match the trail records', () => {
    expect(sample).toBeDefined();
    const dir = tempPackages([sample.id]);
    expect(staleReason(sample, dir)).toBeNull();
  });

  test('a newly Verified trail with no package is built', () => {
    const dir = tempPackages([]);
    expect(staleReason(sample, dir)).toBe('no package');
    expect(stalePackages([sample], dir)).toEqual([{ id:sample.id, reason:'no package' }]);
  });

  test('a changed route, profile or safety fact rebuilds the package', () => {
    const dir = tempPackages([sample.id]);
    const moved = { ...sample, path:sample.path.map(([lat, lng]) => [lat + 0.001, lng]) };
    expect(staleReason(moved, dir)).toBe('route changed');
    const higher = { ...sample, elevationProfile:sample.elevationProfile.map(point => ({ ...point, elev:point.elev + 10 })) };
    expect(staleReason(higher, dir)).toBe('elevation profile changed');
    const hotter = { ...sample, heatRisk:sample.heatRisk === 'high' ? 'low' : 'high' };
    expect(staleReason(hotter, dir)).toBe('safety facts changed');
  });

  test('pilots and unverified trails are never built', () => {
    const dir = tempPackages([]);
    const pilots = trails.filter(trail => PILOT_IDS.includes(trail.id));
    const unverified = trails.filter(trail => !isVerified(trail)).slice(0, 5);
    expect(stalePackages([...pilots, ...unverified], dir)).toEqual([]);
  });

  test('a trail that lost the seal loses its package; the pilots and Verified ones stay', () => {
    const dir = tempPackages([sample.id, ...PILOT_IDS]);
    fs.cpSync(path.join(dir, sample.id), path.join(dir, 'osm-withdrawn'), { recursive:true });
    expect(prunePackages(new Set([sample.id]), dir)).toEqual(['osm-withdrawn']);
    expect(fs.readdirSync(dir).sort()).toEqual([...PILOT_IDS, sample.id].sort());
  });
});

describe('the publish step, run against a scratch repository', () => {
  const { execFileSync, spawnSync } = require('child_process');
  const publish = steps.find(step => step.name === 'Publish the offline packages').run;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding:'utf8', stdio:['ignore', 'pipe', 'pipe'] }).trim();

  // A stand-in for gh that records every call. `pr list` answers with the
  // open package PR, if any; a created PR merges at once, so the wait loop
  // ends on its first look.
  function fakeGh(dir){
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), [
      '#!/bin/bash',
      'echo "$*" >> "$GH_LOG"',
      'case "$1 $2" in',
      '  "pr list") echo "$OPEN_PR" ;;',
      '  "pr create") echo "https://github.com/lorenzib/ORMA/pull/77" ;;',
      '  "pr view") case "$*" in *mergeStateStatus*) echo "MERGED CLEAN" ;; *headRefOid*) echo abc ;; *) echo MERGED ;; esac ;;',
      'esac',
    ].join('\n'), { mode:0o755 });
    return bin;
  }

  // origin has main with one package; the checkout is the runner's.
  function scratch(){
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-offline-publish-'));
    const origin = path.join(dir, 'origin.git');
    const work = path.join(dir, 'work');
    git(dir, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
    git(dir, 'clone', '--quiet', origin, work);
    git(work, 'config', 'user.email', 'test@example.com');
    git(work, 'config', 'user.name', 'Test');
    fs.mkdirSync(path.join(work, 'offline', 'packages', 'osm-1'), { recursive:true });
    ['offline-packages.js', 'trail-routing-coverage.js', 'trail-app.bundle.js', 'README.md']
      .forEach(file => fs.writeFileSync(path.join(work, file), 'v1\n'));
    fs.writeFileSync(path.join(work, 'offline', 'packages', 'osm-1', 'manifest.json'), '{}\n');
    git(work, 'add', '-A');
    git(work, 'commit', '--quiet', '-m', 'main');
    git(work, 'push', '--quiet', 'origin', 'HEAD:main');
    fs.writeFileSync(path.join(work, 'changes.log'), '[stale] osm-2: no package\n');
    return { dir, origin, work, log:path.join(dir, 'gh.log'), bin:fakeGh(dir) };
  }

  function addPackage(work){
    fs.mkdirSync(path.join(work, 'offline', 'packages', 'osm-2'));
    fs.writeFileSync(path.join(work, 'offline', 'packages', 'osm-2', 'manifest.json'), '{"id":"osm-2"}\n');
    fs.writeFileSync(path.join(work, 'offline-packages.js'), 'v2\n');
  }

  function run(repo, openPr = ''){
    const result = spawnSync('bash', ['-c', `sleep(){ :; }\n${publish}`], {
      cwd:repo.work,
      encoding:'utf8',
      env:{ ...process.env, PATH:`${repo.bin}:${process.env.PATH}`, GH_LOG:repo.log, OPEN_PR:openPr, GITHUB_REPOSITORY:'lorenzib/ORMA' },
    });
    const calls = fs.existsSync(repo.log) ? fs.readFileSync(repo.log, 'utf8').trim().split('\n') : [];
    const pushed = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'refs/heads/orma-bot/offline-packages'], { cwd:repo.origin }).status === 0;
    return { status:result.status, out:result.stdout + result.stderr, calls, pushed };
  }

  test('nothing to build and no open package PR: it does nothing', () => {
    const result = run(scratch());
    expect(result.status).toBe(0);
    expect(result.out).toContain("Every Verified trail's offline package is current.");
    expect(result.calls.filter(call => !call.startsWith('pr list'))).toEqual([]);
    expect(result.pushed).toBe(false);
  });

  test('nothing to build but a package PR is still open: it closes the leftover', () => {
    const result = run(scratch(), '1031');
    expect(result.status).toBe(0);
    expect(result.calls.some(call => call.startsWith('pr close 1031 --delete-branch'))).toBe(true);
    expect(result.pushed).toBe(false);
  });

  test('main gained the same packages while it was building: it publishes nothing', () => {
    const repo = scratch();
    addPackage(repo.work);
    // An earlier run's PR merges the identical files into main meanwhile.
    const other = path.join(repo.dir, 'other');
    git(repo.dir, 'clone', '--quiet', repo.origin, other);
    git(other, 'config', 'user.email', 'test@example.com');
    git(other, 'config', 'user.name', 'Test');
    addPackage(other);
    git(other, 'add', '-A');
    git(other, 'commit', '--quiet', '-m', 'earlier package PR');
    git(other, 'push', '--quiet', 'origin', 'HEAD:main');
    const result = run(repo, '1031');
    expect(result.status).toBe(0);
    expect(result.out).toContain('nothing to publish');
    expect(result.calls.some(call => call.startsWith('pr close 1031'))).toBe(true);
    expect(result.calls.some(call => call.startsWith('pr create'))).toBe(false);
    expect(result.pushed).toBe(false);
  });

  test('a new package: it pushes the branch, opens the PR, merges and deploys', () => {
    const repo = scratch();
    addPackage(repo.work);
    const result = run(repo);
    expect(result.status).toBe(0);
    expect(result.pushed).toBe(true);
    expect(git(repo.origin, 'diff', '--name-only', 'main', 'orma-bot/offline-packages').split('\n').sort())
      .toEqual(['offline-packages.js', 'offline/packages/osm-2/manifest.json']);
    expect(result.calls.some(call => call.startsWith('pr create --base main --head orma-bot/offline-packages'))).toBe(true);
    expect(result.calls.some(call => call.startsWith('pr close'))).toBe(false);
    expect(result.calls).toContain('workflow run deploy-pages.yml --ref main');
  });

  test('a change outside the generated files stops it before anything is pushed', () => {
    const repo = scratch();
    addPackage(repo.work);
    fs.writeFileSync(path.join(repo.work, 'README.md'), 'changed\n');
    const result = run(repo);
    expect(result.status).toBe(1);
    expect(result.out).toContain('README.md');
    expect(result.pushed).toBe(false);
  });
});
