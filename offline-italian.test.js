'use strict';

// The offline page reads in Italian for an Italian reader, with no network:
// its fixed wording lives in offline/offline-app.js, and what only a walk knows
// (its name, start and hazards) travels in that walk's safety.json as textIt.
// A wording change on the page, or a new walk, must keep both complete.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
const packagesDir = path.join(root, 'offline', 'packages');

function italianTable(){
  const start = app.indexOf('const IT = {');
  const end = app.indexOf('\n  };\n', start);
  return vm.runInNewContext(`(${app.slice(start + 'const IT = '.length, end + 4)})`);
}

function italianNames(){
  const context = { window:{} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'i18n-trail-names-it.js'), 'utf8'), context);
  return context.window.ORMA_TRAIL_NAMES_IT;
}

const IT = italianTable();
const DURATION = /^(?:\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s+(?:hours?|minutes?)|(?:\d+ h(?: \d+ min)?|\d+ min)(?: – (?:\d+ h(?: \d+ min)?|\d+ min))?|\d+–\d+ h)$/;

describe('the offline page in Italian', () => {
  test('every line of the page itself has Italian', () => {
    const body = shell.slice(shell.indexOf('<body>'), shell.indexOf('<script'));
    const texts = body
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map(line => line.replace(/&[a-z]+;/g, '').trim())
      .filter(line => /[A-Za-z]{2}/.test(line) && line !== 'ORMA');
    const labels = [...body.matchAll(/(?:aria-label|alt)="([^"]+)"/g)].map(match => match[1]);
    const title = shell.match(/<title>([^<]+)<\/title>/)[1];
    const missing = [...new Set([title, ...texts, ...labels])].filter(text => !IT[text]);
    expect(missing).toEqual([]);
  });

  test('every sentence the script writes has Italian', () => {
    const missing = [...app.matchAll(/\bsay\('((?:[^'\\]|\\.)+)'/g)]
      .map(match => match[1].replace(/\\'/g, "'"))
      .filter(text => !IT[text]);
    expect([...new Set(missing)]).toEqual([]);
  });

  test('every package says in Italian what it shows', () => {
    const names = italianNames();
    const missing = [];
    for(const id of fs.readdirSync(packagesDir)){
      const safety = JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'safety.json'), 'utf8'));
      const manifest = JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'manifest.json'), 'utf8'));
      const own = safety.textIt || {};
      const known = text => text == null || own[text] || IT[text];
      if(names[id] !== manifest.name && !own[manifest.name]) missing.push(`${id}: name`);
      const shown = [
        safety.trailhead && safety.trailhead.label,
        safety.facts.routeType,
        safety.facts.difficulty,
        safety.emergency.note,
        ...safety.cautions,
        ...(safety.waypoints || []).map(point => point.reliability),
      ];
      shown.filter(text => !known(text)).forEach(text => missing.push(`${id}: ${text}`));
      if(safety.facts.expectedDuration && !DURATION.test(safety.facts.expectedDuration) &&
         !known(safety.facts.expectedDuration)){
        missing.push(`${id}: ${safety.facts.expectedDuration}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
