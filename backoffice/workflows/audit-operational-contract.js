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
  const [builder,rules,client,worker,strategy,standard,hosting,dashboard,packageManifest]=await Promise.all([
    read(root,'scripts/build-backoffice-hosting.js'),read(root,'firestore.rules'),read(root,'backoffice-firebase.js'),
    read(root,'backoffice/workflows/run-live-backoffice-worker.js'),read(root,'backoffice/workflows/run-live-strategy-cycle.js'),
    read(root,'backoffice/OPERATING_STANDARD.md'),read(root,'backoffice/HOSTING.md'),read(root,'backoffice/dashboard-model.js'),read(root,'package.json'),
  ]);
  const checks=[];const add=(id,ok,detail)=>checks.push({id,status:ok?'pass':'fail',detail});
  const hostedPages=['trail-dossier-desk.html','trail-content-desk.html','new-trail-scouting-desk.html','hazard-review-desk.html','editorial-desk.html','image-coverage-desk.html','newsletter-desk.html','product-ideas-desk.html'];
  add('six-team-hosted-desks',hostedPages.every(page=>builder.includes(`'${page}'`)),`${hostedPages.length} protected desk routes are allowlisted`);
  const reviewCollections=['backofficeDossierReviews','backofficeReviews','backofficePublicationReviews','backofficeNewTrailReviews','backofficeHazardReviews','backofficeEditorialReviews','backofficeImageReviews','backofficeNewsletterReviews','backofficeAnalystReviews'];
  add('immutable-review-contracts',reviewCollections.every(name=>rules.includes(`/${name}/{`)&&client.includes(`'${name}'`)),`${reviewCollections.length} moderator review collections have client and rules contracts`);
  add('hosted-worker-coverage',['ingestEditorialReviews','ingestImageReviews','ingestNewsletterReviews','ingestAnalystReviews'].every(name=>worker.includes(name)),'Editorial, images, Newsletter and Analyst decisions are consumed by the durable worker');
  add('strategy-team-coverage',['runEditorialCycle','auditImageCoverage','runProductDiscovery','runNewsletter'].every(name=>strategy.includes(name)),'The weekly strategy cycle refreshes all protected strategy desks');
  add('five-attempt-resolution',MAX_AUTOMATED_ATTEMPTS===5&&JSON.stringify(RETRY_DELAYS_HOURS)===JSON.stringify([0,1,6,24,72]),'Five materially different evidence attempts are scheduled at 0, 1, 6, 24 and 72 hours');
  add('publication-failure-receipts',workflows['orma-backoffice-worker.yml']?.includes('Record publication automation failure')&&workflows['orma-backoffice-worker.yml']?.includes('force_publication_retry'),'Publication approval is retained through durable failure receipts and an explicit recovery input');
  const publicationWorkflow=workflows['orma-backoffice-worker.yml']||'';
  const publicationArtifacts=['data/verified-trail-overrides.json','data/generated/trail-validation-report.json','data/regions','data/regions-manifest.json','regions-runtime-manifest.js','trails','sitemap.xml','browse-trails.html'];
  add('publication-artifact-closure',publicationArtifacts.every(target=>publicationWorkflow.includes(target))&&publicationWorkflow.includes('git diff --quiet'),'Publication PRs stage every generated website target and fail closed when tracked output remains unstaged');
  const deploymentReceiptWorkflow=workflows['orma-publication-deployment-receipt.yml']||'';
  add('publication-deployment-receipts',publicationWorkflow.includes('actions: read')&&publicationWorkflow.includes('backoffice:find-pages-deployment')&&publicationWorkflow.includes('backoffice:confirm-publications')&&publicationWorkflow.includes('deployed-site/data/verified-trail-overrides.json')&&deploymentReceiptWorkflow.includes('workflow_dispatch')&&deploymentReceiptWorkflow.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:confirm-publications')&&dashboard.includes("status==='published'"),'The five-minute worker verifies a successful Pages run for the exact deployed commit, matches deployed approval IDs, records a protected published receipt, clears the PR gate and exposes the live trail link; the same verifier remains manually recoverable');
  add('truthful-team-gates',standard.includes('Approval hands the issue to Social')&&standard.includes('or prototype never authorises development'),'Newsletter sending, Analyst implementation and Release remain explicitly gated');
  add('worker-cadence',workflows['orma-backoffice-worker.yml']?.includes("cron: '*/5 * * * *'")&&workflows['orma-backoffice-worker.yml']?.includes('ORMA_WORKER_AUTOMATION_ENABLED'),'The queue worker has a five-minute target and an activation variable');
  add('daily-hazard-cadence',workflows['orma-hazard-watch.yml']?.includes("cron: '15 7 * * *'")&&workflows['orma-hazard-watch.yml']?.includes('timezone: Europe/Rome'),'Groundskeeper targets 07:15 Europe/Rome daily');
  add('weekly-strategy-cadence',workflows['orma-strategy-cycle.yml']?.includes("cron: '0 12 * * 3'")&&workflows['orma-strategy-cycle.yml']?.includes('timezone: Europe/Rome'),'Strategy work targets Wednesday 12:00 Europe/Rome');
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
