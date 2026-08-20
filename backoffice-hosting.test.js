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
    expect(html).toContain('trail-dossier-desk.js?v=20260820-5');
  });

  test('hosted trail content desk requests the durable publication receipt asset',()=>{
    const html=fs.readFileSync(path.join(output,'trail-content-desk.html'),'utf8');
    const script=fs.readFileSync(path.join(output,'trail-content-desk.js'),'utf8');
    expect(html).toContain('backoffice/content-receipt-model.js?v=20260820-4');
    expect(html).toContain('trail-content-desk.js?v=20260820-9');
    expect(script).toContain("job.jobType==='verified-trail-editorial-first-pass'");
    expect(script).toContain("Exactly one fully licensed ready image is required before approval");
  });

  test('hosted dashboard exposes only protected trail desk links',()=>{
    const html=fs.readFileSync(path.join(output,'backoffice-review.html'),'utf8');
    expect(html).toContain('One linear trail workflow');
    expect(html).toContain('What happened after your clicks');
    expect(html).toContain('What ORMA automation does');
    expect(html).toContain('backoffice-review.css?v=20260820-13');
    expect(html).toContain('id="workerHealth"');
    expect(html).toContain('id="campaignHealth"');
    expect(html).toContain('backoffice/dashboard-model.js?v=20260820-8');
    expect(html).toContain('backoffice-hosted-dashboard.js?v=20260820-7');
    expect(html).toContain('href="trail-dossier-desk.html"');
    expect(html).not.toMatch(/href="(?:content|new-trail-scouting|hazard-review|image-coverage|newsletter|social|product-ideas)-desk\.html"/);
  });

  test.each([
    ['backoffice-review.html','Home'],
    ['trail-dossier-desk.html','Trail evidence'],
    ['trail-content-desk.html','Content &amp; release'],
  ])('%s has persistent navigation and a clear current location',(page,current)=>{
    const html=fs.readFileSync(path.join(output,page),'utf8');
    expect(html).toContain('aria-label="Backoffice navigation"');
    expect(html).toContain('href="backoffice-review.html"');
    expect(html).toContain('href="trail-dossier-desk.html"');
    expect(html).toContain('href="trail-content-desk.html"');
    expect(html).toContain(`aria-current="page">${current}</a>`);
  });

  test('moderator-facing trail pages explain automation without vague worker language',()=>{
    const files=['backoffice-review.html','trail-dossier-desk.html','trail-content-desk.html','backoffice-hosted-dashboard.js','trail-dossier-desk.js','trail-content-desk.js','backoffice/dashboard-model.js','backoffice/content-receipt-model.js'];
    const text=files.map(file=>fs.readFileSync(path.join(output,file),'utf8')).join('\n');
    expect(text).toContain('ORMA automation');
    expect(text).not.toMatch(/waiting for the worker|the worker will|worker processed|independent worker/i);
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

  test('scheduled worker records a durable start and always-run completion receipt',()=>{
    const workflow=fs.readFileSync(path.join(__dirname,'.github/workflows/orma-backoffice-worker.yml'),'utf8');
    expect(workflow).toContain('name: Record worker start');
    expect(workflow).toContain('ORMA_WORKER_HEALTH_PHASE=start');
    expect(workflow).toContain('name: Record worker completion');
    expect(workflow).toContain('if: ${{ always() }}');
    expect(workflow).toContain('ORMA_WORKER_HEALTH_PHASE=finish');
    expect(workflow).toContain('ORMA_WORKER_FAILURE_STAGE="$stage"');
    expect(workflow).toContain('force_publication_retry:');
    expect(workflow).toContain("ORMA_PUBLICATION_FORCE_RETRY: ${{ github.event.inputs.force_publication_retry || 'false' }}");
    expect(workflow).toContain("ORMA_CAMPAIGN_AUTOMATION_ENABLED: ${{ vars.ORMA_CAMPAIGN_AUTOMATION_ENABLED || 'false' }}");
  });

  test('daily campaign and worker catch-up share one lock and due-only receipts',()=>{
    const campaign=fs.readFileSync(path.join(__dirname,'.github/workflows/orma-trail-campaign.yml'),'utf8');
    expect(campaign).toContain('group: orma-backoffice-worker');
    expect(campaign).toContain('--scheduled');
    const dashboard=fs.readFileSync(path.join(output,'backoffice-hosted-dashboard.js'),'utf8');
    expect(dashboard).toContain("optional(remote,'trail-campaign-health',null)");
  });
});
