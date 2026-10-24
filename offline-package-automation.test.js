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
