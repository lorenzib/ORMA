'use strict';

const fs=require('fs');
const path=require('path');
const {build,output}=require('./scripts/build-backoffice-hosting');

describe('separate Firebase backoffice Hosting package',()=>{
  beforeAll(()=>build());

  test('contains only interface assets and no static review data',()=>{
    function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):path.join(directory,entry.name));}
    const files=walk(output).map(file=>path.relative(output,file));
    expect(files.some(file=>file.endsWith('.json'))).toBe(false);
    expect(files.some(file=>file.startsWith('backoffice-data/'))).toBe(false);
    expect(files.some(file=>file.startsWith('data/'))).toBe(false);
  });

  test.each(['backoffice-login.html','trail-dossier-desk.html','trail-content-desk.html'])('%s uses the backoffice-only Firebase client',page=>{
    const html=fs.readFileSync(path.join(output,page),'utf8');
    expect(html).toContain('src="backoffice-firebase.js"');
    expect(html).not.toContain('src="firebase-init.js');
  });

  test('hosted dossier desk requests the current revision-control asset',()=>{
    const html=fs.readFileSync(path.join(output,'trail-dossier-desk.html'),'utf8');
    expect(html).toContain('trail-dossier-desk.js?v=20260819-2');
  });

  test('hosted trail content desk requests the durable publication receipt asset',()=>{
    const html=fs.readFileSync(path.join(output,'trail-content-desk.html'),'utf8');
    expect(html).toContain('trail-content-desk.js?v=20260819-2');
  });

  test('hosted dashboard exposes only protected trail desk links',()=>{
    const html=fs.readFileSync(path.join(output,'backoffice-review.html'),'utf8');
    expect(html).toContain('One linear trail workflow');
    expect(html).toContain('What happened after your clicks');
    expect(html).toContain('backoffice/dashboard-model.js?v=20260819-1');
    expect(html).toContain('href="trail-dossier-desk.html"');
    expect(html).not.toMatch(/href="(?:content|new-trail-scouting|hazard-review|image-coverage|newsletter|social|product-ideas)-desk\.html"/);
  });

  test('hosted sign-in accepts only the dedicated moderator credentials',()=>{
    const html=fs.readFileSync(path.join(output,'backoffice-login.html'),'utf8');
    expect(html).toContain('dedicated moderator email and password');
    expect(html).not.toContain('Continue with Google');
  });

  test('Firebase and GitHub deploy only the named backoffice target',()=>{
    const firebase=JSON.parse(fs.readFileSync(path.join(__dirname,'firebase.json'),'utf8'));
    const targets=JSON.parse(fs.readFileSync(path.join(__dirname,'.firebaserc'),'utf8')).targets;
    const workflow=fs.readFileSync(path.join(__dirname,'.github/workflows/deploy-backoffice-hosting.yml'),'utf8');
    expect(firebase.hosting.target).toBe('backoffice');
    expect(targets.dolopaws.hosting.backoffice).toEqual(['dolopaws-backoffice']);
    expect(workflow).toContain('deploy --only hosting:backoffice');
  });
});
