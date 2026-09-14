#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const path=require('path');
const {createHash}=require('crypto');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist','backoffice');

const files=[
  'backoffice-firebase.js','backoffice-login.js','backoffice-auth-guard.js','backoffice-session.js',
  'backoffice-hosted-dashboard.js','trail-verify-desk.js','backoffice/dashboard-model.js',
  'moderation-page.js','moderation.css','community-content-states.js',
  'backoffice-review.css','styles.css','favicon-32.png','logo.svg','backoffice/content-review-decisions.js','backoffice/content-receipt-model.js',
];

async function copy(relative){
  const target=path.join(output,relative);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(path.join(root,relative),target);
}

// A cache key typed in by hand goes stale the moment someone forgets it. The
// desk shipped a fix on 2026-09-14 still asking for ?v=20260910-1, so browsers
// kept serving the previous file for an hour from the same URL, and the fix
// looked like it had not deployed. Deriving the key from the file means it
// changes exactly when the file does, and never otherwise.
async function assetVersion(relative){
  const contents=await fs.readFile(path.join(root,relative));
  return createHash('sha256').update(contents).digest('hex').slice(0,10);
}

async function assetVersions(){
  const versions=new Map();
  for(const relative of files){
    if(!/\.(?:js|css)$/.test(relative))continue;
    const version=await assetVersion(relative);
    // Pages reference these both bare and by path, so both resolve.
    versions.set(relative,version);versions.set(path.basename(relative),version);
  }
  return versions;
}

async function hostedPage(source,target=source,versions){
  let html=await fs.readFile(path.join(root,source),'utf8');
  const stamp=versions||await assetVersions();
  // The public page loads firebase-init.js; the hosted one loads the backoffice
  // build of it under a different name.
  const firebase=stamp.get('backoffice-firebase.js');
  html=html.replace(/src="firebase-init\.js(?:\?[^\"]*)?"/g,`src="backoffice-firebase.js?v=${firebase}"`);
  html=html.replace(/(src|href)="([\w./-]+\.(?:js|css))(?:\?[^\"]*)?"/g,(match,attribute,file)=>{
    const version=stamp.get(file);
    return version?`${attribute}="${file}?v=${version}"`:match;
  });

  const destination=path.join(output,target);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,html,'utf8');
}

async function walk(directory,prefix=''){
  const entries=await fs.readdir(directory,{withFileTypes:true});const result=[];
  for(const entry of entries){const relative=path.join(prefix,entry.name);const absolute=path.join(directory,entry.name);result.push(...(entry.isDirectory()?await walk(absolute,relative):[relative]));}
  return result;
}

async function build(){
  await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
  await Promise.all(files.map(copy));
  await hostedPage('backoffice-hosted-login.html','backoffice-login.html');
  await hostedPage('trail-verify-desk.html');
  await hostedPage('community-moderation-desk.html');
  await hostedPage('backoffice-hosted-review.html','backoffice-review.html');
  await fs.writeFile(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  await fs.writeFile(path.join(output,'404.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Private backoffice | ORMA</title></head><body><main><h1>Page not found</h1><p><a href="backoffice-login.html">Return to private sign in</a></p></main></body></html>','utf8');
  const built=await walk(output);
  const forbidden=built.filter(file=>file.endsWith('.json')||file.startsWith(`backoffice-data${path.sep}`)||file.startsWith(`data${path.sep}`));
  if(forbidden.length)throw new Error(`Unsafe backoffice Hosting files: ${forbidden.join(', ')}`);
  console.log(`Built ${built.length} private-interface files with no static review data.`);
  return {output,built};
}

if(require.main===module)build().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
module.exports={build,output};
