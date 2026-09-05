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
  const [builder,rules,client,worker,hazards,vetting,standard,hosting,dashboard,packageManifest,firebaseJson,materializer]=await Promise.all([
    read(root,'scripts/build-backoffice-hosting.js'),read(root,'firestore.rules'),read(root,'backoffice-firebase.js'),
    read(root,'backoffice/workflows/run-live-backoffice-worker.js'),
    read(root,'backoffice/workflows/dynamic-hazards.js'),read(root,'backoffice/workflows/community-hazard-vetting.js'),
    read(root,'backoffice/OPERATING_STANDARD.md'),read(root,'backoffice/HOSTING.md'),read(root,'backoffice/dashboard-model.js'),read(root,'package.json'),
    read(root,'firebase.json'),read(root,'backoffice/workflows/materialize-approved-trail-images.js'),
  ]);
  const checks=[];const add=(id,ok,detail)=>checks.push({id,status:ok?'pass':'fail',detail});
  const hostedPages=['trail-dossier-desk.html','trail-content-desk.html','new-trail-scouting-desk.html','hazard-review-desk.html','image-coverage-desk.html'];
  add('backfill-hosted-desks',hostedPages.every(page=>builder.includes(`'${page}'`))&&!builder.includes("'editorial-desk.html'")&&!builder.includes("'newsletter-desk.html'")&&!builder.includes("'product-ideas-desk.html'")&&!builder.includes("'designer-desk.html'"),`${hostedPages.length} protected desk routes are allowlisted and the retired lanes are gone`);
  const reviewCollections=['backofficeDossierReviews','backofficeReviews','backofficePublicationReviews','backofficeNewTrailReviews','backofficeHazardReviews','backofficeImageReviews'];
  add('immutable-review-contracts',reviewCollections.every(name=>rules.includes(`/${name}/{`)&&client.includes(`'${name}'`)),`${reviewCollections.length} moderator review collections have client and rules contracts`);
  add('backfill-worker-coverage',['ingestImageReviews','ingestHazardReviews','ingestDossierReviews'].every(name=>worker.includes(name))&&!worker.includes('ingestNewsletterReviews')&&!worker.includes('ingestAnalystReviews')&&!worker.includes('ingestEditorialReviews'),'The worker runs only the trail-photo, hazard and verification lanes; the retired lanes are removed rather than gated');
  add('five-attempt-resolution',MAX_AUTOMATED_ATTEMPTS===5&&JSON.stringify(RETRY_DELAYS_HOURS)===JSON.stringify([0,1,6,24,72]),'Five materially different evidence attempts are scheduled at 0, 1, 6, 24 and 72 hours');
  add('publication-failure-receipts',workflows['orma-backoffice-worker.yml']?.includes('Record publication automation failure')&&workflows['orma-backoffice-worker.yml']?.includes('force_publication_retry'),'Publication approval is retained through durable failure receipts and an explicit recovery input');
  const publicationWorkflow=workflows['orma-backoffice-worker.yml']||'';
  add('publication-validation-circuit-breaker',publicationWorkflow.includes('backoffice:publication-gate')&&publicationWorkflow.includes("if: steps.website_gate.outputs.publication_allowed == 'true'")&&publicationWorkflow.includes('outcome="blocked"')&&dashboard.includes("artifact.status==='blocked'"),'A red or missing Validate ORMA result pauses only website materialization, preserves approvals, and appears as a blocked dashboard heartbeat while queue work continues');
  const publicationArtifacts=['data/verified-trail-overrides.json','data/trail-image-overrides.json','images/trails','data/generated/trail-validation-report.json','data/regions','data/regions-manifest.json','regions-runtime-manifest.js','trails','sitemap.xml','browse-trails.html'];
  add('publication-artifact-closure',publicationArtifacts.every(target=>publicationWorkflow.includes(target))&&publicationWorkflow.includes('git diff --quiet'),'Publication PRs stage every generated website target and fail closed when tracked output remains unstaged');
  const deploymentReceiptWorkflow=workflows['orma-publication-deployment-receipt.yml']||'';
  add('publication-deployment-receipts',publicationWorkflow.includes('actions: read')&&publicationWorkflow.includes('backoffice:find-pages-deployment')&&publicationWorkflow.includes('backoffice:confirm-publications')&&publicationWorkflow.includes('backoffice:confirm-trail-images')&&publicationWorkflow.includes('deployed-site/data/verified-trail-overrides.json')&&publicationWorkflow.includes('deployed-site/data/trail-image-overrides.json')&&deploymentReceiptWorkflow.includes('workflow_dispatch')&&deploymentReceiptWorkflow.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:confirm-publications')&&packageManifest.includes('backoffice:confirm-trail-images')&&dashboard.includes("status==='published'"),'The worker verifies a successful Pages run for the exact deployed commit, records both trail and trail-photo deployment receipts, and exposes the live links; the verifier remains manually recoverable');
  add('retired-lanes-are-gone',standard.includes('lanes are\nretired')&&!standard.includes('### 4. Newsletter')&&!standard.includes('### 6. Analyst')&&packageManifest.includes('backoffice:worker:live')&&!packageManifest.includes('backoffice:strategy-cycle')&&!packageManifest.includes('backoffice:product-discovery'),'The Newsletter, Social, Analyst, Design and website-copy lanes are removed from the standard and the entry points, not merely gated');
  add('worker-cadence',workflows['orma-backoffice-worker.yml']?.includes("cron: '*/30 * * * *'")&&workflows['orma-backoffice-worker.yml']?.includes('ORMA_WORKER_AUTOMATION_ENABLED')&&standard.includes('every thirty minutes'),'The queue worker has a thirty-minute target and an activation variable');
  add('automatic-hazard-lifecycle',hazards.includes("if(successful.has(old.sourceKey) && expired) return;")&&!hazards.includes("state: 'resolution-review'")&&hazards.includes("old.origin === 'community'")&&worker.includes('processCommunityHazardReports')&&vetting.includes("webSearch:true")&&vetting.includes('reported-unverified')&&standard.includes('There is no human removal gate'),'Hazards are added and removed without a human gate, and customer reports are published only after the Hazard Analyst finds or fails to find independent corroboration');
  add('hourly-hazard-cadence',workflows['orma-hazard-watch.yml']?.includes("cron: '7 * * * *'")&&workflows['orma-hazard-watch.yml']?.includes('timezone: Europe/Rome'),'Groundskeeper targets minute 7 of every hour in Europe/Rome, clear of the quarter-hour queue worker');
  add('daily-orma-verified-intake',workflows['orma-trail-campaign.yml']?.includes("cron: '30 9 * * *'")&&workflows['orma-trail-campaign.yml']?.includes('timezone: Europe/Rome')&&workflows['orma-trail-campaign.yml']?.includes('ORMA_CAMPAIGN_AUTOMATION_ENABLED'),'ORMA Verified candidate intake targets 09:30 Europe/Rome every day, after the Firestore quota reset window');
  add('dolomites-first-scouting-cadence',workflows['orma-new-trail-intake.yml']?.includes("cron: '0 10 * * 1-6'")&&workflows['orma-new-trail-intake.yml']?.includes('timezone: Europe/Rome')&&workflows['orma-new-trail-intake.yml']?.includes('ORMA_NEW_TRAIL_INTAKE_RESUMED')&&standard.includes('Dolomites-first')&&standard.includes('Scouting is paused during the'),'New Trail scouting is paused during the backfills and keeps its Dolomites-first Monday-to-Saturday cadence for resumption');
  add('trail-photo-backfill',worker.includes('refreshTrailPhotoBackfill')&&!workflows['orma-trail-image-coverage.yml']&&materializer.includes('downloadLicensedImage')&&materializer.includes("status:'superseded-by-published-photo'")&&standard.includes('finite backfill that runs inside the worker'),'Trail-photo coverage is a finite backfill inside the worker pass; approved photos are copied into the repository and a published photo is never replaced');
  const firebaseConfig=JSON.parse(firebaseJson);const rulesDeploy=workflows['deploy-firestore-rules.yml']||'';
  add('free-trail-photo-staging',!firebaseConfig.storage&&rules.includes('/backofficeImageUploads/{')&&rules.includes('fileSize <= 573440')&&client.includes("collection(db,'backofficeImageUploads')")&&client.includes('560*1024')&&materializer.includes('store.getImageUpload(request.uploadRef)')&&materializer.includes('size>560*1024')&&!rulesDeploy.includes('firestore,storage'),'Moderator photos use bounded private Firestore staging, move into GitHub after approval, and require no paid storage bucket');
  const setupNodeCount=(workflowText.match(/actions\/setup-node@v7/g)||[]).length;const node24Count=(workflowText.match(/node-version:\s*24/g)||[]).length;
  add('supported-ci-runtime',setupNodeCount>0&&node24Count===setupNodeCount&&!workflowText.includes('node-version: 20')&&!workflowText.match(/actions\/(?:checkout|setup-node|setup-java|cache)@v4/)&&!workflowText.includes('google-github-actions/auth@v2'),'All Node workflows use Node 24 and supported Node-24 action runtimes');
  add('private-hosting-boundary',hosting.includes('must never contain files')&&hosting.includes('`backoffice-data/`, `data/`')&&builder.includes("file.endsWith('.json')")&&builder.includes("file.startsWith(`backoffice-data${path.sep}`)")&&builder.includes("file.startsWith(`data${path.sep}`)"),'The Hosting allowlist excludes internal JSON and data directories');
  const failures=checks.filter(item=>item.status==='fail');
  return {contractVersion:'1.0.0',generatedAt:options.at||new Date().toISOString(),status:failures.length?'failed':'pass',summary:{passed:checks.length-failures.length,failed:failures.length,total:checks.length},checks,manualChecks:[
    {id:'github-actions-pr-creation',instruction:'Repository Settings → Actions → General must allow GitHub Actions to create pull requests before approved trail publication can recover.'},
    {id:'moderator-access',instruction:'The operator must sign in through the private backoffice with a Firebase moderator custom claim.'},
  ]};
}

module.exports={auditOperationalContract};
