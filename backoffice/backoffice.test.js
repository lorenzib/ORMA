'use strict';

const workflow = require('./contracts/workflow-v1');
const { validateCandidate } = require('./contracts/candidate-v1');
const { validateEvidence } = require('./contracts/evidence-v1');
const { assessGeometry, distanceMeters } = require('./services/geometry-validator');
const { rankParking } = require('./services/parking-ranker');
const { buildCandidate, discoverTrails } = require('./workflows/discover-trails');
const { addLogistics } = require('./workflows/add-logistics');
const reviewDecisions = require('./review-decisions');
const routeReviewDecisions = require('./route-review-decisions');
const routeReview = require('../backoffice-data/route-review.json');
const { validateDossier } = require('./contracts/dossier-v1');
const treCimeDossier = require('./dossiers/tre-cime.json');
const cinqueTorriDossier = require('./dossiers/cinque-torri.json');
const lagoBraiesDossier = require('./dossiers/lago-braies.json');
const enrichmentReviewDecisions = require('./enrichment-review-decisions');
const decisionResolution = require('../backoffice-data/decision-resolution.json');
const decisionResolutionAttempt2 = require('../backoffice-data/decision-resolution-attempt-2.json');
const decisionResolutionAttempt3 = require('../backoffice-data/decision-resolution-attempt-3.json');
const decisionResolutionAttempt4 = require('../backoffice-data/decision-resolution-attempt-4.json');
const decisionResolutionAttempt5 = require('../backoffice-data/decision-resolution-attempt-5.json');
const montePelmoContactPacket = require('../backoffice-data/monte-pelmo-contact-packet.json');
const finalHumanDecisionStatus = require('../backoffice-data/final-human-decision-status.json');
const braiesParkingApproval = require('../backoffice-data/braies-parking-set-approval.json');
const routeResolutionAttempt1 = require('../backoffice-data/route-resolution-attempt-1.json');
const routeResolutionAttempt2 = require('../backoffice-data/route-resolution-attempt-2.json');
const routeResolutionAttempt3 = require('../backoffice-data/route-resolution-attempt-3.json');
const routeApprovalReceipts = require('../backoffice-data/route-approval-receipts-2026-08-18.json');
const postRouteParkingAudit = require('../backoffice-data/decision-resolution-post-route-audit.json');
const export11RouteReceipts = require('../backoffice-data/route-approval-receipts-export-11.json');
const export11Resolution = require('../backoffice-data/decision-resolution-export-11.json');
const export11Enrichment = require('../backoffice-data/enrichment-campaign-export-11.json');
const export12ParkingReceipt = require('../backoffice-data/parking-approval-receipt-export-12.json');
const export12Resolution = require('../backoffice-data/decision-resolution-export-12.json');
const enrichmentAttempt1 = require('../backoffice-data/enrichment-resolution-attempt-1.json');
const mediaGapChecklist = require('../backoffice-data/media-gap-checklist-enrichment-1.json');
const enrichmentReviewReceipt13 = require('../backoffice-data/enrichment-review-receipt-export-13.json');
const enrichmentAttempt2 = require('../backoffice-data/enrichment-resolution-attempt-2.json');
const mediaCandidatesAttempt2 = require('../backoffice-data/media-candidates-attempt-2.json');
const enrichmentReviewReceipt14 = require('../backoffice-data/enrichment-review-receipt-export-14.json');
const enrichmentAttempt3 = require('../backoffice-data/enrichment-resolution-attempt-3.json');
const enrichmentReviewReceipt15 = require('../backoffice-data/enrichment-review-receipt-export-15.json');
const enrichmentAttempt4 = require('../backoffice-data/enrichment-resolution-attempt-4.json');
const mediaLicensingAttempt4 = require('../backoffice-data/media-licensing-packet-attempt-4.json');
const braiesLivestockContactAttempt4 = require('../backoffice-data/braies-livestock-contact-packet-attempt-4.json');
const enrichmentReviewReceipt16 = require('../backoffice-data/enrichment-review-receipt-export-16.json');
const enrichmentAttempt5 = require('../backoffice-data/enrichment-resolution-attempt-5.json');
const redTeamAttempt5 = require('../backoffice-data/red-team-review-attempt-5.json');
const verificationReviewDecisions = require('./verification-review-decisions');
const verificationReceipt17 = require('../backoffice-data/verification-approval-receipt-export-17.json');
const verifiedRegistry = require('../backoffice-data/orma-verified-registry.json');
const braiesLivestockHumanAttestation = require('../backoffice-data/braies-livestock-human-attestation-2026-08-18.json');
const braiesVerificationApproval = require('../backoffice-data/braies-verification-approval-2026-08-18.json');
const decisionReconciliation18 = require('../backoffice-data/decision-reconciliation-export-18.json');
const verificationReceipt19 = require('../backoffice-data/verification-review-receipt-export-19.json');
const verificationReceipt20 = require('../backoffice-data/verification-approval-receipt-export-20.json');
const verifiedTrailEditorialQueue = require('../backoffice-data/verified-trail-editorial-queue.json');
const { planVerifiedTrailEditorial } = require('./workflows/plan-verified-trail-editorial');
const verifiedTrailEditorialExecution = require('../backoffice-data/verified-trail-editorial-execution.json');
const { compileVerifiedEditorialPreview } = require('./workflows/compile-verified-editorial-preview');
const { buildPublicationStaging } = require('./workflows/build-publication-staging');
const { buildVerifiedTrailRevisionJobs } = require('./workflows/queue-verified-trail-revisions');
const { runVerifiedTrailRevision } = require('./workflows/run-verified-trail-revision');
const { materializeApprovedPublications } = require('./workflows/materialize-approved-publications');
const { publicationRequestIsRetryable, recordPublicationFailure } = require('./workflows/publication-failure-receipts');
const { summarizeFailureLog, workflowRunUrl } = require('./cli/record-publication-failure');
const { ingestPublicationReviews } = require('./workflows/run-live-backoffice-worker');
const resolutionPolicy = require('./contracts/resolution-policy-v1');
const fleet = require('./agents/registry-v1');
const { createAgentJob, validateAgentJob } = require('./contracts/agent-job-v1');
const fleetRouter = require('./workflows/fleet-router-v1');
const { buildRelationQuery } = require('./services/osm-relation-client');
const { reconstructRelation } = require('./services/relation-geometry');
const { compareMetrics, runCartographer } = require('./workflows/run-cartographer');
const { parseGpx, proposalFeature } = require('./services/gpx-route');
const { splitAssistedRoute } = require('./services/assisted-route-segmenter');
const { validateCartographerResult } = require('./contracts/cartographer-result-v1');
const { validateCampaign } = require('./contracts/catalogue-campaign-v1');
const {
  hasFullGraduation, relationExternalId, planCatalogueCampaign,
} = require('./workflows/plan-catalogue-campaign');
const { candidateFromProductionTrail, runCatalogueBatch } = require('./workflows/run-catalogue-batch');
const { validateContentFlow } = require('./contracts/content-flow-v1');
const { EDITABLE_FIELDS, PROTECTED_FIELDS, planContentFlow } = require('./workflows/plan-content-flow');
const { validateContentOperations } = require('./contracts/content-operations-v1');
const { planContentOperations } = require('./workflows/plan-content-operations');
const { outputText,createStructuredResponse } = require('./services/openai-responses-client');
const { visibleText, runGuideContent, runPageContent } = require('./workflows/run-guide-content');
const { runEditorialCycle } = require('./workflows/run-editorial-cycle');
const { runNewsletter, newsletterIsDue } = require('./workflows/run-newsletter');
const { validateContentExecution } = require('./contracts/content-result-v1');
const contentReviewDecisions = require('./content-review-decisions');
const { safeSourcePath, applyExactChanges, applyReviewChanges, recordVerifiedTrailReview } = require('./workflows/apply-content-review');
const { publishablePaths, groupedPatches } = require('./workflows/publish-content-review');
const { contentFingerprint, fingerprint, selectEditorialWork, recordEditorialOutcome } = require('./workflows/editorial-ledger');
const { validateEditorialLedger } = require('./contracts/editorial-ledger-v1');
const { validateRevisionResult, runEditorialRevision } = require('./workflows/run-editorial-revision');
const { validateTrailOrchestration } = require('./contracts/trail-orchestration-v1');
const { seedOrchestrationFromCatalogue, buildDossierReviewQueue } = require('./workflows/build-live-orchestration');
const { applyDossierReview } = require('./workflows/apply-dossier-review');
const { dossierBlockingReasons } = require('./workflows/advance-trail-orchestration');
const { modelForAgent,runTrailSpecialist } = require('./workflows/run-trail-specialist');
const { processTrailSpecialistJobs } = require('./workflows/run-live-backoffice-worker');
const { positiveInteger } = require('./cli/live-worker');
const { startLiveTrailCampaign } = require('./workflows/start-live-trail-campaign');
const { trailOnlyReviewQueue } = require('./cli/seed-live-state');
const { compileVerifiedDossier, verificationRecord } = require('./workflows/compile-verified-dossier');
const { runProductDiscovery } = require('./workflows/run-product-discovery');
const { applyProductIdeaReview } = require('./workflows/product-ideas-review');
const { imageSignals, auditImageCoverage } = require('./workflows/audit-image-coverage');
const { applyImageCoverageReview } = require('./workflows/image-coverage-review');
const { parseAtomFeed, buildHazardArtifacts, applyHazardReview } = require('./workflows/dynamic-hazards');
const { planNewTrailScouting } = require('./workflows/plan-new-trail-scouting');
const { candidateToTrail, selectedNewTrails, admitNewTrailIntake } = require('./workflows/new-trail-intake');
const mockContentExecution = require('./fixtures/content-execution.mock.json');

const loop = [
  [11.58, 46.51], [11.59, 46.52], [11.60, 46.51], [11.58, 46.51],
];

function trail(overrides = {}){
  return {
    id: 'relation/123', osmType: 'relation', osmId: 123,
    name: 'Test loop', ref: null, difficulty: 'hiking',
    center: [11.59, 46.515], geometry: loop,
    sourceTags: { route: 'hiking' }, ...overrides,
  };
}

describe('ORMA backoffice MVP', () => {
  test('workflow allows only explicit transitions', () => {
    expect(workflow.canTransition('discovered', 'geometry_validated')).toBe(true);
    expect(workflow.canTransition('discovered', 'published')).toBe(false);
    expect(() => workflow.transition({ state: 'discovered' }, 'published')).toThrow('Invalid workflow transition');
  });

  test('geometry assessment recognises a plausible closed loop', () => {
    const result = assessGeometry(loop);
    expect(result.status).toBe('passed');
    expect(result.isClosed).toBe(true);
    expect(result.distanceKm).toBeGreaterThan(3);
    expect(distanceMeters(loop[0], loop[1])).toBeGreaterThan(1000);
  });

  test('open geometry stays out of the queue', () => {
    const candidate = buildCandidate(trail({ geometry: loop.slice(0, -1) }), { at: '2026-08-17T10:00:00.000Z' });
    expect(candidate.state).toBe('rejected');
    expect(candidate.blockers).toContain('not-closed-loop');
  });

  test('hard alpine difficulty stays out even when geometry closes', () => {
    const candidate = buildCandidate(trail({ difficulty: 'alpine_hiking' }), { at: '2026-08-17T10:00:00.000Z' });
    expect(candidate.state).toBe('rejected');
    expect(candidate.blockers).toContain('blocked-difficulty:alpine_hiking');
  });

  test('discovery is bounded and returns contract-valid candidates', () => {
    const result = discoverTrails({
      source: 'fixture', generatedAt: '2026-08-16T00:00:00.000Z',
      trails: [trail(), trail({ id: 'way/456', name: 'Second loop' }), trail({ id: 'way/789', geometry: loop.slice(0, -1) })],
    }, { limit: 1, at: '2026-08-17T10:00:00.000Z' });
    expect(result.summary).toEqual({ assessed: 3, eligible: 2, queued: 1, rejected: 1 });
    expect(result.candidates).toHaveLength(1);
    expect(validateCandidate(result.candidates[0])).toEqual([]);
    expect(result.candidates[0].state).toBe('geometry_validated');
  });

  test('evidence contract requires a traceable source and producer', () => {
    expect(validateEvidence({
      contractVersion: '1.0.0',
      category: 'access',
      status: 'proposed',
      claim: 'Dogs are allowed on leash.',
      confidence: 0.9,
      source: { url: 'https://example.test/rules' },
      producedBy: { component: 'auditor-v1' },
    })).toEqual([]);
    expect(validateEvidence({ contractVersion: '1.0.0' })).toEqual(expect.arrayContaining([
      'category is invalid', 'status is invalid', 'source.url is required',
    ]));
  });

  test('logistics ranks nearby named parking without approving it', () => {
    const accessPoints = {
      generatedAt: '2026-08-01T00:00:00.000Z',
      features: [
        { type: 'Feature', properties: { kind: 'parking', name: null }, geometry: { type: 'Point', coordinates: [11.5805, 46.5105] } },
        { type: 'Feature', properties: { kind: 'parking', name: 'Main car park', osmId: 'way/99' }, geometry: { type: 'Point', coordinates: [11.5806, 46.5106] } },
        { type: 'Feature', properties: { kind: 'parking', name: 'Too far' }, geometry: { type: 'Point', coordinates: [12.5, 47.5] } },
      ],
    };
    const ranked = rankParking(loop, accessPoints, { radiusM: 500 });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toEqual(expect.objectContaining({
      name: 'Main car park', osmId: 'way/99', status: 'mapped-suggestion', rank: 1,
    }));
    const candidate = buildCandidate(trail(), { at: '2026-08-17T10:00:00.000Z' });
    const enriched = addLogistics(candidate, accessPoints, { at: '2026-08-17T11:00:00.000Z' });
    expect(enriched.state).toBe('evidence_pending');
    expect(enriched.logistics.selectedParking).toBeNull();
    expect(enriched.logistics.requiresHumanReview).toBe(true);
  });

  test('review decisions are explicit, replaceable and exportable', () => {
    const parking = { position: [11.58, 46.51], name: 'Main car park' };
    const approved = reviewDecisions.applyDecision({}, {
      candidateId: 'osm-relation-123', action: 'approve-parking', parking,
      reviewedAt: '2026-08-17T12:00:00.000Z', reviewedBy: 'editor-1',
    });
    expect(approved['osm-relation-123']).toEqual(expect.objectContaining({ action: 'approve-parking', parking }));
    const unresolved = reviewDecisions.applyDecision(approved, {
      candidateId: 'osm-relation-123', action: 'parking-unresolved',
      reviewedAt: '2026-08-17T13:00:00.000Z',
    });
    expect(unresolved['osm-relation-123'].parking).toBeNull();
    const exported = reviewDecisions.exportRecord({ workflowVersion: '1.0.0' }, unresolved, '2026-08-17T14:00:00.000Z');
    expect(exported.decisions).toHaveLength(1);
    expect(() => reviewDecisions.applyDecision({}, { candidateId: 'x', action: 'approve-parking' })).toThrow('mapped parking');
  });

  test('route decisions remain separate, human-gated and exportable', () => {
    const requested = routeReviewDecisions.applyDecision({}, {
      candidateId: 'osm-relation-1484751', action: 'request-route-research',
      reviewedAt: '2026-08-18T15:00:00.000Z', note: 'Replace the incorrect relation.',
    });
    expect(requested['osm-relation-1484751']).toEqual(expect.objectContaining({
      gate: 'geometry-approval', action: 'request-route-research', route: null,
    }));
    expect(() => routeReviewDecisions.applyDecision({}, {
      candidateId: 'x', action: 'approve-route',
    })).toThrow('LineString');
    const exported = routeReviewDecisions.exportRecord(routeReview, requested, '2026-08-18T15:01:00.000Z');
    expect(exported.gate).toBe('geometry-approval');
    expect(exported.decisions).toHaveLength(1);
    const geometry = { type: 'LineString', coordinates: loop };
    const variants = routeReviewDecisions.applyDecision({}, {
      candidateId: 'tre-cime', action: 'approve-route-variants',
      routes: [
        { proposalId: 'classic', geometry, sourceRefs: ['official-classic'] },
        { proposalId: 'extended', geometry, sourceRefs: ['official-extended'] },
      ],
    });
    expect(variants['tre-cime'].routes).toHaveLength(2);
    expect(variants['tre-cime'].route).toBeNull();
  });

  test('route review separates Tre Cime variants and never enables unsupported approval', () => {
    expect(routeReview.mode).toBe('draft-only');
    expect(routeReview.publicMutationAllowed).toBe(false);
    expect(routeReview.items).toHaveLength(4);
    expect(routeReview.items[0]).toEqual(expect.objectContaining({
      candidateId: 'osm-relation-1484751', priority: 1,
      reviewState: 'ready-for-human-route-choice', approvalAllowed: true,
    }));
    expect(routeReview.items[0].proposals.map(proposal => proposal.id)).toEqual([
      'tre-cime-classic-101-105', 'tre-cime-monte-paterno-101-104-105',
    ]);
    const cinqueTorri = routeReview.items.find(item => item.candidateId === 'osm-relation-6678431');
    expect(cinqueTorri.approvalAllowed).toBe(true);
    expect(cinqueTorri.proposals).toEqual([
      expect.objectContaining({
        id: 'cinque-torri-three-refuges-assisted',
        eligibility: 'ready-for-human-review',
      }),
    ]);
    expect(routeReview.items.find(item => item.candidateId === 'osm-relation-1372055').nextAgentAction)
      .toEqual(expect.objectContaining({ attempt: 5, maximumAttempts: 5 }));
  });

  test('worked Tre Cime dossier is contract-valid, internally verified and still unpublished', () => {
    expect(validateDossier(treCimeDossier)).toEqual([]);
    expect(treCimeDossier.reviewState).toBe('accepted');
    expect(treCimeDossier.promotionGate.canPublish).toBe(false);
    expect(treCimeDossier.ormaVerification).toEqual(expect.objectContaining({
      status: 'verified', publicationAuthorized: false, publicMutationAllowed: false,
    }));
    expect(treCimeDossier.promotionGate.canApproveParking).toBe(true);
    expect(treCimeDossier.promotionGate.canApproveRoute).toBe(true);
    expect(treCimeDossier.claims.find(claim => claim.id === 'route-geometry').state).toBe('supported');
    expect(treCimeDossier.claims.find(claim => claim.id === 'parking-pin').state).toBe('supported');
  });

  test('resolution policy permits five distinct automated attempts', () => {
    expect(resolutionPolicy.MAX_AUTOMATED_ATTEMPTS).toBe(5);
    const attempts = Array.from({ length: 4 }, (_, index) => ({ strategy: `strategy-${index + 1}` }));
    expect(resolutionPolicy.assertNextStrategy(attempts, 'strategy-5')).toEqual({
      attemptNumber: 5, strategy: 'strategy-5', delayHours: 72,
    });
    const exhausted = [...attempts, { strategy: 'strategy-5' }];
    expect(resolutionPolicy.resolutionStatus(exhausted, 'unresolved')).toBe('source-exhausted');
    expect(() => resolutionPolicy.assertNextStrategy(exhausted, 'strategy-6')).toThrow('limit reached (5)');
    expect(() => resolutionPolicy.assertNextStrategy(attempts, 'strategy-1')).toThrow('materially different');
  });

  test('new specialist agents are registered with human gates and no approval authority', () => {
    expect(fleet.validateRegistry()).toEqual([]);
    ['cartographer', 'regulatoryRanger', 'evidenceLibrarian', 'redTeam'].forEach(agentId => {
      const agent = fleet.getAgent(agentId);
      expect(agent).toBeTruthy();
      expect(agent.humanGates.length).toBeGreaterThan(0);
      expect(agent.mayApprove).toEqual([]);
    });
  });

  test('agent jobs require a registered fleet member and traceable references', () => {
    const job = createAgentJob({
      id: 'job-1', agentId: 'cartographer', action: 'resolve-full-geometry',
      candidateId: 'osm-relation-1484751', claimIds: ['route-geometry'],
      inputRefs: ['dossiers/osm-relation-1484751'], humanGate: 'geometry-approval',
    }, { at: '2026-08-17T15:00:00.000Z' });
    expect(validateAgentJob(job)).toEqual([]);
    expect(job.status).toBe('queued');
    expect(() => createAgentJob({ id: 'bad', agentId: 'unknown', action: 'x' })).toThrow('not registered');
  });

  test('fleet router sends only remaining blockers onward and requires red-team review at the end', () => {
    const handoffs = fleetRouter.auditHandoffs(treCimeDossier);
    expect(handoffs).toEqual([]);
    expect(handoffs.find(handoff => handoff.agentId === 'cartographer')).toBeUndefined();
    expect(handoffs.find(handoff => handoff.agentId === 'terrainPoi')).toBeUndefined();
    expect(handoffs.find(handoff => handoff.agentId === 'logistics')).toBeUndefined();
    const green = { claims: treCimeDossier.claims.map(claim => ({ ...claim, state: 'supported' })) };
    expect(fleetRouter.preEditorialSequence(green)).toEqual(expect.objectContaining({
      humanGate: 'serious-objection-review',
      next: expect.arrayContaining([expect.objectContaining({ agentId: 'redTeam' })]),
    }));
  });

  test('Cartographer query and reconstruction retain current relation provenance', () => {
    expect(buildRelationQuery('relation/123')).toContain('relation(123)');
    const payload = {
      elements: [
        {
          type: 'relation', id: 123, version: 7, timestamp: '2026-08-16T09:00:00Z',
          tags: { type: 'route', route: 'hiking' },
          members: [
            { type: 'way', ref: 10, role: '' },
            { type: 'way', ref: 11, role: '' },
            { type: 'way', ref: 12, role: '' },
          ],
        },
        { type: 'way', id: 10, geometry: [{ lon: 11.58, lat: 46.51 }, { lon: 11.59, lat: 46.52 }] },
        { type: 'way', id: 11, geometry: [{ lon: 11.60, lat: 46.51 }, { lon: 11.59, lat: 46.52 }] },
        { type: 'way', id: 12, geometry: [{ lon: 11.60, lat: 46.51 }, { lon: 11.58, lat: 46.51 }] },
      ],
    };
    const reconstructed = reconstructRelation(payload, 'relation/123');
    expect(reconstructed.relation).toEqual(expect.objectContaining({ version: 7, memberWayCount: 3 }));
    expect(reconstructed.components).toHaveLength(1);
    expect(reconstructed.geometry.coordinates[0]).toEqual(reconstructed.geometry.coordinates.at(-1));
    expect(reconstructed.assessment.status).toBe('passed');
  });

  test('official GPX becomes a closed, draft-only route proposal', () => {
    const xml = '<?xml version="1.0"?><gpx><trk><trkseg>'
      + '<trkpt lat="46.51" lon="11.58"><ele>100</ele></trkpt>'
      + '<trkpt lat="46.52" lon="11.59"><ele>120</ele></trkpt>'
      + '<trkpt lat="46.51" lon="11.60"><ele>110</ele></trkpt>'
      + '<trkpt lat="46.51" lon="11.58"><ele>100</ele></trkpt>'
      + '</trkseg></trk></gpx>';
    const parsed = parseGpx(xml);
    expect(parsed.assessment.isClosed).toBe(true);
    expect(parsed.elevation.rawAscentM).toBe(20);
    const feature = proposalFeature(xml, { proposalId: 'official-loop' });
    expect(feature.geometry.type).toBe('LineString');
    expect(feature.properties).toEqual(expect.objectContaining({
      proposalId: 'official-loop', humanGate: 'geometry-approval', publicMutationAllowed: false,
    }));
  });

  test('Cartographer produces a blocked human-review artifact when official metrics conflict', async () => {
    const candidate = buildCandidate(trail(), { at: '2026-08-17T10:00:00.000Z' });
    candidate.source.externalId = 'relation/123';
    const payload = {
      elements: [
        { type: 'relation', id: 123, version: 2, timestamp: '2026-08-17T08:00:00Z', tags: {}, members: [
          { type: 'way', ref: 10 }, { type: 'way', ref: 11 }, { type: 'way', ref: 12 },
        ] },
        { type: 'way', id: 10, geometry: [{ lon: 11.58, lat: 46.51 }, { lon: 11.59, lat: 46.52 }] },
        { type: 'way', id: 11, geometry: [{ lon: 11.59, lat: 46.52 }, { lon: 11.60, lat: 46.51 }] },
        { type: 'way', id: 12, geometry: [{ lon: 11.60, lat: 46.51 }, { lon: 11.58, lat: 46.51 }] },
      ],
    };
    const result = await runCartographer(candidate, { referenceMetrics: { distanceKm: 20, ascentM: 400 } }, {
      at: '2026-08-17T16:00:00.000Z',
      fetchRelation: async () => ({ endpoint: 'fixture', payload }),
    });
    expect(validateCartographerResult(result)).toEqual([]);
    expect(result.reviewState).toBe('blocked');
    expect(result.blockers).toContain('official-distance-conflict');
    expect(result.humanGate.required).toBe(true);
    expect(compareMetrics({ distanceKm: 3 }, { assessment: { distanceKm: 10 } }, { distanceKm: 10 }).withinOfficialDistanceTolerance).toBe(true);
  });

  test('catalogue campaign recognises only complete modern graduation as ORMA verified', () => {
    const complete = {
      status: 'verified',
      completed: ['photo', 'route', 'mapPoints', 'elevation', 'water', 'heat',
        'exposure', 'livestock', 'surfaceHazards', 'access'],
    };
    expect(hasFullGraduation({ graduation: complete })).toBe(true);
    expect(hasFullGraduation({ graduation: { ...complete, completed: complete.completed.slice(1) } })).toBe(false);
    expect(hasFullGraduation({ graduation: { ...complete, status: 'in-progress' } })).toBe(false);
  });

  test('catalogue campaign creates a bounded, draft-only Cartographer queue', () => {
    const trails = [
      { id: 'curated-one', name: 'Curated One', curated: true, path: loop },
      { id: 'osm-123', name: 'Imported One', curated: false, path: loop },
      { id: 'osm-456', name: 'Imported Two', curated: false, path: loop },
    ];
    const campaign = planCatalogueCampaign(trails, {
      at: '2026-08-17T17:00:00.000Z', jobLimit: 2,
    });
    expect(validateCampaign(campaign)).toEqual([]);
    expect(campaign.mode).toBe('draft-only');
    expect(campaign.publicMutationAllowed).toBe(false);
    expect(campaign.jobs).toHaveLength(2);
    expect(campaign.jobs.every(job => job.humanGate === 'geometry-approval')).toBe(true);
    expect(campaign.items.find(item => item.trailId === 'curated-one').campaignState).toBe('source-identity-required');
    expect(relationExternalId(trails[1])).toBe('relation/123');
  });

  test('catalogue campaign advances past trails recorded by earlier batches', () => {
    const trails = [
      { id: 'osm-123', name: 'First', curated: false, path: loop },
      { id: 'osm-456', name: 'Second', curated: false, path: loop },
    ];
    const campaign = planCatalogueCampaign(trails, {
      at: '2026-08-17T17:30:00.000Z', jobLimit: 1, excludedTrailIds: ['osm-123'],
    });
    expect(campaign.selectedTrailIds).toEqual(['osm-456']);
    expect(campaign.summary.previouslyQueued).toBe(1);
    expect(campaign.summary.remainingQueueable).toBe(0);
  });

  test('campaign runner converts production coordinates into a gated Cartographer artifact', async () => {
    const productionTrail = {
      id: 'osm-123', name: 'First', curated: false, osmRelation: 123,
      path: loop.map(([lng, lat]) => [lat, lng]), distance: 3, elevation: 200,
    };
    const campaign = planCatalogueCampaign([productionTrail], {
      at: '2026-08-17T18:00:00.000Z', jobLimit: 1,
    });
    const candidate = candidateFromProductionTrail(productionTrail);
    expect(candidate.source.externalId).toBe('relation/123');
    expect(candidate.geometryAssessment.distanceKm).toBe(3);
    const execution = await runCatalogueBatch(campaign, [productionTrail], {
      at: '2026-08-17T18:01:00.000Z',
      runCartographer: async input => ({
        candidateId: input.id, reviewState: 'ready-for-human-review', blockers: [],
      }),
    });
    expect(execution.publicMutationAllowed).toBe(false);
    expect(execution.summary).toEqual({ attempted: 1, needsHuman: 1, failed: 0 });
    expect(execution.jobs[0]).toEqual(expect.objectContaining({
      status: 'needs-human', humanGate: 'geometry-approval',
    }));
    expect(execution.outputs[0].outputRef).toBe('backoffice-data/cartographer/osm-123.json');
  });

  test('exported parking decisions remain evidence-backed and human-gated after resolution', () => {
    expect(decisionResolution.publicMutationAllowed).toBe(false);
    expect(decisionResolution.resolutionAttempt).toBe(1);
    expect(decisionResolution.resolutions).toHaveLength(4);
    decisionResolution.resolutions.forEach(resolution => {
      expect(resolution.sources.length).toBeGreaterThan(0);
      expect(resolution.remainingHumanChecks.length).toBeGreaterThan(0);
    });
    expect(decisionResolution.resolutions.find(item => item.candidateId === 'osm-relation-1372055').state)
      .toBe('requires-update-trail-access-blocked');
  });

  test('resolution attempt 2 records pins with confidence and never promotes a trail', () => {
    expect(decisionResolutionAttempt2.resolutionAttempt).toBe(2);
    expect(decisionResolutionAttempt2.publicMutationAllowed).toBe(false);
    expect(decisionResolutionAttempt2.summary.fullyOrmaVerified).toBe(0);
    const treCime = decisionResolutionAttempt2.resolutions.find(item => item.candidateId === 'osm-relation-1484751');
    expect(treCime.parkingOptions[0]).toEqual(expect.objectContaining({
      lat: 46.612849, lng: 12.292858, osmId: 'way/1109742730',
    }));
    const braies = decisionResolutionAttempt2.resolutions.find(item => item.candidateId === 'osm-way-25736154');
    expect(braies.parkingOptions.find(item => item.label.startsWith('P3'))).toEqual(expect.objectContaining({
      lat: null, confidence: 'identity-confirmed-coordinate-conflicted',
    }));
  });

  test('resolution attempt 3 rejects the conflicted Cinque Torri approval and records four Braies options', () => {
    expect(decisionResolutionAttempt3.resolutionAttempt).toBe(3);
    expect(decisionResolutionAttempt3.publicMutationAllowed).toBe(false);
    const cinque = decisionResolutionAttempt3.resolutions.find(item => item.candidateId === 'osm-relation-6678431');
    expect(cinque.conflictedDecision).toEqual(expect.objectContaining({ accepted: false, distanceFromAuthoritativeTrailheadM: 1379 }));
    const braies = decisionResolutionAttempt3.resolutions.find(item => item.candidateId === 'osm-way-25736154');
    expect(braies.parkingOptions.map(option => option.label)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^P1/), expect.stringMatching(/^P2/), expect.stringMatching(/^P3/), expect.stringMatching(/^P4/),
    ]));
    expect(decisionResolutionAttempt3.summary.fullyOrmaVerified).toBe(0);
  });

  test('review decisions support an explicitly selected parking set', () => {
    const next = reviewDecisions.applyDecision({}, {
      candidateId: 'braies', action: 'approve-parking-set',
      parkings: [{ name: 'P3', position: [12.08, 46.70] }, { name: 'P4', position: [12.083, 46.699] }],
      reviewedAt: '2026-08-18T13:00:00.000Z',
    });
    expect(next.braies.action).toBe('approve-parking-set');
    expect(next.braies.parkings).toHaveLength(2);
    expect(next.braies.parking).toBeNull();
  });

  test('resolution attempt 4 exposes four coordinate-backed Braies options and keeps Monte Pelmo blocked', () => {
    expect(decisionResolutionAttempt4.resolutionAttempt).toBe(4);
    const braies = decisionResolutionAttempt4.resolutions.find(item => item.candidateId === 'osm-way-25736154');
    expect(braies.parkingOptions).toHaveLength(4);
    expect(braies.parkingOptions.every(option => Number.isFinite(option.lat) && Number.isFinite(option.lng))).toBe(true);
    const pelmo = decisionResolutionAttempt4.resolutions.find(item => item.candidateId === 'osm-relation-1372055');
    expect(pelmo.state).toBe('direct-confirmation-required-full-loop-blocked');
    expect(decisionResolutionAttempt4.summary.fullyOrmaVerified).toBe(0);
  });

  test('resolution attempt 5 exhausts retries without forcing unresolved claims green', () => {
    expect(decisionResolutionAttempt5.resolutionAttempt).toBe(5);
    expect(decisionResolutionAttempt5.automatedRetryBudgetExhausted).toBe(true);
    expect(decisionResolutionAttempt5.summary.fullyOrmaVerified).toBe(0);
    const pelmo = decisionResolutionAttempt5.resolutions.find(item => item.candidateId === 'osm-relation-1372055');
    expect(pelmo.state).toBe('source-exhausted-direct-confirmation-required');
    expect(montePelmoContactPacket.notSent).toBe(true);
    expect(montePelmoContactPacket.questions.length).toBeGreaterThanOrEqual(5);
  });

  test('post-attempt human status records the explicit four-option Braies approval', () => {
    expect(finalHumanDecisionStatus.automatedResolutionAttemptsComplete).toBe(5);
    const braies = finalHumanDecisionStatus.status.find(item => item.candidateId === 'osm-way-25736154');
    expect(braies.parkingDecision).toBe('approved-four-option-set');
    expect(braies.approvedParkingCount).toBe(4);
    expect(finalHumanDecisionStatus.publicMutationAllowed).toBe(false);
    expect(braiesParkingApproval.action).toBe('approve-parking-set');
    expect(braiesParkingApproval.parkings).toHaveLength(4);
    expect(braiesParkingApproval.publicMutationAllowed).toBe(false);
  });

  test('route resolution attempt 1 creates two reviewable proposals without promoting a trail', () => {
    expect(routeResolutionAttempt1.sourceDecisionExport).toBe('orma-review-decisions-2026-08-18 (9).json');
    expect(routeResolutionAttempt1.publicMutationAllowed).toBe(false);
    expect(routeResolutionAttempt1.summary.fullyOrmaVerified).toBe(0);
    const treCime = routeResolutionAttempt1.results.find(item => item.candidateId === 'osm-relation-1484751');
    expect(treCime.proposalIds).toEqual([
      'tre-cime-classic-101-105', 'tre-cime-monte-paterno-101-104-105',
    ]);
    expect(treCime.excludedVariant.reason).toMatch(/not dog-friendly/);
    const cinque = routeResolutionAttempt1.results.find(item => item.candidateId === 'osm-relation-6678431');
    expect(cinque.nextAttemptRequired).toBe(true);
  });

  test('route attempt 2 accepts exact geometry and reopens contradicted Cinque Torri parking', () => {
    expect(routeApprovalReceipts.sourceDecisionExport).toBe('orma-review-decisions-2026-08-18 (10).json');
    expect(routeApprovalReceipts.approvals).toHaveLength(2);
    expect(routeApprovalReceipts.approvals.every(approval => approval.exactProposalMatch)).toBe(true);
    expect(routeResolutionAttempt2.publicMutationAllowed).toBe(false);
    expect(routeResolutionAttempt2.summary.fullyOrmaVerified).toBe(0);
    const cinque = routeResolutionAttempt2.results.find(item => item.candidateId === 'osm-relation-6678431');
    expect(cinque.storedRelationAudit.validHikingRoute).toBe(false);
    expect(cinque.parkingContradiction.replacementCandidate).toEqual(expect.objectContaining({
      osmId: 'way/900787870', position: [12.037603729268294, 46.51891714390244],
    }));
    const correction = postRouteParkingAudit.resolutions.find(item => item.candidateId === 'osm-relation-6678431');
    expect(correction.state).toBe('parking-and-assisted-route-geometry-approved');
    expect(correction.parkingOptions[0].osmId).toBe('way/900787870');
  });

  test('route attempt 3 resolves dog lift rules but keeps Cinque Torri human-gated', () => {
    expect(routeResolutionAttempt3.resolutionAttempt).toBe(3);
    expect(routeResolutionAttempt3.publicMutationAllowed).toBe(false);
    expect(routeResolutionAttempt3.state).toBe('assisted-route-ready-for-human-geometry-review');
    expect(routeResolutionAttempt3.resolvedClaims[0]).toEqual(expect.objectContaining({
      state: 'supported', conditions: ['leash', 'muzzle'],
    }));
    expect(routeResolutionAttempt3.nextAutomatedAttempt).toBe(4);
    expect(routeResolutionAttempt3.fullyOrmaVerified).toBe(false);
  });

  test('export 11 accepts exact route geometries but rejects the stale Cinque Torri parking', () => {
    expect(export11RouteReceipts.sourceDecisionExport).toBe('orma-review-decisions-2026-08-18 (11).json');
    expect(export11RouteReceipts.approvals).toHaveLength(3);
    expect(export11RouteReceipts.approvals.every(approval => approval.exactProposalMatch)).toBe(true);
    const cinqueRoute = export11RouteReceipts.approvals.find(approval => approval.candidateId === 'osm-relation-6678431');
    expect(cinqueRoute).toEqual(expect.objectContaining({
      proposalId: 'cinque-torri-three-refuges-assisted',
      coordinateCount: 204,
      geometrySha256: '7131fb630d239582e8ab7b1be22e914cc9c3a1caaa1959921d71569dd93ff47a',
    }));
    expect(export11Resolution.summary.staleParkingApprovalsRejected).toBe(1);
    const cinqueResolution = export11Resolution.results.find(result => result.candidateId === 'osm-relation-6678431');
    expect(cinqueResolution.requiredParking).toEqual(expect.objectContaining({
      osmId: 'way/900787870', state: 'awaiting-human-approval',
    }));
    expect(export11Resolution.summary.fullyOrmaVerified).toBe(0);
  });

  test('approved route geometries queue enrichment without permitting publication', () => {
    expect(export11Enrichment.status).toBe('queued');
    expect(export11Enrichment.publicMutationAllowed).toBe(false);
    expect(export11Enrichment.candidates).toHaveLength(3);
    expect(export11Enrichment.requiredOutputs).toContain('surface-and-exposure-assessment');
    expect(export11Enrichment.nextHumanGate).toBe('safety-input-review');
  });

  test('export 12 closes corrected Cinque Torri parking without revoking prior approvals', () => {
    expect(export12ParkingReceipt.sourceDecisionExport).toBe('orma-review-decisions-2026-08-18 (12).json');
    expect(export12ParkingReceipt.approval).toEqual(expect.objectContaining({
      candidateId: 'osm-relation-6678431',
      osmId: 'way/900787870',
      position: [12.037603729268294, 46.51891714390244],
      exactReviewedCandidateMatch: true,
    }));
    expect(export12Resolution.summary.fullyOrmaVerified).toBe(0);
    const braies = export12Resolution.results.find(result => result.candidateId === 'osm-way-25736154');
    expect(braies).toEqual(expect.objectContaining({
      state: 'parking-set-and-geometry-approved-enrichment-queued',
      carriedForwardFrom: 'orma-review-decisions-2026-08-18 (9).json',
    }));
  });

  test('current enrichment dossiers are contract-valid and preserve the final human gate', () => {
    [treCimeDossier, cinqueTorriDossier, lagoBraiesDossier].forEach(dossier => {
      expect(validateDossier(dossier)).toEqual([]);
      expect(dossier.promotionGate.canApproveParking).toBe(true);
      expect(dossier.promotionGate.canApproveRoute).toBe(true);
      expect(dossier.promotionGate.canPublish).toBe(false);
    });
    expect(treCimeDossier.reviewState).toBe('accepted');
    expect(cinqueTorriDossier.reviewState).toBe('accepted');
    expect(lagoBraiesDossier.reviewState).toBe('accepted');
    expect(treCimeDossier.claims.every(claim => claim.state === 'supported')).toBe(true);
    expect(cinqueTorriDossier.claims.every(claim => claim.state === 'supported')).toBe(true);
    expect(lagoBraiesDossier.claims.every(claim => claim.state === 'supported')).toBe(true);
    expect(cinqueTorriDossier.claims.find(claim => claim.id === 'walking-elevation').state).toBe('supported');
    expect(lagoBraiesDossier.claims.find(claim => claim.id === 'surface-exposure').state).toBe('supported');
  });

  test('enrichment review records exact claims and never permits public mutation', () => {
    const requested = enrichmentReviewDecisions.applyDecision({}, {
      candidateId: 'osm-way-25736154',
      action: 'request-enrichment-resolution',
      supportedClaimIds: ['route-geometry', 'route-identity'],
      unresolvedClaimIds: ['shade', 'water', 'shade'],
      reviewedAt: '2026-08-18T14:00:00.000Z',
    });
    expect(requested['osm-way-25736154']).toEqual(expect.objectContaining({
      gate: 'safety-input-review',
      supportedClaimIds: ['route-geometry', 'route-identity'],
      unresolvedClaimIds: ['shade', 'water'],
      publicMutationAllowed: false,
    }));
    const exported = enrichmentReviewDecisions.exportRecord(requested, '2026-08-18T14:01:00.000Z');
    expect(exported.gate).toBe('safety-input-review');
    expect(exported.publicMutationAllowed).toBe(false);
    expect(() => enrichmentReviewDecisions.applyDecision({}, {
      candidateId: 'x', action: 'confirm-supported-claims', supportedClaimIds: [],
    })).toThrow('reviewed supported claim');
  });

  test('enrichment attempt 1 routes every blocker to a distinct second-pass strategy', () => {
    expect(enrichmentAttempt1.resolutionAttempt).toBe(1);
    expect(enrichmentAttempt1.maximumAutomatedAttempts).toBe(5);
    expect(enrichmentAttempt1.summary).toEqual(expect.objectContaining({
      supportedClaims: 25, unresolvedOrConflictedClaims: 12, fullyOrmaVerified: 0,
    }));
    expect(enrichmentAttempt1.results.every(result => (
      result.unresolvedClaimIds.length > 0
      && result.nextAttempt.attempt === 2
      && result.nextAttempt.strategy.length > 20
    ))).toBe(true);
    expect(mediaGapChecklist.trails).toHaveLength(3);
    expect(mediaGapChecklist.trails.every(trail => trail.requiredShots.length >= 6)).toBe(true);
    expect(mediaGapChecklist.humanGate).toBe('asset-and-licensing-approval');
  });

  test('assisted route segmentation excludes the Cinque Torri lift from walking effort', () => {
    const xml = require('fs').readFileSync('backoffice-data/cinque-torri-three-refuges-official.gpx', 'utf8');
    const segmented = splitAssistedRoute(xml, 22);
    expect(segmented.transport).toEqual(expect.objectContaining({
      distanceKm: 1.37, rawAscentM: 295, startIndex: 0, endIndex: 22,
    }));
    expect(segmented.walking).toEqual(expect.objectContaining({
      distanceKm: 3.95, rawAscentM: 10, rawDescentM: 347, startIndex: 22,
    }));
    expect(segmented.publicMutationAllowed).toBe(false);
  });

  test('export 13 confirms exact claim sets and attempt 2 creates only human-gated resolutions', () => {
    expect(enrichmentReviewReceipt13.summary).toEqual(expect.objectContaining({
      dossiersReviewed: 3, supportedClaimsConfirmed: 25,
      unresolvedClaimsCarriedForward: 12, exactClaimSetMatch: true,
    }));
    expect(enrichmentAttempt2.resolutionAttempt).toBe(2);
    expect(enrichmentAttempt2.summary).toEqual(expect.objectContaining({
      supportedClaims: 27, newlySupportedClaims: 2,
      unresolvedOrConflictedClaims: 10, fullyOrmaVerified: 0,
    }));
    expect(enrichmentAttempt2.newlySupported.every(item => item.humanGate === 'safety-input-review')).toBe(true);
    expect(enrichmentAttempt2.publicMutationAllowed).toBe(false);
    expect(mediaCandidatesAttempt2.selectionState).toBe('candidates-only-human-licensing-gate-required');
    expect(mediaCandidatesAttempt2.candidates).toHaveLength(3);
  });

  test('export 14 confirms attempt 2 and attempt 3 narrows claims without manufacturing precision', () => {
    expect(enrichmentReviewReceipt14.summary).toEqual(expect.objectContaining({
      dossiersReviewed: 3, supportedClaimsConfirmed: 27,
      unresolvedClaimsCarriedForward: 10, exactClaimSetMatch: true,
      newAttempt2ClaimsConfirmed: 2,
    }));
    expect(enrichmentAttempt3.resolutionAttempt).toBe(3);
    expect(enrichmentAttempt3.summary).toEqual(expect.objectContaining({
      supportedClaims: 33, newlySupportedClaims: 6,
      unresolvedOrConflictedClaims: 4, fullyOrmaVerified: 0,
    }));
    expect(enrichmentAttempt3.newlySupported.every(item => item.humanGate === 'safety-input-review')).toBe(true);
    expect(enrichmentAttempt3.guardrails.join(' ')).toMatch(/not converted into canopy percentages/i);
    expect(enrichmentAttempt3.publicMutationAllowed).toBe(false);
    expect(treCimeDossier.claims.find(claim => claim.id === 'heat-shade').proposedValue).toMatch(/No shade percentage/i);
    expect(cinqueTorriDossier.claims.find(claim => claim.id === 'shade').state).toBe('supported');
    expect(lagoBraiesDossier.claims.find(claim => claim.id === 'water').proposedValue).toMatch(/Carry all water/i);
    expect(enrichmentAttempt3.unresolvedByCandidate
      .reduce((count, candidate) => count + candidate.claimIds.length, 0)).toBe(4);
  });

  test('export 15 confirms attempt 3 and attempt 4 creates auditable hero proposals without publishing', () => {
    expect(enrichmentReviewReceipt15.summary).toEqual(expect.objectContaining({
      supportedClaimsConfirmed: 33, unresolvedClaimsCarriedForward: 4,
      exactClaimSetMatch: true, newAttempt3ClaimsConfirmed: 6,
    }));
    expect(enrichmentAttempt4.resolutionAttempt).toBe(4);
    expect(enrichmentAttempt4.summary).toEqual(expect.objectContaining({
      supportedClaims: 36, newlySupportedClaims: 3,
      unresolvedOrConflictedClaims: 1, fullyOrmaVerified: 0,
    }));
    expect(mediaLicensingAttempt4.assets).toHaveLength(3);
    expect(mediaLicensingAttempt4.assets.every(asset => (
      asset.licence === 'CC BY-SA 4.0'
      && asset.requiredCredit
      && asset.licenceUrl
      && asset.humanGate === 'asset-and-licensing-approval'
    ))).toBe(true);
    expect(mediaLicensingAttempt4.downloadOrPublicationPerformed).toBe(false);
    expect(braiesLivestockContactAttempt4.status).toBe('prepared-not-sent');
    expect(braiesLivestockContactAttempt4.messageDraft).toMatch(/no reply as unresolved/i);
    expect(enrichmentAttempt4.publicMutationAllowed).toBe(false);
  });

  test('export 16 confirms all proposed assets and attempt 5 never fabricates the Braies livestock result', () => {
    expect(enrichmentReviewReceipt16.summary).toEqual(expect.objectContaining({
      supportedClaimsConfirmed: 36, unresolvedClaimsCarriedForward: 1,
      exactClaimSetMatch: true, newAttempt4ClaimsConfirmed: 3,
    }));
    expect(enrichmentAttempt5.resolutionAttempt).toBe(5);
    expect(enrichmentAttempt5.summary).toEqual(expect.objectContaining({
      readyForFinalHumanVerification: 2, fullyOrmaVerified: 0, sourceExhausted: 1,
    }));
    expect(enrichmentAttempt5.attemptBudgetRule).toMatch(/No sixth automated search/i);
    const braiesRedTeam = redTeamAttempt5.reviews.find(review => review.candidateId === 'osm-way-25736154');
    expect(braiesRedTeam.recommendation).toBe('remain-blocked-source-exhausted');
    expect(braiesRedTeam.seriousObjections).toEqual([
      expect.objectContaining({ claimId: 'livestock', severity: 'serious' }),
    ]);
    expect(enrichmentAttempt5.publicMutationAllowed).toBe(false);
  });

  test('the editor livestock attestation resolves the Braies evidence after attempt 5 without authorizing publication', () => {
    expect(braiesLivestockHumanAttestation).toEqual(expect.objectContaining({
      candidateId: 'osm-way-25736154',
      claimId: 'livestock',
      evidenceType: 'human-editor-local-knowledge-attestation',
      publicMutationAllowed: false,
    }));
    expect(braiesVerificationApproval).toEqual(expect.objectContaining({
      candidateId: 'osm-way-25736154',
      action: 'approve-orma-verified',
      gate: 'human-local-knowledge-objection-resolution',
      publicationAuthorized: false,
      publicMutationAllowed: false,
    }));
    expect(lagoBraiesDossier.claims.find(claim => claim.id === 'livestock')).toEqual(
      expect.objectContaining({ state: 'supported', confidence: 0.95 }),
    );
  });

  test('export 18 preserves the later Braies attestation instead of reviving stale browser-local state', () => {
    expect(decisionReconciliation18).toEqual(expect.objectContaining({
      sourceDecisionExport: 'orma-review-decisions-2026-08-18 (18).json',
      status: 'reconciled-no-new-decisions',
      publicMutationAllowed: false,
    }));
    expect(decisionReconciliation18.summary).toEqual(expect.objectContaining({
      newDecisionsApplied: 0,
      supersededEnrichmentSelectionsIgnored: 1,
      internalOrmaVerifiedTotal: 3,
      publicationAuthorized: false,
    }));
    expect(decisionReconciliation18.reconciliations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateId: 'osm-way-25736154',
        field: 'enrichmentReview.livestock',
        effectiveState: 'supported',
      }),
      expect.objectContaining({
        candidateId: 'osm-way-25736154',
        field: 'verificationReview',
        effectiveState: 'orma-verified-internal-not-published',
      }),
    ]));
  });

  test('export 19 applies the later explicit Braies verification hold without discarding its livestock evidence', () => {
    expect(verificationReceipt19.decision).toEqual(expect.objectContaining({
      candidateId: 'osm-way-25736154',
      action: 'keep-verification-blocked',
      reviewedAt: '2026-08-18T15:19:57.182Z',
    }));
    expect(verificationReceipt19.evidenceTreatment.livestockAttestationState).toBe('retained-as-supported');
    expect(verificationReceipt19.result).toEqual(expect.objectContaining({
      trailVerification: 'human-review-blocked',
      publicationAuthorized: false,
      publicMutationAllowed: false,
    }));
    expect(lagoBraiesDossier.claims.find(claim => claim.id === 'livestock').state).toBe('supported');
  });

  test('the explicit instruction accompanying export 20 unblocks and verifies Braies without publishing it', () => {
    expect(verificationReceipt20).toEqual(expect.objectContaining({
      sourceDecisionExport: 'orma-review-decisions-2026-08-18 (20).json',
      candidateId: 'osm-way-25736154',
      action: 'approve-orma-verified',
      decisionSource: 'explicit-human-instruction-accompanying-export',
      publicationAuthorized: false,
      publicMutationAllowed: false,
    }));
    expect(lagoBraiesDossier.reviewState).toBe('accepted');
    expect(lagoBraiesDossier.ormaVerification.status).toBe('verified');
    expect(lagoBraiesDossier.verificationReview.recommendation).toBe('clear-for-orma-verified');
  });

  test('final verification requires every Red Team acknowledgement and remains local-only', () => {
    expect(() => verificationReviewDecisions.applyDecision({}, {
      candidateId: 'osm-relation-1484751', action: 'approve-orma-verified',
      reviewReady: true, acknowledgementIds: ['one'], requiredAcknowledgementIds: ['one', 'two'],
    })).toThrow('Every Red Team acknowledgement');
    const decisions = verificationReviewDecisions.applyDecision({}, {
      candidateId: 'osm-relation-1484751', action: 'approve-orma-verified', reviewReady: true,
      acknowledgementIds: ['tre-hard-rating', 'tre-water-caveat', 'tre-live-checks'],
      requiredAcknowledgementIds: ['tre-hard-rating', 'tre-water-caveat', 'tre-live-checks'],
      reviewedAt: '2026-08-18T15:00:00.000Z',
    });
    expect(decisions['osm-relation-1484751']).toEqual(expect.objectContaining({
      gate: 'serious-objection-review', action: 'approve-orma-verified', publicMutationAllowed: false,
    }));
    expect(verificationReviewDecisions.exportRecord(decisions).publicMutationAllowed).toBe(false);
  });

  test('the latest registry applies the export 20 override and keeps three trails internally ORMA Verified', () => {
    expect(verificationReceipt17.summary).toEqual({
      ormaVerifiedApproved: 2, verificationBlocked: 1,
      exactAcknowledgementMatch: true, publicationAuthorized: false,
    });
    expect(verificationReceipt17.approvals.every(approval => (
      approval.exactAcknowledgementMatch && approval.publicationAuthorized === false
    ))).toBe(true);
    expect(verifiedRegistry.verified).toHaveLength(3);
    expect(verifiedRegistry.blocked.map(item => item.candidateId)).toEqual([
      'osm-relation-1372055',
    ]);
    expect(verifiedRegistry.publicMutationAllowed).toBe(false);
    expect(verifiedRegistry.publicationAuthorized).toBe(false);
  });

  test('verified trails hand off to Copywriter and Visual Director with facts and publication locked', () => {
    const queue = planVerifiedTrailEditorial(
      verifiedRegistry,
      [treCimeDossier, cinqueTorriDossier, lagoBraiesDossier],
      mediaLicensingAttempt4,
      { at: '2026-08-18T15:30:00.000Z' },
    );
    expect(queue).toEqual(expect.objectContaining({
      mode: 'draft-only', stage: 'verified-trail-editorial-readiness',
      publicMutationAllowed: false, publicationAuthorized: false,
    }));
    expect(queue.summary).toEqual({
      verifiedTrails: 3, copywriterJobs: 3, visualDirectorJobs: 3,
      humanGatesPending: 6, publicationGatesLocked: 3,
    });
    expect(queue.jobs).toHaveLength(6);
    expect(new Set(queue.jobs.map(job => job.agentId))).toEqual(new Set(['copywriter', 'visualDirector']));
    expect(queue.items.every(item => (
      item.lockedFacts.length > 0
      && item.lockedFacts.every(fact => fact.value && fact.sourceIds.length)
      && item.humanGates.find(gate => gate.id === 'publication-approval').status === 'locked'
    ))).toBe(true);
    expect(verifiedTrailEditorialQueue.summary.verifiedTrails).toBe(3);
    expect(verifiedTrailEditorialQueue.publicationAuthorized).toBe(false);
  });

  test('the Codex-assisted verified-trail preview produces six reviewable outputs without publishing', () => {
    const execution = compileVerifiedEditorialPreview(verifiedTrailEditorialQueue, { at: '2026-08-18T15:40:00.000Z' });
    expect(validateContentExecution(execution)).toEqual([]);
    expect(execution).toEqual(expect.objectContaining({
      mode: 'draft-only', stage: 'verified-trail-editorial-review',
      executionOrigin: 'codex-assisted-locked-fact-preview',
      publicMutationAllowed: false, publicationAuthorized: false,
    }));
    expect(execution.summary).toEqual({ trails: 3, readyForReview: 6, blocked: 0, publicationReady: 0 });
    expect(execution.outputs.filter(output => output.agentId === 'copywriter')).toHaveLength(3);
    expect(execution.outputs.filter(output => output.agentId === 'visualDirector')).toHaveLength(3);
    expect(execution.outputs.filter(output => output.agentId === 'copywriter').every(output => output.result.changes.length === 3)).toBe(true);
    expect(execution.outputs.filter(output => output.agentId === 'visualDirector').every(output => output.result.candidates[0].status === 'ready')).toBe(true);
    expect(verifiedTrailEditorialExecution.summary.readyForReview).toBe(6);
    expect(verifiedTrailEditorialExecution.publicationAuthorized).toBe(false);
  });

  test('Publication Mapper waits for both approvals then creates staging previews without public mutation', () => {
    const decisions = verifiedTrailEditorialExecution.outputs.map(output => ({
      jobId: output.jobId, agentId: output.agentId, action: 'approve', reviewedAt: '2026-08-18T18:30:00.000Z',
    }));
    const staging = buildPublicationStaging(
      verifiedTrailEditorialQueue,
      verifiedTrailEditorialExecution,
      { submissions: [{ submissionId: 'review-all', decisions }] },
      { at: '2026-08-18T18:31:00.000Z' },
    );
    expect(staging).toEqual(expect.objectContaining({
      mode: 'staging-only', stage: 'website-publication-preview',
      publicMutationAllowed: false, publicationAuthorized: false,
    }));
    expect(staging.summary).toEqual({ trails: 3, readyForPreview: 3, waitingForApprovals: 0, waitingForMapping:0, publicMutations: 0 });
    expect(staging.items[0].proposedWebsiteFields.imageCredit).toEqual(expect.objectContaining({
      text:expect.any(String),url:expect.stringMatching(/^https:\/\//),
    }));
    expect(staging.items[0].proposedWebsiteFields.imageCreditText).toEqual(expect.any(String));
    expect(staging.items.every(item => (
      item.state === 'ready-for-publication-preview'
      && item.proposedWebsiteFields.name
      && item.proposedWebsiteFields.desc
      && item.proposedWebsiteFields.tips
      && item.proposedWebsiteFields.routeRef
      && item.proposedWebsiteFields.imageCredit
      && item.humanGate === 'website-preview-and-publication-approval'
      && item.publicationAuthorized === false
    ))).toBe(true);
  });

  test('content flow creates only editing and picture-gathering jobs', () => {
    const flow = planContentFlow([
      { id: 'trail-one', name: 'Trail One', area: 'Dolomites', desc: 'Draft.', tips: 'Bring water.', distance: 5 },
    ], { at: '2026-08-18T18:00:00.000Z' });
    expect(validateContentFlow(flow)).toEqual([]);
    expect(flow.mode).toBe('draft-only');
    expect(flow.publicMutationAllowed).toBe(false);
    expect(flow.jobs.map(job => [job.agentId, job.action])).toEqual([
      ['copywriter', 'edit-copy'], ['visualDirector', 'gather-pictures'],
    ]);
    expect(flow.jobs.every(job => job.humanGate)).toBe(true);
    expect(EDITABLE_FIELDS).toEqual(['name', 'desc', 'tips']);
    expect(PROTECTED_FIELDS).toEqual(expect.arrayContaining(['path', 'distance', 'safetyLevel', 'waterSources']));
    expect(flow.items[0].distance).toBeUndefined();
  });

  test('content flow rejects unknown explicitly requested trails', () => {
    expect(() => planContentFlow([{ id: 'known' }], { trailIds: ['missing'] }))
      .toThrow('Unknown trail id(s): missing');
  });

  test('content operations parks Newsletter and Social until their explicit gates open', () => {
    const plan = planContentOperations({
      asOf: '2026-08-18', at: '2026-08-18T18:00:00.000Z',
    });
    expect(validateContentOperations(plan)).toEqual([]);
    expect(plan.publicMutationAllowed).toBe(false);
    expect(plan.summary).toEqual({ activeWorkstreams: 0, parkedWorkstreams: 5, jobs: 0 });
    expect(plan.workstreams.find(stream => stream.id === 'newsletter')).toEqual(expect.objectContaining({
      cadence: 'every-14-days-after-launch', nextRunOn: null, status: 'parked',
    }));
    expect(plan.workstreams.find(stream => stream.id === 'library-enrichment')).toEqual(expect.objectContaining({status:'parked',nextRunOn:null}));
    expect(plan.workstreams.find(stream => stream.id === 'collections')).toEqual(expect.objectContaining({
      cadence: 'on-demand', status: 'parked', nextRunOn: null,
    }));
    expect(plan.workstreams.find(stream => stream.id === 'social')).toEqual(expect.objectContaining({
      status: 'parked', nextRunOn: null,
    }));
    expect(plan.editorialPolicy.editorialCopyMvpPaused).toBe(true);
  });

  test('social jobs are created only when the channel is enabled', () => {
    const plan = planContentOperations({ asOf: '2026-08-18', socialEnabled: true });
    expect(plan.summary).toEqual({ activeWorkstreams: 1, parkedWorkstreams: 4, jobs: 2 });
    expect(plan.jobs.filter(job => job.action.includes('social'))).toHaveLength(2);
  });

  test('Newsletter jobs return only after content readiness is explicitly enabled', () => {
    const plan = planContentOperations({ asOf: '2026-08-18', newsletterEnabled: true });
    expect(plan.summary).toEqual({ activeWorkstreams: 1, parkedWorkstreams: 4, jobs: 2 });
    expect(plan.workstreams.find(stream => stream.id === 'newsletter')).toEqual(expect.objectContaining({
      status: 'active', nextRunOn: '2026-09-01',
    }));
    expect(plan.jobs.filter(job => job.action.includes('newsletter'))).toHaveLength(2);
  });

  test('guide content runner produces a copy-only review artifact', async () => {
    const calls = [];
    const execution = await runGuideContent(require('path').resolve(__dirname, '..'), {
      guideId: 'paw-protection', at: '2026-08-18T19:00:00.000Z',
      runAgent: async input => {
        calls.push(input.schemaName);
        return { responseId: 'resp-edit', model: 'fixture', data: {
          title: 'Paw protection', summary: 'Small clarity edit.', changes: [], sources: [], openQuestions: [],
        } };
      },
    });
    expect(validateContentExecution(execution)).toEqual([]);
    expect(execution.summary).toEqual({ readyForReview: 1, blocked: 0 });
    expect(calls).toEqual(['orma_guide_edit']);
    expect(execution.publicMutationAllowed).toBe(false);
    expect(execution.subject.original).toContain('<html');
    expect(execution.subject.original.length).toBeGreaterThan(100);
  });

  test('governance page runner keeps Privacy and Terms inside the copy-only human gate', async () => {
    const calls=[];
    const execution=await runPageContent(require('path').resolve(__dirname,'..'),{
      pageId:'privacy',sourceRef:'privacy.html',at:'2026-08-20T12:00:00.000Z',
      runAgent:async input=>{
        calls.push(input);
        return {responseId:'resp-privacy',model:'fixture',data:{title:'Privacy',summary:'Clarity review.',changes:[],sources:[],openQuestions:[]}};
      },
    });
    expect(validateContentExecution(execution)).toEqual([]);
    expect(execution).toEqual(expect.objectContaining({mode:'draft-only',publicMutationAllowed:false}));
    expect(execution.subject).toEqual(expect.objectContaining({type:'page',id:'privacy',sourceRef:'privacy.html'}));
    expect(calls[0].schemaName).toBe('orma_governance_page_edit');
    expect(calls[0].messages[0].content).toContain('instead of inventing a commitment');
    expect(calls[0].messages[0].content).toContain('Do not propose layouts, design changes, images or image placement');
  });

  test('editorial cycle fills three slots once and preserves unresolved packets', async () => {
    const fs=require('fs');const os=require('os');const path=require('path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'orma-editorial-cycle-'));
    fs.mkdirSync(path.join(root,'guides'));fs.mkdirSync(path.join(root,'backoffice-data'));
    ['a','b','c','d'].forEach(id=>fs.writeFileSync(path.join(root,'guides',`${id}.html`),`<html><main><h1>${id}</h1></main></html>`));
    fs.writeFileSync(path.join(root,'backoffice-data','editorial-ledger.json'),JSON.stringify({contractVersion:'1.0.0',items:[]}));
    let calls=0;const runGuide=async (runRoot,{guideId,at})=>{calls++;const sourceRef=`guides/${guideId}.html`;return {contractVersion:'1.0.0',generatedAt:at,mode:'draft-only',publicMutationAllowed:false,subject:{type:'guide',id:guideId,sourceRef,updatedAt:at,original:fs.readFileSync(path.join(runRoot,sourceRef),'utf8')},outputs:[{jobId:`guide-${guideId}-edit`,agentId:'copywriter',status:'ready-for-review',responseId:null,model:'fixture',result:{title:guideId,summary:'Review',changes:[],sources:[],openQuestions:[]},error:null}],summary:{readyForReview:1,blocked:0}};};
    try{
      const first=await runEditorialCycle(root,{at:'2026-08-19T10:00:00.000Z',runGuide});
      const second=await runEditorialCycle(root,{at:'2026-08-26T10:00:00.000Z',runGuide});
      expect(first.generated).toHaveLength(3);expect(second.preserved).toHaveLength(3);expect(second.generated).toHaveLength(0);expect(calls).toBe(3);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });

  test('editorial cycle prioritises Privacy and Terms before ordinary freshness work', async () => {
    const fs=require('fs');const os=require('os');const path=require('path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'orma-governance-cycle-'));
    fs.mkdirSync(path.join(root,'guides'));fs.mkdirSync(path.join(root,'backoffice-data'));
    fs.writeFileSync(path.join(root,'guides','ordinary.html'),'<html><main><h1>Ordinary guide</h1></main></html>');
    fs.writeFileSync(path.join(root,'privacy.html'),'<html><main><h1>Privacy</h1></main></html>');
    fs.writeFileSync(path.join(root,'terms.html'),'<html><main><h1>Terms</h1></main></html>');
    fs.writeFileSync(path.join(root,'backoffice-data','editorial-ledger.json'),JSON.stringify({contractVersion:'1.0.0',items:[]}));
    const seen=[];
    const runPage=async(runRoot,{pageId,sourceRef,at})=>{seen.push(pageId);return {contractVersion:'1.0.0',generatedAt:at,mode:'draft-only',publicMutationAllowed:false,subject:{type:'page',id:pageId,sourceRef,updatedAt:at,original:fs.readFileSync(path.join(runRoot,sourceRef),'utf8')},outputs:[{jobId:`page-${pageId}-edit`,agentId:'copywriter',status:'ready-for-review',responseId:null,model:'fixture',result:{title:pageId,summary:'Review',changes:[],sources:[],openQuestions:[]},error:null}],summary:{readyForReview:1,blocked:0}};};
    try{
      const result=await runEditorialCycle(root,{at:'2026-08-20T12:00:00.000Z',limit:2,runPage,runGuide:async()=>{throw new Error('ordinary guide should not be selected');}});
      expect(result.generated.map(item=>item.contentId)).toEqual(['page-privacy','page-terms']);
      expect(seen).toEqual(['privacy','terms']);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });

  test('editorial cycle archives Safety Library packets and does not generate new safety reviews', async () => {
    const fs=require('fs');const os=require('os');const path=require('path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'orma-safety-pause-'));
    fs.mkdirSync(path.join(root,'guides'));fs.mkdirSync(path.join(root,'backoffice-data'));
    fs.writeFileSync(path.join(root,'guides','paw-protection.html'),'<html><main><h1>Paws</h1></main></html>');
    fs.writeFileSync(path.join(root,'guides','dog-friendly-hikes-val-gardena.html'),'<html><main><h1>Val Gardena</h1></main></html>');
    fs.writeFileSync(path.join(root,'backoffice-data','editorial-ledger.json'),JSON.stringify({contractVersion:'1.0.0',items:[]}));
    fs.writeFileSync(path.join(root,'backoffice-data','editorial-review-packet-1.json'),JSON.stringify({generatedAt:'2026-08-19T10:00:00Z',subject:{type:'guide',id:'paw-protection',sourceRef:'guides/paw-protection.html'},outputs:[{status:'ready-for-review'}]}));
    const seen=[];const runGuide=async(runRoot,{guideId,at})=>{seen.push(guideId);const sourceRef=`guides/${guideId}.html`;return {contractVersion:'1.0.0',generatedAt:at,mode:'draft-only',publicMutationAllowed:false,subject:{type:'guide',id:guideId,sourceRef,updatedAt:at,original:fs.readFileSync(path.join(runRoot,sourceRef),'utf8')},outputs:[{jobId:`guide-${guideId}-edit`,agentId:'copywriter',status:'ready-for-review',result:{changes:[],sources:[]}}],summary:{readyForReview:1,blocked:0}};};
    try{
      const result=await runEditorialCycle(root,{at:'2026-08-25T10:00:00Z',limit:1,runGuide});
      expect(result.paused).toEqual(['guide-paw-protection']);expect(seen).toEqual(['dog-friendly-hikes-val-gardena']);
      const archive=JSON.parse(fs.readFileSync(path.join(root,'backoffice-data','editorial-paused-packets.json'),'utf8'));
      expect(archive.packets[0]).toEqual(expect.objectContaining({reason:'Safety Library UI review in progress',packet:expect.objectContaining({subject:expect.objectContaining({id:'paw-protection'})})}));
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });

  test('newsletter agent creates one reviewable issue and respects the fourteen-day gate', async () => {
    const packet=await runNewsletter({newlyPublishedTrails:[],publishedEditorialChanges:[],timelySafetySignals:[{title:'Heat'}],currentEditorialSignals:[]},{at:'2026-08-19T10:00:00.000Z',runAgent:async()=>({model:'fixture',responseId:'newsletter-1',data:{issueTitle:'Cooler trails this week',subjectOptions:['Cooler walks','Plan for heat'],preheader:'A practical ORMA update',introduction:'Hello hikers.',sections:[{heading:'Heat planning',body:'Check current official warnings before leaving.',linkUrl:null,sourceRefs:['MeteoAlarm']}],closing:'Walk well.',sources:[]}})});
    expect(validateContentExecution(packet)).toEqual([]);expect(packet.summary).toEqual({readyForReview:1,blocked:0});
    expect(newsletterIsDue(packet,{decisions:[]},'2026-08-20T10:00:00.000Z')).toBe(false);
    const review={decisions:[{generatedAt:packet.generatedAt,action:'approve',reviewedAt:'2026-08-19T11:00:00.000Z'}]};
    expect(newsletterIsDue(packet,review,'2026-09-01T10:59:59.000Z')).toBe(false);
    expect(newsletterIsDue(packet,review,'2026-09-02T11:00:00.000Z')).toBe(true);
  });

  test('content runner utilities extract response text and visible guide copy', () => {
    expect(outputText({ output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }] })).toBe('{"ok":true}');
    expect(visibleText('<style>x{}</style><h1>Paws &amp; rock</h1><script>bad()</script>')).toBe('Paws & rock');
  });

  test('OpenAI transport rate limits wait and retry without consuming a workflow resolution attempt', async () => {
    const waits=[];let calls=0;
    const response=await createStructuredResponse({messages:[],webSearch:true,schemaName:'test_schema',schema:{type:'object'}},{
      apiKey:'test-key',model:'gpt-5.6-luna',maxRateLimitRetries:1,sleep:async milliseconds=>waits.push(milliseconds),
      fetchImpl:async()=>{
        calls+=1;
        if(calls===1)return {ok:false,status:429,headers:{get:()=>null},json:async()=>({error:{message:'Rate limit reached. Please try again in 6.167s.'}})};
        return {ok:true,status:200,headers:{get:()=>null},json:async()=>({id:'resp-ok',model:'gpt-5.6-luna',output:[{content:[{type:'output_text',text:'{"ok":true}'}]}]})};
      },
    });
    expect(response.data).toEqual({ok:true});
    expect(calls).toBe(2);
    expect(waits).toEqual([6417]);
  });

  test('OpenAI quota errors are not retried as transient rate limits', async () => {
    let calls=0;
    await expect(createStructuredResponse({messages:[],webSearch:false,schemaName:'test_schema',schema:{type:'object'}},{
      apiKey:'test-key',maxRateLimitRetries:2,sleep:async()=>{},fetchImpl:async()=>{
        calls+=1;return {ok:false,status:429,headers:{get:()=>null},json:async()=>({error:{message:'You exceeded your current quota.'}})};
      },
    })).rejects.toThrow('current quota');
    expect(calls).toBe(1);
  });

  test('requested editorial revisions immediately produce a replacement review packet', async () => {
    const fs = require('fs'); const os = require('os'); const path = require('path');
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-revision-'));
    fs.mkdirSync(path.join(temporaryRoot, 'guides'));
    fs.writeFileSync(path.join(temporaryRoot, 'guides', 'paws.html'), '<main><li>Current copy</li></main>');
    const execution = {
      contractVersion:'1.0.0',generatedAt:'2026-08-18T19:00:00.000Z',mode:'draft-only',publicMutationAllowed:false,
      workstream:'website-editorial',subject:{type:'guide',id:'paws',sourceRef:'guides/paws.html',updatedAt:'2026-08-18T19:00:00.000Z'},
      outputs:[
        {jobId:'copy-old',agentId:'copywriter',status:'ready-for-review',responseId:null,model:'fixture',error:null,result:{title:'Old',summary:'Old',changes:[{section:'Paws',before:'<li>Published copy</li>',after:'<li>Current copy</li>',reason:'First pass'}],sources:[],openQuestions:[]}},
        {jobId:'visual-old',agentId:'visualDirector',status:'ready-for-review',responseId:null,model:'fixture',error:null,result:{searchSummary:'Keep it',candidates:[],coverageGaps:[]}},
      ],summary:{readyForReview:2,blocked:0},
    };
    try{
      const revised = await runEditorialRevision(temporaryRoot, execution, 'Make it warmer.', {
        at:'2026-08-18T19:01:00.000Z',runAgent:async prompt => {
          expect(prompt).toContain('Make it warmer.');
          return {responseId:'revision-response',model:'fixture',data:{title:'Revised',summary:'Warmer',changes:[{section:'Paws',before:'<li>Current copy</li>',after:'<li>Check paws gently.</li>',reason:'Warmer wording'}],sources:[],openQuestions:[]}};
        },
      });
      expect(revised.generatedAt).toBe('2026-08-18T19:01:00.000Z');
      expect(revised.outputs[0].result.changes[0].beforeAlternatives).toEqual(['<li>Published copy</li>']);
      expect(revised.outputs[1].result.searchSummary).toBe('Keep it');
      expect(new Set(revised.outputs.map(output => output.jobId)).size).toBe(2);
    }finally{
      fs.rmSync(temporaryRoot, {recursive:true,force:true});
    }
  });

  test('editorial revision output must target one exact current page block', () => {
    expect(() => validateRevisionResult({changes:[{section:'Paws',before:'<li>Same</li>',after:'<li>New</li>'}]}, '<li>Same</li><li>Same</li>'))
      .toThrow('not unique');
  });

  test('content decisions remain human-gated and exportable', () => {
    const decisions = contentReviewDecisions.applyDecision({}, {
      jobId: 'guide-paw-edit', agentId: 'copywriter', action: 'request-revision', note: 'Shorten the opening.',
      reviewedAt: '2026-08-18T20:00:00.000Z',
    });
    expect(decisions['guide-paw-edit']).toEqual(expect.objectContaining({ gate: 'editorial-approval', publicMutationAllowed: false }));
    expect(contentReviewDecisions.exportRecord(decisions).decisions).toHaveLength(1);
  });

  test('approved editorial changes apply only to one exact source passage', () => {
    expect(applyExactChanges('Before text. Keep this.', [{ section: 'intro', before: 'Before text.', after: 'After text.' }]))
      .toBe('After text. Keep this.');
    expect(() => applyExactChanges('Repeat. Repeat.', [{ before: 'Repeat.', after: 'Changed.' }])).toThrow('ambiguous');
    expect(() => applyExactChanges('Different.', [{ before: 'Missing.', after: 'Changed.' }])).toThrow('not found');
  });

  test('review application can safely resume after an approved change was already applied', () => {
    const change={section:'intro',before:'Before text.',after:'After text.'};
    expect(applyReviewChanges('Before text. Keep this.',[change])).toBe('After text. Keep this.');
    expect(applyReviewChanges('After text. Keep this.',[change])).toBe('After text. Keep this.');
    expect(applyReviewChanges('Proposed text. Keep this.',[{...change,after:'Human edited text.',beforeAlternatives:['Proposed text.']}]))
      .toBe('Human edited text. Keep this.');
    expect(()=>applyReviewChanges('Different text.',[change])).toThrow('not found');
  });

  test('editorial source paths cannot escape the project', () => {
    expect(safeSourcePath('/tmp/orma', 'guides/paws.html')).toBe('/tmp/orma/guides/paws.html');
    expect(() => safeSourcePath('/tmp/orma', '../outside.html')).toThrow('outside the project');
  });

  test('publication stages only paths recorded by applied review outcomes', () => {
    expect(publishablePaths('/tmp/orma', { outcomes: [
      { status: 'applied-locally', sourceRefs: ['guides/paws.html', 'images/paw.png'] },
      { status: 'revision-queued', sourceRefs: ['guides/ignored.html'] },
      { status: 'applied-locally', sourceRefs: ['guides/paws.html'] },
    ] })).toEqual(['guides/paws.html', 'images/paw.png']);
    expect(() => publishablePaths('/tmp/orma', { outcomes: [{ status: 'applied-locally', sourceRefs: ['../outside'] }] })).toThrow('outside the project');
  });

  test('publication merges multiple approved patches for the same source file', () => {
    const grouped=groupedPatches({outcomes:[
      {status:'applied-locally',patches:[{sourceRef:'guides/paws.html',changes:[{before:'one',after:'1'}]}]},
      {status:'applied-locally',patches:[{sourceRef:'guides/paws.html',changes:[{before:'two',after:'2'}]}]},
    ]});
    expect(grouped.get('guides/paws.html')).toEqual([{before:'one',after:'1'},{before:'two',after:'2'}]);
  });

  test('publication patches tolerate an image placement already present in HEAD', () => {
    const changes=[
      {section:'Copy',before:'Old guidance',after:'New guidance'},
      {section:'Picture placement',before:'old-image.png',after:'approved-image.jpg'},
    ];
    expect(applyReviewChanges('Old guidance approved-image.jpg',changes)).toBe('New guidance approved-image.jpg');
  });

  test('editorial fingerprints ignore scripts, styles and cache-only markup changes', () => {
    expect(contentFingerprint('<style>.x{}</style><p>Useful copy</p><script src="a.js?v=1"></script>'))
      .toBe(contentFingerprint('<style>.y{}</style><p>Useful copy</p><script src="a.js?v=2"></script>'));
  });

  test('editorial selection prioritises revisions and skips unchanged cooldown work', () => {
    const unchanged=fingerprint('unchanged');
    const candidates=[
      {contentId:'guide-revision',contentFingerprint:unchanged,packetFingerprint:'packet-a'},
      {contentId:'guide-cooldown',contentFingerprint:unchanged,packetFingerprint:'packet-b'},
      {contentId:'guide-new',contentFingerprint:fingerprint('new'),packetFingerprint:'packet-c'},
    ];
    const ledger={items:[
      {contentId:'guide-revision',status:'revision-requested',contentFingerprint:unchanged,nextEligibleAt:'2026-08-18T00:00:00.000Z'},
      {contentId:'guide-cooldown',status:'published',contentFingerprint:unchanged,nextEligibleAt:'2026-09-29T00:00:00.000Z'},
    ]};
    expect(selectEditorialWork(candidates,ledger,{asOf:'2026-08-25T09:00:00.000Z',limit:2}).map(item=>item.contentId))
      .toEqual(['guide-revision','guide-new']);
  });

  test('editorial selection covers unreviewed guides before repeating stale guides', () => {
    const candidates=[
      {contentId:'guide-stale',contentFingerprint:'same',packetFingerprint:'stale-packet'},
      {contentId:'guide-unreviewed',contentFingerprint:'new',packetFingerprint:'new-packet'},
    ];
    const ledger={items:[{contentId:'guide-stale',status:'published',contentFingerprint:'same',nextEligibleAt:'2026-08-01T00:00:00.000Z'}]};
    expect(selectEditorialWork(candidates,ledger,{asOf:'2026-08-18T00:00:00.000Z',limit:1})[0].contentId).toBe('guide-unreviewed');
  });

  test('recorded approvals establish cooldown while revisions remain immediately eligible', () => {
    const published=recordEditorialOutcome({contractVersion:'1.0.0',items:[]},{at:'2026-08-18T09:00:00.000Z',contentId:'guide-paws',type:'guide',sourceRef:'guides/paws.html',action:'approve',contentFingerprint:'abc'});
    expect(published.items[0]).toEqual(expect.objectContaining({status:'published',nextEligibleAt:'2026-09-29T09:00:00.000Z'}));
    const revision=recordEditorialOutcome(published,{at:'2026-08-20T09:00:00.000Z',contentId:'guide-paws',type:'guide',sourceRef:'guides/paws.html',action:'request-revision',contentFingerprint:'abc'});
    expect(revision.items[0]).toEqual(expect.objectContaining({status:'revision-requested',nextEligibleAt:'2026-08-20T09:00:00.000Z'}));
    expect(validateEditorialLedger(revision)).toEqual([]);
  });

  test('verified-trail editorial decisions are recorded without mutating public files', () => {
    const outcomes = recordVerifiedTrailReview(verifiedTrailEditorialExecution, [
      { jobId: 'verified-osm-relation-1484751-copy', action: 'approve' },
      { jobId: 'verified-osm-relation-1484751-visual', action: 'approve' },
      { jobId: 'verified-osm-relation-6678431-copy', action: 'request-revision' },
    ]);
    expect(outcomes).toEqual([
      expect.objectContaining({ status: 'editorial-approved' }),
      expect.objectContaining({ status: 'asset-and-licensing-approved' }),
      expect.objectContaining({ status: 'revision-queued' }),
    ]);
    expect(outcomes.filter(outcome => outcome.status.includes('approved')).every(outcome => outcome.message.includes('No public file was changed'))).toBe(true);
  });

  test('verified-trail revisions target the server-known trail agent and reject guide jobs', () => {
    const jobs = buildVerifiedTrailRevisionJobs(verifiedTrailEditorialExecution, [{
      jobId: 'verified-osm-relation-1484751-copy', agentId: 'visualDirector',
      action: 'request-revision', note: 'Shorten the opening.',
    }], '2026-08-18T18:00:00.000Z');
    expect(jobs).toEqual([expect.objectContaining({
      candidateId: 'osm-relation-1484751', agentId: 'copywriter',
      instruction: 'Shorten the opening.', humanGate: 'editorial-approval',
      publicMutationAllowed: false,
    })]);
    expect(() => buildVerifiedTrailRevisionJobs(verifiedTrailEditorialExecution, [{
      jobId: 'guide-paw-protection-edit-2026-08-18', action: 'request-revision', note: 'Change it.',
    }], '2026-08-18T18:00:00.000Z')).toThrow('Verified-trail revision output was not found');
    const second = buildVerifiedTrailRevisionJobs(verifiedTrailEditorialExecution, [{
      jobId: 'verified-osm-relation-1484751-copy', action: 'request-revision', note: 'Try again.',
    }], '2026-08-18T18:05:00.000Z', jobs);
    expect(second[0].attempt).toBe(2);
  });

  test('live Copywriter revisions preserve the locked dossier and return an auditable replacement', async () => {
    const job = buildVerifiedTrailRevisionJobs(verifiedTrailEditorialExecution, [{
      jobId:'verified-osm-way-25736154-copy', action:'request-revision', note:'Make the water sentence clearer.',
    }], '2026-08-18T19:00:00.000Z')[0];
    const current = verifiedTrailEditorialExecution.outputs.find(output => output.jobId === job.jobId);
    const revised = JSON.parse(JSON.stringify(current.result));
    revised.changes.find(change => change.section === 'Why it suits dogs').after = 'Bring enough water for your dog; no potable route source is verified.';
    const result = await runVerifiedTrailRevision({ job, execution:verifiedTrailEditorialExecution, editorialQueue:verifiedTrailEditorialQueue }, {
      at:'2026-08-18T19:01:00.000Z', runAgent:async () => ({ responseId:'resp-test', model:'test-model', data:{
        result:revised, factIdsUsed:['water'], instructionResolution:'Clarified the sentence without changing the water finding.', rejectedInstructionClaims:[],
      } }),
    });
    expect(result.output).toEqual(expect.objectContaining({ status:'ready-for-review', responseId:'resp-test' }));
    expect(result.output.revision).toEqual(expect.objectContaining({ attempt:1, factIdsUsed:['water'] }));
    expect(result.job.status).toBe('ready-for-review');
  });

  test('one human publication approval materializes one idempotent verified-trail override', () => {
    const request = { id:'publication-approval-1', candidateId:'osm-relation-1484751', status:'approved-for-pr-creation' };
    const item = {
      candidateId:'osm-relation-1484751', targetTrailId:'tre-cime', state:'ready-for-publication-preview',
      proposedWebsiteFields:{ name:'Tre Cime', desc:'Verified copy.', tips:'Carry water.', ormaVerified:true },
    };
    const route = { geometry:{ coordinates:[[12.29,46.61],[12.30,46.62],[12.29,46.61]] } };
    const first = materializeApprovedPublications({
      requests:{requests:[request]}, staging:{items:[item]},
      routesByCandidate:{'osm-relation-1484751':route},
      overrides:{schemaVersion:1,updatedAt:null,trails:[]}, at:'2026-08-18T20:00:00.000Z',
    });
    expect(first.materialized).toBe(1);
    expect(first.overrides.trails[0]).toEqual(expect.objectContaining({
      id:'tre-cime', approvalId:'publication-approval-1',
      fields:expect.objectContaining({ ormaVerified:true, path:[[46.61,12.29],[46.62,12.30],[46.61,12.29]] }),
    }));
    const second = materializeApprovedPublications({
      requests:{requests:[request]}, staging:{items:[item]},
      routesByCandidate:{'osm-relation-1484751':route}, overrides:first.overrides, at:'2026-08-18T20:05:00.000Z',
    });
    expect(second.materialized).toBe(0);
    expect(second.overrides).toEqual(first.overrides);
  });

  test('a failed publication keeps the approval, records a bounded receipt and can be retried safely', () => {
    const failed=recordPublicationFailure({contractVersion:'1.0.0',requests:[{
      id:'publication-approval-1',candidateId:'osm-relation-1484751',status:'approved-for-pr-creation',
    }]},{stage:'website-validation',message:'Three generated-site tests failed.',workflowRunUrl:'https://github.com/orma/actions/runs/1'},{at:'2026-08-19T20:31:00.000Z'});
    expect(failed.recorded).toBe(1);
    expect(failed.artifact.requests[0]).toEqual(expect.objectContaining({
      status:'publication-failed',retryable:true,failureStage:'website-validation',failureCount:1,
      failureKind:'automation-failure',retryAfter:'2026-08-19T20:46:00.000Z',
      workflowRunUrl:'https://github.com/orma/actions/runs/1',
    }));
    expect(failed.artifact.requests[0].failureHistory).toHaveLength(1);
    expect(publicationRequestIsRetryable(failed.artifact.requests[0])).toBe(true);
    expect(publicationRequestIsRetryable(failed.artifact.requests[0],{at:'2026-08-19T20:35:00.000Z'})).toBe(false);

    const retried=materializeApprovedPublications({
      requests:failed.artifact,
      staging:{items:[{candidateId:'osm-relation-1484751',targetTrailId:'tre-cime',state:'ready-for-publication-preview',proposedWebsiteFields:{name:'Tre Cime'}}]},
      routesByCandidate:{'osm-relation-1484751':{geometry:{coordinates:[[12.29,46.61],[12.30,46.62]]}}},
      overrides:{schemaVersion:1,trails:[]},at:'2026-08-19T20:35:00.000Z',forceRetry:true,
    });
    expect(retried.materialized).toBe(1);
    expect(retried.overrides.trails[0].approvalId).toBe('publication-approval-1');
  });

  test('an unchanged GitHub PR permission failure enters a manual circuit breaker',()=>{
    const failed=recordPublicationFailure({contractVersion:'1.0.0',requests:[{
      id:'publication-approval-1',candidateId:'osm-relation-1484751',status:'approved-for-pr-creation',
    }]},{stage:'pull-request-creation',message:'GraphQL: GitHub Actions is not permitted to create or approve pull requests',workflowRunUrl:'https://github.com/orma/actions/runs/2'},{at:'2026-08-19T21:00:00.000Z'});
    const request=failed.artifact.requests[0];
    expect(request).toEqual(expect.objectContaining({failureKind:'external-configuration-required',retryMode:'manual',retryAfter:null,manualRetryAvailable:true}));
    expect(publicationRequestIsRetryable(request,{at:'2026-08-20T20:59:59.000Z'})).toBe(false);
    expect(publicationRequestIsRetryable(request,{at:'2026-08-20T20:59:59.000Z',force:true})).toBe(true);
    expect(publicationRequestIsRetryable(request,{at:'2026-08-27T21:00:00.000Z'})).toBe(false);
    const forcedFailure=recordPublicationFailure(failed.artifact,{stage:'pull-request-creation',message:'GraphQL: GitHub Actions is not permitted to create or approve pull requests'},{at:'2026-08-20T21:00:00.000Z'});
    expect(forcedFailure.artifact.requests[0].failureCount).toBe(2);
  });

  test('publication failure logs and workflow URLs become concise safe receipt fields', () => {
    const summary=summarizeFailureLog('\u001b[31mFAIL ./trail-trust.test.js\u001b[0m\nnoise\nTest Suites: 3 failed, 91 passed');
    expect(summary).toBe('FAIL ./trail-trust.test.js\nTest Suites: 3 failed, 91 passed');
    expect(workflowRunUrl({GITHUB_SERVER_URL:'https://github.com',GITHUB_REPOSITORY:'lorenzib/ORMA',GITHUB_RUN_ID:'123'}))
      .toBe('https://github.com/lorenzib/ORMA/actions/runs/123');
  });

  test('the live worker supersedes repeat clicks and keeps only the latest publication decision per trail', async () => {
    const reviews=[
      {id:'approval-old',candidateId:'osm-relation-1484751',action:'approve-for-pr-creation',submittedAt:'2026-08-19T17:55:00.000Z'},
      {id:'approval-latest',candidateId:'osm-relation-1484751',action:'approve-for-pr-creation',submittedAt:'2026-08-19T17:56:00.000Z'},
    ];
    const marks=[];let requests=null;
    const store={
      listPublicationReviews:async()=>reviews,
      getArtifact:async id=>id==='publication-staging'?{items:[{candidateId:'osm-relation-1484751',targetTrailId:'tre-cime',state:'ready-for-publication-preview'}]}:requests,
      setArtifact:async(id,value)=>{if(id==='publication-requests')requests=value;},
      markPublicationReview:async(id,status,fields)=>marks.push({id,status,...fields}),
    };
    const outcomes=await ingestPublicationReviews(store);
    expect(requests.requests).toEqual([expect.objectContaining({id:'approval-latest',status:'approved-for-pr-creation'})]);
    expect(marks).toEqual(expect.arrayContaining([
      expect.objectContaining({id:'approval-old',status:'superseded',supersededBy:'approval-latest'}),
      expect.objectContaining({id:'approval-latest',status:'processed'}),
    ]));
    expect(outcomes).toHaveLength(2);
  });

  test('mock guide review uses the production result contract', () => {
    expect(validateContentExecution(mockContentExecution)).toEqual([]);
    expect(mockContentExecution.subject.id).toBe('paw-protection');
    expect(mockContentExecution.outputs.map(output => output.agentId)).toEqual(['copywriter', 'visualDirector']);
    expect(mockContentExecution.outputs[1].result.candidates.map(candidate => candidate.status)).toEqual(['ready', 'blocked']);
    expect(mockContentExecution.publicMutationAllowed).toBe(false);
  });

  test('picture candidates cannot be review-ready without an actual preview', () => {
    const invalid = JSON.parse(JSON.stringify(mockContentExecution));
    invalid.outputs[1].result.candidates[0].assetUrl = null;
    expect(validateContentExecution(invalid)).toContain(
      'outputs[1].result.candidates[0] ready pictures require assetUrl preview'
    );
  });

  test('trail orchestration exposes a blocked geometry gate instead of allowing approval', () => {
    const at='2026-08-18T20:00:00.000Z';
    const campaign={generatedAt:at,items:[{trailId:'trail-a',name:'Trail A',origin:'curated',priorityScore:10,baselineBlockers:[]}]};
    const execution={jobs:[{id:'cartographer-a',candidateId:'trail-a',completedAt:at,outputRefs:['backoffice-data/cartographer/trail-a.json']}]};
    const outputs={'trail-a':{agentId:'cartographer',reviewState:'blocked',blockers:['not-closed-loop']}};
    const orchestration=seedOrchestrationFromCatalogue(campaign,execution,outputs,{at});
    const reviewQueue=buildDossierReviewQueue(orchestration,outputs,{at});
    expect(validateTrailOrchestration(orchestration)).toEqual([]);
    expect(reviewQueue.items[0]).toEqual(expect.objectContaining({approvalAllowed:false,blockingReasons:['not-closed-loop']}));
    expect(()=>applyDossierReview(orchestration,reviewQueue,{reviewId:reviewQueue.items[0].reviewId,action:'approve'},{at})).toThrow('cannot be approved');
  });

  test('geometry approval queues the three independent evidence specialists', () => {
    const at='2026-08-18T20:00:00.000Z';
    const orchestration={contractVersion:'1.0.0',generatedAt:at,publicMutationAllowed:false,summary:{},trails:[{
      trailId:'trail-a',candidateId:'trail-a',trailName:'Trail A',state:'geometry-human-gate',stage:'route-identity-and-geometry',
      attempts:{cartographer:1},resolutionAttempts:{},jobIds:['cartographer-a'],currentJobId:'cartographer-a',latestOutputRef:'firestore:cartographer-a',
      gate:{id:'geometry-approval',status:'awaiting-human'},blockers:[],publicMutationAllowed:false,
    }]};
    const reviewQueue={items:[{reviewId:'review-a',candidateId:'trail-a',gateType:'geometry-approval',state:'awaiting-human',approvalAllowed:true}]};
    const result=applyDossierReview(orchestration,reviewQueue,{reviewId:'review-a',action:'approve'},{at});
    expect(result.orchestration.trails[0].state).toBe('evidence-research');
    expect(result.jobs.map(job=>job.agentId)).toEqual(['logistics','regulatoryRanger','terrainPoi']);
    expect(result.jobs.every(job=>job.publicMutationAllowed===false)).toBe(true);
  });

  test('five resolution attempts are allowed and the sixth blocks the trail', () => {
    const base={contractVersion:'1.0.0',publicMutationAllowed:false,summary:{},trails:[{
      trailId:'trail-a',candidateId:'trail-a',trailName:'Trail A',state:'geometry-human-gate',attempts:{cartographer:5},resolutionAttempts:{cartographer:4},
      jobIds:[],gate:{id:'geometry-approval',status:'awaiting-human'},blockers:[],publicMutationAllowed:false,
    }]};
    const queue={items:[{reviewId:'review-a',candidateId:'trail-a',gateType:'geometry-approval',state:'awaiting-human',approvalAllowed:false}]};
    const fifth=applyDossierReview(base,queue,{reviewId:'review-a',action:'request-revision',targetAgent:'cartographer',note:'Resolve the final gap.'},{at:'2026-08-18T20:00:00.000Z'});
    expect(fifth.jobs[0].resolutionAttempt).toBe(5);
    const againQueue={items:[{reviewId:'review-b',candidateId:'trail-a',gateType:'geometry-approval',state:'awaiting-human',approvalAllowed:false}]};
    const sixth=applyDossierReview(fifth.orchestration,againQueue,{reviewId:'review-b',action:'request-revision',targetAgent:'cartographer',note:'Try once more.'},{at:'2026-08-18T20:01:00.000Z'});
    expect(sixth.orchestration.trails[0].state).toBe('blocked');
    expect(sixth.jobs).toHaveLength(0);
  });

  test('the final gate locks approval when any specialist finding is unresolved', () => {
    expect(dossierBlockingReasons([{agentId:'redTeam',result:{recommendation:'needs-resolution',claims:[{id:'parking',finding:'unresolved',blockers:['No authority source']}]} }]))
      .toEqual(['redTeam: recommendation is needs-resolution','redTeam/parking: unresolved','redTeam/parking: No authority source']);
  });

  test('final human approval compiles a durable ORMA Verified editorial handoff', () => {
    const at='2026-08-18T20:00:00.000Z';const review={reviewId:'dossier-a',candidateId:'trail-a',gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:true,specialistOutputs:[
      {agentId:'cartographer',jobId:'cart-a',result:{source:{provider:'OSM',url:'https://example.test/route',endpoint:'https://example.test/raw',externalId:'relation/1',relationVersion:2,licence:'ODbL-1.0'},relation:{tags:{name:'Trail A'}},geometry:{type:'LineString',coordinates:[[1,1],[1,1]]},assessment:{pointCount:2,distanceKm:1}}},
      {agentId:'logistics',jobId:'log-a',result:{claims:[{id:'parking',category:'parking',proposedValue:'Use P1.',finding:'supported-proposal',confidence:.9,rationale:'Official source.',sources:[{label:'Authority',url:'https://example.test/parking',authority:'Municipality',accessedAt:at}],blockers:[]}] }},
    ]};
    const trail={candidateId:'trail-a',trailId:'trail-a',trailName:'Trail A',sourceTrail:{externalRelationId:'relation/1'}};
    const dossier=compileVerifiedDossier(review,trail,{at,verifiedBy:'editor-a'});const record=verificationRecord(dossier);
    expect(validateDossier(dossier)).toEqual([]);
    expect(dossier).toEqual(expect.objectContaining({reviewState:'accepted',publicMutationAllowed:false,publicationAuthorized:false}));
    expect(record).toEqual(expect.objectContaining({verifiedBy:'editor-a',nextStage:'editorial-and-publication-review'}));
  });

  test('a numbered route cannot be verified without an authoritative recommended starting point', () => {
    const at='2026-09-02T10:00:00.000Z';
    const cartographer={agentId:'cartographer',jobId:'cart-a',result:{source:{provider:'OSM',url:'https://example.test/route',endpoint:'https://example.test/raw',externalId:'relation/19',relationVersion:2,licence:'ODbL-1.0'},relation:{tags:{name:'Trail 19',ref:'19'}},geometry:{type:'LineString',coordinates:[[1,1],[1,1]]},assessment:{pointCount:2,distanceKm:1}}};
    const parking={id:'parking',category:'parking',proposedValue:'Use P1.',finding:'supported-proposal',confidence:.9,rationale:'Official source.',sources:[{label:'Authority',url:'https://example.test/parking',authority:'Municipality',accessedAt:at}],blockers:[]};
    const review={reviewId:'dossier-19',candidateId:'trail-19',approvalAllowed:true,specialistOutputs:[cartographer,{agentId:'logistics',jobId:'log-a',result:{claims:[parking]}}]};
    const trail={candidateId:'trail-19',trailId:'trail-19',trailName:'Trail 19'};
    expect(()=>compileVerifiedDossier(review,trail,{at})).toThrow('requires an authoritative recommended-start claim');
    review.specialistOutputs[1].result.claims.push({id:'recommended-start',category:'access',proposedValue:'Start at Rifugio Example, 46.0000, 11.0000.',finding:'supported-proposal',confidence:.95,rationale:'The official route page identifies the start.',sources:[{label:'Official route',url:'https://example.test/trail-19',authority:'Park authority',accessedAt:at}],blockers:[]});
    expect(compileVerifiedDossier(review,trail,{at}).claims).toEqual(expect.arrayContaining([expect.objectContaining({id:'logistics-recommended-start'})]));
  });

  test('a web-search specialist returns proposed evidence without public mutation authority', async () => {
    const response=await runTrailSpecialist({
      job:{agentId:'logistics',candidateId:'trail-a',action:'verify-parking-and-access'},trail:{id:'trail-a'},context:[],
    },{at:'2026-08-18T20:00:00.000Z',env:{},runAgent:async (input,clientOptions)=>{
      expect(input.webSearch).toBe(true);
      expect(clientOptions.model).toBe('gpt-5.6-luna');
      return {responseId:'resp-a',model:'test-model',data:{
        summary:'Parking remains unresolved.',
        claims:[{id:'parking',category:'parking',proposedValue:'Unknown',finding:'unresolved',confidence:0,
          rationale:'No authoritative source located.',sources:[],blockers:['parking-pin-unverified']}],
        openQuestions:['Contact the municipality.'],recommendation:'needs-resolution',
      }};
    }});
    expect(response.result).toEqual(expect.objectContaining({agentId:'logistics',publicMutationAllowed:false,recommendation:'needs-resolution'}));
  });

  test('trail specialists route routine research to Luna and judgment passes to Terra', () => {
    expect(modelForAgent('logistics',{})).toBe('gpt-5.6-luna');
    expect(modelForAgent('regulatoryRanger',{})).toBe('gpt-5.6-luna');
    expect(modelForAgent('terrainPoi',{})).toBe('gpt-5.6-luna');
    expect(modelForAgent('evidenceLibrarian',{})).toBe('gpt-5.6-terra');
    expect(modelForAgent('redTeam',{})).toBe('gpt-5.6-terra');
    expect(modelForAgent('auditor',{})).toBe('gpt-5.6-terra');
    expect(modelForAgent('logistics',{ORMA_CONTENT_MODEL:'test-shared'})).toBe('test-shared');
    expect(modelForAgent('redTeam',{ORMA_CONTENT_AUDIT_MODEL:'test-audit',ORMA_CONTENT_MODEL:'test-shared'})).toBe('test-audit');
  });

  test('a controlled live worker run processes only the selected trail candidate', async () => {
    const pending=[
      {id:'job-a',jobType:'trail-verification-specialist',agentId:'logistics',candidateId:'trail-a',action:'verify-parking-and-access'},
      {id:'job-b',jobType:'trail-verification-specialist',agentId:'logistics',candidateId:'trail-b',action:'verify-parking-and-access'},
    ];
    const completed=[];
    const store={
      listJobs:async()=>pending,
      claimJob:async id=>pending.find(job=>job.id===id),
      getArtifact:async()=>null,
      setArtifact:async()=>{},
      completeSystemJob:async id=>completed.push(id),
      failJob:async()=>{},
    };
    const result=await processTrailSpecialistJobs(store,{
      specialistCandidateId:'trail-b',specialistLimit:5,productionTrails:[{id:'trail-b'}],env:{},
      runAgent:async()=>({responseId:'resp-b',model:'gpt-5.6-luna',data:{summary:'Checked.',claims:[],openQuestions:[],recommendation:'advance'}}),
    });
    expect(result).toEqual([expect.objectContaining({jobId:'job-b',status:'completed'})]);
    expect(completed).toEqual(['job-b']);
  });

  test('the live worker accepts only positive specialist limits', () => {
    expect(positiveInteger('1',5)).toBe(1);
    expect(positiveInteger('0',5)).toBe(5);
    expect(positiveInteger('not-a-number',5)).toBe(5);
  });

  test('the live daily campaign excludes trails already in orchestration', async () => {
    const artifacts={"trail-orchestration":{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[{trailId:'trail-a',candidateId:'trail-a',trailName:'A',state:'ready-for-editorial',attempts:{},resolutionAttempts:{},jobIds:[],publicMutationAllowed:false}]}};const queued=[];
    const store={getArtifact:async id=>artifacts[id],setArtifact:async(id,value)=>{artifacts[id]=value;},putJob:async job=>queued.push(job)};
    const trails=[{id:'trail-a',name:'A',curated:true,osmRelation:1,path:[[1,1],[1,1]]},{id:'trail-b',name:'B',curated:true,osmRelation:2,path:[[1,1],[1,1]]}];
    const result=await startLiveTrailCampaign(store,trails,{at:'2026-08-18T20:00:00.000Z',limit:1});
    expect(result.campaign.selectedTrailIds).toEqual(['trail-b']);
    expect(queued[0]).toEqual(expect.objectContaining({candidateId:'trail-b',jobType:'trail-verification-specialist',status:'queued'}));
    expect(validateTrailOrchestration(artifacts['trail-orchestration'])).toEqual([]);
  });

  test('live seeding excludes guide reviews from the trail fleet', () => {
    const queue=trailOnlyReviewQueue({contractVersion:'1.0.0',submissions:[
      {submissionId:'mixed',decisions:[
        {jobId:'guide-paw-protection-edit',action:'approve'},
        {jobId:'verified-osm-way-1-copy',action:'approve'},
      ]},
      {submissionId:'guide-only',decisions:[{jobId:'guide-alpine-plants-copy',action:'approve'}]},
    ]});
    expect(queue.submissions).toEqual([expect.objectContaining({
      submissionId:'mixed',decisions:[expect.objectContaining({jobId:'verified-osm-way-1-copy'})],
    })]);
  });

  test('the live campaign does not exceed fifteen in-flight trails', async () => {
    const active=Array.from({length:15},(_,index)=>({trailId:`trail-${index}`,candidateId:`trail-${index}`,trailName:`Trail ${index}`,
      state:'geometry-human-gate',attempts:{cartographer:1},resolutionAttempts:{},jobIds:[],publicMutationAllowed:false}));
    const artifacts={'trail-orchestration':{contractVersion:'1.0.0',publicMutationAllowed:false,trails:active}};const queued=[];
    const store={getArtifact:async id=>artifacts[id],setArtifact:async(id,value)=>{artifacts[id]=value;},putJob:async job=>queued.push(job)};
    const result=await startLiveTrailCampaign(store,[{id:'new-trail',name:'New',curated:true,osmRelation:99,path:[[1,1],[1,1]]}],{at:'2026-08-18T20:00:00.000Z',limit:10,capacity:15});
    expect(result.jobIds).toEqual([]);expect(queued).toEqual([]);expect(artifacts['trail-orchestration'].trails).toHaveLength(15);
  });

  test('product discovery produces a source-linked research-only review packet', async () => {
    const packet=await runProductDiscovery({at:'2026-08-19T10:00:00.000Z',runAgent:async input=>{
      expect(input.webSearch).toBe(true);
      return {model:'test-model',responseId:'response-1',data:{executiveSummary:'A useful pattern.',ideas:[
        {id:'condition-layer',category:'feature',title:'Condition layer',signal:'A competitor shipped it.',ormaOpportunity:'Make it dog-first.',whyNow:'Safety.',impact:'high',confidence:'high',suggestedInvestigation:['Check inputs'],sources:[{label:'Official release',url:'https://example.test/release',checkedAt:'2026-08-19',supports:'The release.'}]},
        {id:'visual-gap',category:'ui',title:'Visual gap',signal:'Photos matter.',ormaOpportunity:'Use owned photos.',whyNow:'Coverage.',impact:'medium',confidence:'medium',suggestedInvestigation:['Audit'],sources:[{label:'Official page',url:'https://example.test/photos',checkedAt:'2026-08-19',supports:'Photo feature.'}]},
        {id:'editorial-gap',category:'editorial-gap',title:'Editorial gap',signal:'Questions repeat.',ormaOpportunity:'Publish an explainer.',whyNow:'Demand.',impact:'low',confidence:'medium',suggestedInvestigation:['Review queries'],sources:[{label:'Support',url:'https://example.test/support',checkedAt:'2026-08-19',supports:'Common questions.'}]},
      ]}};
    }});
    expect(packet).toEqual(expect.objectContaining({mode:'research-only',publicMutationAllowed:false}));
    expect(packet.ideas).toHaveLength(3);expect(packet.ideas.every(idea=>idea.status==='awaiting-review')).toBe(true);
  });

  test('investigate further queues research without authorising feature work', () => {
    const packet={ideas:[{id:'condition-layer',suggestedInvestigation:['Check inputs']}]};
    const review=applyProductIdeaReview(packet,{decisions:[],jobs:[]},{ideaId:'condition-layer',action:'investigate-further',note:'Compare Alpine sources.'},'2026-08-19T10:00:00.000Z');
    expect(review.decisions[0]).toEqual(expect.objectContaining({featureWorkAuthorized:false,publicMutationAllowed:false}));
    expect(review.jobs[0]).toEqual(expect.objectContaining({agentId:'marketOpportunity',status:'queued',focus:'Compare Alpine sources.'}));
  });

  test('prioritising an analyst idea authorises a mock-up but not development', () => {
    const packet={ideas:[{id:'condition-layer',ormaOpportunity:'Dog-first condition layer.',suggestedInvestigation:[]}]};
    const review=applyProductIdeaReview(packet,{decisions:[],jobs:[]},{ideaId:'condition-layer',action:'prioritise',note:'Start with the trail header.'},'2026-08-19T10:00:00.000Z');
    expect(review.decisions[0]).toEqual(expect.objectContaining({designExplorationAuthorized:true,featureWorkAuthorized:false,implementationAuthorized:false}));
    expect(review.jobs[0]).toEqual(expect.objectContaining({agentId:'productDesigner',action:'create-reviewable-mockup',humanGate:'ceo-mockup-approval',implementationAuthorized:false}));
  });

  test('trail-photo coverage audits every production trail and ranks Dolomites gaps first', async () => {
    expect(imageSignals('<img src="../images/editorial/paw.jpg" alt="Paw">').editorialImages).toEqual(['../images/editorial/paw.jpg']);
    const root=require('path').resolve(__dirname,'..');const production=require('../scripts/load-production-trails').loadProductionTrails(root);
    const audit=await auditImageCoverage(root,{at:'2026-08-19T10:00:00.000Z'});
    expect(audit.mode).toBe('trail-photo-coverage-audit');
    expect(audit.summary.trailsScanned).toBe(production.length);
    expect(audit.summary.missing).toBe(production.filter(trail=>!trail.imageIcon&&!trail.heroImage).length);
    expect(audit.summary.dolomitesMissing).toBe(production.filter(trail=>trail.region==='dolomites'&&!trail.imageIcon&&!trail.heroImage).length);
    expect(audit.gaps[0].region).toBe('dolomites');
    expect(audit.gaps.map(gap=>gap.slug)).not.toContain('tre-cime');
    expect(audit.pages.find(page=>page.slug==='tre-cime').coverageState).toBe('covered');
    expect(audit.pages.find(page=>page.slug==='tre-cime').existingAssets).toContain('images/tre-cime-hero.jpg');
    const expectedDolomitesGap=production.find(trail=>trail.region==='dolomites'&&!trail.imageIcon&&!trail.heroImage);
    expect(expectedDolomitesGap).toBeDefined();
    expect(audit.pages.find(page=>page.slug===expectedDolomitesGap.id)).toEqual(expect.objectContaining({coverageState:'missing',sourceRef:`trail.html?id=${expectedDolomitesGap.id}`,priority:'high'}));
  });

  test('image sourcing stays queued behind asset approval', () => {
    const audit={gaps:[{slug:'seceda',trailId:'seceda',sourceRef:'trail.html?id=seceda',reasons:['Missing cover photo'],libraryMatches:[]}]};
    const review=applyImageCoverageReview(audit,{decisions:[],jobs:[]},{slug:'seceda',action:'find-licensed',note:'Look for a correctly licensed summer view.'},'2026-08-19T10:00:00.000Z');
    expect(review.jobs[0]).toEqual(expect.objectContaining({agentId:'visualDirector',status:'queued',requiresAssetApproval:true,publicMutationAllowed:false}));
  });

  test('authoritative severe-weather alerts map to affected ORMA trails without claiming closure', () => {
    const xml=`<feed xmlns="http://www.w3.org/2005/Atom" xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2"><entry><id>alert-1</id><title>Orange wind warning</title><updated>2026-08-19T05:00:00Z</updated><link href="https://example.test/cap" type="application/cap+xml"/><cap:identifier>official-1</cap:identifier><cap:event>Wind</cap:event><cap:areaDesc>Veneto</cap:areaDesc><cap:severity>Severe</cap:severity><cap:certainty>Likely</cap:certainty><cap:expires>2026-08-20T05:00:00Z</cap:expires></entry></feed>`;
    const alerts=parseAtomFeed(xml,{key:'official-italy',label:'Official Italy',url:'https://example.test/feed'});
    const artifacts=buildHazardArtifacts({hazards:[]},alerts,[{key:'official-italy',ok:true,alertsRead:1}],[{id:'trail-a',name:'Trail A',region:'dolomites',province:'belluno'}],{at:'2026-08-19T06:00:00.000Z'});
    expect(artifacts.publicData.hazards).toEqual([expect.objectContaining({state:'active',trailIds:['trail-a'],removalRequiresHumanReview:true})]);
    expect(artifacts.publicData.hazards[0].message).toContain('not a trail-closure notice');
  });

  test('an unavailable warning source never clears a previous warning', () => {
    const previous={hazards:[{id:'source:a',sourceKey:'source',state:'active',expiresAt:'2026-08-18T00:00:00.000Z',message:'Warning.',trailIds:['trail-a']}]};
    const artifacts=buildHazardArtifacts(previous,[],[{key:'source',ok:false,error:'timeout'}],[],{at:'2026-08-19T06:00:00.000Z'});
    expect(artifacts.publicData.hazards[0]).toEqual(expect.objectContaining({state:'active',sourceStatus:'unavailable',sourceError:'timeout'}));
    expect(artifacts.reviewQueue.items).toHaveLength(0);
  });

  test('a complete authoritative snapshot automatically removes warnings the source no longer lists', () => {
    const previous={contractVersion:'1.0.0',hazards:[{id:'source:a',sourceKey:'source',sourceLabel:'Official source',state:'active',expiresAt:'2026-08-20T00:00:00.000Z',title:'Wind warning',message:'Warning.',trailIds:['trail-a']}]};
    const artifacts=buildHazardArtifacts(previous,[],[{key:'source',ok:true,completeSnapshot:true,alertsRead:0}],[],{at:'2026-08-19T06:00:00.000Z'});
    expect(artifacts.publicData.hazards).toEqual([]);
    expect(artifacts.reviewQueue.items).toEqual([]);
    expect(artifacts.status.summary.automaticallyRemoved).toBe(1);
    expect(artifacts.status.automaticRemovals).toEqual([expect.objectContaining({hazardId:'source:a',sourceKey:'source',reason:'absent-from-complete-authoritative-snapshot'})]);
  });

  test('expired warnings enter removal review and only human confirmation removes them', () => {
    const previous={contractVersion:'1.0.0',hazards:[{id:'source:a',sourceKey:'source',state:'active',expiresAt:'2026-08-18T00:00:00.000Z',message:'Warning.',trailIds:['trail-a']}]};
    const artifacts=buildHazardArtifacts(previous,[],[{key:'source',ok:true,alertsRead:0}],[],{at:'2026-08-19T06:00:00.000Z'});
    expect(artifacts.publicData.hazards[0].state).toBe('resolution-review');
    const repeated=buildHazardArtifacts(artifacts.publicData,[],[{key:'source',ok:true,alertsRead:0}],[],{at:'2026-08-19T06:05:00.000Z'});
    expect(repeated.publicData.hazards[0].message).toBe(artifacts.publicData.hazards[0].message);
    const reviewed=applyHazardReview(artifacts.publicData,{decisions:[]},{hazardId:'source:a',action:'confirm-resolved'},{at:'2026-08-19T07:00:00.000Z'});
    expect(reviewed.publicData.hazards).toHaveLength(0);expect(reviewed.ledger.decisions[0].action).toBe('confirm-resolved');
  });

  test('keeping an expired warning active defers the next removal review for one day', () => {
    const data={contractVersion:'1.0.0',hazards:[{id:'source:a',sourceKey:'source',state:'resolution-review',expiresAt:'2026-08-18T00:00:00.000Z',message:'Warning.',trailIds:['trail-a']}]};
    const kept=applyHazardReview(data,{decisions:[]},{hazardId:'source:a',action:'keep-active'},{at:'2026-08-19T07:00:00.000Z'});
    expect(kept.publicData.hazards[0]).toEqual(expect.objectContaining({state:'active',nextRemovalReviewAt:'2026-08-20T07:00:00.000Z'}));
    const artifacts=buildHazardArtifacts(kept.publicData,[],[{key:'source',ok:true,alertsRead:0}],[],{at:'2026-08-19T08:00:00.000Z'});
    expect(artifacts.publicData.hazards[0].state).toBe('active');
  });

  test('new trail scouting prioritises credible loops near existing coverage and never publishes them', () => {
    const closed=[[11.5,46.5],[11.51,46.5],[11.5,46.5]];const sources=[{region:'dolomites',data:{features:[
      {type:'Feature',properties:{osm_relation:200,name:'Nearby loop',distance_km:5,loop:true,sac_scale:'hiking'},geometry:{type:'LineString',coordinates:closed}},
      {type:'Feature',properties:{osm_relation:100,name:'Already public',distance_km:5,loop:true},geometry:{type:'LineString',coordinates:closed}},
      {type:'Feature',properties:{osm_relation:300,name:'Too hard',distance_km:5,loop:true,sac_scale:'alpine_hiking'},geometry:{type:'LineString',coordinates:closed}},
    ]}}];
    const packet=planNewTrailScouting(sources,[{id:'existing',name:'Existing',region:'dolomites',lat:46.5,lng:11.5,osmRelation:100}],{at:'2026-08-19T07:00:00.000Z'});
    expect(packet.candidates).toEqual([expect.objectContaining({id:'osm-relation-200',expansionTier:'existing-area',status:'awaiting-ceo-selection',publicMutationAllowed:false})]);
    expect(packet.publicMutationAllowed).toBe(false);
  });

  test('new trail scouting keeps Dolomites candidates ahead of other regions', () => {
    const loop=[[11.5,46.5],[11.51,46.5],[11.5,46.5]];
    const feature=(relation,name)=>({type:'Feature',properties:{osm_relation:relation,name,distance_km:5,loop:true},geometry:{type:'LineString',coordinates:loop}});
    const packet=planNewTrailScouting([{region:'savoy',data:{features:[feature(401,'Savoy loop')]}},{region:'dolomites',data:{features:[feature(402,'Dolomites loop')]}}],[],{at:'2026-08-25T08:30:00Z'});
    expect(packet.candidates.map(item=>item.name)).toEqual(['Dolomites loop','Savoy loop']);
    expect(packet.summary).toEqual(expect.objectContaining({primaryRegion:'dolomites',primaryRegionCandidates:1}));
  });

  test('a selected New Trail enters the existing verification fleet as a non-public intake', async () => {
    const candidate={id:'osm-relation-200',osmRelation:200,name:'Nearby loop',region:'dolomites',center:[11.5,46.5],distanceKm:5,sourceUrl:'https://www.openstreetmap.org/relation/200'};
    expect(candidateToTrail(candidate)).toEqual(expect.objectContaining({id:'osm-relation-200',curated:false,osmRelation:200,publicRecordPresent:false}));
    expect(selectedNewTrails({candidates:[candidate]},{decisions:[{candidateId:candidate.id,action:'send-to-verification'}]})).toHaveLength(1);
    const artifacts={};const jobs=[];const store={getArtifact:async id=>artifacts[id]||null,setArtifact:async(id,value)=>{artifacts[id]=value;},putJob:async job=>jobs.push(job)};
    const result=await admitNewTrailIntake(store,{candidates:[candidate]},{decisions:[{candidateId:candidate.id,action:'send-to-verification'}]},{at:'2026-08-19T08:00:00.000Z'});
    expect(result.jobIds).toHaveLength(1);expect(jobs[0]).toEqual(expect.objectContaining({candidateId:candidate.id,agentId:'cartographer'}));
    expect(artifacts['trail-orchestration'].trails[0]).toEqual(expect.objectContaining({state:'geometry-audit',publicMutationAllowed:false}));
  });
});
