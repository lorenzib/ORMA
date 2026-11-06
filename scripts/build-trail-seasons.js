#!/usr/bin/env node
'use strict';

// Writes data/trail-seasons.json for the Dolomites walks: the months each
// walk's tourist board recommends, read off the board's page; failing that, a
// snow estimate from the walk's high point; and how much of the line is mapped
// as a ski run, sled run or cross-country track in OpenStreetMap.
//
//   node scripts/build-trail-seasons.js            fetch what the cache lacks
//   node scripts/build-trail-seasons.js --offline  use the cache only
//
// Piste tiles and board pages are cached in ~/.cache/orma/trail-seasons, so a rerun
// after a data change measures again without asking Overpass for 45 tiles.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { loadProductionTrails } = require('./load-production-trails');
const { snowEstimate, parseBoardMonths, validateSeason, WINTER_USE_MIN_KM } = require('./trail-seasons');

const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'data', 'trail-seasons.json');
// Outside the repository: the site's link checker reads every HTML file in it.
const cacheDir = process.env.TRAIL_SEASONS_CACHE || path.join(os.homedir(), '.cache', 'orma', 'trail-seasons');
const offline = process.argv.includes('--offline');
const REGION = 'dolomites';
const TILE = 0.2;
const TOLERANCE_M = 20;
const MIN_RUN_M = 100;
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'ORMA/1.0 (https://www.app-orma.com; trail seasons builder)';

// The board a walk was verified against names its own page among the record's
// links. Authorities, maps and photo hosts publish no season.
const NOT_A_BOARD = /openstreetmap|salute\.gov|civis\.bz|gemeinde|comune\.|provinz|provincia|kc-usercontent|nature-parks|eea\.europa|waymarked|wikimedia|trovanorme|regione|mapillary/;
const BOARD_LABELS = {
  'outdooractive.com': 'Outdooractive',
  'valgardena.it': 'Val Gardena tourist board',
  'altabadia.org': 'Alta Badia tourist board',
  'dreizinnen.com': 'Dolomites 3 Zinnen tourist board',
  'eggental.com': 'Eggental tourist board',
  'olang.com': 'Olang tourist board',
  'antholzertal.com': 'Antholzertal tourist board',
  'seiseralm.it': 'Seiser Alm tourist board',
  'odlesdolomites.com': 'Villnöss tourist board',
  'merano-suedtirol.it': 'Merano tourist board',
  'kronplatz.com': 'Kronplatz tourist board',
  'gitschberg-jochtal.com': 'Gitschberg Jochtal tourist board',
  'drei-zinnen.info': 'Dolomites 3 Zinnen tourist board',
  'klausen.it': 'Klausen tourist board',
};
// A track's name in the map is sometimes its length ("3,00 km", "Accesso 1,1 km"),
// which names nothing a walker would see.
const usefulName = name => !!name && !/\d\s*km\b/i.test(name) && !/^[\d\s.,]+$/.test(name);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cachePath = (kind, name) => path.join(cacheDir, kind, name);

async function fetchText(url, init, timeoutMs){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try{
    const response = await fetch(url, { ...init, signal: controller.signal });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  }finally{
    clearTimeout(timer);
  }
}

function tileQuery([a, b]){
  const s = a * TILE - 0.01, w = b * TILE - 0.01, n = a * TILE + TILE + 0.01, e = b * TILE + TILE + 0.01;
  const box = `(${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)})`;
  return `[out:json][timeout:200];(way["piste:type"~"^(downhill|nordic|sled)$"]${box};relation["piste:type"~"^(downhill|nordic|sled)$"]${box};);out tags geom;`;
}

async function loadTile(tile){
  const file = cachePath('pistes', `${tile[0]}_${tile[1]}.json`);
  if(fs.existsSync(file)) return { data: JSON.parse(fs.readFileSync(file, 'utf8')), fetchedAt: fs.statSync(file).mtime };
  if(offline) throw new Error(`Piste tile ${tile.join(',')} is not cached; run without --offline`);
  let lastError = null;
  for(let attempt = 0; attempt < 6; attempt += 1){
    const endpoint = OVERPASS_URLS[attempt % OVERPASS_URLS.length];
    try{
      const text = await fetchText(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(tileQuery(tile))}`,
      }, 240000);
      const data = JSON.parse(text);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      return { data, fetchedAt: new Date() };
    }catch(error){
      lastError = error;
      await sleep(15000 * (attempt + 1));
    }
  }
  throw new Error(`Piste tile ${tile.join(',')}: every Overpass mirror failed (${lastError && lastError.message})`);
}

async function loadBoardPage(url){
  const file = cachePath('boards', `${crypto.createHash('sha1').update(url).digest('hex')}.html`);
  if(fs.existsSync(file)) return { html: fs.readFileSync(file, 'utf8'), accessedAt: fs.statSync(file).mtime };
  if(offline) return null;
  try{
    const html = await fetchText(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) ORMA trail seasons builder' } }, 30000);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    return { html, accessedAt: new Date() };
  }catch(error){
    console.warn(`Board page not read: ${url} (${error.message})`);
    return null;
  }
}

// ---- measuring the line against the pistes -------------------------------

const R = 6371000, RAD = Math.PI / 180, CELL = 0.002;
const haversine = (a, b) => {
  const dLat = (b[0] - a[0]) * RAD, dLng = (b[1] - a[1]) * RAD;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

function pisteIndex(tiles){
  const lines = [], areas = [], seen = new Set(), grid = new Map();
  for(const { data } of tiles){
    for(const element of data.elements || []){
      const key = element.type + element.id;
      if(seen.has(key)) continue;
      seen.add(key);
      const tags = element.tags || {};
      const geometries = element.type === 'way' ? [element.geometry] : (element.members || []).filter(m => m.geometry).map(m => m.geometry);
      for(const geometry of geometries){
        if(!geometry || geometry.length < 2) continue;
        const pts = geometry.map(p => [p.lat, p.lon]);
        const closed = pts.length > 3 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1];
        const record = { kind: tags['piste:type'], name: tags['piste:name'] || tags.name || tags['piste:ref'] || tags.ref || '', pts };
        (closed && (tags.area === 'yes' || tags.landuse === 'winter_sports') ? areas : lines).push(record);
      }
    }
  }
  lines.forEach((line, li) => {
    for(let i = 1; i < line.pts.length; i += 1){
      const a = line.pts[i - 1], b = line.pts[i];
      for(let x = Math.floor(Math.min(a[0], b[0]) / CELL); x <= Math.floor(Math.max(a[0], b[0]) / CELL); x += 1){
        for(let y = Math.floor(Math.min(a[1], b[1]) / CELL); y <= Math.floor(Math.max(a[1], b[1]) / CELL); y += 1){
          const k = `${x}:${y}`;
          if(!grid.has(k)) grid.set(k, []);
          grid.get(k).push([li, i]);
        }
      }
    }
  });
  return { lines, areas, grid };
}

function segmentDistance(p, a, b){
  const k = Math.cos(p[0] * RAD) * R * RAD;
  const P = [p[1] * k, p[0] * R * RAD], A = [a[1] * k, a[0] * R * RAD], B = [b[1] * k, b[0] * R * RAD];
  const dx = B[0] - A[0], dy = B[1] - A[1];
  let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / ((dx * dx + dy * dy) || 1);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(P[0] - A[0] - t * dx, P[1] - A[1] - t * dy);
}

function insideArea(p, ring){
  let inside = false;
  for(let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1){
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function nearestPiste(index, p){
  let best = null, bestD = Infinity;
  const x0 = Math.floor(p[0] / CELL), y0 = Math.floor(p[1] / CELL);
  for(let x = x0 - 1; x <= x0 + 1; x += 1){
    for(let y = y0 - 1; y <= y0 + 1; y += 1){
      for(const [li, i] of index.grid.get(`${x}:${y}`) || []){
        const d = segmentDistance(p, index.lines[li].pts[i - 1], index.lines[li].pts[i]);
        if(d < bestD){ bestD = d; best = index.lines[li]; }
      }
    }
  }
  if(bestD <= TOLERANCE_M) return best;
  return index.areas.find(area => insideArea(p, area.pts)) || null;
}

// Samples the line every ~10 m and gathers the stretches that lie on a piste;
// a stretch under MIN_RUN_M is a crossing. Kinds under WINTER_USE_MIN_KM in
// all are dropped.
function winterUse(index, line){
  const runs = [];
  let current = null;
  for(let i = 1; i < line.length; i += 1){
    const a = line[i - 1], b = line[i];
    const d = haversine(a, b);
    const n = Math.max(1, Math.ceil(d / 10));
    for(let k = 0; k < n; k += 1){
      const t = (k + 0.5) / n;
      const hit = nearestPiste(index, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      if(hit && current && current.kind === hit.kind){
        current.m += d / n;
        if(usefulName(hit.name)) current.names.add(hit.name);
      }else{
        if(current) runs.push(current);
        current = hit ? { kind: hit.kind, m: d / n, names: new Set(usefulName(hit.name) ? [hit.name] : []) } : null;
      }
    }
  }
  if(current) runs.push(current);
  const byKind = new Map();
  for(const run of runs.filter(r => r.m >= MIN_RUN_M)){
    const entry = byKind.get(run.kind) || { kind: run.kind, m: 0, names: new Set() };
    entry.m += run.m;
    run.names.forEach(name => entry.names.add(name));
    byKind.set(run.kind, entry);
  }
  return [...byKind.values()]
    .map(entry => ({ kind: entry.kind, km: Math.round(entry.m / 100) / 10, names: [...entry.names].slice(0, 3) }))
    .filter(entry => entry.km >= WINTER_USE_MIN_KM)
    .sort((a, b) => b.km - a.km);
}

// ---- board months ---------------------------------------------------------

function boardUrls(trail){
  const urls = [
    ...(trail.sourceLinks || []).map(link => link && link.url),
    ...((trail.routeNumberGuidance && trail.routeNumberGuidance.sources) || []).map(source => source && source.url),
    trail.routeNumberSource && trail.routeNumberSource.url,
  ].filter(url => typeof url === 'string' && /^https:\/\//.test(url) && !NOT_A_BOARD.test(url));
  return [...new Set(urls)];
}

function boardLabel(url){
  const host = new URL(url).hostname.replace(/^www\./, '');
  const key = Object.keys(BOARD_LABELS).find(domain => host === domain || host.endsWith(`.${domain}`));
  return key ? BOARD_LABELS[key] : host;
}

const day = date => date.toISOString().slice(0, 10);

async function main(){
  const trails = loadProductionTrails(root, undefined, { seasons: false }).filter(t => t.region === REGION && Array.isArray(t.path) && t.path.length > 1);
  const tileKeys = [...new Set(trails.flatMap(t => t.path.map(p => `${Math.floor(p[0] / TILE)},${Math.floor(p[1] / TILE)}`)))].sort();
  const tiles = [];
  for(const key of tileKeys) tiles.push(await loadTile(key.split(',').map(Number)));
  const index = pisteIndex(tiles);
  const pistesReadAt = new Date(Math.min(...tiles.map(t => +t.fetchedAt)));

  const out = {};
  let fromBoard = 0, estimated = 0, withWinterUse = 0;
  for(const trail of trails){
    const season = {};
    const verified = !!(trail.graduation && trail.graduation.status === 'verified');
    // Only a verified walk's links are known to be its own board page.
    for(const url of verified ? boardUrls(trail) : []){
      const page = await loadBoardPage(url);
      const months = page && parseBoardMonths(page.html);
      if(months){
        season.recommended = { months, source: { label: boardLabel(url), url, accessedAt: day(page.accessedAt) } };
        break;
      }
    }
    if(!season.recommended){
      const highPoint = Math.max(0, ...(trail.elevationProfile || []).map(point => point.elev).filter(Number.isFinite));
      const snow = snowEstimate(highPoint);
      if(snow) season.snow = snow;
    }
    const uses = winterUse(index, trail.path);
    if(uses.length) season.winterUse = uses;
    if(!season.recommended && !season.snow && !season.winterUse) continue;
    validateSeason(trail.id, season);
    out[trail.id] = season;
    if(season.recommended) fromBoard += 1; else if(season.snow) estimated += 1;
    if(season.winterUse) withWinterUse += 1;
  }

  const artifact = {
    contractVersion: 'trail-seasons-v1',
    generatedAt: new Date().toISOString(),
    note: 'When in the year each Dolomites walk is a walk. recommended: the months the walk\'s tourist board marks as its season, read off the board\'s page. snow: where no board publishes months, the snowy months estimated from the walk\'s high point (2,000 m and over: November to May; 1,600 m and over: December to April; lower: snow possible December to February). winterUse: stretches of the line mapped as a ski run, sled run or cross-country track, 0.5 km or more of a kind. Written by npm run build:trail-seasons; nothing here is a verification.',
    sources: {
      winterUse: {
        label: 'Read off the map (OpenStreetMap)',
        url: 'https://www.openstreetmap.org/copyright',
        accessedAt: day(pistesReadAt),
      },
    },
    trails: Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${trails.length} walks: ${fromBoard} with board months, ${estimated} estimated from altitude, ${withWinterUse} with winter use (${index.lines.length} piste lines, ${index.areas.length} areas).`);
}

if(require.main === module){
  main().catch(error => { console.error(error); process.exit(1); });
}

module.exports = { winterUse, pisteIndex, boardUrls, boardLabel, tileQuery };
