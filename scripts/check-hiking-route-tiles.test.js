const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { checkTiles, STALE_AFTER_DAYS } = require('./check-hiking-route-tiles');

const root = path.join(__dirname, '..');
const workflow = name => yaml.load(fs.readFileSync(path.join(root, '.github', 'workflows', name), 'utf8'));
const DAY = 86400000;

function tiles({ stamp, metadataTime } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-hiking-tiles-'));
  fs.mkdirSync(path.join(dir, '12', '2170'), { recursive: true });
  fs.writeFileSync(path.join(dir, '12', '2170', '1450.pbf'), 'x');
  fs.writeFileSync(path.join(dir, 'metadata.json'), '{}');
  if (metadataTime) fs.utimesSync(path.join(dir, 'metadata.json'), metadataTime, metadataTime);
  if (stamp) fs.writeFileSync(path.join(dir, 'built-at.txt'), `${stamp}\n`);
  return dir;
}

describe('the deploy can tell whether the route tiles are still refreshing', () => {
  const now = new Date('2026-11-20T06:00:00Z');

  test('a set built this week is fine', () => {
    const result = checkTiles(tiles({ stamp: '2026-11-16T03:20:00Z' }), now);
    expect(result).toEqual({ state: 'ok', builtAt: '2026-11-16T03:20:00.000Z', ageDays: 4, tiles: 1 });
  });

  test('a set older than two missed Mondays is stale', () => {
    const built = new Date(now - (STALE_AFTER_DAYS + 1) * DAY).toISOString();
    expect(checkTiles(tiles({ stamp: built }), now).state).toBe('stale');
    const justInside = new Date(now - STALE_AFTER_DAYS * DAY).toISOString();
    expect(checkTiles(tiles({ stamp: justInside }), now).state).toBe('ok');
  });

  test('a set saved before the stamp existed is dated by its metadata', () => {
    const old = new Date(now - 30 * DAY);
    const result = checkTiles(tiles({ metadataTime: old }), now);
    expect(result.state).toBe('stale');
    expect(result.ageDays).toBe(30);
  });

  test('no folder, or a folder with no tiles, is missing', () => {
    expect(checkTiles(path.join(os.tmpdir(), 'orma-no-such-tiles'), now).state).toBe('missing');
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-empty-tiles-'));
    expect(checkTiles(empty, now).state).toBe('missing');
  });
});

describe('a refresh that stops is said out loud', () => {
  test('the build stamps every set it makes', () => {
    const script = fs.readFileSync(path.join(__dirname, 'build-hiking-route-tiles.sh'), 'utf8');
    expect(script).toMatch(/date -u \+%FT%TZ > "\$OUT\/built-at\.txt"/);
  });

  test('the weekly build raises the issue on failure and closes it on success', () => {
    const tilesWorkflow = workflow('orma-hiking-route-tiles.yml');
    expect(tilesWorkflow.permissions.issues).toBe('write');
    const step = tilesWorkflow.jobs.tiles.steps.find(s => /hiking-route-tiles-alert\.sh/.test(s.run || ''));
    expect(step.if).toMatch(/always\(\)/);
    expect(step.if).toMatch(/pull_request/);
    expect(step.run).toMatch(/alert\.sh clear/);
    expect(step.run).toMatch(/alert\.sh raise /);
    // The alert is the last word, after everything that can fail.
    const steps = tilesWorkflow.jobs.tiles.steps;
    expect(steps.indexOf(step)).toBe(steps.length - 1);
  });

  test('the deploy raises it once, after the tiles are in place, and never closes it', () => {
    const deploy = workflow('deploy-pages.yml');
    expect(deploy.permissions.issues).toBe('write');
    const steps = deploy.jobs.build.steps;
    const publish = steps.findIndex(s => s.name === 'Publish the hiking route tiles');
    const check = steps.findIndex(s => /check-hiking-route-tiles\.js _site\/data\/hiking-routes/.test(s.run || ''));
    expect(check).toBeGreaterThan(publish);
    expect(steps[check].run).toMatch(/alert\.sh raise-once/);
    expect(steps[check].run).not.toMatch(/alert\.sh (raise |clear)/);
  });

  test('the alert finds its issue by label and never fails the job', () => {
    const script = fs.readFileSync(path.join(__dirname, 'hiking-route-tiles-alert.sh'), 'utf8');
    expect(script).toMatch(/gh issue list --state open --label "\$LABEL"/);
    expect(script.trim().endsWith('exit 0')).toBe(true);
  });
});
