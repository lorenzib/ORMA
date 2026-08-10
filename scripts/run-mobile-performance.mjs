#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(projectRoot, 'config', 'performance-budgets.json');
const baselinePath = path.join(projectRoot, 'docs', 'performance', 'mobile-baseline.json');
const arg = name => process.argv.includes(name);
const writeBaseline = arg('--write-baseline');
const checkBudgets = arg('--check');
const runsOverride = Number(process.argv.find(value => value.startsWith('--runs='))?.split('=')[1]);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const scenarios = [
  {
    id: 'homepage',
    path: '/index.html',
    action: async page => {
      await page.waitForSelector('#hpSearch', { visible: true });
      await page.click('#hpSearch');
      await page.type('#hpSearch', 'Carezza');
    },
  },
  {
    id: 'discovery',
    path: '/browse-trails.html',
    action: async page => {
      await page.waitForSelector('#browseSearch', { visible: true });
      await page.click('#browseSearch');
      await page.type('#browseSearch', 'Carezza');
    },
  },
  {
    id: 'trail-detail',
    path: '/trail.html?id=lago-carezza',
    action: async page => {
      await page.waitForSelector('#mapExpandBtn', { visible: true });
      await page.click('#mapExpandBtn');
    },
  },
  {
    id: 'download-flow',
    path: '/trail.html?id=lago-carezza',
    action: async page => {
      await page.waitForSelector('#offlineDownloadBtn', { visible: true });
      await page.click('#offlineDownloadBtn');
      await page.waitForSelector('#authModal:not([hidden])', { timeout: 10000 });
    },
  },
  {
    id: 'active-hike',
    path: '/trail.html?id=lago-carezza',
    setup: async page => {
      await page.evaluateOnNewDocument(() => {
        const fix = {
          coords: {
            latitude: 46.4099,
            longitude: 11.5750,
            accuracy: 8,
            altitude: 1520,
            altitudeAccuracy: 12,
            heading: 0,
            speed: 1.2,
          },
          timestamp: Date.now(),
        };
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition(success){ setTimeout(() => success(fix), 20); },
            watchPosition(success){ setTimeout(() => success(fix), 20); return 1; },
            clearWatch(){},
          },
        });
        Object.defineProperty(navigator, 'wakeLock', {
          configurable: true,
          value: { request: async () => ({ release: async () => {}, addEventListener(){} }) },
        });
      });
    },
    action: async page => {
      await page.waitForFunction(() => typeof window.initHikeMode === 'function' && Array.isArray(window.trails));
      await page.evaluate(() => {
        const trail = window.trails.find(item => item.id === 'lago-carezza');
        if(!trail) throw new Error('Carezza trail data did not load');
        const container = document.createElement('div');
        container.id = 'perfActiveHikeSurface';
        container.style.cssText = 'position:fixed;inset:0;z-index:999;background:#dfe9d6;';
        document.body.appendChild(container);
        const sources = new Map();
        const fakeMap = {
          getContainer(){ return container; },
          on(){},
          getSource(id){ return sources.get(id) || null; },
          addSource(id, source){ sources.set(id, { ...source, setData(data){ this.data = data; } }); },
          addLayer(){},
          easeTo(){},
          getZoom(){ return 15; },
        };
        window.maplibregl = {
          Marker: class {
            setLngLat(){ return this; }
            addTo(){ return this; }
            remove(){}
          },
        };
        window.DoloPawsMapFS = { enter(){}, exit(){} };
        window.DoloPawsReadiness = { open(_trail, continuation){ continuation(); } };
        window.initHikeMode(fakeMap, trail);
      });
      await page.click('#mapStartHikeBtn');
      await page.waitForSelector('#mapHikeStatus', { visible: true });
    },
  },
];

function median(values){
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value, digits = 0){
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function aggregate(records){
  return {
    transferredKb: round(median(records.map(item => item.transferredBytes)) / 1024, 1),
    lcpMs: round(median(records.map(item => item.lcpMs))),
    inpMs: round(median(records.map(item => item.inpMs))),
    cls: round(median(records.map(item => item.cls)), 3),
    jsExecutionMs: round(median(records.map(item => item.jsExecutionMs))),
    requests: round(median(records.map(item => item.requests))),
  };
}

function budgetFrom(value){
  return {
    transferredKb: Math.ceil(value.transferredKb * 1.15 / 25) * 25,
    lcpMs: Math.max(2500, Math.ceil(value.lcpMs * 1.2 / 100) * 100),
    inpMs: Math.max(200, Math.ceil(value.inpMs * 1.25 / 25) * 25),
    cls: Math.max(0.1, Math.ceil(value.cls * 1.25 * 100) / 100),
    jsExecutionMs: Math.ceil(value.jsExecutionMs * 1.2 / 100) * 100,
  };
}

function startServer(){
  const server = http.createServer(async (request, response) => {
    try{
      const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
      const target = path.resolve(projectRoot, relative);
      if(target !== projectRoot && !target.startsWith(`${projectRoot}${path.sep}`)){
        response.writeHead(403).end('Forbidden');
        return;
      }
      const content = await fs.readFile(target);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      });
      response.end(content);
    }catch(error){
      response.writeHead(error && error.code === 'ENOENT' ? 404 : 500).end('Not found');
    }
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function installObservers(page){
  await page.evaluateOnNewDocument(() => {
    window.__doloPawsPerf = { lcpMs: 0, cls: 0, inpMs: 0 };
    try{
      new PerformanceObserver(list => {
        for(const entry of list.getEntries()) window.__doloPawsPerf.lcpMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    }catch(error){}
    try{
      new PerformanceObserver(list => {
        for(const entry of list.getEntries()){
          if(!entry.hadRecentInput) window.__doloPawsPerf.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }catch(error){}
    try{
      new PerformanceObserver(list => {
        for(const entry of list.getEntries()){
          window.__doloPawsPerf.inpMs = Math.max(window.__doloPawsPerf.inpMs, entry.duration || 0);
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    }catch(error){}
  });
}

async function measure(browser, origin, scenario){
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setCacheEnabled(false);
  await installObservers(page);
  if(scenario.setup) await scenario.setup(page);

  const client = await page.createCDPSession();
  await client.send('Network.enable');
  await client.send('Performance.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200 * 1024,
    uploadThroughput: 93.75 * 1024,
    connectionType: 'cellular4g',
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  let transferredBytes = 0;
  let requests = 0;
  client.on('Network.requestWillBeSent', () => { requests += 1; });
  client.on('Network.loadingFinished', event => { transferredBytes += event.encodedDataLength || 0; });

  try{
    // Map tiles and Firebase listeners can stay active after the visible UI is
    // ready. DOMContentLoaded plus each scenario's explicit ready selector is
    // a stable end condition; waiting for global network idleness is not.
    await page.goto(`${origin}${scenario.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await scenario.action(page);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const webVitals = await page.evaluate(() => ({ ...window.__doloPawsPerf }));
    const metrics = await client.send('Performance.getMetrics');
    const scriptDuration = metrics.metrics.find(item => item.name === 'ScriptDuration')?.value || 0;
    return {
      transferredBytes,
      requests,
      lcpMs: webVitals.lcpMs || 0,
      inpMs: webVitals.inpMs || 0,
      cls: webVitals.cls || 0,
      jsExecutionMs: scriptDuration * 1000,
    };
  }finally{
    await page.close();
  }
}

function printTable(results, budgets){
  console.table(Object.fromEntries(Object.entries(results).map(([id, value]) => [id, {
    'KB': value.transferredKb,
    'LCP ms': value.lcpMs,
    'INP ms': value.inpMs,
    'CLS': value.cls,
    'JS ms': value.jsExecutionMs,
    'requests': value.requests,
    'budget': budgets && budgets[id] ? 'checked' : 'baseline',
  }])));
}

function failuresFor(results, budgets){
  const failures = [];
  for(const [scenario, measured] of Object.entries(results)){
    const budget = budgets[scenario];
    if(!budget || !Object.keys(budget).length){
      failures.push(`${scenario}: budget has not been established`);
      continue;
    }
    for(const metric of ['transferredKb', 'lcpMs', 'inpMs', 'cls', 'jsExecutionMs']){
      if(measured[metric] > budget[metric]){
        failures.push(`${scenario} ${metric}: ${measured[metric]} > ${budget[metric]}`);
      }
    }
  }
  return failures;
}

const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const runCount = Number.isInteger(runsOverride) && runsOverride > 0
  ? runsOverride
  : config.conditions.runs;
const { server, origin } = await startServer();
let browser;

try{
  browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
  const raw = {};
  const results = {};
  for(const scenario of scenarios){
    raw[scenario.id] = [];
    for(let index = 0; index < runCount; index += 1){
      process.stdout.write(`Measuring ${scenario.id} ${index + 1}/${runCount}...\n`);
      raw[scenario.id].push(await measure(browser, origin, scenario));
    }
    results[scenario.id] = aggregate(raw[scenario.id]);
  }

  if(writeBaseline){
    const budgets = Object.fromEntries(Object.entries(results).map(([id, value]) => [id, budgetFrom(value)]));
    config.budgets = budgets;
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    await fs.mkdir(path.dirname(baselinePath), { recursive: true });
    await fs.writeFile(baselinePath, `${JSON.stringify({
      measuredAt: new Date().toISOString(),
      chrome: await browser.version(),
      profile: config.profile,
      conditions: { ...config.conditions, runs: runCount },
      results,
      raw,
    }, null, 2)}\n`);
    printTable(results, budgets);
    console.log(`Wrote ${path.relative(projectRoot, baselinePath)} and performance budgets.`);
  }else{
    printTable(results, config.budgets);
  }

  if(checkBudgets){
    const failures = failuresFor(results, config.budgets);
    if(failures.length){
      console.error('Performance budget failures:');
      failures.forEach(failure => console.error(`- ${failure}`));
      process.exitCode = 1;
    }else{
      console.log('All mobile performance budgets passed.');
    }
  }
}finally{
  if(browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
