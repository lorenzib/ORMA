'use strict';

/**
 * Ground height is asked for once and kept.
 *
 * Every promoter run queried Open-Meteo for all 80 samples of all 163 routes,
 * and the free tier answers some of those with 429. A failed fetch leaves the
 * route with no profile and says so only in a warning, so a rate-limited run
 * quietly produced worse data than the one before it: regenerating the
 * catalogue on 16 October needed two full passes and a merge of both to lose no
 * profile, because each pass dropped a different handful.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { elevationKey, loadElevationCache, saveElevationCache, fetchElevations } =
  require('./promote-osm-trails');

// Two points on the Vandoies loop, at the precision the request uses.
const SAMPLES = [
  { lat: 46.8167, lng: 11.7230, km: 0 },
  { lat: 46.8197, lng: 11.7270, km: 0.4 },
  { lat: 46.8167, lng: 11.7230, km: 1.3 },   // the loop returns to its start
];

const answer = values => async () => ({ ok: true, status: 200,
  json: async () => ({ elevation: values }) });

const run = (samples, options = {}) => {
  const asked = [];
  const found = new Map();
  const fetchImpl = async url => {
    asked.push(url);
    const handler = options.handler || answer([767, 886]);
    return handler(asked.length);
  };
  return { asked, found,
    promise: fetchElevations(samples, { fetchImpl, found,
      cache: options.cache || new Map(), sleep: () => Promise.resolve() }) };
};

const tmpFile = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orma-elev-')), 'cache.json');

describe('a point is keyed the way it is asked for', () => {
  test('to five decimals, which is how the request spells it', () => {
    // Keyed any looser and two different points share an answer; any tighter
    // and the same point asked for twice misses its own cached height.
    expect(elevationKey({ lat: 46.8167, lng: 11.723 })).toBe('46.81670,11.72300');
    expect(elevationKey({ lat: 46.816701234, lng: 11.723004 })).toBe('46.81670,11.72300');
  });
});

describe('what is on file is not asked for again', () => {
  test('a run with every height cached makes no request at all', async () => {
    const cache = new Map([['46.81670,11.72300', 767], ['46.81970,11.72700', 886]]);
    const { asked, promise } = run(SAMPLES, { cache });
    await expect(promise).resolves.toEqual([767, 886, 767]);
    expect(asked).toEqual([]);
  });

  test('only the missing point is asked for', async () => {
    const cache = new Map([['46.81670,11.72300', 767]]);
    const { asked, promise } = run(SAMPLES, { cache, handler: answer([886]) });
    await expect(promise).resolves.toEqual([767, 886, 767]);
    expect(asked).toHaveLength(1);
    // One coordinate in the query, not three.
    expect(asked[0]).toContain('latitude=46.81970');
    expect(asked[0]).not.toContain('46.81670');
  });

  test('a point repeated within one route is asked for once', async () => {
    // A loop ends where it starts, so its first and last sample are the same
    // place.
    const { asked, promise } = run(SAMPLES, { handler: answer([767, 886]) });
    await expect(promise).resolves.toEqual([767, 886, 767]);
    expect(asked).toHaveLength(1);
    expect(asked[0].match(/46\.81670/g)).toHaveLength(1);
  });

  test('every height used is recorded, cached ones included', async () => {
    // The saved file has to be the whole live set, or the next run refetches
    // whatever this one happened to read from the cache.
    const cache = new Map([['46.81670,11.72300', 767]]);
    const { found, promise } = run(SAMPLES, { cache, handler: answer([886]) });
    await promise;
    expect([...found.entries()].sort()).toEqual([
      ['46.81670,11.72300', 767], ['46.81970,11.72700', 886],
    ]);
  });
});

describe('a height that cannot be had is not half a profile', () => {
  test('a failing fetch gives up on the route, as it always did', async () => {
    const { promise } = run(SAMPLES, { handler: async () => ({ ok: false, status: 429 }) });
    await expect(promise).resolves.toBeNull();
  });

  test('a route that gave up still banks the heights it did get', async () => {
    // The whole point of the cache is that repeated runs converge. Discarding
    // a batch because a later one was rate-limited would make a throttled run
    // contribute nothing and start the next one over.
    // Four distinct points, two to a batch: the first batch answers and the
    // second is refused however often it is asked.
    const many = [
      { lat: 46.8167, lng: 11.7230, km: 0 }, { lat: 46.8197, lng: 11.7270, km: 1 },
      { lat: 46.8217, lng: 11.7290, km: 2 }, { lat: 46.8237, lng: 11.7310, km: 3 },
    ];
    let call = 0;
    const found = new Map();
    const fetchImpl = async () => {
      call += 1;
      return call === 1
        ? { ok: true, status: 200, json: async () => ({ elevation: [767, 886] }) }
        : { ok: false, status: 429 };
    };
    const result = await fetchElevations(many, { fetchImpl, found, cache: new Map(),
      sleep: () => Promise.resolve(), batchSize: 2 });
    expect(result).toBeNull();
    expect([...found.entries()]).toEqual([
      ['46.81670,11.72300', 767], ['46.81970,11.72700', 886],
    ]);
  });

  test('nothing is recorded when not one height arrived', async () => {
    const { found, promise } = run(SAMPLES, { handler: async () => ({ ok: false, status: 429 }) });
    await promise;
    expect(found.size).toBe(0);
  });

  test('a short answer is a failure, not a silent misalignment', async () => {
    // Open-Meteo returning fewer heights than points asked for used to be
    // spread with `push`, so every height after the gap belonged to the wrong
    // place and the profile was quietly wrong rather than absent.
    const { promise } = run(SAMPLES, { handler: answer([767]) });
    await expect(promise).resolves.toBeNull();
  });

  test('a non-numeric height is a failure too', async () => {
    const { promise } = run(SAMPLES, { handler: answer([767, null]) });
    await expect(promise).resolves.toBeNull();
  });

  test('it retries before giving up', async () => {
    const { asked, promise } = run(SAMPLES, {
      handler: attempt => (attempt < 3
        ? Promise.resolve({ ok: false, status: 429 })
        : answer([767, 886])()),
    });
    await expect(promise).resolves.toEqual([767, 886, 767]);
    expect(asked).toHaveLength(3);
  });
});

describe('the file on disk', () => {
  test('what is saved is what is loaded', async () => {
    const file = tmpFile();
    await saveElevationCache(file, new Map([['46.81670,11.72300', 767]]));
    expect([...loadElevationCache(file)]).toEqual([['46.81670,11.72300', 767]]);
  });

  test('no file yet is an empty cache, not a crash', () => {
    expect(loadElevationCache(path.join(os.tmpdir(), 'orma-no-such-cache.json')).size).toBe(0);
  });

  test('a corrupt file is an empty cache, not a crash', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{ not json');
    expect(loadElevationCache(file).size).toBe(0);
  });

  test('a height that is not a number is dropped on load', async () => {
    const file = tmpFile();
    fs.writeFileSync(file, JSON.stringify({ points: {
      '46.81670,11.72300': 767, '46.81970,11.72700': null, '46.82000,11.72800': 'high' } }));
    expect([...loadElevationCache(file)]).toEqual([['46.81670,11.72300', 767]]);
  });

  test('it is written in key order, so a commit diff is readable', async () => {
    const file = tmpFile();
    await saveElevationCache(file, new Map([
      ['46.81970,11.72700', 886], ['46.81670,11.72300', 767]]));
    const keys = Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).points);
    expect(keys).toEqual(['46.81670,11.72300', '46.81970,11.72700']);
  });
});