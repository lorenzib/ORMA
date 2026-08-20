#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { loadProductionTrails } = require('./load-production-trails');
const { planCatalogueCampaign } = require('../backoffice/workflows/plan-catalogue-campaign');
const { planContentOperations } = require('../backoffice/workflows/plan-content-operations');
const { applyContentReview, recordVerifiedTrailReview } = require('../backoffice/workflows/apply-content-review');
const { buildPublicationStaging } = require('../backoffice/workflows/build-publication-staging');
const { buildVerifiedTrailRevisionJobs } = require('../backoffice/workflows/queue-verified-trail-revisions');
const { publishContentReview } = require('../backoffice/workflows/publish-content-review');
const { contentFingerprint, fingerprint, recordEditorialOutcome } = require('../backoffice/workflows/editorial-ledger');
const { runEditorialRevision } = require('../backoffice/workflows/run-editorial-revision');
const { applyDossierReview } = require('../backoffice/workflows/apply-dossier-review');
const { runProductDiscovery, runFocusedInvestigation } = require('../backoffice/workflows/run-product-discovery');
const { applyProductIdeaReview } = require('../backoffice/workflows/product-ideas-review');
const { auditImageCoverage } = require('../backoffice/workflows/audit-image-coverage');
const { applyImageCoverageReview } = require('../backoffice/workflows/image-coverage-review');
const { runHazardWatch } = require('../backoffice/cli/hazard-watch');
const { applyHazardReview } = require('../backoffice/workflows/dynamic-hazards');
const { planNewTrailScouting, applyNewTrailReview } = require('../backoffice/workflows/plan-new-trail-scouting');
const { runNewsletter } = require('../backoffice/workflows/run-newsletter');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.ORMA_BACKOFFICE_PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const campaignPath = path.join(root, 'backoffice-data', 'catalogue-campaign.json');
const campaignStatePath = path.join(root, 'backoffice-data', 'catalogue-campaign-state.json');
const contentOperationsPath = path.join(root, 'backoffice-data', 'content-operations.json');
const contentExecutionPath = path.join(root, 'backoffice-data', 'content-execution.json');
const editorialReviewPacketPaths = [1, 2, 3].map(slot => path.join(root, 'backoffice-data', `editorial-review-packet-${slot}.json`));
const newsletterReviewPacketPath = path.join(root, 'backoffice-data', 'newsletter-review-packet.json');
const verifiedTrailExecutionPath = path.join(root, 'backoffice-data', 'verified-trail-editorial-execution.json');
const contentReviewQueuePath = path.join(root, 'backoffice-data', 'content-review-queue.json');
const contentReviewResultPath = path.join(root, 'backoffice-data', 'content-review-last-result.json');
const editorialLedgerPath = path.join(root,'backoffice-data','editorial-ledger.json');
const verifiedTrailEditorialQueuePath = path.join(root, 'backoffice-data', 'verified-trail-editorial-queue.json');
const publicationStagingPath = path.join(root, 'backoffice-data', 'publication-staging.json');
const publicationReviewQueuePath = path.join(root, 'backoffice-data', 'publication-review-queue.json');
const verifiedTrailRevisionQueuePath = path.join(root, 'backoffice-data', 'verified-trail-revision-queue.json');
const trailOrchestrationPath=path.join(root,'backoffice-data','trail-orchestration.json');
const dossierReviewQueuePath=path.join(root,'backoffice-data','dossier-review-queue.json');
const specialistJobQueuePath=path.join(root,'backoffice-data','trail-specialist-job-queue.json');
const liveVerifiedRegistryPath=path.join(root,'backoffice-data','orma-verified-registry-live.json');
const productIdeasPath=path.join(root,'backoffice-data','product-ideas.json');
const productIdeasReviewPath=path.join(root,'backoffice-data','product-ideas-review.json');
const imageCoveragePath=path.join(root,'backoffice-data','image-coverage.json');
const imageCoverageReviewPath=path.join(root,'backoffice-data','image-coverage-review.json');
const imageLibraryConfigPath=path.join(root,'backoffice-data','image-library-config.local.json');
const dynamicHazardsPath=path.join(root,'data','dynamic-hazards.json');
const hazardReviewQueuePath=path.join(root,'backoffice-data','hazard-review-queue.json');
const hazardLedgerPath=path.join(root,'backoffice-data','hazard-ledger.json');
const newTrailScoutingPath=path.join(root,'backoffice-data','new-trail-scouting.json');
const newTrailScoutingReviewPath=path.join(root,'backoffice-data','new-trail-scouting-review.json');
const newsletterReviewPath=path.join(root,'backoffice-data','newsletter-review.json');
const newsletterInputsPath=path.join(root,'backoffice-data','newsletter-inputs.json');
let editorialRevisionRunning = false;
let newsletterRevisionRunning = false;
let productDiscoveryRunning = false;
let hazardWatchRunning = false;
const runFile = promisify(execFile);

function json(response, status, value){
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(file, fallback){
  try { return JSON.parse(await fs.promises.readFile(file, 'utf8')); }
  catch(error){
    if(error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file, value){
  const temporary = `${file}.next`;
  await fs.promises.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.promises.rename(temporary, file);
}

async function git(args,options={}){
  const result=await runFile('git',args,{cwd:root,maxBuffer:4*1024*1024,...options});return result.stdout.trim();
}

async function publishIsolatedDecision({files,message,requiredRemotePath}){
  await git(['fetch','origin','main']);
  try{await git(['cat-file','-e',`origin/main:${requiredRemotePath}`]);}
  catch(error){return {status:'local-only',reason:'This workflow has not been merged into main yet.'};}
  await runFile('npm',['run','test:backoffice'],{cwd:root,maxBuffer:4*1024*1024});
  await runFile('npm',['run','test:static'],{cwd:root,maxBuffer:4*1024*1024});
  const temporary=await fs.promises.mkdtemp(path.join(os.tmpdir(),'orma-hazard-publish-'));const index=path.join(temporary,'index');
  const env={...process.env,GIT_INDEX_FILE:index,GIT_AUTHOR_NAME:'ORMA hazard review',GIT_AUTHOR_EMAIL:'actions@github.com',GIT_COMMITTER_NAME:'ORMA hazard review',GIT_COMMITTER_EMAIL:'actions@github.com'};
  try{
    const base=await git(['rev-parse','origin/main']);await git(['read-tree',base],{env});
    for(const file of files){const blob=await git(['hash-object','-w',file]);await git(['update-index','--add','--cacheinfo','100644',blob,file],{env});}
    const tree=await git(['write-tree'],{env});const commit=await git(['commit-tree',tree,'-p',base,'-m',message],{env});
    await git(['push','origin',`${commit}:refs/heads/main`]);return {status:'published',commit,paths:files,deployment:'github-pages-triggered'};
  }finally{await fs.promises.rm(temporary,{recursive:true,force:true});}
}

async function publishHazardDecision(decision){
  return publishIsolatedDecision({
    files:['data/dynamic-hazards.json','backoffice-data/hazard-review-queue.json','backoffice-data/hazard-ledger.json'],
    requiredRemotePath:'data/dynamic-hazards.json',message:`Hazards: ${decision.action} (${decision.hazardId})`,
  });
}

async function publishNewTrailDecision(decision){
  return publishIsolatedDecision({files:['backoffice-data/new-trail-scouting-review.json'],requiredRemotePath:'backoffice-data/new-trail-scouting.json',
    message:`New Trails: ${decision.action} (${decision.candidateId})`});
}

async function readEditorialPackets(){
  const packets = await Promise.all(editorialReviewPacketPaths.map(file => readJson(file, null)));
  return packets.map((packet, index) => ({ packet, file: editorialReviewPacketPaths[index] })).filter(item => item.packet);
}

async function appendContentReviewSubmission(submission){
  const queue = await readJson(contentReviewQueuePath, { contractVersion: '1.0.0', submissions: [] });
  queue.updatedAt = submission.publishedAt || submission.completedAt || submission.submittedAt;
  queue.submissions = [...(queue.submissions || []).filter(item => item.submissionId !== submission.submissionId), submission];
  await writeJsonAtomic(contentReviewQueuePath, queue);
}

async function updateEditorialLedger(execution,decisions,at){
  if(!execution||!decisions.length) return;
  const ledger=await readJson(editorialLedgerPath,{contractVersion:'1.0.0',items:[]});
  let source=execution.subject.original||'';
  try{source=await fs.promises.readFile(path.resolve(root,execution.subject.sourceRef),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const action=decisions.some(item=>item.action==='request-revision')?'request-revision':decisions.every(item=>item.action==='approve')?'approve':'reject';
  const sources=(execution.outputs||[]).flatMap(output=>output.result?.sources||[]).map(item=>`${item.url}|${item.checkedAt||''}`).sort();
  const next=recordEditorialOutcome(ledger,{at,contentId:`${execution.subject.type}-${execution.subject.id}`,type:execution.subject.type,sourceRef:execution.subject.sourceRef,
    action,contentFingerprint:contentFingerprint(source),sourcesFingerprint:fingerprint(sources.join('\n')),packetFingerprint:fingerprint(JSON.stringify(execution)),
    safetyCritical:execution.subject.safetyCritical===true,reviewIntervalDays:42});
  const item=next.items.find(entry=>entry.contentId===`${execution.subject.type}-${execution.subject.id}`);
  if(action==='request-revision') item.revisionNote=[...new Set(decisions.map(decision=>decision.note).filter(Boolean))].join(' · ');
  await fs.promises.writeFile(editorialLedgerPath,`${JSON.stringify(next,null,2)}\n`,'utf8');
}

async function markEditorialPacketInReview(execution, at){
  const ledger = await readJson(editorialLedgerPath, { contractVersion: '1.0.0', items: [] });
  const source = await fs.promises.readFile(path.resolve(root, execution.subject.sourceRef), 'utf8');
  const sources = (execution.outputs || []).flatMap(output => output.result?.sources || []).map(item => `${item.url}|${item.checkedAt || ''}`).sort();
  const next = recordEditorialOutcome(ledger, {
    at, contentId: `${execution.subject.type}-${execution.subject.id}`, type: execution.subject.type,
    sourceRef: execution.subject.sourceRef, action: 'in-review', contentFingerprint: contentFingerprint(source),
    sourcesFingerprint: fingerprint(sources.join('\n')), packetFingerprint: fingerprint(JSON.stringify(execution)),
    safetyCritical: execution.subject.safetyCritical === true, reviewIntervalDays: 42,
  });
  const item = next.items.find(entry => entry.contentId === `${execution.subject.type}-${execution.subject.id}`);
  if(item) item.revisionNote = null;
  await writeJsonAtomic(editorialLedgerPath, next);
}

async function rebuildPublicationStaging(reviewQueue){
  const [editorialQueue, verifiedExecution] = await Promise.all([
    readJson(verifiedTrailEditorialQueuePath, null), readJson(verifiedTrailExecutionPath, null),
  ]);
  if(!editorialQueue || !verifiedExecution) return null;
  const staging = buildPublicationStaging(editorialQueue, verifiedExecution, reviewQueue);
  await fs.promises.writeFile(publicationStagingPath, `${JSON.stringify(staging, null, 2)}\n`, 'utf8');
  return staging;
}

async function queueVerifiedTrailRevisions(execution, decisions, submittedAt){
  const queue = await readJson(verifiedTrailRevisionQueuePath, { contractVersion: '1.0.0', jobs: [] });
  const revisions = buildVerifiedTrailRevisionJobs(execution, decisions, submittedAt, queue.jobs || []);
  if(!revisions.length) return [];
  queue.updatedAt = submittedAt; queue.jobs = [...(queue.jobs || []), ...revisions];
  await fs.promises.writeFile(verifiedTrailRevisionQueuePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  return revisions;
}

async function queueNextBatch(request, response){
  let body = '';
  for await (const chunk of request){
    body += chunk;
    if(body.length > 2048) return json(response, 413, { error: 'Request too large' });
  }
  const input = body ? JSON.parse(body) : {};
  const limit = Number(input.limit || 5);
  if(!Number.isInteger(limit) || limit < 1 || limit > 25){
    return json(response, 400, { error: 'limit must be an integer between 1 and 25' });
  }
  const ledger = await readJson(campaignStatePath, { queuedTrailIds: [], batches: [] });
  const campaign = planCatalogueCampaign(loadProductionTrails(root), {
    jobLimit: limit, excludedTrailIds: ledger.queuedTrailIds,
  });
  const nextLedger = {
    contractVersion: '1.0.0', updatedAt: campaign.generatedAt,
    queuedTrailIds: [...new Set([...ledger.queuedTrailIds, ...campaign.selectedTrailIds])],
    batches: [...ledger.batches, {
      queuedAt: campaign.generatedAt, trailIds: campaign.selectedTrailIds,
      jobIds: campaign.jobs.map(job => job.id),
    }],
  };
  await fs.promises.mkdir(path.dirname(campaignPath), { recursive: true });
  await Promise.all([
    fs.promises.writeFile(campaignPath, `${JSON.stringify(campaign, null, 2)}\n`, 'utf8'),
    fs.promises.writeFile(campaignStatePath, `${JSON.stringify(nextLedger, null, 2)}\n`, 'utf8'),
  ]);
  json(response, 200, { campaign, ledger: nextLedger });
}

async function planContentCycle(request, response){
  let body = '';
  for await (const chunk of request){
    body += chunk;
    if(body.length > 2048) return json(response, 413, { error: 'Request too large' });
  }
  const input = body ? JSON.parse(body) : {};
  const plan = planContentOperations({
    asOf: input.asOf || new Date().toISOString(),
    socialEnabled: input.socialEnabled === true,
  });
  await fs.promises.mkdir(path.dirname(contentOperationsPath), { recursive: true });
  await fs.promises.writeFile(contentOperationsPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  json(response, 200, { plan });
}

async function submitContentReview(request, response){
  let body = '';
  for await (const chunk of request){
    body += chunk;
    if(body.length > 65536) return json(response, 413, { error: 'Review is too large' });
  }
  const input = body ? JSON.parse(body) : {};
  if(input.gate !== 'content-review' || !Array.isArray(input.decisions) || !input.decisions.length){
    return json(response, 400, { error: 'At least one content review decision is required' });
  }
  const allowedActions = new Set(['approve', 'request-revision', 'reject']);
  if(input.decisions.some(item => !item || typeof item.jobId !== 'string' || !allowedActions.has(item.action))){
    return json(response, 400, { error: 'Review contains an invalid decision' });
  }
  const submittedAt = new Date().toISOString();
  const [editorialPackets, newsletterPacket, legacyExecution, verifiedExecution] = await Promise.all([
    readEditorialPackets(),readJson(newsletterReviewPacketPath,null),readJson(contentExecutionPath, null), readJson(verifiedTrailExecutionPath, null),
  ]);
  const verifiedJobIds = new Set((verifiedExecution?.outputs || []).map(output => output.jobId));
  const verifiedDecisions = input.decisions.filter(decision => verifiedJobIds.has(decision.jobId));
  const generalDecisions = input.decisions.filter(decision => !verifiedJobIds.has(decision.jobId));
  const execution=[...editorialPackets.map(item=>item.packet),newsletterPacket,legacyExecution].find(packet=>packet&&(packet.outputs||[]).some(output=>generalDecisions.some(decision=>decision.jobId===output.jobId)));
  if(generalDecisions.length && !execution) return json(response, 409, { error: 'No general editorial recommendation packet is available to apply' });
  const outcomes = [
    ...recordVerifiedTrailReview(verifiedExecution, verifiedDecisions),
    ...(generalDecisions.length ? await applyContentReview(root, execution, generalDecisions) : []),
  ];
  const hasBlocked = outcomes.some(item => item.status === 'blocked');
  const queue = await readJson(contentReviewQueuePath, { contractVersion: '1.0.0', submissions: [] });
  const submission = {
    submissionId: `content-review-${submittedAt.replace(/[:.]/g, '-')}`,
    submittedAt, status: hasBlocked ? 'needs-attention' : 'processed', decisions: input.decisions, outcomes, publicMutationAllowed: false,
  };
  queue.updatedAt = submittedAt;
  queue.submissions = [...(queue.submissions || []), submission];
  await fs.promises.mkdir(path.dirname(contentReviewQueuePath), { recursive: true });
  await Promise.all([
    fs.promises.writeFile(contentReviewQueuePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8'),
    fs.promises.writeFile(contentReviewResultPath, `${JSON.stringify(submission, null, 2)}\n`, 'utf8'),
  ]);
  if(generalDecisions.length) await updateEditorialLedger(execution,generalDecisions,submittedAt);
  const publicationStaging = await rebuildPublicationStaging(queue);
  const revisionJobs = await queueVerifiedTrailRevisions(verifiedExecution, verifiedDecisions, submittedAt);
  const revisionQueue = await readJson(verifiedTrailRevisionQueuePath, { contractVersion:'1.0.0', jobs:[] });
  for(const decision of verifiedDecisions){
    const target = (revisionQueue.jobs||[]).filter(job => job.jobId === decision.jobId && job.status === 'ready-for-review')
      .sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
    if(target){
      target.status = decision.action === 'approve' ? 'approved' : decision.action === 'reject' ? 'rejected' : 'revision-requested';
      target.reviewAction = decision.action;
      target.reviewedAt = submittedAt;
    }
  }
  revisionQueue.updatedAt = submittedAt;
  await writeJsonAtomic(verifiedTrailRevisionQueuePath, revisionQueue);
  json(response, 200, { submissionId: submission.submissionId, status: submission.status, outcomes, revisionJobs, publicationStaging });
}

async function reviseEditorialNow(request, response){
  let body = '';
  for await(const chunk of request){
    body += chunk;
    if(body.length > 16384) return json(response, 413, { error: 'Revision request is too large' });
  }
  const input = body ? JSON.parse(body) : {};
  const note = String(input.note || '').trim();
  if(!input.generatedAt || !note) return json(response, 400, { error: 'A packet and revision note are required' });
  if(note.length > 1500) return json(response, 400, { error: 'Revision note must be 1,500 characters or fewer' });
  if(editorialRevisionRunning) return json(response, 409, { error: 'A revision is already being prepared. Please wait for it to finish.' });
  const packetRecord = (await readEditorialPackets()).find(item => item.packet.generatedAt === input.generatedAt);
  const execution = packetRecord?.packet;
  if(!execution) return json(response, 409, { error: 'The recommendation changed. Reload and review the latest version.' });
  const decisions = (execution.outputs || []).filter(output => output.status === 'ready-for-review').map(output => ({
    jobId: output.jobId, agentId: output.agentId, action: 'request-revision', note,
    reviewedBy: 'local-editor', publicMutationAllowed: false,
  }));
  if(!decisions.length) return json(response, 409, { error: 'No reviewable recommendation is available to revise' });
  const submittedAt = new Date().toISOString();
  editorialRevisionRunning = true;
  try{
    await updateEditorialLedger(execution, decisions, submittedAt);
    const revised = await runEditorialRevision(root, execution, note);
    await writeJsonAtomic(packetRecord.file, revised);
    await markEditorialPacketInReview(revised, revised.generatedAt);
    const submission = {
      submissionId: `content-review-${submittedAt.replace(/[:.]/g, '-')}`, packetGeneratedAt: execution.generatedAt,
      submittedAt, completedAt: revised.generatedAt, status: 'revision-completed', decisions,
      outcomes: [{ status: 'revised-for-review', sourceRefs: [execution.subject.sourceRef] }], publicMutationAllowed: false,
    };
    const queue = await readJson(contentReviewQueuePath, { contractVersion: '1.0.0', submissions: [] });
    queue.updatedAt = revised.generatedAt; queue.submissions = [...(queue.submissions || []), submission];
    await Promise.all([writeJsonAtomic(contentReviewQueuePath, queue), writeJsonAtomic(contentReviewResultPath, submission)]);
    json(response, 200, { status: submission.status, packet: revised });
  }catch(error){
    const failed = {
      submissionId: `content-review-${submittedAt.replace(/[:.]/g, '-')}`, packetGeneratedAt: execution.generatedAt,
      submittedAt, status: 'needs-attention', decisions, outcomes: [{ status: 'revision-failed', message: error.message }], publicMutationAllowed: false,
    };
    await writeJsonAtomic(contentReviewResultPath, failed);
    json(response, 502, { error: error.message, status: failed.status });
  }finally{
    editorialRevisionRunning = false;
  }
}

async function submitPublicationReview(request, response){
  let body = '';
  for await (const chunk of request){
    body += chunk;
    if(body.length > 16384) return json(response, 413, { error: 'Publication review is too large' });
  }
  const input = body ? JSON.parse(body) : {};
  const actions = new Set(['approve-for-pr-creation', 'request-changes', 'hold']);
  if(typeof input.candidateId !== 'string' || !actions.has(input.action)) return json(response, 400, { error: 'Candidate and valid publication action are required' });
  const staging = await readJson(publicationStagingPath, null);
  const item = staging?.items?.find(candidate => candidate.candidateId === input.candidateId);
  if(!item) return json(response, 404, { error: 'Publication staging candidate was not found' });
  if(input.action === 'approve-for-pr-creation' && item.state !== 'ready-for-publication-preview'){
    return json(response, 409, { error: 'Both editorial and asset approvals are required before PR creation can be approved' });
  }
  const reviewedAt = new Date().toISOString();
  const decision = {
    contractVersion: '1.0.0', candidateId: input.candidateId, targetTrailId: item.targetTrailId,
    action: input.action, note: String(input.note || '').trim().slice(0, 1500), reviewedAt,
    reviewedBy: 'local-editor', status: input.action === 'approve-for-pr-creation' ? 'approved-for-pr-creation' : input.action,
    publicMutationAllowed: false, publicationPerformed: false,
  };
  const queue = await readJson(publicationReviewQueuePath, { contractVersion: '1.0.0', decisions: [] });
  queue.updatedAt = reviewedAt; queue.decisions = [...(queue.decisions || []), decision];
  await fs.promises.writeFile(publicationReviewQueuePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  json(response, 200, { decision, message: 'Publication decision recorded. No website file, commit, push or pull request was created.' });
}

async function submitDossierReview(request,response){
  let body='';for await(const chunk of request){body+=chunk;if(body.length>16384)return json(response,413,{error:'Dossier review is too large'});}
  const input=body?JSON.parse(body):{};const submittedAt=new Date().toISOString();
  const [orchestration,reviewQueue]=await Promise.all([readJson(trailOrchestrationPath,null),readJson(dossierReviewQueuePath,null)]);
  if(!orchestration||!reviewQueue)return json(response,409,{error:'Trail orchestration is not initialized'});
  const result=applyDossierReview(orchestration,reviewQueue,input,{at:submittedAt});
  const jobs=await readJson(specialistJobQueuePath,{contractVersion:'1.0.0',jobs:[]});
  jobs.updatedAt=submittedAt;jobs.jobs=[...(jobs.jobs||[]),...result.jobs];
  const writes=[writeJsonAtomic(trailOrchestrationPath,result.orchestration),writeJsonAtomic(dossierReviewQueuePath,result.reviewQueue),writeJsonAtomic(specialistJobQueuePath,jobs)];
  if(result.verifiedDossier){
    const registry=await readJson(liveVerifiedRegistryPath,{contractVersion:'1.0.0',status:'active',verified:[],publicMutationAllowed:false,publicationAuthorized:false});
    registry.generatedAt=submittedAt;registry.verified=[...(registry.verified||[]).filter(item=>item.candidateId!==result.verifiedRecord.candidateId),result.verifiedRecord];
    writes.push(writeJsonAtomic(path.join(root,'backoffice-data',`verified-dossier-${result.verifiedDossier.candidateId}.json`),result.verifiedDossier),writeJsonAtomic(liveVerifiedRegistryPath,registry));
  }
  await Promise.all(writes);
  json(response,200,{status:'processed',queuedJobs:result.jobs,ormaVerified:!!result.verifiedDossier,message:result.verifiedDossier
    ?'Trail recorded as ORMA Verified and handed to the separate trail content flow. No website file was changed.'
    :result.jobs.length
    ?`${result.jobs.length} specialist jobs queued. The production worker will run these automatically after activation.`
    :'Dossier decision recorded. No public website file was changed.'});
}

async function publishApprovedContent(request, response){
  let body = '';
  for await (const chunk of request){
    body += chunk;
    if(body.length > 4096) return json(response, 413, { error: 'Publish request is too large' });
  }
  const input = body ? JSON.parse(body) : {};
  const review = await readJson(contentReviewResultPath, null);
  if(!review) return json(response, 409, { error: 'No processed editorial review is ready to publish' });
  if(input.submissionId && input.submissionId !== review.submissionId) return json(response, 409, { error: 'A newer editorial review is available; reload before publishing' });
  const publication = await publishContentReview(root, review);
  const published = { ...review, status: 'published', publishedAt: new Date().toISOString(), publication };
  await fs.promises.writeFile(contentReviewResultPath, `${JSON.stringify(published, null, 2)}\n`, 'utf8');
  json(response, 200, published);
}

async function approveAndPublish(request, response){
  let body='';
  for await(const chunk of request){ body+=chunk; if(body.length>65536) return json(response,413,{error:'Approval request is too large'}); }
  const input=body?JSON.parse(body):{};
  const [editorialPackets,newsletterPacket,legacyExecution]=await Promise.all([readEditorialPackets(),readJson(newsletterReviewPacketPath,null),readJson(contentExecutionPath,null)]);
  const baseExecution=[...editorialPackets.map(item=>item.packet),newsletterPacket,legacyExecution].find(packet=>packet&&packet.generatedAt===input.generatedAt);
  if(!baseExecution) return json(response,409,{error:'No editorial recommendation is available'});
  const execution=JSON.parse(JSON.stringify(baseExecution));
  if(input.generatedAt!==execution.generatedAt) return json(response,409,{error:'The recommendation changed. Reload and review the latest version.'});
  for(const edit of input.edits||[]){
    const output=(execution.outputs||[]).find(item=>item.jobId===edit.jobId&&item.agentId==='copywriter');
    if(!output||!Array.isArray(edit.afterByIndex)||edit.afterByIndex.length!==(output.result?.changes||[]).length) return json(response,400,{error:'Edited copy does not match the reviewed recommendation'});
    edit.afterByIndex.forEach((after,index)=>{
      if(typeof after!=='string'||!after.trim()||after.length>5000||/<script\b|javascript:|\son\w+\s*=/i.test(after)) throw new Error('Edited copy contains invalid or unsafe markup');
      const original=output.result.changes[index].after; const originalTag=original.trim().match(/^<([a-z][a-z0-9-]*)\b/i)?.[1]; const editedTag=after.trim().match(/^<([a-z][a-z0-9-]*)\b/i)?.[1];
      if(originalTag&&editedTag!==originalTag) throw new Error('Edited copy must keep the proposed content block type');
      if(after!==original) output.result.changes[index].beforeAlternatives=[...(output.result.changes[index].beforeAlternatives||[]),original];
      output.result.changes[index].after=after;
    });
  }
  const decisions=(execution.outputs||[]).filter(output=>output.status==='ready-for-review').map(output=>({
    contractVersion:'1.0.0', gate:output.agentId==='visualDirector'?'asset-and-licensing-approval':'editorial-approval',
    jobId:output.jobId, agentId:output.agentId, action:'approve', note:'', reviewedAt:new Date().toISOString(), reviewedBy:'local-editor', publicMutationAllowed:false,
  }));
  if(!decisions.length) return json(response,409,{error:'No reviewable recommendations are available'});
  const outcomes=await applyContentReview(root,execution,decisions);
  const blocked=outcomes.filter(item=>item.status==='blocked');
  const submittedAt=new Date().toISOString();
  const submission={
    submissionId:`content-review-${submittedAt.replace(/[:.]/g,'-')}`, packetGeneratedAt:execution.generatedAt,
    submittedAt, status:blocked.length?'needs-attention':'processed', decisions, outcomes, publicMutationAllowed:false,
  };
  await fs.promises.writeFile(contentReviewResultPath,`${JSON.stringify(submission,null,2)}\n`,'utf8');
  if(blocked.length) return json(response,409,{error:blocked.map(item=>item.message).join(' '),outcomes});
  let publication;
  try { publication=await publishContentReview(root,submission); }
  catch(error){
    const failed={...submission,status:'needs-attention',publicationError:error.message};
    await fs.promises.writeFile(contentReviewResultPath,`${JSON.stringify(failed,null,2)}\n`,'utf8');
    throw error;
  }
  const published={...submission,status:'published',publishedAt:new Date().toISOString(),publication};
  await Promise.all([writeJsonAtomic(contentReviewResultPath,published),appendContentReviewSubmission(published)]);
  await updateEditorialLedger(execution,decisions,published.publishedAt);
  json(response,200,published);
}

async function runProductDiscoveryNow(request,response){
  if(productDiscoveryRunning) return json(response,409,{error:'Product discovery is already running'});
  productDiscoveryRunning=true;
  try{
    const packet=await runProductDiscovery();
    await writeJsonAtomic(productIdeasPath,packet);
    json(response,200,{packet,message:'A fresh source-linked research packet is ready. Nothing was built or published.'});
  }finally{productDiscoveryRunning=false;}
}

async function submitProductIdeaReview(request,response){
  let body='';for await(const chunk of request){body+=chunk;if(body.length>16384)return json(response,413,{error:'Product review is too large'});}
  const input=body?JSON.parse(body):{};
  const [packet,queue]=await Promise.all([
    readJson(productIdeasPath,null),readJson(productIdeasReviewPath,{contractVersion:'1.0.0',decisions:[],jobs:[]}),
  ]);
  const next=applyProductIdeaReview(packet,queue,input);
  await writeJsonAtomic(productIdeasReviewPath,next);
  let researchStatus=null;
  if(input.action==='investigate-further'){
    const job=next.jobs.filter(item=>item.ideaId===input.ideaId&&item.status==='queued').at(-1);
    const idea=packet.ideas.find(item=>item.id===input.ideaId);
    try{
      job.status='running';job.startedAt=new Date().toISOString();await writeJsonAtomic(productIdeasReviewPath,next);
      job.result=await runFocusedInvestigation(idea,job.focus);
      job.status='ready-for-review';job.completedAt=new Date().toISOString();researchStatus='ready-for-review';
    }catch(error){
      job.status='blocked';job.completedAt=new Date().toISOString();job.error=error.message;researchStatus='blocked';
    }
    next.updatedAt=new Date().toISOString();await writeJsonAtomic(productIdeasReviewPath,next);
  }
  const message=input.action==='investigate-further'
    ?researchStatus==='ready-for-review'
      ?'Deeper investigation completed and is ready on this idea. No feature work was authorized.'
      :'The deeper investigation could not complete; the saved job shows what needs attention.'
    :input.action==='prioritise'
      ?'Opportunity handed to the Designer for a reviewable mock-up. Development is not authorised.'
      :'Product decision recorded. No public website file was changed.';
  json(response,200,{review:next,message,researchStatus});
}

async function scanImageCoverage(request,response){
  const libraryConfig=await readJson(imageLibraryConfigPath,null);
  const audit=await auditImageCoverage(root,{personalLibraryPath:libraryConfig?.folderPath});
  await writeJsonAtomic(imageCoveragePath,audit);
  json(response,200,{audit,message:'Image coverage refreshed. Nothing was placed or published.'});
}

async function connectImageLibrary(request,response){
  let body='';for await(const chunk of request){body+=chunk;if(body.length>4096)return json(response,413,{error:'Library path is too large'});}
  const input=body?JSON.parse(body):{};const folderPath=path.resolve(String(input.folderPath||'').trim());
  const allowed=folderPath.startsWith('/Users/benedettalorenzi/')||folderPath.startsWith('/Volumes/');
  if(!allowed)return json(response,400,{error:'Choose a folder inside your user account or an attached drive'});
  const stat=await fs.promises.stat(folderPath);if(!stat.isDirectory())return json(response,400,{error:'The selected path is not a folder'});
  await writeJsonAtomic(imageLibraryConfigPath,{contractVersion:'1.0.0',folderPath,connectedAt:new Date().toISOString()});
  const audit=await auditImageCoverage(root,{personalLibraryPath:folderPath});await writeJsonAtomic(imageCoveragePath,audit);
  json(response,200,{audit,message:`Personal photo library connected. ${audit.library.personalAssetsScanned} images indexed locally.`});
}

async function submitImageCoverageReview(request,response){
  let body='';for await(const chunk of request){body+=chunk;if(body.length>16384)return json(response,413,{error:'Image review is too large'});}
  const input=body?JSON.parse(body):{};
  const [audit,queue]=await Promise.all([
    readJson(imageCoveragePath,null),readJson(imageCoverageReviewPath,{contractVersion:'1.0.0',decisions:[],jobs:[]}),
  ]);
  const next=applyImageCoverageReview(audit,queue,input);
  const job=next.jobs.filter(item=>item.slug===input.slug&&item.status==='queued').at(-1);
  if(job&&input.action==='use-orma-library'){
    job.status='ready-for-asset-review';job.candidates=[{source:'orma-library',assetRef:job.assetRef,ownership:'ORMA-owned'}];job.completedAt=new Date().toISOString();
  }
  if(job&&input.action==='check-personal-library'){
    const matches=audit.gaps.find(item=>item.slug===input.slug)?.libraryMatches?.filter(item=>item.source==='personal-library')||[];
    job.status=matches.length?'ready-for-asset-review':audit.library.personalLibraryConnected?'needs-photo-reference':'blocked';
    job.candidates=matches.map(item=>({source:'personal-library',fileName:item.fileName,matchedTerms:item.matchedTerms,ownership:'owner-supplied-pending-confirmation'}));
    job.error=job.status==='blocked'?'Connect the personal photo folder before running this route.':null;job.completedAt=new Date().toISOString();
  }
  await writeJsonAtomic(imageCoverageReviewPath,next);
  json(response,200,{review:next,message:input.action==='park'?'Image gap parked.':'Image sourcing job queued. Asset and licensing approval remain required.'});
}

async function runHazardsNow(request,response){
  if(hazardWatchRunning)return json(response,409,{error:'The hazard watcher is already running'});
  hazardWatchRunning=true;
  try{const artifacts=await runHazardWatch({root});json(response,200,{artifacts,message:'Official warning sources checked. New qualifying warnings were applied to local public data; removals remain human-gated.'});}
  finally{hazardWatchRunning=false;}
}

async function submitHazardReview(request,response){
  let body='';for await(const chunk of request){body+=chunk;if(body.length>8192)return json(response,413,{error:'Hazard review is too large'});}
  const input=body?JSON.parse(body):{};const [publicData,ledger]=await Promise.all([readJson(dynamicHazardsPath,{contractVersion:'1.0.0',hazards:[]}),readJson(hazardLedgerPath,{contractVersion:'1.0.0',decisions:[]})]);
  const result=applyHazardReview(publicData,ledger,input);
  const reviewQueue={contractVersion:'1.0.0',generatedAt:result.publicData.generatedAt,items:result.publicData.hazards.filter(item=>item.state==='resolution-review')};
  await Promise.all([writeJsonAtomic(dynamicHazardsPath,result.publicData),writeJsonAtomic(hazardLedgerPath,result.ledger),writeJsonAtomic(hazardReviewQueuePath,reviewQueue)]);
  let publication=null;let publicationError=null;
  try{publication=await publishHazardDecision(result.decision);}catch(error){publicationError=error.message;}
  const message=publication?.status==='published'
    ?`Hazard decision published in commit ${publication.commit.slice(0,7)}. Website deployment triggered.`
    :publicationError
      ?`Decision saved locally, but remote publication failed: ${publicationError}`
      :`${input.action==='confirm-resolved'?'Warning removed':'Warning kept active'} locally. ${publication?.reason||'Publish after the hazard workflow is merged.'}`;
  json(response,200,{decision:result.decision,publication,publicationError,message});
}

async function runNewTrailScouting(request,response){
  const sources=await Promise.all([
    readJson(path.join(root,'dog-friendly-routes.geojson'),{features:[]}).then(data=>({region:'dolomites',data})),
    readJson(path.join(root,'dog-friendly-routes-savoy.geojson'),{features:[]}).then(data=>({region:'savoy',data})),
  ]);
  const packet=planNewTrailScouting(sources,loadProductionTrails(root));await writeJsonAtomic(newTrailScoutingPath,packet);
  json(response,200,{packet,message:`${packet.summary.candidates} candidates ranked. Nothing was added to the public catalogue.`});
}

async function submitNewTrailReview(request,response){
  let body='';for await(const chunk of request){body+=chunk;if(body.length>8192)return json(response,413,{error:'Scouting review is too large'});}
  const input=body?JSON.parse(body):{};const [packet,review]=await Promise.all([readJson(newTrailScoutingPath,null),readJson(newTrailScoutingReviewPath,{contractVersion:'1.0.0',decisions:[],intake:[]})]);
  const next=applyNewTrailReview(packet,review,input);await writeJsonAtomic(newTrailScoutingReviewPath,next);const decision=next.decisions.find(item=>item.candidateId===input.candidateId);
  let publication=null;let publicationError=null;try{publication=await publishNewTrailDecision(decision);}catch(error){publicationError=error.message;}
  const message=publication?.status==='published'
    ?`Scouting decision published in commit ${publication.commit.slice(0,7)}. ${input.action==='send-to-verification'?'The verification fleet has been triggered.':'No verification work was started.'}`
    :publicationError?`Decision saved locally, but remote handoff failed: ${publicationError}`
      :`${input.action==='send-to-verification'?'Candidate queued locally for route verification.':'Scouting decision recorded locally.'} ${publication?.reason||''}`;
  json(response,200,{review:next,publication,publicationError,message});
}

async function submitNewsletterReview(request,response){
  let body='';for await(const chunk of request){body+=chunk;if(body.length>8192)return json(response,413,{error:'Newsletter review is too large'});}
  const input=body?JSON.parse(body):{};if(!['approve','request-revision'].includes(input.action))return json(response,400,{error:'A valid newsletter action is required'});
  const packet=await readJson(newsletterReviewPacketPath,null);if(!packet||packet.generatedAt!==input.generatedAt)return json(response,409,{error:'The newsletter draft changed. Reload the latest issue.'});
  if(input.action==='request-revision'&&!String(input.note||'').trim())return json(response,400,{error:'Add a revision note'});
  if(input.action==='request-revision'&&newsletterRevisionRunning)return json(response,409,{error:'A newsletter revision is already being prepared'});
  const review=await readJson(newsletterReviewPath,{contractVersion:'1.0.0',decisions:[]});const reviewedAt=new Date().toISOString();const decision={generatedAt:packet.generatedAt,issueId:packet.subject?.id,action:input.action,note:String(input.note||'').trim().slice(0,1500),reviewedAt,reviewedBy:'local-editor',status:input.action==='approve'?'approved-for-sending':'revision-requested',publicMutationAllowed:false};
  review.updatedAt=reviewedAt;review.decisions=[...(review.decisions||[]).filter(item=>item.generatedAt!==packet.generatedAt),decision];await writeJsonAtomic(newsletterReviewPath,review);
  if(input.action==='approve')return json(response,200,{decision,message:'Issue approved for the future sending integration and handed to Social for repurposing. Nothing was sent automatically.'});
  newsletterRevisionRunning=true;
  try{
    const inputs=await readJson(newsletterInputsPath,null);if(!inputs)throw new Error('Newsletter inputs are not available');
    const revised=await runNewsletter(inputs,{root,at:new Date().toISOString(),revisionNote:decision.note,previousPacket:packet});
    await writeJsonAtomic(newsletterReviewPacketPath,revised);
    if(!revised.summary.readyForReview)throw new Error(revised.outputs[0]?.error||'The Newsletter agent produced no reviewable draft');
    json(response,200,{decision,packet:revised,message:'Revision completed. The updated issue is ready here now.'});
  }finally{newsletterRevisionRunning=false;}
}

const server = http.createServer(async (request, response) => {
  if(request.method === 'POST' && request.url === '/api/campaign/next'){
    try { await queueNextBatch(request, response); }
    catch(error){ json(response, 500, { error: error.message }); }
    return;
  }
  if(request.method === 'POST' && request.url === '/api/content-operations/plan'){
    try { await planContentCycle(request, response); }
    catch(error){ json(response, 500, { error: error.message }); }
    return;
  }
  if(request.method === 'POST' && request.url === '/api/content-reviews/submit'){
    try { await submitContentReview(request, response); }
    catch(error){ json(response, 500, { error: error.message }); }
    return;
  }
  if(request.method === 'POST' && request.url === '/api/content-reviews/revise-now'){
    try { await reviseEditorialNow(request, response); }
    catch(error){ json(response, 500, { error: error.message }); }
    return;
  }
  if(request.method === 'POST' && request.url === '/api/publication-reviews/submit'){
    try { await submitPublicationReview(request, response); }
    catch(error){ json(response, 500, { error: error.message }); }
    return;
  }
  if(request.method==='POST'&&request.url==='/api/dossier-reviews/submit'){
    try{await submitDossierReview(request,response);}catch(error){json(response,500,{error:error.message});}
    return;
  }
  if(request.method === 'POST' && request.url === '/api/content-reviews/publish'){
    try { await publishApprovedContent(request, response); }
    catch(error){ json(response, 500, { error: error.message }); }
    return;
  }
  if(request.method === 'POST' && request.url === '/api/content-reviews/approve-and-publish'){
    try { await approveAndPublish(request,response); }
    catch(error){ json(response,500,{error:error.message}); }
    return;
  }
  if(request.method==='POST'&&request.url==='/api/product-ideas/run'){
    try{await runProductDiscoveryNow(request,response);}catch(error){json(response,500,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/product-ideas/review'){
    try{await submitProductIdeaReview(request,response);}catch(error){json(response,400,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/image-coverage/scan'){
    try{await scanImageCoverage(request,response);}catch(error){json(response,500,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/image-coverage/library'){
    try{await connectImageLibrary(request,response);}catch(error){json(response,400,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/image-coverage/review'){
    try{await submitImageCoverageReview(request,response);}catch(error){json(response,400,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/hazards/run'){
    try{await runHazardsNow(request,response);}catch(error){json(response,500,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/hazards/review'){
    try{await submitHazardReview(request,response);}catch(error){json(response,400,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/new-trails/run'){
    try{await runNewTrailScouting(request,response);}catch(error){json(response,500,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/new-trails/review'){
    try{await submitNewTrailReview(request,response);}catch(error){json(response,400,{error:error.message});}
    return;
  }
  if(request.method==='POST'&&request.url==='/api/newsletter/review'){
    try{await submitNewsletterReview(request,response);}catch(error){json(response,400,{error:error.message});}
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'backoffice-review.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if(target !== root && !target.startsWith(`${root}${path.sep}`)){
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(target, (statError, stat) => {
    if(statError || !stat.isFile()){
      response.writeHead(404).end('Not found');
      return;
    }
    response.setHeader('Content-Type', types[path.extname(target).toLowerCase()] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(target).pipe(response);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[backoffice] Review UI: http://127.0.0.1:${port}/backoffice-review.html`);
  console.log(`[backoffice] Trail Content Desk: http://127.0.0.1:${port}/trail-content-desk.html`);
  console.log(`[backoffice] Trail Verification Desk: http://127.0.0.1:${port}/trail-dossier-desk.html`);
  console.log(`[backoffice] Guide Content Edit: http://127.0.0.1:${port}/content-desk.html`);
  console.log(`[backoffice] Product Ideas: http://127.0.0.1:${port}/product-ideas-desk.html`);
  console.log(`[backoffice] Image Coverage: http://127.0.0.1:${port}/image-coverage-desk.html`);
  console.log(`[backoffice] Hazard Review: http://127.0.0.1:${port}/hazard-review-desk.html`);
  console.log(`[backoffice] New Trail Scouting: http://127.0.0.1:${port}/new-trail-scouting-desk.html`);
  console.log(`[backoffice] Newsletter: http://127.0.0.1:${port}/newsletter-desk.html`);
  console.log('[backoffice] Localhost only. Press Ctrl+C to stop.');
});
