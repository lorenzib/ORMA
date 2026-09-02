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

  test.each(['backoffice-login.html','trail-dossier-desk.html','trail-content-desk.html','new-trail-scouting-desk.html','hazard-review-desk.html','editorial-desk.html','image-coverage-desk.html','newsletter-desk.html','product-ideas-desk.html','designer-desk.html'])('%s uses the backoffice-only Firebase client',page=>{
    const html=fs.readFileSync(path.join(output,page),'utf8');
    expect(html).toMatch(/src="backoffice-firebase\.js\?v=[0-9-]+"/);
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

  test('hosted dashboard keeps the MVP trail lanes prominent and parks the rest',()=>{
    const html=fs.readFileSync(path.join(output,'backoffice-review.html'),'utf8');
    expect(html).toContain('Needs your decision');
    expect(html).toContain('MVP workstreams');
    expect(html).toContain('Parked for MVP');
    expect(html).toContain('backoffice-review.css?v=20260901-1');
    expect(html).toContain('id="workerHealth"');
    expect(html).toContain('id="campaignHealth"');
    expect(html).toContain('backoffice/dashboard-model.js?v=20260825-10');
    expect(html).toContain('backoffice-hosted-dashboard.js?v=20260902-1');
    expect(html).toContain('href="trail-dossier-desk.html"');
    expect(html).toContain('href="new-trail-scouting-desk.html"');
    expect(html).toContain('href="hazard-review-desk.html"');
    expect(html).toContain('href="image-coverage-desk.html"');
    expect(html).toContain('href="editorial-desk.html"');
    expect(html).toContain('href="newsletter-desk.html"');
    expect(html).toContain('href="product-ideas-desk.html"');
    expect(html).toContain('href="designer-desk.html"');
    expect(html).not.toContain('One linear trail workflow');
    expect(html).not.toContain('View all six ORMA teams');
    expect(html).not.toMatch(/href="(?:content|social)-desk\.html"/);
  });

  test('dashboard primary navigation contains only active MVP desks',()=>{
    const html=fs.readFileSync(path.join(output,'backoffice-review.html'),'utf8');
    const nav=html.match(/<nav class="bo-primary-nav"[\s\S]*?<\/nav>/)?.[0]||'';
    expect(nav).toContain('>Home</a>');
    expect(nav).toContain('>Existing Trails</a>');
    expect(nav).toContain('>New Trails</a>');
    expect(nav).toContain('>Trail photos</a>');
    expect(nav).toContain('>Hazards</a>');
    expect(nav).not.toMatch(/Editorial|Newsletter|Analyst|Design/);
  });

  test('dashboard does not fetch parked workstream artifacts',()=>{
    const script=fs.readFileSync(path.join(output,'backoffice-hosted-dashboard.js'),'utf8');
    expect(script).not.toMatch(/editorial-review-packet|strategy-cycle-status|newsletter-review-packet|approved-newsletters|product-ideas|product-investigation-results|product-design-results/);
    expect(script).toContain("optional(remote,'image-coverage'");
    expect(script).toContain("optional(remote,'new-trail-scouting'");
    expect(script).toContain("optional(remote,'hazard-review-queue'");
  });

  test('dashboard refreshes conservatively and pauses polling in hidden tabs',()=>{
    const script=fs.readFileSync(path.join(output,'backoffice-hosted-dashboard.js'),'utf8');
    expect(script).toContain('const REFRESH_SECONDS=300');
    expect(script).toContain("document.addEventListener('visibilitychange'");
    expect(script).toContain('if(loading||document.hidden)return');
  });

  test.each([
    ['trail-dossier-desk.html','Trail evidence'],
    ['trail-content-desk.html','Content &amp; release'],
    ['new-trail-scouting-desk.html','New Trails'],
    ['hazard-review-desk.html','Groundskeeper'],
    ['editorial-desk.html','Editorial'],
    ['image-coverage-desk.html','Editorial'],
    ['newsletter-desk.html','Newsletter'],
    ['product-ideas-desk.html','Analyst'],
    ['designer-desk.html','Design'],
  ])('%s has persistent navigation and a clear current location',(page,current)=>{
    const html=fs.readFileSync(path.join(output,page),'utf8');
    expect(html).toContain('aria-label="Backoffice navigation"');
    expect(html).toContain('href="backoffice-review.html"');
    expect(html).toContain('href="trail-dossier-desk.html"');
    expect(html).toContain('href="trail-content-desk.html"');
    expect(html).toContain('href="new-trail-scouting-desk.html"');
    expect(html).toContain('href="hazard-review-desk.html"');
    expect(html).toContain('href="editorial-desk.html"');
    expect(html).toContain('href="newsletter-desk.html"');
    expect(html).toContain('href="product-ideas-desk.html"');
    expect(html).toContain('href="designer-desk.html"');
    expect(html).toContain(`aria-current="page">${current}</a>`);
  });

  test('moderator-facing trail pages explain automation without vague worker language',()=>{
    const files=['backoffice-review.html','trail-dossier-desk.html','trail-content-desk.html','new-trail-scouting-desk.html','hazard-review-desk.html','editorial-desk.html','image-coverage-desk.html','newsletter-desk.html','product-ideas-desk.html','designer-desk.html','backoffice-hosted-dashboard.js','trail-dossier-desk.js','trail-content-desk.js','new-trail-scouting-desk.js','hazard-review-desk.js','editorial-desk.js','image-coverage-hosted.js','newsletter-hosted.js','analyst-hosted.js','designer-desk.js','backoffice/dashboard-model.js','backoffice/content-receipt-model.js'];
    const text=files.map(file=>fs.readFileSync(path.join(output,file),'utf8')).join('\n');
    expect(text).toContain('ORMA automation');
    expect(text).not.toMatch(/waiting for the worker|the worker will|worker processed|independent worker/i);
  });

  test('hosted sign-in accepts only the dedicated moderator credentials',()=>{
    const html=fs.readFileSync(path.join(output,'backoffice-login.html'),'utf8');
    expect(html).toContain('dedicated moderator email and password');
    expect(html).not.toContain('Continue with Google');
  });

  test('Analyst decisions keep validation and save receipts beside the clicked card',()=>{
    const html=fs.readFileSync(path.join(output,'product-ideas-desk.html'),'utf8');
    const script=fs.readFileSync(path.join(output,'analyst-hosted.js'),'utf8');
    expect(html).toContain('analyst-hosted.js?v=20260820-3');
    expect(script).toContain("receipt.setAttribute('aria-live','polite')");
    expect(script).toContain('Add the investigation or revision focus in the box above first.');
    expect(script).toContain('Saving this Analyst decision…');
    expect(script).toContain('designer-desk.html#design-');
    expect(script).not.toContain('mockupControls');
  });

  test('Design desk renders visual prototypes and owns their review gate',()=>{
    const html=fs.readFileSync(path.join(output,'designer-desk.html'),'utf8');
    const script=fs.readFileSync(path.join(output,'designer-desk.js'),'utf8');
    expect(html).toContain('Interactive mock-ups');
    expect(html).toContain('product-prototype.js?v=20260820-1');
    expect(html).toContain('designer-desk.js?v=20260820-1');
    expect(script).toContain("optional(remote,'product-design-results'");
    expect(script).toContain("subjectType:'mockup'");
    expect(script).toContain('approve-mockup-for-developer-brief');
    expect(script).toContain('request-mockup-revision');
    expect(script).toContain('Reject prototype');
  });

  test('Newsletter desk is visibly parked and preserves old issues as read-only',()=>{
    const home=fs.readFileSync(path.join(output,'backoffice-review.html'),'utf8');
    const html=fs.readFileSync(path.join(output,'newsletter-desk.html'),'utf8');
    const script=fs.readFileSync(path.join(output,'newsletter-hosted.js'),'utf8');
    expect(home).toContain('<summary>Parked for MVP</summary>');
    expect(home).toContain('Editorial copy, Newsletter, Social, Analyst and Design are paused.');
    expect(html).toContain('Newsletter on hold');
    expect(html).toContain('newsletter-hosted.js?v=20260820-2');
    expect(script).toContain('const NEWSLETTER_PARKED=true');
    expect(script).toContain('This preserved issue is read-only.');
  });

  test('Firebase and GitHub deploy only the named backoffice target',()=>{
    const firebase=JSON.parse(fs.readFileSync(path.join(__dirname,'firebase.json'),'utf8'));
    const targets=JSON.parse(fs.readFileSync(path.join(__dirname,'.firebaserc'),'utf8')).targets;
    const workflow=fs.readFileSync(path.join(__dirname,'.github/workflows/deploy-backoffice-hosting.yml'),'utf8');
    expect(firebase.hosting.target).toBe('backoffice');
    expect(targets.dolopaws.hosting.backoffice).toEqual(['dolopaws-backoffice']);
    expect(workflow).toContain('deploy --only hosting:backoffice');
    expect(workflow).toContain('- designer-desk.html');
    expect(workflow).toContain('- designer-desk.js');
    expect(workflow).toContain('- product-prototype.js');
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

  test('hosts Firestore-backed New Trails and Groundskeeper desks with no local data files',()=>{
    const newTrails=fs.readFileSync(path.join(output,'new-trail-scouting-desk.js'),'utf8');const groundskeeper=fs.readFileSync(path.join(output,'hazard-review-desk.js'),'utf8');
    expect(newTrails).toContain("getArtifact('new-trail-scouting')");expect(newTrails).toContain('submitNewTrailReview');
    expect(groundskeeper).toContain("getArtifact('dynamic-hazards')");expect(groundskeeper).toContain('submitHazardReview');
    expect(`${newTrails}\n${groundskeeper}`).toContain("const LOCAL_MODE=['127.0.0.1','localhost']");
  });
});
