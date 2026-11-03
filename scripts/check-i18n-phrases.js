#!/usr/bin/env node
'use strict';

// Every sentence a script wraps in tx() or phraseTx() is its own key in
// i18n-phrases-it.js. One missing there is shown in English to Italian readers;
// this lists them, and the quality gate fails on any.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { isGeneratedDirectory } = require('./generated-directories');

const ROOT = path.resolve(__dirname, '..');
const CALL = /(?:^|[^\w$.])(?:tx|phraseTx|L)\(\s*'((?:\\.|[^'\\\n])*)'/gm;

function sourceFiles(directory = ROOT, output = []){
  for(const entry of fs.readdirSync(directory, { withFileTypes:true })){
    if(isGeneratedDirectory(entry.name) || entry.name === 'experiments') continue;
    const absolute = path.join(directory, entry.name);
    if(entry.isDirectory()) sourceFiles(absolute, output);
    else if(/\.(?:js|html)$/.test(entry.name) && !entry.name.endsWith('.test.js')
      && entry.name !== 'trail-app.bundle.js') output.push(absolute);
  }
  return output;
}

function phrasesInUse(root = ROOT){
  const used = new Map();
  for(const file of sourceFiles(root)){
    const source = fs.readFileSync(file, 'utf8');
    for(const match of source.matchAll(CALL)){
      const phrase = Function(`"use strict"; return '${match[1]}';`)();
      if(!used.has(phrase)) used.set(phrase, path.relative(root, file));
    }
  }
  return used;
}

function italianTable(root = ROOT){
  const context = { window:{} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'i18n-phrases-it.js'), 'utf8'), context);
  return context.window.ORMA_PHRASES_IT || {};
}

function check(root = ROOT){
  const table = italianTable(root);
  const errors = [];
  const placeholders = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  for(const [phrase, file] of phrasesInUse(root)){
    if(!Object.prototype.hasOwnProperty.call(table, phrase)) errors.push(`No Italian for "${phrase}" (${file})`);
    else if(placeholders(phrase) !== placeholders(table[phrase])) errors.push(`Placeholders differ for "${phrase}"`);
  }
  return { used:phrasesInUse(root).size, entries:Object.keys(table).length, errors };
}

if(require.main === module){
  const result = check();
  result.errors.forEach(error => console.error(`[i18n-phrases] ${error}`));
  if(result.errors.length) process.exitCode = 1;
  else console.log(`[i18n-phrases] ${result.used} script phrases, all with Italian (${result.entries} entries).`);
}

module.exports = { phrasesInUse, italianTable, check };
