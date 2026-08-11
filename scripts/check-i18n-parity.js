#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function dictionarySlices(source){
  const englishStart = source.indexOf('  en: {');
  const italianStart = source.indexOf('  it: {', englishStart);
  const end = source.indexOf('\n  }};', italianStart);
  if(englishStart < 0 || italianStart < 0 || end < 0){
    throw new Error('Could not locate the English and Italian dictionaries.');
  }
  return {
    en:source.slice(englishStart, italianStart),
    it:source.slice(italianStart, end),
  };
}

function entries(source){
  const result = new Map();
  const pattern = /^\s*'([^']+)'\s*:\s*((?:'(?:\\.|[^'])*')|(?:"(?:\\.|[^"])*"))\s*,?\s*$/gm;
  for(const match of source.matchAll(pattern)){
    // The dictionary is repository-owned source; evaluating only the matched
    // string literal preserves escaped apostrophes and markup accurately.
    const value = Function(`"use strict"; return ${match[2]};`)();
    result.set(match[1], value);
  }
  return result;
}

function placeholders(value){
  return [...new Set([...String(value).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(match => match[1]))].sort();
}

function walk(directory, predicate, output = []){
  for(const entry of fs.readdirSync(directory, { withFileTypes:true })){
    if(['.git', 'node_modules', 'experiments'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if(entry.isDirectory()) walk(absolute, predicate, output);
    else if(predicate(absolute)) output.push(absolute);
  }
  return output;
}

function referencedKeys(root = ROOT){
  const references = [];
  const files = walk(root, file => /\.(?:html|js)$/.test(file) && !file.endsWith('.test.js'));
  for(const file of files){
    const source = fs.readFileSync(file, 'utf8');
    if(file.endsWith('.html')){
      for(const match of source.matchAll(/data-i18n(?:-placeholder|-title|-aria-label)?\s*=\s*["']([^"']+)["']/g)){
        references.push({ key:match[1], file:path.relative(root, file) });
      }
    }
    if(path.basename(file) !== 'i18n.js'){
      for(const match of source.matchAll(/(?:^|[^\w$.])(?:window\.)?t\(\s*["']([^"']+)["']\s*(?=[,)])/gm)){
        references.push({ key:match[1], file:path.relative(root, file) });
      }
    }
  }
  return references;
}

function audit(root = ROOT){
  const source = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');
  const slices = dictionarySlices(source);
  const en = entries(slices.en);
  const it = entries(slices.it);
  const errors = [];
  for(const key of en.keys()) if(!it.has(key)) errors.push(`Missing Italian key: ${key}`);
  for(const key of it.keys()) if(!en.has(key)) errors.push(`Missing English key: ${key}`);
  for(const [key, value] of en){
    if(!it.has(key)) continue;
    const enVars = placeholders(value);
    const itVars = placeholders(it.get(key));
    if(JSON.stringify(enVars) !== JSON.stringify(itVars)){
      errors.push(`Placeholder mismatch for ${key}: en={${enVars}} it={${itVars}}`);
    }
  }
  for(const reference of referencedKeys(root)){
    if(!en.has(reference.key)) errors.push(`Unknown i18n key ${reference.key} in ${reference.file}`);
  }
  return { en, it, errors };
}

function main(){
  const result = audit();
  if(result.errors.length){
    result.errors.forEach(error => console.error(`[i18n] ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`[i18n] ${result.en.size} English and Italian keys; references and placeholders match.`);
}

if(require.main === module) main();

module.exports = { dictionarySlices, entries, placeholders, referencedKeys, audit };
