#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const path=require('path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist','backoffice');

const files=[
  'backoffice-firebase.js','backoffice-login.js','backoffice-auth-guard.js','backoffice-session.js',
  'backoffice-hosted-dashboard.js','trail-dossier-desk.js','trail-content-desk.js','backoffice/dashboard-model.js',
  'new-trail-scouting-desk.js','hazard-review-desk.js','editorial-desk.js','image-coverage-hosted.js','newsletter-hosted.js','analyst-hosted.js',
  'backoffice-review.css','styles.css','favicon-32.png','logo.svg','backoffice/content-review-decisions.js','backoffice/content-receipt-model.js',
];

async function copy(relative){
  const target=path.join(output,relative);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(path.join(root,relative),target);
}

async function hostedPage(source,target=source){
  let html=await fs.readFile(path.join(root,source),'utf8');
  html=html.replace(/src="firebase-init\.js(?:\?[^\"]*)?"/g,'src="backoffice-firebase.js?v=20260820-1"');
  html=html.replace(/src="backoffice-firebase\.js(?:\?[^\"]*)?"/g,'src="backoffice-firebase.js?v=20260820-1"');
  html=html.replace(/<a href="content-desk\.html">Guide content edit ↗<\/a>/g,'<span class="bo-hosted-separation">Guide editing remains in the separate Editorial flow.</span>');
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
  await hostedPage('trail-dossier-desk.html');
  await hostedPage('trail-content-desk.html');
  await hostedPage('new-trail-scouting-desk.html');
  await hostedPage('hazard-review-desk.html');
  await hostedPage('editorial-desk.html');
  await hostedPage('image-coverage-hosted.html','image-coverage-desk.html');
  await hostedPage('newsletter-hosted.html','newsletter-desk.html');
  await hostedPage('analyst-hosted.html','product-ideas-desk.html');
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
