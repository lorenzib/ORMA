'use strict';

const fs=require('fs/promises');
const path=require('path');
const {MAX_AUTOMATED_ATTEMPTS,RETRY_DELAYS_HOURS}=require('../contracts/resolution-policy-v1');

async function read(root,relative){return fs.readFile(path.join(root,relative),'utf8');}

async function auditOperationalContract(root=path.resolve(__dirname,'../..'),options={}){
  const workflowDir=path.join(root,'.github/workflows');
  const workflowNames=(await fs.readdir(workflowDir)).filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
  const workflowEntries=await Promise.all(workflowNames.map(async name=>[name,await read(root,`.github/workflows/${name}`)]));
  const workflows=Object.fromEntries(workflowEntries);const workflowText=workflowEntries.map(([,value])=>value).join('\n');
  const [builder,rules,client,worker,strategy,editorialScope,standard,hosting,dashboard,packageManifest,firebaseJson,materializer]=await Promise.all([
    read(root,'scripts/build-backoffice-hosting.js'),read(root,'firestore.rules'),read(root,'backoffice-firebase.js'),
    read(root,'backoffice/workflows/run-live-backoffice-worker.js'),read(root,'backoffice/workflows/run-live-strategy-cycle.js'),
    read(root,'backoffice/workflows/editorial-scope.js'),
    read(root,'backoffice/OPERATING_STANDARD.md'),read(root,'backoffice/HOSTING.md'),read(root,'backoffice/dashboard-model.js'),read(root,'package.json'),
    read(root,'firebase.json'),read(root,'backoffice/workflows/materialize-approved-trail-images.js'),
  ]);
  const checks=[];const add=(id,ok,detail)=>checks.push({id,status:ok?'pass':'fail',detail});
  const hostedPages=['trail-dossier-desk.html','trail-content-desk.html','new-trail-scouting-desk.html','hazard-review-desk.html','editorial-desk.html','image-coverage-desk.html','newsletter-desk.html','product-ideas-desk.html','designer-desk.html'];
  add('six-team-hosted-desks',hostedPages.every(page=>builder.includes(`'${page}'`)),`${hostedPages.length} protected desk routes are allowlisted`);
  const reviewCollections=['backofficeDossierReviews','backofficeReviews','backofficePublicationReviews','backofficeNewTrailReviews','backofficeHazardReviews','backofficeEditorialReviews','backofficeImageReviews','backofficeNewsletterReviews','backofficeAnalystReviews'];
  add('immutable-review-contracts',reviewCollections.every(name=>rules.includes(`/${name}/{`)&&client.includes(`'${name}'`)),`${reviewCollections.length} moderator review collections have client and rules contracts`);
  add('hosted-worker-coverage',['ingestEditorialReviews','ingestImageReviews','ingestNewsletterReviews','ingestAnalystReviews'].every(name=>worker.includes(name)),'Trail-photo decisions remain active and parked Editorial, Newsletter and Analyst handlers remain recoverable');
  add('mvp-strategy-pause',!workflows['orma-strategy-cycle.yml']?.includes('schedule:')&&strategy.includes('editorialEnabled')&&strategy.includes('analystEnabled')&&standard.includes('Strategy cycle: parked during the MVP phase'),'Scheduled strategy generation is parked while manual recovery preserves existing Editorial and Analyst artifacts');
  add('five-attempt-resolution',MAX_AUTOMATED_ATTEMPTS===5&&JSON.stringify(RETRY_DELAYS_HOURS)===JSON.stringify([0,1,6,24,72]),'Five materially different evidence attempts are scheduled at 0, 1, 6, 24 and 72 hours');
  add('publication-failure-receipts',workflows['orma-backoffice-worker.yml']?.includes('Record publication automation failure')&&workflows['orma-backoffice-worker.yml']?.includes('force_publication_retry'),'Publication approval is retained through durable failure receipts and an explicit recovery input');
  const publicationWorkflow=workflows['orma-backoffice-worker.yml']||'';
  add('publication-validation-circuit-breaker',publicationWorkflow.includes('backoffice:publication-gate')&&publicationWorkflow.includes("if: steps.website_gate.outputs.publication_allowed == 'true'")&&publicationWorkflow.includes('outcome="blocked"')&&dashboard.includes("artifact.status==='blocked'"),'A red or missing Validate ORMA result pauses only website materialization, preserves approvals, and appears as a blocked dashboard heartbeat while queue work continues');
  const publicationArtifacts=['data/verified-trail-overrides.json','data/trail-image-overrides.json','images/trails','data/generated/trail-validation-report.json','data/regions','data/regions-manifest.json','regions-runtime-manifest.js','trails','sitemap.xml','browse-trails.html'];
  add('publication-artifact-closure',publicationArtifacts.every(target=>publicationWorkflow.includes(target))&&publicationWorkflow.includes('git diff --quiet'),'Publication PRs stage every generated website target and fail closed when tracked output remains unstaged');
  const deploymentReceiptWorkflow=workflows['orma-publication-deployment-receipt.yml']||'';
  add('publication-deployment-receipts',publicationWorkflow.includes('actions: read')&&publicationWorkflow.includes('backoffice:find-pages-deployment')&&publicationWorkflow.includes('backoffice:confirm-publications')&&publicationWorkflow.includes('backoffice:confirm-trail-images')&&publicationWorkflow.includes('deployed-site/data/verified-trail-overrides.json')&&publicationWorkflow.includes('deployed-site/data/trail-image-overrides.json')&&deploymentReceiptWorkflow.includes('workflow_dispatch')&&deploymentReceiptWorkflow.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:confirm-publications')&&packageManifest.includes('backoffice:confirm-trail-images')&&dashboard.includes("status==='published'"),'The worker verifies a successful Pages run for the exact deployed commit, records both trail and trail-photo deployment receipts, and exposes the live links; the verifier remains manually recoverable');
  add('truthful-team-gates',standard.includes('Approval hands the issue to Social')&&standard.includes('or prototype never authorises development'),'Newsletter sending, Analyst implementation and Release remain explicitly gated');
  add('worker-cadence',workflows['orma-backoffice-worker.yml']?.includes("cron: '*/30 * * * *'")&&workflows['orma-backoffice-worker.yml']?.includes('ORMA_WORKER_AUTOMATION_ENABLED')&&standard.includes('every thirty minutes'),'The queue worker has a thirty-minute target and an activation variable');
  add('hourly-hazard-cadence',workflows['orma-hazard-watch.yml']?.includes("cron: '7 * * * *'")&&workflows['orma-hazard-watch.yml']?.includes('timezone: Europe/Rome'),'Groundskeeper targets minute 7 of every hour in Europe/Rome, clear of the quarter-hour queue worker');
  add('mvp-editorial-analyst-pause',workflows['orma-backoffice-worker.yml']?.includes("ORMA_EDITORIAL_ENABLED: 'false'")&&workflows['orma-backoffice-worker.yml']?.includes("ORMA_ANALYST_ENABLED: 'false'")&&standard.includes('Website copy generation is parked')&&standard.includes('Is parked during the MVP'),'Editorial copy and Analyst generation are parked without deleting their protected queues');
  add('daily-orma-verified-intake',workflows['orma-trail-campaign.yml']?.includes("cron: '30 9 * * *'")&&workflows['orma-trail-campaign.yml']?.includes('timezone: Europe/Rome')&&workflows['orma-trail-campaign.yml']?.includes('ORMA_CAMPAIGN_AUTOMATION_ENABLED'),'ORMA Verified candidate intake targets 09:30 Europe/Rome every day, after the Firestore quota reset window');
  add('dolomites-first-scouting-cadence',workflows['orma-new-trail-intake.yml']?.includes("cron: '0 10 * * 1-6'")&&workflows['orma-new-trail-intake.yml']?.includes('timezone: Europe/Rome')&&workflows['orma-new-trail-intake.yml']?.includes('ORMA_NEW_TRAIL_INTAKE_RESUMED')&&standard.includes('Dolomites-first')&&standard.includes('Scouting is paused during the'),'New Trail scouting is paused during the backfills and keeps its Dolomites-first Monday-to-Saturday cadence for resumption');
  add('trail-photo-coverage-cadence',workflows['orma-trail-image-coverage.yml']?.includes("cron: '0 11 * * *'")&&workflows['orma-trail-image-coverage.yml']?.includes('ORMA_IMAGE_AUTOMATION_ENABLED')&&workflows['orma-trail-image-coverage.yml']?.includes('backoffice:image-coverage:live')&&standard.includes('licensed candidate scouting: daily at 11:00'),'Trail-photo coverage and credited candidate scouting run daily with a separate activation variable and protected queue');
  const firebaseConfig=JSON.parse(firebaseJson);const rulesDeploy=workflows['deploy-firestore-rules.yml']||'';
  add('free-trail-photo-staging',!firebaseConfig.storage&&rules.includes('/backofficeImageUploads/{')&&rules.includes('fileSize <= 573440')&&client.includes("collection(db,'backofficeImageUploads')")&&client.includes('560*1024')&&materializer.includes('store.getImageUpload(request.uploadRef)')&&materializer.includes('size>560*1024')&&!rulesDeploy.includes('firestore,storage'),'Moderator photos use bounded private Firestore staging, move into GitHub after approval, and require no paid storage bucket');
  add('safety-editorial-pause',editorialScope.includes("'safety-guide'")&&editorialScope.includes("'paw-protection'")&&standard.includes('protected paused archive'),'Safety Library copy packets are excluded from the active Editorial queue and preserved in a paused archive');
  const setupNodeCount=(workflowText.match(/actions\/setup-node@v7/g)||[]).length;const node24Count=(workflowText.match(/node-version:\s*24/g)||[]).length;
  add('supported-ci-runtime',setupNodeCount>0&&node24Count===setupNodeCount&&!workflowText.includes('node-version: 20')&&!workflowText.match(/actions\/(?:checkout|setup-node|setup-java|cache)@v4/)&&!workflowText.includes('google-github-actions/auth@v2'),'All Node workflows use Node 24 and supported Node-24 action runtimes');
  add('private-hosting-boundary',hosting.includes('must never contain files')&&hosting.includes('`backoffice-data/`, `data/`')&&builder.includes("file.endsWith('.json')")&&builder.includes("file.startsWith(`backoffice-data${path.sep}`)")&&builder.includes("file.startsWith(`data${path.sep}`)"),'The Hosting allowlist excludes internal JSON and data directories');
  const failures=checks.filter(item=>item.status==='fail');
  return {contractVersion:'1.0.0',generatedAt:options.at||new Date().toISOString(),status:failures.length?'failed':'pass',summary:{passed:checks.length-failures.length,failed:failures.length,total:checks.length},checks,manualChecks:[
    {id:'github-actions-pr-creation',instruction:'Repository Settings → Actions → General must allow GitHub Actions to create pull requests before approved trail publication can recover.'},
    {id:'moderator-access',instruction:'The operator must sign in through the private backoffice with a Firebase moderator custom claim.'},
    {id:'social-launch',instruction:'Social credentials and channels remain deliberately disabled until the CEO explicitly launches them.'},
  ]};
}

module.exports={auditOperationalContract};
