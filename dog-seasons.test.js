const fs = require('fs');
const path = require('path');
const { applyDogSeasons } = require('./scripts/dog-seasons');
const words = require('./trail-season-words');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'dog-seasons.json'), 'utf8'));
const walk = (fields) => ({
  id: 'x', region: 'dolomites', province: 'alto-adige', valley: 'Val Gardena',
  elevationProfile: [{ km: 0, elev: 1100 }, { km: 2, elev: 1300 }], desc: 'A walk through the woods.', ...fields,
});
const kinds = (trail) => ((applyDogSeasons([trail], config)[0].season || {}).dogSeasons || []).map((risk) => risk.kind);

describe('which walks a dog season reaches', () => {
  test('caterpillars: Trentino or Vinschgau, below 1,400 m', () => {
    expect(kinds(walk({ province: 'trentino' }))).toContain('caterpillars');
    expect(kinds(walk({ valley: 'Val Venosta – Vinschgau' }))).toContain('caterpillars');
    expect(kinds(walk({}))).not.toContain('caterpillars');
    expect(kinds(walk({ province: 'trentino', elevationProfile: [{ km: 0, elev: 1500 }] }))).not.toContain('caterpillars');
  });

  test('ticks: any Dolomites walk below 1,200 m, none elsewhere', () => {
    expect(kinds(walk({}))).toContain('ticks');
    expect(kinds(walk({ elevationProfile: [{ km: 0, elev: 1250 }] }))).not.toContain('ticks');
    expect(kinds(walk({ elevationProfile: [] }))).not.toContain('ticks');
    expect(kinds(walk({ region: 'savoy' }))).toEqual([]);
  });

  test('cows: a walk whose own text names cattle or pastures', () => {
    expect(kinds(walk({ tips: 'Give the grazing cattle a wide berth.' }))).toContain('cows');
    expect(kinds(walk({}))).not.toContain('cows');
  });

  test('carries the months and the sources, and keeps the rest of the season', () => {
    const [trail] = applyDogSeasons([walk({ province: 'trentino', season: { highPoint: 1300 } })], config);
    expect(trail.season.highPoint).toBe(1300);
    const caterpillars = trail.season.dogSeasons.find((risk) => risk.kind === 'caterpillars');
    expect(caterpillars.months).toEqual([3, 4]);
    expect(caterpillars.sources[0].url).toMatch(/^https:\/\//);
  });

  test('refuses a risk without a source', () => {
    const bad = { risks: { ticks: { ...config.risks.ticks, sources: [] } } };
    expect(() => applyDogSeasons([walk({})], bad)).toThrow(/no source/);
  });
});

describe('the words', () => {
  const season = applyDogSeasons([walk({ province: 'trentino', tips: 'Cows graze here.' })], config)[0].season;

  test('a tag only in its months', () => {
    expect(words.dogSeasonsNow(season, 3).map((risk) => risk.label)).toEqual(['Caterpillar season', 'Tick season']);
    expect(words.dogSeasonsNow(season, 7).map((risk) => risk.label)).toEqual(['Cows on the pastures']);
    expect(words.dogSeasonsNow(season, 11)).toEqual([]);
  });

  test('a line under When to go, with its months and where they come from', () => {
    const lines = words.describe(season).dogSeasons;
    expect(lines.map((risk) => risk.line)[1]).toBe('March to June: ticks in the woods below about 1200 m, most of all from late May to mid-June. Check your dog after the walk.');
    expect(lines[2].line).toMatch(/^June to September \(an estimate\)/);
    expect(lines[0].sources.map((source) => source.label)).toEqual(['Province of Trento, forestry service']);
  });
});

describe('the pages', () => {
  test('a trail page carries the tags hidden until their month, and the lines', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trails', 'fenn-promenade.html'), 'utf8');
    expect(html).toContain('<span class="dp-badge sp-tag sp-tag--dog" data-season-out="001111000000" hidden><span>Tick season</span></span>');
    expect(html).toContain("document.querySelectorAll('.sp-tag[data-season-out]')");
    expect(html).toContain('<h3 class="sp-season-dog">For your dog</h3>');
    const it = fs.readFileSync(path.join(__dirname, 'it', 'trails', 'fenn-promenade.html'), 'utf8');
    expect(it).toContain('<span>Stagione delle zecche</span>');
    expect(it).toContain('Da marzo a giugno: zecche nei boschi');
  });

  test('the list cards and the app show the tags', () => {
    expect(fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8')).toContain('browse-season--dog');
    const blueprint = fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8');
    expect(blueprint).toContain('trail-season-tag--dog');
    expect(blueprint).toContain('seasonWords.dogSeasonsNow(t.season, month)');
  });
});
