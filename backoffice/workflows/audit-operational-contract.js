'use strict';

const fs=require('fs/promises');
const path=require('path');
const {MAX_AUTOMATED_ATTEMPTS,MAX_WAIVABLE_ATTEMPTS,RETRY_DELAYS_HOURS}=require('../contracts/resolution-policy-v1');
const {MAX_OPTIONAL_REVISIONS}=require('./automate-existing-trail-verification');
const {OPTIONAL_DETAIL_DISPATCHES,dispatchLimitFor}=require('./dispatch-unanswered-gates');

async function read(root,relative){return fs.readFile(path.join(root,relative),'utf8');}

async function auditOperationalContract(root=path.resolve(__dirname,'../..'),options={}){
  const workflowDir=path.join(root,'.github/workflows');
  const workflowNames=(await fs.readdir(workflowDir)).filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
  const workflowEntries=await Promise.all(workflowNames.map(async name=>[name,await read(root,`.github/workflows/${name}`)]));
  const workflows=Object.fromEntries(workflowEntries);const workflowText=workflowEntries.map(([,value])=>value).join('\n');
  const [builder,rules,client,worker,hazards,vetting,standard,hosting,dashboard,packageManifest,gateDispatch,adjudicator,desk,closureScout,healthCli,gatePolicy,dossier,mapGuidance,recordGuidance,dossierReview,orchestrationStates,campaign,cartographer,dryRun,numbersAlong,resurvey,resurveyCli,dryRunCli,places,claimResolution,orchestrationAdvance,handoff,staging,specialist,overrides,materialize,pageGenerator,appTrust,blueprint,compaction,rehydrate,funnel,funnelCli,intake,promoter,generatedCheck,routeEvidence,campaignCli,requeueWorkflow,scoutImport,discovery,photoAudit,safetyLane]=await Promise.all([
    read(root,'scripts/build-backoffice-hosting.js'),read(root,'firestore.rules'),read(root,'backoffice-firebase.js'),
    read(root,'backoffice/workflows/run-live-backoffice-worker.js'),
    read(root,'backoffice/workflows/dynamic-hazards.js'),read(root,'backoffice/workflows/community-hazard-vetting.js'),
    read(root,'backoffice/OPERATING_STANDARD.md'),read(root,'backoffice/HOSTING.md'),read(root,'backoffice/dashboard-model.js'),read(root,'package.json'),
    read(root,'backoffice/workflows/dispatch-unanswered-gates.js'),
    read(root,'backoffice/workflows/adjudicate-gate-blockers.js'),read(root,'trail-verify-desk.js'),
    read(root,'backoffice/workflows/scout-area-closures.js'),
    read(root,'backoffice/cli/record-worker-health.js'),
    read(root,'backoffice/workflows/automate-existing-trail-verification.js'),
    read(root,'backoffice/workflows/compile-verified-dossier.js'),
    read(root,'backoffice/workflows/route-guidance-from-map.js'),
    read(root,'backoffice/workflows/route-guidance-from-record.js'),
    read(root,'backoffice/workflows/apply-dossier-review.js'),
    read(root,'backoffice/contracts/trail-orchestration-v1.js'),
    read(root,'backoffice/workflows/start-live-trail-campaign.js'),
    read(root,'backoffice/workflows/run-cartographer.js'),
    read(root,'backoffice/workflows/gate-dry-run.js'),
    read(root,'backoffice/workflows/numbers-along-the-walk.js'),
    read(root,'backoffice/workflows/resurvey-named-trails.js'),
    read(root,'backoffice/cli/resurvey-trails.js'),
    read(root,'backoffice/cli/dry-run-gate.js'),
    read(root,'backoffice/workflows/places-on-route.js'),
    read(root,'backoffice/workflows/claim-resolution.js'),
    read(root,'backoffice/workflows/advance-trail-orchestration.js'),
    read(root,'backoffice/workflows/verified-editorial-handoff.js'),
    read(root,'backoffice/workflows/build-publication-staging.js'),
    read(root,'backoffice/workflows/run-trail-specialist.js'),
    read(root,'scripts/verified-trail-overrides.js'),
    read(root,'backoffice/workflows/materialize-approved-publications.js'),
    read(root,'scripts/generate-trail-pages.js'),
    read(root,'trail-trust.js'),
    read(root,'trail-blueprint.js'),
    read(root,'backoffice/workflows/review-queue-compaction.js'),
    read(root,'backoffice/workflows/rehydrate-review-detail.js'),
    read(root,'backoffice/workflows/verification-funnel.js'),
    read(root,'backoffice/cli/report-verification-funnel.js'),
    read(root,'backoffice/workflows/new-trail-intake.js'),
    read(root,'scripts/promote-osm-trails.js'),
    read(root,'scripts/check-generated-artifacts.js'),
    read(root,'scripts/route-number-evidence.js'),
    read(root,'backoffice/cli/start-live-trail-campaign.js'),
    read(root,'.github/workflows/orma-requeue-fixed-jobs.yml'),
    read(root,'scripts/import-scouted-trail.js'),
    read(root,'scripts/fetch-dog-friendly-routes.js'),
    read(root,'scripts/audit-trail-photos.js'),
    read(root,'backoffice/workflows/safety-research-lane.js'),
  ]);
  const checks=[];const add=(id,ok,detail)=>checks.push({id,status:ok?'pass':'fail',detail});
  const hostedPages=['trail-verify-desk.html','community-moderation-desk.html'];
  const retiredPages=['trail-dossier-desk.html','trail-content-desk.html','image-coverage-desk.html'];
  add('backfill-hosted-desks',hostedPages.every(page=>builder.includes(`'${page}'`))&&retiredPages.every(page=>!builder.includes(`'${page}'`))&&!builder.includes("'image-coverage-hosted.html'")&&!builder.includes("'editorial-desk.html'")&&!builder.includes("'newsletter-desk.html'")&&!builder.includes("'product-ideas-desk.html'")&&!builder.includes("'designer-desk.html'")&&!builder.includes("'hazard-review-desk.html'")&&!builder.includes("'new-trail-scouting-desk.html'"),`${hostedPages.length} protected desk routes are allowlisted and the retired lanes (photos included) are gone`);
  const reviewCollections=['backofficeDossierReviews','backofficeReviews','backofficePublicationReviews','backofficeNewTrailReviews','backofficeHazardReviews'];
  add('immutable-review-contracts',reviewCollections.every(name=>rules.includes(`/${name}/{`)&&client.includes(`'${name}'`))&&!rules.includes('/backofficeImageReviews/{')&&!rules.includes('/backofficeImageUploads/{'),`${reviewCollections.length} moderator review collections have client and rules contracts, and the trail-photo collections are gone`);
  add('backfill-worker-coverage',['ingestHazardReviews','ingestDossierReviews'].every(name=>worker.includes(name))&&!worker.includes('ingestImageReviews')&&!worker.includes('refreshTrailPhotoBackfill')&&!worker.includes('ingestNewsletterReviews')&&!worker.includes('ingestAnalystReviews')&&!worker.includes('ingestEditorialReviews'),'The worker runs only the hazard and verification lanes; the retired lanes, trail photos included, are removed rather than gated');
  add('five-attempt-resolution',MAX_AUTOMATED_ATTEMPTS===5&&JSON.stringify(RETRY_DELAYS_HOURS)===JSON.stringify([0,0,0,0,6]),'Five materially different evidence attempts, the first four issued as soon as the worker can claim them and the fifth after six hours: that one pause is before a final targeted search, the one place waiting can change an answer, and the rest paced nothing but held the whole trail still');
  // Two ladders, and the sentence that ends one of them carries no number.
  // A consumer matching the literal "five" would have matched nothing from the
  // day optional detail stopped at three, and every trail whose remaining
  // blockers were all exhausted would have circulated for ever looking like it
  // still had research to do.
  add('optional-detail-stops-at-three',
    MAX_WAIVABLE_ATTEMPTS===3
    &&MAX_WAIVABLE_ATTEMPTS<MAX_AUTOMATED_ATTEMPTS
    &&!gatePolicy.includes('five automated resolution strategies exhausted')
    &&gatePolicy.includes('automated resolution strategies exhausted')
    &&!dossier.includes('five automated resolution strategies exhausted')
    &&dossier.includes('automated resolution strategies exhausted')
    &&standard.includes('Optional detail stops at three'),
    'Route guidance keeps all five research attempts and optional detail stops at three, since an optional claim is recorded unknown either way while the policy will not approve a trail with one still researchable; the exhausted sentence states no count, so no consumer matches a number that is now two numbers');
  // The ladder is one layer; the gate asking again is another. The policy
  // rejects a missing direction before it ever reaches here, so a gate still
  // open is held only by optional detail and the verdict is already settled --
  // every further revision buys a thicker dossier, not a different answer.
  // Fifteen model calls bought the approval the first pass already stood on.
  add('a-settled-verdict-is-not-researched-again',
    MAX_OPTIONAL_REVISIONS===1
    &&OPTIONAL_DETAIL_DISPATCHES===1
    &&MAX_OPTIONAL_REVISIONS<MAX_AUTOMATED_ATTEMPTS
    &&OPTIONAL_DETAIL_DISPATCHES<MAX_AUTOMATED_ATTEMPTS
    // One look is kept, not none: a first pass can miss what a second finds.
    &&MAX_OPTIONAL_REVISIONS>0&&OPTIONAL_DETAIL_DISPATCHES>0
    // A gate on route guidance still gets the full ladder.
    &&dispatchLimitFor({blockingReasons:['logistics/route-number-switches: sourced route guidance is required']})===MAX_AUTOMATED_ATTEMPTS
    &&dispatchLimitFor({blockingReasons:['logistics: open question — where is the car park?']})===OPTIONAL_DETAIL_DISPATCHES
    &&gatePolicy.includes('MAX_OPTIONAL_REVISIONS')
    &&!gatePolicy.includes('[agentId]||0)<MAX_AUTOMATED_ATTEMPTS')
    &&standard.includes('A settled verdict is not researched again'),
    'A gate held only by optional detail is dispatched once and revised once per agent, because the policy has already rejected anything unwaivable and the remaining calls buy a thicker dossier rather than a different verdict; a gate held by route guidance keeps all five, and one look is kept rather than none');
  add('publication-failure-receipts',workflows['orma-backoffice-worker.yml']?.includes('Record publication automation failure')&&workflows['orma-backoffice-worker.yml']?.includes('force_publication_retry'),'Publication approval is retained through durable failure receipts and an explicit recovery input');
  const publicationWorkflow=workflows['orma-backoffice-worker.yml']||'';
  add('publication-validation-circuit-breaker',publicationWorkflow.includes('backoffice:publication-gate')&&publicationWorkflow.includes("if: steps.website_gate.outputs.publication_allowed == 'true'")&&publicationWorkflow.includes('outcome="blocked"')&&dashboard.includes("artifact.status==='blocked'"),'A red or missing Validate ORMA result pauses only website materialization, preserves approvals, and appears as a blocked dashboard heartbeat while queue work continues');
  const publicationArtifacts=['data/verified-trail-overrides.json','data/route-operational-facts.json','data/generated/trail-validation-report.json','data/regions','data/regions-manifest.json','regions-runtime-manifest.js','trails','sitemap.xml','browse-trails.html'];
  add('publication-artifact-closure',publicationArtifacts.every(target=>publicationWorkflow.includes(target))&&publicationWorkflow.includes('git diff --quiet'),'Publication PRs stage every generated website target and fail closed when tracked output remains unstaged');
  const deploymentReceiptWorkflow=workflows['orma-publication-deployment-receipt.yml']||'';
  add('publication-deployment-receipts',publicationWorkflow.includes('actions: write')&&publicationWorkflow.includes('backoffice:find-pages-deployment')&&publicationWorkflow.includes('backoffice:confirm-publications')&&publicationWorkflow.includes('deployed-site/data/verified-trail-overrides.json')&&deploymentReceiptWorkflow.includes('workflow_dispatch')&&deploymentReceiptWorkflow.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:find-pages-deployment')&&packageManifest.includes('backoffice:confirm-publications')&&dashboard.includes("status==='published'"),'The worker verifies a successful Pages run for the exact deployed commit, records the trail deployment receipt, and exposes the live links; the verifier remains manually recoverable');
  add('retired-lanes-are-gone',standard.includes('lanes are\nretired')&&!standard.includes('### 4. Newsletter')&&!standard.includes('### 6. Analyst')&&packageManifest.includes('backoffice:worker:live')&&!packageManifest.includes('backoffice:strategy-cycle')&&!packageManifest.includes('backoffice:product-discovery'),'The Newsletter, Social, Analyst, Design and website-copy lanes are removed from the standard and the entry points, not merely gated');
  add('quota-metered-drain',workflows['orma-verification-drain.yml']?.includes('group: orma-backoffice-worker')&&workflows['orma-verification-drain.yml']?.includes('ORMA_DRAIN_READ_BUDGET')&&workflows['orma-verification-drain.yml']?.includes('ORMA_DRAIN_WRITE_BUDGET')&&standard.includes('Verification drain')&&standard.includes('read budget'),'A hand-run drain repeats the worker pass under the worker lock and stops at a Firestore read and write budget, so clearing the queue cannot exhaust the daily quota the crons need');
  add('worker-cadence',workflows['orma-backoffice-worker.yml']?.includes("cron: '20 */3 * * *'")&&workflows['orma-backoffice-worker.yml']?.includes('ORMA_WORKER_AUTOMATION_ENABLED')&&standard.includes('every three hours'),'The queue worker has a three-hour target and an activation variable, keeping Firestore within its daily quota');
  // The scout brings back an authority's notice; it never publishes one. The
  // lane's own gate -- the Analyst searching independently -- stays in front of
  // every scouted notice, and a published notice is never presented as a
  // walker's sighting.
  add('scouted-closures-are-vetted-not-published',
    closureScout.includes("status:'pending'")
    &&!closureScout.includes("state:'active'")
    &&closureScout.includes("reportedBy:'orma-closure-scout'")
    &&closureScout.includes('webSearch:true')
    &&vetting.includes('SCOUTED_UNVERIFIED_NOTICE')
    &&vetting.includes("Official notice found by ORMA")
    &&worker.includes('scoutClosureNotices')
    &&worker.includes("options.closureScoutEnabled!==true")
    &&standard.includes('files them as pending hazard reports'),
    'Closure notices the scout finds are filed for vetting rather than published, and a published notice is never labelled as a hiker report');

  // The CEO removed the verification desk on 12 October: the evidence policy
  // decides every catalogue trail, published or not. Pinned because the scope
  // lives at a call site and shipped narrow once already -- the policy was
  // handed only the published trails, so 22 catalogue trails had no automatic
  // decision and queued for her instead.
  add('verification-has-no-human-gate',
    worker.includes('const catalogueTrails=productionTrails;')
    &&worker.includes('automateEvidenceGates(store,{...options,productionTrails:catalogueTrails})')
    &&!worker.includes('automateEvidenceGates(store,{...options,productionTrails:siteTrails})')
    &&standard.includes('there is no human verification gate')
    &&standard.includes('Trail verification is not one of them'),
    'Trail verification is decided by the evidence policy for every catalogue trail, published or not, and never queued for the CEO');

  add('automatic-hazard-lifecycle',hazards.includes("if(successful.has(old.sourceKey) && expired) return;")&&!hazards.includes("state: 'resolution-review'")&&hazards.includes("old.origin === 'community'")&&worker.includes('processCommunityHazardReports')&&vetting.includes("webSearch:true")&&vetting.includes('reported-unverified')&&standard.includes('There is no human removal gate'),'Hazards are added and removed without a human gate, and customer reports are published only after the Hazard Analyst finds or fails to find independent corroboration');
  const {RESOLUTION_ATTEMPT_LIMIT}=require('./dispatch-unanswered-gates');
  add('agent-answerable-gates-are-dispatched',
    worker.includes('dispatchUnansweredGates')
    &&worker.indexOf('await dispatchUnansweredGates(store')<worker.indexOf('await ingestDossierReviews(store')
    &&worker.includes("action:'request-revision'")
    &&!gateDispatch.includes("'approve'")&&!gateDispatch.includes("'reject'")
    &&RESOLUTION_ATTEMPT_LIMIT===MAX_AUTOMATED_ATTEMPTS
    &&workflows['orma-backoffice-worker.yml']?.includes('ORMA_GATE_DISPATCH_ENABLED')
    &&standard.includes('sent to that agent rather than left on the desk'),
    'A gate standing only on findings one agent can supply is dispatched to that agent before the same pass applies decisions, requesting a revision only — never an approval or a rejection — and never past the automated-resolution limit');
  add('gate-recommendations-never-decide',
    worker.includes('adjudicateStandingGates')
    &&worker.indexOf('await adjudicateStandingGates(store')>worker.indexOf('await ingestDossierReviews(store)')
    // The adjudicator writes no decision and the desk never ticks on her behalf.
    &&!adjudicator.includes("acceptedBlockers")
    &&adjudicator.includes('blocker-cannot-be-accepted')
    &&adjudicator.includes('accept-without-a-retrievable-source')
    &&desk.includes('never ticked for her')
    &&!desk.includes('tick.checked=true')
    &&workflows['orma-backoffice-worker.yml']?.includes('ORMA_GATE_ADJUDICATION_ENABLED')
    &&standard.includes('It recommends and never accepts')
    // A contradiction is not a dispatch, and the adjudicator is what receives it.
    &&gateDispatch.includes('nothing-a-re-run-can-answer')
    &&gateDispatch.includes('answerableCountsByAgent')
    &&adjudicator.includes('contestedCount'),
    'A blocker only a moderator can decide arrives with a cited recommendation in the reason field, after the dispatch and apply steps; the recommendation cites a retrieved source, is never offered for an unwaivable blocker, and nothing is ticked or accepted without a person');
  add('hazard-snapshot-publication',workflows['orma-hazard-watch.yml']?.includes('orma-bot/hazard-snapshot')&&workflows['orma-hazard-watch.yml']?.includes('gh pr merge')&&workflows['orma-hazard-watch.yml']?.includes('--auto')&&workflows['orma-hazard-watch.yml']?.includes('/actions/runs/${run}/approve')&&workflows['orma-hazard-watch.yml']?.includes('gh workflow run deploy-pages.yml --ref main')&&workflows['orma-hazard-watch.yml']?.includes('gh pr update-branch')&&standard.includes('automatic pull request whenever the warning set changes'),'The public warning snapshot reaches the website through a pull request whenever the warning set changes: the run approves the PR\'s own quality-gate run (a bot never graduates from the first-time-contributor policy), merges once it passes, and dispatches the website deploy, which nothing done with the workflow token starts by itself');
  // Offline packages follow the Verified seal without anyone running the
  // builder, and reach the website the same way the warning snapshot does.
  const offlineWorkflow=workflows['orma-offline-packages.yml']||'';
  add('offline-packages-follow-the-seal',offlineWorkflow.includes('--prune --stale')&&offlineWorkflow.includes('orma-bot/offline-packages')&&offlineWorkflow.includes('/actions/runs/${run}/approve')&&offlineWorkflow.includes('gh workflow run deploy-pages.yml --ref main')&&offlineWorkflow.includes('group: orma-offline-packages')&&standard.includes('Offline packages (`orma-offline-packages.yml`)'),'Every Verified trail gets its offline package and a withdrawn one loses it, built by one scheduled builder at a time and published through a self-approving pull request');
  add('hazard-cadence',workflows['orma-hazard-watch.yml']?.includes("cron: '7 */3 * * *'")&&workflows['orma-hazard-watch.yml']?.includes('timezone: Europe/Rome'),'Groundskeeper targets minute 7 of every third hour in Europe/Rome, clear of the queue worker and within the Firestore daily quota');
  // The intake budget is read by whichever job admits, and both read the same
  // variable.
  //
  // #847 raised the capacity to 60 in the worker and nothing changed: the job
  // that admits runs in the campaign workflow, which set no capacity at all and
  // fell back to the built-in 15. `available` stayed at zero, and the campaign
  // ran successfully on 17 October admitting nobody. A number raised in one
  // workflow and left behind in the other reads exactly like a number that did
  // not work.
  const campaignWorkflow=workflows['orma-trail-campaign.yml']||'';
  const capacityVariable='vars.ORMA_CAMPAIGN_CAPACITY';
  add('daily-orma-verified-intake',
    campaignWorkflow.includes("cron: '30 9 * * *'")
    &&campaignWorkflow.includes('timezone: Europe/Rome')
    &&campaignWorkflow.includes('ORMA_CAMPAIGN_AUTOMATION_ENABLED')
    // Set where admission happens, and from the same variable as the worker.
    &&campaignWorkflow.includes(capacityVariable)
    &&publicationWorkflow.includes(capacityVariable)
    // And passed. Setting it was all this used to check, and the step beside
    // it passed a hardcoded 15 from a second variable of its own: the run on
    // 19 October logged `ORMA_CAMPAIGN_CAPACITY: 60` and `CAMPAIGN_CAPACITY:
    // 15` one line apart and admitted nobody, for the third morning running.
    // A name that is set and not used reads exactly like a number that does
    // not work, which is what this invariant exists to prevent and did not.
    &&campaignWorkflow.includes('--capacity "$ORMA_CAMPAIGN_CAPACITY"')
    &&campaignWorkflow.includes('--limit "$ORMA_CAMPAIGN_LIMIT"')
    &&!/^\s*CAMPAIGN_CAPACITY:/m.test(campaignWorkflow)
    &&!/^\s*CAMPAIGN_LIMIT:/m.test(campaignWorkflow)
    // And the command accepts it. The fleet budget shared the per-pass batch
    // ceiling of 25, so 60 would have thrown even once it was passed.
    &&campaignCli.includes('const MAX_CAPACITY=200;')
    &&campaignCli.includes('capacity>MAX_CAPACITY')
    &&standard.includes('The capacity has to reach the command that admits'),
    'ORMA Verified candidate intake targets 09:30 Europe/Rome every day, after the Firestore quota reset window; the job that admits reads its capacity from the same repository variable as the worker AND passes that variable on its command line -- no second hardcoded copy beside it -- and the command accepts a fleet budget larger than the per-pass batch ceiling, which it did not: 60 would have been refused by the argument check even after the workflow was corrected');
  add('dolomites-first-scouting-cadence',workflows['orma-new-trail-intake.yml']?.includes("cron: '0 10 * * 1-6'")&&workflows['orma-new-trail-intake.yml']?.includes('timezone: Europe/Rome')&&workflows['orma-new-trail-intake.yml']?.includes('ORMA_NEW_TRAIL_INTAKE_RESUMED')&&standard.includes('Dolomites-first')&&standard.includes('Scouting is paused during the'),'New Trail scouting is paused during the backfills and keeps its Dolomites-first Monday-to-Saturday cadence for resumption');
  add('trail-photos-removed-from-backoffice',!worker.includes('refreshTrailPhotoBackfill')&&!worker.includes('ingestImageReviews')&&!rules.includes('/backofficeImageUploads/{')&&!client.includes('uploadTrailImage')&&!client.includes("collection(db,'backofficeImageReviews')")&&!builder.includes("'image-coverage-hosted.js'")&&standard.includes('Trail photos are sourced by hand, outside the backoffice')&&dashboard.includes('sourced by hand outside the backoffice'),'Trail-photo gathering is removed from the backoffice: no worker lane, no owner-upload staging, no image-review client or desk; photos are committed by hand and only rendered by the publication pipeline');
  const setupNodeCount=(workflowText.match(/actions\/setup-node@v7/g)||[]).length;const node24Count=(workflowText.match(/node-version:\s*24/g)||[]).length;
  add('supported-ci-runtime',setupNodeCount>0&&node24Count===setupNodeCount&&!workflowText.includes('node-version: 20')&&!workflowText.match(/actions\/(?:checkout|setup-node|setup-java|cache)@v4/)&&!workflowText.includes('google-github-actions/auth@v2'),'All Node workflows use Node 24 and supported Node-24 action runtimes');
  add('private-hosting-boundary',hosting.includes('must never contain files')&&hosting.includes('`backoffice-data/`, `data/`')&&builder.includes("file.endsWith('.json')")&&builder.includes("file.startsWith(`backoffice-data${path.sep}`)")&&builder.includes("file.startsWith(`data${path.sep}`)"),'The Hosting allowlist excludes internal JSON and data directories');
  // The alarm is the one thing that cannot be allowed to fail quietly, since
  // its whole job is to prevent quiet failure. Dropping `issues: write`,
  // renaming the step id or losing the step would each disable it without
  // failing a run, which is exactly how the worker went down unnoticed on 13
  // October.
  add('a-stopped-worker-says-so',
    publicationWorkflow.includes('issues: write')
    &&publicationWorkflow.includes('id: worker_health')
    &&publicationWorkflow.includes('Say so when the worker has stopped')
    &&publicationWorkflow.includes('steps.worker_health.outputs.consecutive_failures')
    &&publicationWorkflow.includes('steps.worker_health.outcome')
    &&publicationWorkflow.includes('gh issue create')
    &&publicationWorkflow.includes('gh issue close')
    &&healthCli.includes('GITHUB_OUTPUT')
    &&healthCli.includes('lastFailure')
    // The quieter stop: a run that completes every step and gets nothing
    // done reports success, so the failure alarm above is correctly silent
    // and only this one speaks. Both ways the pipeline stops have to be
    // covered, or the covered one lends false confidence to the other.
    &&publicationWorkflow.includes('Say so when the worker is getting nothing done')
    &&publicationWorkflow.includes('steps.worker_health.outputs.consecutive_unproductive')
    &&healthCli.includes('consecutiveUnproductiveRuns')
    &&healthCli.includes('providerParked')
    &&standard.includes('A worker that has stopped says so'),
    'A worker that fails twice in a row, that cannot write its own health receipt, or that completes two runs in a row without a single job getting through, opens a GitHub issue naming what happened and when anything last worked, and the next good run closes it; no dashboard has to be open for the operator to learn that nothing is being verified');

  // What the map may answer, and that it always says it did.
  //
  // The risk this pins is not that the measurement is wrong but that it stops
  // looking like a measurement: a value that loses its provenance line, or a
  // start point quietly answered from a relation that publishes none, would
  // both read to a walker as an authority's directions.
  add('map-read-guidance-says-so',
    mapGuidance.includes('not from a published route description')
    &&mapGuidance.includes('The mapped route follows')
    &&!mapGuidance.includes('`Follow route')
    &&mapGuidance.includes("authority: MAP_AUTHORITY")
    &&dossier.includes("MAP_ANSWERABLE_CLAIMS=Object.freeze(['route-number-sequence','route-number-switches'])")
    &&dossier.includes('const sourced=supportedLogisticsClaim(review,id);')
    &&standard.includes('Read off the map, and said to be read off the map'),
    'The order of a walk\'s numbers and where they change may be read from the route relations it is built from, and every such value says so in its own words and cites the relation; the start point and whether the route is numbered stay the agent\'s to establish from an authority, and a cited authority always wins over the measurement');

  // The numbers a walker follows, for a walk that is not itself numbered.
  //
  // The risk is what gets offered as a waymark. A cycle route runs along Le
  // Mont d'Arbois and a départementale road number sits on the member ways of
  // these very walks, so the filter is a safety rule and not a tidiness one.
  // And the wording must never promote running along a route into being it.
  add('numbers-along-an-unnumbered-walk',
    numbersAlong.includes("WALKING_ROUTES = Object.freeze(['hiking', 'foot', 'walking'])")
    &&numbersAlong.includes("tags?.type === 'route'")
    // Never a way's own ref, which is where the road numbers are.
    &&!numbersAlong.includes('way.tags.ref')
    &&!numbersAlong.includes("element.tags?.ref")
    // A stretch with no number on it is not an answer.
    &&numbersAlong.includes('if(!guidance.sequence.filter(Boolean).length) return null;')
    // Measured with the same functions the composite search uses.
    &&numbersAlong.includes("require('./discover-route-composite')")
    &&numbersAlong.includes("require('./route-ref-segments')")
    &&cartographer.includes('const ownNumber = singleRelationGuidance(reconstructed.relation);')
    &&cartographer.includes('await measureNumbersAlong(')
    // Said to be running along them, not being them.
    &&mapGuidance.includes('This walk carries no route number of its own. The mapped route runs along')
    &&dossier.includes('if(result?.routeGuidance?.relations?.length)return result.routeGuidance.relations;')
    &&standard.includes('A walk with no number of its own still has numbers along it'),
    'A walk carrying no route number of its own has the numbered walking routes running along it measured with the same functions the composite search uses: footpath route relations only -- never a cycle route, and never a way\'s own ref, which is where the road numbers are -- a crossing route folded away, a numberless stretch refused as an answer, the value saying it runs along those waymarks rather than being them, and the citation naming them rather than the unnumbered walk');

  // A walk with no number still tells a walker how to follow it.
  //
  // The risk is a walk being told it has no number because nobody looked.
  // Measured-and-found-nothing is a fact about the walk; never-measured is a
  // fact about ORMA, and an audit taken before the along-the-walk measurement
  // existed can say neither -- so the claim rests on a positive mark and not on
  // an absent field.
  add('a-walk-with-no-number-says-how-to-follow-it',
    cartographer.includes('const routeNumbersAbsent = along.measured && !along.guidance;')
    &&dossier.includes('const routeNumbersAbsent=Boolean(result?.routeNumbersAbsent);')
    &&recordGuidance.includes('if(options.routeNumbersAbsent){')
    // Landmarks in order with their distance, and the honest fallback.
    &&recordGuidance.includes('function recordedLandmarks(trail)')
    &&recordGuidance.includes('no landmark sequence recorded for it')
    // Water labels are not landmarks.
    &&!recordGuidance.includes('trail?.waterSources')
    // The record is still the bottom rung: the map's number wins where it has one.
    &&dossier.includes('if(MAP_ANSWERABLE_CLAIMS.includes(id)){')
    &&dossier.includes('const sourced=supportedLogisticsClaim(review,id);')
    &&standard.includes('A walk with no number says how to follow it'),
    'A walk the map was searched for numbers on and found none is answered from ORMA\'s record in landmark terms -- the start, then each recorded landmark in order with its distance -- or, where none is recorded, told to follow the walk\'s name and the mapped line; it rests on the audit\'s positive measured-and-none mark so a walk nobody measured is never told it has no number, water labels are not offered as landmarks, and a measured number or a cited authority still wins');

  // An outage is not evidence about a trail, but it has to leave a mark.
  //
  // The risk is the one that is invisible from outside: a measurement that
  // could not be taken reads exactly like a walk nobody can supply directions
  // for, and only one of the two is worth doing anything about. La Croix des
  // Salles sat that way with both its route claims unanswered.
  add('a-measurement-that-could-not-be-taken-says-so',
    cartographer.includes('const routeNumbersUnmeasured = along.measured ? null :')
    &&cartographer.includes('{ measured: false, why:')
    // Never mistaken for having looked.
    &&cartographer.includes('const routeNumbersAbsent = along.measured && !along.guidance;')
    // And named as its own thing: a survey to run again.
    &&dryRun.includes('routeNumbersUnmeasured:unmeasured')
    &&dryRunCli.includes('SURVEY AGAIN (the numbers were never measured)')
    &&dryRunCli.includes('resurvey_trail_ids')
    // And a composite says it too, or a composite of unnumbered routes reads
    // like a survey too old to answer -- which is what blocked Cinque Torri.
    &&cartographer.includes('const along = reconstructed.routeGuidance')
    &&cartographer.includes('const routeNumbersAbsent = along.measured && !along.guidance;')
    &&(cartographer.match(/routeNumbersUnmeasured \? \{ routeNumbersUnmeasured \}/g)||[]).length===2
    &&standard.includes('A composite survey says which of the three cases it is too')
    &&standard.includes('A measurement that could not be taken says so'),
    'A geometry survey records what went wrong when the corridor query could not be taken, so an outage never reads as a walk nobody can supply directions for; the gate dry run names it as a survey to run again rather than a refusal, and a walk whose own relation carries a number is not marked unmeasured because no query was needed');

  // A badge claims only what a specialist was asked.
  //
  // The risk is a published page telling a walker ORMA checked the water and
  // the livestock on a walk nobody looked at -- which is what publication
  // asserted of every trail, safely, right up until a free survey could verify
  // one on its own. A dossier recorded findings and never whether anybody
  // looked, so absence of a finding and absence of a look were one shape.
  add('a-badge-claims-only-what-was-researched',
    dossier.includes('function researchedSafetyCategories(review)')
    // Whatever the finding: looking and not settling it is a real check.
    &&dossier.includes('if(SAFETY_CATEGORIES.includes(id))asked.add(id);')
    // The survey is not a specialist.
    &&dossier.includes("if(output.agentId==='cartographer')continue;")
    &&dossier.includes('researchedCategories:researchedSafetyCategories(review)')
    // Carried to publication, and the badge derived from it rather than asserted.
    &&handoff.includes('researchedCategories:dossier.ormaVerification.researchedCategories||[]')
    &&staging.includes('function graduationFor(researched, hasPhoto, hasFields, settled=[], options={})')
    &&staging.includes("ormaVerified: graduation.status==='verified'")
    &&staging.includes('verified:{ categories:SAFETY_CHECKS.filter(check=>researched.includes(check))')
    &&!staging.includes("categories:['water','heat','exposure','livestock','surfaceHazards','access']")
    // And a trail short of the seal publishes as reviewed, through its own door,
    // rather than being held: the override contract takes it, it has to declare
    // what it is short of, and the seal cannot come through that door.
    &&!staging.includes('safety-categories-not-researched')
    &&overrides.includes("entry.verificationScope === 'routeReviewed'")
    &&overrides.includes('entry.fields.ormaVerified === false')
    &&overrides.includes("graduation.status === 'in-progress'")
    &&overrides.includes('graduation.completed.length < graduation.required.length')
    &&overrides.includes('&& !entry.verificationScope')
    &&materialize.includes("...(fullSeal?{}:{verificationScope:'routeReviewed'}),")
    &&materialize.includes('would remove the ORMA Verified seal it already carries')
    &&standard.includes('A badge claims only what a specialist was asked'),
    'A dossier records which of the six safety categories a specialist was asked about -- any finding counts, since looking and failing to settle it is a real check, and the geometry survey is not a specialist -- and publication derives the badge from that mark instead of asserting all six: the earned seal needs all eleven, a trail short of it publishes as reviewed through a scope that must state what it is short of and cannot carry the seal, no publication may take a seal away, and it upgrades by itself as research lands');

  // One badge rule, for the page and for the app.
  //
  // The risk is two renderers answering the same question differently. The page
  // granted the seal on six reviewed categories and the app, since #616, on the
  // eleven-check graduation: 22 live pages showed a green Verified seal for a
  // trail every card called Reviewed. With publication open it ran the other way
  // too, a trail published as reviewed reading "Imported trail" on its own page.
  // The same held for the caveats, which keyed off curation rather than off the
  // category review -- so mapped water would have been titled as reviewed water
  // on a trail whose water nobody researched.
  add('one-badge-rule-for-the-page-and-the-app',
    pageGenerator.includes('function badgeForTrail(t)')
    &&pageGenerator.includes('evidenceContract.tierOf(t)')
    // Three labels, including the middle one the page did not have.
    &&pageGenerator.includes("reviewed: { label: 'Reviewed by ORMA', style: 'neutral', icon: null }")
    &&!pageGenerator.includes("const reviewLabel = fullyReviewed ? 'Verified by ORMA' : 'Imported trail';")
    // The footer says the same as the badge.
    &&pageGenerator.includes('${badgeTier.label} on ${escapeHtml(formatReviewDate(reviewDate))}')
    // The caveats rest on the category review, in both copies.
    &&pageGenerator.includes("categoryVerified(t, 'water')")
    &&pageGenerator.includes("categoryVerified(t, 'access')")
    &&appTrust.includes("categoryVerified(trail, 'water')")
    &&appTrust.includes("categoryVerified(trail, 'access')")
    // And the prefix class that strips "Start here:" lists the colon, which it
    // did not, so seven pages read "Suggested start, Start here: parking".
    &&pageGenerator.includes("/^Start here\\s*[,.:;\u2014\u2013-]*\\s*/i")
    &&appTrust.includes("/^Start here\\s*[,.:;\u2014\u2013-]*\\s*/i")
    &&standard.includes('One badge rule for the page and the app'),
    'The crawlable page and the app derive the badge from one rule -- the evidence contract tier -- so the seal appears in both places or neither, and a reviewed trail is called reviewed rather than imported; the water and access caveats rest on whether that category was researched rather than on whether the listing is curated, and the machine wording and "Start here" prefix are stripped before either sentence is built');

  // What ORMA establishes has to reach the reader who arrives from a search.
  //
  // The risk is work that is done and never seen. The four directions are the
  // whole output of verification, and they rendered only in the app: the
  // crawlable page said how far the walk was and nothing about how to walk it,
  // from the same record. And the signage caveat was dropped in the app, so a
  // card stated a number sequence as though the signs were confirmed.
  add('the-directions-reach-the-page',
    pageGenerator.includes('function directionsSection(t)')
    &&pageGenerator.includes('<h2>How to follow this route</h2>')
    // Three sentences or none: half a set is worse than none.
    &&pageGenerator.includes('if (!start || !sequence || !switches) return \'\';')
    // The same numbers the app shows, from the same module.
    &&pageGenerator.includes("require('../trail-route-refs.js')")
    &&blueprint.includes('window.DoloPawsTrailRouteRefs')
    // The same labels, chosen on the same condition.
    &&pageGenerator.includes("guidance.mode === 'landmarks'")
    &&blueprint.includes("verifiedRouteGuidance.mode === 'landmarks'")
    // And the signage caveat printed by both, when there is one.
    &&pageGenerator.includes("String(guidance.status || '').trim()")
    &&blueprint.includes("String(verifiedRouteGuidance.status || '').trim()")
    &&standard.includes('The directions reach the page, not only the app'),
    'The four directions a verification establishes render on the crawlable page as well as in the app, under one heading with one set of labels, the same waymark numbers from the same module, and three sentences or none; both print the signage caveat when the record carries one, which the app had been dropping so that a card stated a number sequence as though the signs were confirmed');

  // A size measure may not decide a verdict.
  //
  // The risk: the queue summary dropped seven of the fourteen fields the gate
  // reads, so a walk the map and ORMA's record had answered was refused once
  // its item was summarised -- and a walk measured and carrying no number read
  // the same as a walk nobody measured, which are the two cases the record rung
  // exists to tell apart. And when the pointer to the full output could not be
  // followed, the refusal said the research was missing rather than unreadable.
  add('compaction-may-not-decide-a-verdict',
    compaction.includes('const DECIDING_FIELDS = Object.freeze([')
    &&['routeGuidance','routeNumbersAbsent','routeNumbersUnmeasured','relation',
      'trailRecord','routeConformance','claimContracts']
      .every(field=>compaction.includes(`'${field}',`)||compaction.includes(`'${field}'`))
    // The two that decide and can be long are kept, bounded rather than dropped.
    &&compaction.includes("const BOUNDED_FIELDS = Object.freeze(['openQuestions', 'blockers'])")
    &&compaction.includes('function boundedList(values)')
    // And a refusal names the real cause when the evidence cannot be read back.
    &&rehydrate.includes('detailUnreadable')
    &&dossier.includes('if(output.detailUnreadable) reasons.push(')
    &&standard.includes('Compaction may drop what is bulky, not what decides'),
    'The review-queue summary keeps every field the gate decides on -- the map measurement, the relation, the measured-and-none marks, ORMA\'s own record of the walk, the conformance and the claim contracts -- and keeps the two deciding lists bounded rather than dropping them, because dropping an open question read as a trail with none; the bulky parts are still fetched through the pointer, and when that pointer cannot be followed the gate says the evidence could not be read back instead of reporting it as research nobody has done');

  // Words that already exist are not bought again.
  //
  // The risk is a saving that reverts in silence. The worker is the only
  // caller that hands the handoff the trail as the site has it, and without
  // that argument every verification queues a copywriter again -- 163 model
  // calls to rewrite descriptions that are already on the live page -- with
  // nothing failing and nothing saying so.
  add('an-existing-trail-keeps-its-description',
    handoff.includes('function existingCopyFields(trail)')
    &&handoff.includes("const RETAINED_COPY_FIELDS=Object.freeze(['name','desc','tips'])")
    // All three or none: a record short of one of them still gets a copywriter.
    &&handoff.includes('if(!value)return null;')
    // Only for a trail already on the site, and only the job that is needed.
    &&handoff.includes('options.preserveExistingAssets?existingCopyFields(options.existingTrail):null')
    &&handoff.includes("...(item.copyPolicy==='preserve-existing'?[]:['copywriter']),")
    // The worker is what supplies it.
    &&worker.includes('buildVerifiedEditorialHandoff(result.verifiedDossier,result.verifiedRecord,editorialQueue,')
    &&worker.includes('preserveExistingAssets,existingTrail}')
    // Decided once, at the handoff, and read at publication.
    &&staging.includes("item.copyPolicy==='preserve-existing'")
    &&staging.includes('copyOutput?.result?.title ?? retainedCopy.name')
    &&standard.includes('An existing trail keeps the description it already has'),
    'A trail already on the site keeps its own name, description and practical notes instead of a copywriter being paid to write them again -- the rule its photograph has had all along -- so no model call is spent on words that are already on the live page; all three fields or none, only for a trail the site already has, and a copywriter that did run still wins. The policy is recorded where the job is queued and read where the fields are published, so the two cannot disagree');

  // A gate may not wait on a decision nothing can make.
  //
  // The risk is a deadlock that reports as patience. `asset-and-licensing-
  // approval` can only come from a visualDirector job, which is never queued
  // for a trail already on the site, so 23 of 163 trails with an incomplete
  // image record waited for ever -- their directions off the page for want of
  // a photograph nobody was looking for, and nothing saying so.
  add('a-photograph-nobody-is-sourcing-is-not-a-pending-approval',
    staging.includes("const visualApproved = item.assetPolicy==='preserve-existing'?true:visualDecision?.action === 'approve';")
    // No image either way writes no image fields, so the trail keeps what it shows.
    &&staging.includes('...(retainedImage||(hero?{')
    &&staging.includes('}:{})),')
    // And the badge is told there is no photograph.
    &&staging.includes('graduationFor(researched,Boolean(retainedImage||hero),Boolean(verifiedFields),settledSafetyCategories(item),')
    &&standard.includes('A photograph nobody is sourcing is not a pending approval'),
    'Publication of a trail already on the site does not wait on an approval for a photograph nobody is sourcing: the asset approval covers a newly sourced image, no such job is queued for an existing trail, and 23 of 163 trails with an incomplete image record waited for ever on a decision nothing could make. Such a trail publishes with no image fields, keeps whatever it already shows, and its badge counts one check fewer rather than claiming a photograph it has not got');

  // A report that stops before the work does.
  //
  // The risk is the one this repository keeps meeting: a stage nobody looks at
  // is a stage nothing is reported about, and silence reads as success. The
  // funnel ended at ready-for-editorial while four further stages had opened
  // behind it, and the deadlock that held 23 trails off the page sat in one of
  // them for as long as it took somebody to run the chain by hand.
  add('the-funnel-reaches-the-page',
    funnel.includes("const PUBLICATION_LEG = Object.freeze([")
    &&funnel.includes("'editorial-queue', 'publication-staging', 'publication-requested', 'published',")
    &&funnel.includes('function publicationLeg(')
    // Only what this lane wrote counts as published; the hand-written
    // corrections in the same file are not publications.
    &&funnel.includes("&& entry.approvalId")
    &&funnel.includes('directionsOnThePage')
    // What holds a trail is named, not counted.
    &&funnel.includes('heldBy: tally(held.flatMap(row => row.holds), reason => reason),')
    // And the report reads the artifacts and says when it did not.
    &&funnelCli.includes("store.getArtifact('verified-trail-editorial-queue')")
    &&funnelCli.includes("store.getArtifact('publication-staging')")
    &&funnelCli.includes("store.getArtifact('publication-requests')")
    &&funnelCli.includes('no trail has entered this half of the lane')
    &&standard.includes('The funnel reaches the page'),
    'The verification funnel follows a trail past the dossier gate through the editorial queue, publication staging, the publication request and the override file the site is built from, naming what holds each one rather than counting it; what this lane published and what merely carries directions are counted separately, because the override file also holds hand-written corrections and folding them together reported a pipeline that had run when it had not; and nothing published with nothing held is said in those words, because a lane that never ran and a lane with nothing to do are the same silence');

  // Nothing is paid for a walk that cannot be published.
  //
  // The risk is the scouting lane's own wall. A scouted walk lives only in
  // Firestore and publication restates nine fields from a catalogue record it
  // has not got, so it stops at the mapping gate for ever -- after the
  // research agents, the copywriter and the visual director have all run.
  add('a-walk-the-catalogue-does-not-hold-is-not-paid-for',
    intake.includes('function heldForImport(trails, catalogue)')
    // A missing catalogue is not an empty one.
    &&intake.includes('if(!catalogue)return {admit:trails,held:[]};')
    // The sentence, not its whole line: it now carries the command that
    // clears the hold, which did not exist when this was written.
    &&intake.includes('not in the catalogue: publication restates a record this walk has not got')
    &&worker.includes('productionTrails:options.productionTrails||loadProductionTrails(path.resolve(__dirname,')
    // The reason travels, so a review that queued nothing does not read like
    // a review that queued work.
    &&worker.includes('...(intake.held?.length?{heldForImport:intake.held}:{})')
    // And the blocker names the real problem rather than missing fields.
    &&staging.includes('function inTheCatalogue(item, target, trailsById)')
    &&staging.includes("!known&&'trail-not-in-the-catalogue',")
    &&staging.includes("operation:trailsById.has(item.targetTrailId)?'update-existing':'create-new'")
    &&standard.includes('A walk the catalogue does not hold cannot be published'),
    'A scouted walk exists only in Firestore and publication restates nine fields from a catalogue record it has not got, so it stops at the mapping gate for ever -- after the paid agents have run. Such a candidate is kept back at intake and named with its reason rather than admitted, the reason travels on the review outcome, and at publication the blocker says the trail is not in the catalogue rather than reporting fields missing from a record that does not exist. A caller passing no catalogue is not saying the catalogue is empty');

  // A generated file nobody checks goes stale, and everything below it
  // regenerates faithfully from the stale copy.
  //
  // osm-trails-data.js was outside the generated set, and 32 trails were
  // missing route numbers the map had -- which is what answers two of the four
  // unwaivable route claims. It stayed stale because regenerating it switched
  // the route sourcing off: a status the promoter derives was treated as one
  // somebody declared, and 29 trails fell back to citing the relation instead
  // of a real authority.
  add('the-promoted-catalogue-is-checked',
    generatedCheck.includes("'osm-trails-data.js',")
    &&generatedCheck.includes("'osm-trails-savoy-data.js',")
    &&generatedCheck.includes("ORMA_PROMOTE_OFFLINE: 'true'")
    // Offline, so the check cannot depend on somebody else's server.
    &&promoter.includes("const OFFLINE = process.env.ORMA_PROMOTE_OFFLINE === 'true';")
    &&promoter.includes('if (options.offline) {')
    // A derived status does not stand in front of the evidence, and a number
    // does not deny the page.
    &&routeEvidence.includes("const PROMOTER_DERIVED_STATUS = new Set(['mapped-relation-ref', 'not-listed-in-mapped-source']);")
    &&routeEvidence.includes('if (trail.routeNumberStatus && !PROMOTER_DERIVED_STATUS.has(trail.routeNumberStatus)) return trail;')
    &&routeEvidence.includes('if (Array.isArray(trail.routeRefs) && trail.routeRefs.length && !(mapped && mapped.ref)) {')
    &&packageManifest.includes('"promote:trails"')
    &&packageManifest.includes('npm run promote:trails && npm run validate:production-trails')
    &&standard.includes('The promoted catalogue is checked like every other generated file'),
    'The promoted trail files are regenerated and compared like every other generated artifact, with the promoter reading the committed elevation cache and refusing to reach the network; and regenerating them no longer switches the route sourcing off -- a status the promoter derived from the relation does not stand in front of the mapped evidence, and a number the trail already carries does not deny it the official page');

  // The free work can be asked for without knowing which trails need it.
  //
  // The risk is work that is available and unreachable. A re-survey costs no
  // model credit and is the only thing that moves a trail while the credits
  // are out -- and it could only be asked for by naming trails, which means
  // knowing which ones were surveyed before the surveyor recorded what it
  // found. That is a question for the record, not for a person.
  add('a-re-survey-can-be-asked-for-by-the-record',
    resurvey.includes("const SURVEY_MARKS = Object.freeze(['routeGuidance', 'routeNumbersAbsent', 'routeNumbersUnmeasured']);")
    &&resurvey.includes('function surveyedBeforeTheMarks(orchestration, outputsByTrail)')
    // Present-and-false still says somebody looked.
    &&resurvey.includes('result[mark] !== undefined && result[mark] !== null')
    // A walk nobody surveyed is owed one, not stale.
    &&resurvey.includes('neverSurveyed.push(entry); continue;')
    &&resurveyCli.includes("if(arg === '--stale'){ out.stale = true; continue; }")
    &&requeueWorkflow.includes('resurvey_stale:')
    &&requeueWorkflow.includes('args+=(--stale)')
    &&standard.includes('A re-survey can be asked for by the record, not by hand'),
    'A geometry re-survey, which costs no model credit and is the only work that moves a trail while the credits are out, can be asked for by the record rather than by naming trails: the walks whose survey predates the three route-number marks are found and listed before anything is queued, a mark present and false still counts as having looked, a walk nobody has surveyed is owed one rather than called stale, and the same question is a checkbox on the requeue workflow');

  // The last link of the free lane, which nothing was joining.
  //
  // publication-staging was rebuilt only inside the loop that applies an
  // editorial decision. A trail that keeps its own description queues no
  // copywriter, so there is no decision, so nothing rebuilt its staging and
  // the publication policy never saw it: verified, handed off, and stopped,
  // with nothing queued and nothing saying so.
  add('the-pass-builds-publication-staging',
    worker.includes('async function refreshPublicationStaging(store, options = {})')
    // Before the policy that reads it.
    &&worker.includes('const publicationStaging=await refreshPublicationStaging(store,{...options,productionTrails:siteTrails});')
    &&worker.indexOf('const publicationStaging=await refreshPublicationStaging')
      <worker.indexOf('const automatedPublications=await automatePublicationReviews')
    // Unchanged items cost no write, on a pass that runs every half hour
    // against a free-tier quota.
    &&worker.includes("JSON.stringify(current?.items || null) === JSON.stringify(staging.items || null)")
    &&worker.includes("return { status:'unchanged', items:(staging.items||[]).length };")
    &&standard.includes('The pass builds publication staging, not the decision loop'),
    'The worker pass rebuilds publication staging from the editorial queue, the execution and the content review queue before the publication policy reads it, rather than leaving it to the loop that applies an editorial decision -- which a trail keeping its own description never reaches, so such a trail was verified, handed off and stopped with nothing queued and nothing saying so; an unchanged set of items costs no write');

  // The scouting lane has an exit, and it is screened.
  //
  // The risk is a side door. A walk imported one at a time has not been
  // through the region sweep's phase 1, and the rule that keeps a via ferrata
  // off a dog-walking site lives in an Overpass query it never runs.
  add('a-scouted-walk-becomes-a-screened-record',
    scoutImport.includes('function screen(relation, memberWays, overrides)')
    &&scoutImport.includes('evaluateRelation(tags, hard.length > 0, overrides)')
    &&scoutImport.includes('memberWays.filter(way => hardWayForDogs(way.tags))')
    // One definition of a way that makes a route unsuitable for a dog.
    &&discovery.includes('function hardWayForDogs(tags)')
    &&discovery.includes('hardWayForDogs, evaluateRelation, buildPhase1Query,')
    // One feature, appended, and never over a walk already on file.
    &&scoutImport.includes('collection.features.push(feature);')
    &&scoutImport.includes("return { status: 'already-present', name: already.properties.name };")
    // The promoter is what gives it the nine fields, as it does every trail.
    &&packageManifest.includes('"import:scouted-trail"')
    &&intake.includes('import-scouted-trail.js --relation')
    &&standard.includes('A scouted walk becomes a record the catalogue holds'),
    'A scouted walk can be imported into the catalogue one relation at a time, screened first by the discovery pass\'s own rules -- the relation through evaluateRelation and its member ways through the single definition of a way that makes a route unsuitable for a dog, which the region sweep asks Overpass for -- adding one feature and never rewriting a walk already on file; the promoter then derives the nine fields it does for every other trail, and the intake hold names the command that clears it');

  // A credit line is not a licence.
  //
  // The risk is a rights one, on live pages. Sixteen walks were showing a
  // photograph credited to a tourism board or a commercial site with no
  // licence, creator or terms recorded anywhere, and the check that decides
  // whether ORMA may carry a picture as the trail's own asked only for a
  // credit. An AI illustration was also able to satisfy a check that says
  // this trail has a photograph of it.
  add('a-photograph-says-under-what-terms',
    staging.includes("if(!String(trail.imageLicence||'').trim()||!String(trail.imageCreator||'').trim())return null;")
    &&staging.includes("const NOT_A_PHOTOGRAPH=Object.freeze(['ai-illustration']);")
    &&staging.includes("if(NOT_A_PHOTOGRAPH.includes(String(trail.imageSourceType||'')))return null;")
    // And the question can be asked again without stumbling on it.
    &&photoAudit.includes('function standingOf(trail)')
    &&photoAudit.includes("return 'terms-not-established';")
    &&packageManifest.includes('"audit:trail-photos"')
    &&standard.includes('A photograph says who took it and under what terms'),
    'A photograph may only be carried as a trail\'s own when the record says who took it and under what licence -- a credit line says where a picture came from, not that anyone may use it -- and an AI illustration, however well credited, does not satisfy a check that the trail has a photograph of it; `npm run audit:trail-photos` lists every picture by what the record can say about it');

  // Work that costs nothing is not ordered by a rule about money.
  //
  // The risk is the circle it closed: a trail with no published source ranks
  // last, its free survey is what would answer its directions from the map, and
  // the survey sat behind every paid job in a queue a pass takes ten from. Six
  // queued by hand on 16 October ran only when each trail was scoped alone.
  add('free-work-goes-first',
    specialist.includes("FREE_AGENTS=Object.freeze(['cartographer'])")
    &&specialist.includes('function costsNoModelCall(job)')
    // One list, read by the ordering and by the branch that runs a job.
    &&specialist.includes('if(costsNoModelCall(job)){')
    &&!specialist.includes("if(job.agentId==='cartographer'){")
    &&specialist.includes('const rank=job=>costsNoModelCall(job)?0:(ready(job)?1:2);')
    // The verifiable-first rule still applies among the rest.
    &&specialist.includes('function routeSourceReady(trail)')
    &&standard.includes('Free work goes first'),
    'A job that spends no model credit is ordered ahead of every paid job, because the rule that puts verifiable trails first exists to protect the model budget and has no business ordering work that costs nothing -- which left a trail\'s free survey queued behind the paid research it would have made possible; one list names the free agents and the branch that runs a job reads it, and the verifiable-first rule still orders the paid work');

  // The seal waits for the four unwaivable claims and for nothing else.
  //
  // The risk runs both ways. Waiting on optional detail queued the seal behind
  // five model calls that cannot change the verdict -- forty days for 162
  // trails, and a dead stop when the credits went. And not waiting on the four
  // would publish a walk with no directions, which is the one thing no reason
  // can waive.
  add('a-seal-does-not-wait-for-optional-detail',
    orchestrationAdvance.includes('function directionsSettledWithoutAgents(outputs,catalogueTrail)')
    // Asked of the four, through the function the gate itself uses.
    &&orchestrationAdvance.includes('return !routeGuidanceBlockingReasons(outputs,catalogueTrail?{trail:catalogueTrail}:{}).length;')
    // Only on a survey, and only where no agent has spoken.
    // Not for a trail the safety lane sent back: its directions are settled
    // and what it is waiting for is the specialists it was sent to.
    &&orchestrationAdvance.includes("if(!safety&&base.every(job=>!job)){")
    &&orchestrationAdvance.includes("trail.stage='directions-settled-by-survey'")
    // The catalogue reaches the decision, read live.
    &&worker.includes('advanceTrailOrchestration(store,{...options,productionTrails})')
    &&standard.includes('A seal does not wait for optional detail'),
    'Where a free geometry survey has settled all four unwaivable route claims and no agent has spoken, the trail goes to the dossier gate on what it has and its optional detail is recorded unknown -- so a seal is never queued behind model calls that cannot change the verdict; a trail part-way through research keeps it, and one whose directions are unsettled waits for the agents as before');

  // A reviewed trail is sent back for its safety research (approved 22
  // October 2026). The fast lane seals directions on the survey alone; this
  // is the deferred research it promised, safety questions only, never
  // reopening the directions, its own budget and kill switch, and the three
  // decisions: an answer for access and livestock, a ban withdraws the walk,
  // an unread document goes to a hand audit.
  add('a-reviewed-trail-is-sent-back-for-its-safety-research',
    safetyLane.includes("const SAFETY_AGENTS=Object.freeze(SAFETY_SPECIALISTS.map(spec=>spec.agentId));")
    &&!safetyLane.includes("agentId:'logistics'")
    &&safetyLane.includes("if(entry?.verificationScope!=='routeReviewed'||entry?.fields?.ormaVerified!==false)continue;")
    &&safetyLane.includes("if(trail.safetyResearch?.contract===SAFETY_RESEARCH_CONTRACT)continue;")
    &&orchestrationAdvance.includes('async function openSafetyGate(store,trail,jobs,nextQueue,catalogueTrail,at)')
    &&orchestrationAdvance.includes("const survey=latest(jobs,trail.candidateId,'cartographer');")
    &&worker.includes('const safetyResearch=await sendReviewedTrailsForSafetyResearch(store,{...options,productionTrails});')
    &&staging.includes("const SETTLED_FOR_SEAL=Object.freeze(['access','livestock']);")
    &&staging.includes("...(banned.length?{withdrawal:{reason:'dogs-not-accepted'")
    &&standard.includes('A reviewed trail is sent back for its safety research'),
    'Published reviewed trails are sent back to the Ranger and the terrain analyst for the six safety questions only, two a pass behind ORMA_SAFETY_RESEARCH_ENABLED, and return to the dossier gate with the survey that settled their directions; the seal needs an answer for access and livestock, a settled finding that dogs are not allowed withdraws the walk pending review, and a claim resting on an unread document is listed for a hand audit');

  // Nothing is searched for that the map says is not there.
  //
  // The risk is both ways. Paying three web searches to confirm a walk has no
  // drinking fountain is three searches for nothing -- 281 of 489 category
  // claims are in that position. And concluding "nothing is there" from a
  // measurement that never ran would publish an absence nobody established.
  add('nothing-is-searched-for-that-the-map-says-is-not-there',
    places.includes('function categoriesTheMapFoundNothingFor(found)')
    // Not looking is not a finding: the measurement says whether it ran.
    &&places.includes('if(!found || !found.measured) return [];')
    &&places.includes('return { measured: false, water: [], places: [] };')
    // Settled before a job is queued, and queueClaimResolution only takes a
    // researchable entry.
    &&claimResolution.includes("state:settled?'source-exhausted':'researchable'")
    &&claimResolution.includes("settledBy:'mapped-features'")
    // In the words every consumer already recognises.
    &&claimResolution.includes('automated research strategies were exhausted')
    &&standard.includes('Nothing is searched for that the map says is not there'),
    'A category the mapped features along a walk were measured for and found none of is recorded as settled before any research job is queued, in the sentence an exhausted ladder already writes; a walk whose features were never measured settles nothing, because not looking is not a finding, and the four route claims keep their full ladder whatever the map holds');

  // A free, deterministic survey can be taken again for a named trail.
  //
  // The risk is the one that cost three improvements their effect: the survey
  // is where the map reading lives, and nothing in the pipeline goes backwards,
  // so a better survey reaches only trails not yet past it. And the risk of the
  // fix is a re-survey that sends the trail back a stage, which would mark
  // every agent's evidence as stale and stall it waiting on research nobody
  // queued.
  add('a-named-trail-can-be-surveyed-again',
    packageManifest.includes('"backoffice:resurvey"')
    &&resurvey.includes('function planResurvey(orchestration, ids)')
    // The trail stays put. Pinned as the whole returned shape, so adding a
    // stage or a reconsideredAt to it is the thing that breaks.
    &&resurvey.includes('return { ...trail, attempts, jobIds: [...(trail.jobIds || []), jobId] };')
    &&!resurvey.includes('reconsideredAt:')
    &&resurvey.includes('attempts.cartographer = Number(attempts.cartographer || 0) + 1;')
    // Held rather than double-surveyed, and resting trails left alone.
    &&resurvey.includes("if(String(trail.state) === 'geometry-audit')")
    &&resurvey.includes("RESTING = Object.freeze(['imported', 'rejected', 'verified-by-hand'])")
    &&resurveyCli.includes("if(!args.apply){")
    // And it can actually be run. The state is in Firestore and the credential
    // stays in Actions, so an npm script on its own is a command nobody can
    // run -- which is what shipping it alone left the standard describing.
    &&workflows['orma-requeue-fixed-jobs.yml']?.includes('resurvey_trail_ids')
    &&workflows['orma-requeue-fixed-jobs.yml']?.includes('npm run backoffice:resurvey')
    &&workflows['orma-requeue-fixed-jobs.yml']?.includes("if: inputs.resurvey_trail_ids != ''")
    &&standard.includes('A named trail can be surveyed again'),
    'A named trail can have its deterministic, model-free geometry survey taken again, dry run until --apply; the trail stays exactly where it is because every reader already takes the newest output per agent, so no stage is reset and no agent\'s evidence is marked stale -- a trail already at the survey is held, a resting trail is left alone, and an unknown name is reported');

  // One derivation for the pass that writes an audit and the gate that reads
  // one.
  //
  // The risk is a measurement that exists only for trails measured since the
  // code shipped. The derived field is written by the geometry audit, nothing
  // re-audits a trail already parked at a gate, and nineteen of twenty-seven
  // blocked trails carried their number on the relation all along -- while the
  // citation builder ten lines above the reader was already reading that same
  // tag out of an old audit.
  add('one-derivation-for-writer-and-reader',
    mapGuidance.includes('function singleRelationGuidance')
    // The cartographer derives rather than restates, so there is one definition.
    &&cartographer.includes('singleRelationGuidance(reconstructed.relation)')
    &&!cartographer.includes('sequence: [String(reconstructed.relation.tags.ref)]')
    // And the gate reaches the same answer out of an audit that predates it.
    &&dossier.includes('result?.routeGuidance||singleRelationGuidance(result?.relation)')
    // A walk with no number stays unanswered; a composite's joined label is
    // the measurement's to order.
    &&mapGuidance.includes("if(String(ref).includes(';')) return null;")
    &&standard.includes('The audit on the shelf is read, not re-taken'),
    'A single relation is a single number from end to end, and that derivation has one definition used both by the pass that writes a geometry audit and by the gate that reads one, so the map answers for an audit taken before the field existed without any re-audit; an unnumbered walk stays unanswered and a composite label is left to the measurement that can order it');

  // The unwaivable class is for a direction nobody can supply, not for an
  // agent reporting what happened when it looked.
  //
  // The risk is the ladder being unable to rescue anything: the answer computed
  // from the map or the record, then overruled by the agent's own admission
  // that it could not find one, filed under the claim id that nothing can
  // waive. Ciampeviei had all four answered and was rejected for
  // `logistics/route-number-switches: unresolved`.
  //
  // And the other direction: a claim no rung answered, or an agent reporting a
  // contradiction rather than a dead end, must still decide.
  add('a-note-about-the-search-is-not-a-missing-answer',
    dossier.includes('const aboutTheSearch=')
    &&dossier.includes("claim.finding==='unresolved'||exhausted")
    &&dossier.includes('answeredElsewhere&&aboutTheSearch')
    // Only when some rung of the ladder answered it.
    &&dossier.includes('const answeredElsewhere=caveatOnAnsweredClaim(output,claim,review,options);')
    // A contradiction is not a dead end, so it is not in the moving set.
    &&!dossier.includes("aboutTheSearch=claim.finding==='conflicted'")
    &&!dossier.includes("'counter-evidence'].includes(claim.finding)||exhausted")
    &&standard.includes("A note about the agent's own search is not a missing answer"),
    'A route claim answered by any rung of the ladder files what the agent reports about its own search as a caveat under the claim\'s own suffix -- still reaching the desk, still accepted as unknown, no longer deciding -- and only an unresolved finding or an exhausted ladder moves; a contradiction keeps deciding, and a claim no rung answered is refused exactly as before');

  // The report and the decision are two computations of one fact.
  //
  // The risk is a claim answered everywhere except where it counts. A gate
  // recomputes its blockers from the stored outputs and was handed no trail, so
  // ORMA's record answered in every report and in no decision: 22 of 34 trails
  // named these two claims as what rejected them while the catalogue held the
  // answer.
  add('the-record-answers-in-the-decision-too',
    dossier.includes('function trailRecordFor(review)')
    &&dossier.includes("dossierBlockingReasons(outputs,trail?{trail}:{})")
    // Read live, not taken from an audit that may predate the field.
    &&gatePolicy.includes('catalogue.get(String(found.trailId))')
    &&gatePolicy.includes('const item=trail?{...found,trail}:found;')
    // And the two computations are compared, so a future divergence is a
    // reported fault rather than an afternoon of reading the gate by hand.
    &&dryRun.includes('function reportVersusDecision(reportUnwaivable,decidedUnwaivable)')
    &&dryRun.includes('currentBlockingReasons(review)')
    &&standard.includes('The record answers in the decision, not only in the report'),
    'The catalogue the worker already loads rides the gate item so ORMA\'s own record answers in the decision and not only in the report, read live rather than taken from the audit; the dry run compares the two computations and reports a disagreement as a fault, never as a verdict on the walk');

  // ORMA's own clearly-labelled suggestion is not overruled by two operators
  // disagreeing with each other.
  //
  // The risk runs both ways. Suppressing ORMA's own answer leaves no answer at
  // all, which rejected ten trails on 15 October 2026 whose start the catalogue
  // has always published. And letting any contradiction move would waive one on
  // a claim an authority answered, where a measurement settles nothing -- so it
  // moves only where the answer is ORMA's own record, and only for a conflict.
  add('ormas-own-suggestion-stands-when-authorities-conflict',
    dossier.includes("const ormaOwnAnswer=standing?.derivedFrom==='orma-record'")
    &&dossier.includes("||(claim.finding==='conflicted'&&ormaOwnAnswer)")
    // Not counter-evidence, and not a conflict over an authority's own answer.
    &&!dossier.includes("claim.finding==='counter-evidence'&&ormaOwnAnswer")
    // The value the reader gets says whose suggestion it is, which is what
    // makes this honest rather than a loosened gate.
    &&recordGuidance.includes('not an operator\u2019s recommendation')
    &&recordGuidance.includes('CHECK_ACCESS')
    // And the report names a held contradiction as a judgement, not a bug.
    &&dryRun.includes('function contestedAnswers(routeGuidance,decidedUnwaivable)')
    &&standard.includes('own suggestion is not overruled by a disagreement between others'),
    'Where ORMA\'s own record answers a direction, an agent reporting that published sources contradict each other no longer suppresses it: the value says in its own words that it is ORMA\'s suggestion and tells the reader to check access, the conflict is still recorded as optional detail, and only a conflict over a record-answered claim moves -- counter-evidence and a contradiction over an authority\'s own answer still decide');

  // A dossier can exist for a walk the map and the record answered.
  //
  // The risk is a gate that approves and a compiler that throws, which is what
  // kept every trail off the site: two rules written before the ladder asked
  // for a cited authority, and one was handed the trail record and did not pass
  // it on. Both directions are pinned -- any rung answers, and a numbered route
  // with no start from anywhere is still refused.
  add('a-dossier-exists-for-what-the-ladder-answered',
    dossier.includes('function establishedRecommendedStart(review,options={})')
    &&dossier.includes("supportedRouteGuidance(review,'recommended-start',options)")
    &&!dossier.includes('an authoritative recommended-start claim before verification')
    &&dossier.includes('requires an established recommended-start before verification')
    // The assertion is given the trail, so the bottom rung can answer.
    &&dossier.includes('!supportedRouteGuidance(review,id,trail?{trail}:{})')
    &&standard.includes('A dossier can exist for a walk the map and the record answered'),
    'A dossier compiles for a walk whose directions any rung of the ladder answered: the numbered-route rule asks whether the start is established rather than whether an authority published it, and the guidance assertion passes on the trail record it is handed so ORMA\'s own record can answer there; a numbered route with no start from any rung is refused as before');

  // ORMA may answer from its own record, and must always say that it did.
  //
  // The risk is not that the start is wrong -- it is one ORMA already published
  // and a reader can see on the map -- but that it stops looking like ORMA's
  // own: a value without its suggestion line, or a citation naming an
  // authority nobody found, would read to a walker as somebody's published
  // recommendation.
  add('orma-answers-as-orma',
    recordGuidance.includes('not an operator\u2019s recommendation')
    &&recordGuidance.includes("authority: ORMA_AUTHORITY")
    &&recordGuidance.includes('const ORMA_AUTHORITY = \'ORMA\'')
    // The start and the numbering for any walk, and the other two only for a
    // walk the map was searched on and found none -- where there is no number
    // for anybody to supply.
    &&dossier.includes("RECORD_ANSWERABLE_CLAIMS=Object.freeze(['recommended-start','route-number-status',")
    &&dossier.includes("'route-number-sequence','route-number-switches'])")
    &&recordGuidance.includes('if(options.routeNumbersAbsent){')
    &&dossier.includes('const sourced=supportedLogisticsClaim(review,id);')
    &&standard.includes('Three kinds of answer, and the reader is told which'),
    'Where no authority and no map can answer, ORMA answers the start and the trail numbers from the walk it already recorded, every value saying it is ORMA\'s own suggestion and citing ORMA rather than an authority nobody found; for a walk the map was searched on and found no number it also answers the order and the turns in landmark terms, since no number exists for anybody to supply; an authority always wins, and a walk with neither a record nor an authority is not verified');

  // A walk nobody wrote about is not a walk that failed.
  //
  // Pinned because the two were one state and the difference is invisible from
  // the outside: both stop the trail, and only one of them should read as
  // something going wrong or be eligible to be paid for again.
  add('a-walk-nobody-wrote-about-rests',
    dossierReview.includes('function restingState(')
    &&dossierReview.includes("? 'imported' : 'rejected'")
    &&orchestrationStates.includes("'imported'")
    &&campaign.includes("TERMINAL_STATES=new Set(['ready-for-editorial','imported','verified-by-hand','rejected','blocked'])")
    &&standard.includes('A walk nobody wrote about rests, it is not rejected'),
    'A refusal standing only on route guidance rests as imported, keeping its place on the site while the pipeline stops spending on it; a refusal standing on a broken line or a contradicted identity is still a rejection, and resting is terminal so a rested trail holds no place in the intake budget');

  const failures=checks.filter(item=>item.status==='fail');
  return {contractVersion:'1.0.0',generatedAt:options.at||new Date().toISOString(),status:failures.length?'failed':'pass',summary:{passed:checks.length-failures.length,failed:failures.length,total:checks.length},checks,manualChecks:[
    {id:'github-actions-pr-creation',instruction:'Repository Settings → Actions → General must allow GitHub Actions to create pull requests before approved trail publication can recover.'},
    {id:'moderator-access',instruction:'The operator must sign in through the private backoffice with a Firebase moderator custom claim.'},
  ]};
}

module.exports={auditOperationalContract};
