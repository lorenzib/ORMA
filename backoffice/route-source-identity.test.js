'use strict';

const { planCatalogueCampaign, campaignItem, identityContradiction, pathIsClosedLoop }
  = require('./workflows/plan-catalogue-campaign');
const { runCatalogueBatch } = require('./workflows/run-catalogue-batch');

// A trail whose recorded relation turns out to be a different route used to
// pass the baseline check and fail deep in the pipeline, because the baseline
// only asked whether a relation id was present, never whether it was right.

const LOOP = [[46.5979, 11.7243], [46.5990, 11.7300], [46.5950, 11.7350], [46.5979, 11.7243]];
const LINE = [[46.5979, 11.7243], [46.5990, 11.7300], [46.5586, 11.7283]];

function trail(overrides = {}){
  return { id:'seceda', name:'Seceda Ridge Trail', curated:false, osmRelation:6528494,
    path:LOOP, distance:10.8, elevation:550, ...overrides };
}

function check(overrides = {}){
  return { externalRelationId:'relation/6528494', checkedAt:'2026-09-05T20:51:19.572Z',
    reviewState:'blocked', blockers:['not-closed-loop','official-distance-conflict'],
    closedLoop:false, reconstructedDistanceKm:8.81, officialDistanceKm:10.8,
    distanceDeltaPercent:-18.4, relationName:null, componentCount:1, ...overrides };
}

describe('a recorded relation that reconstructs a different route', () => {
  test('leaves the trail needing a source rather than queued for a check', () => {
    const item = campaignItem(trail(), { seceda:check() });

    expect(item.campaignState).toBe('source-identity-required');
    expect(item.baselineBlockers).toContain('route-source-identity-contradicted');
    expect(item.identityCheck).toMatchObject({ reason:'official-distance-conflict',
      externalRelationId:'relation/6528494', reconstructedDistanceKm:8.81, officialDistanceKm:10.8 });
  });

  test('does not earn the priority bonus for having an identity', () => {
    const queued = campaignItem(trail(), {});
    const contradicted = campaignItem(trail(), { seceda:check() });

    expect(queued.campaignState).toBe('identity-check-queued');
    expect(contradicted.priorityScore).toBe(queued.priorityScore - 15 + 1);
  });

  test('a check of a different relation is ignored, so correcting the source clears it', () => {
    // The trail now records another relation; the old verdict answered a
    // question nobody is asking any more.
    const item = campaignItem(trail({ osmRelation:9430475 }), { seceda:check() });

    expect(item.campaignState).toBe('identity-check-queued');
    expect(item.baselineBlockers).not.toContain('route-source-identity-contradicted');
    expect(item.identityCheck).toBeNull();
  });

  test('a loop whose reconstruction does not close is contradicted', () => {
    const item = campaignItem(trail(), { seceda:check({ blockers:['not-closed-loop'] }) });

    expect(item.identityCheck).toMatchObject({ reason:'reconstruction-is-not-a-loop' });
    expect(item.campaignState).toBe('source-identity-required');
  });

  test('a trail that is not a loop is not contradicted by an open reconstruction', () => {
    const item = campaignItem(trail({ path:LINE }), { seceda:check({ blockers:['not-closed-loop'] }) });

    expect(item.identityCheck).toBeNull();
    expect(item.campaignState).toBe('identity-check-queued');
  });

  test('a relation named as the trail is the trail, whatever its length says', () => {
    // Measured against the catalogue this is the common case: 49 of 58 trails
    // first flagged carried a relation named exactly as the trail. A length
    // disagreement there is a metrics question for the geometry gate.
    const item = campaignItem(trail(), { seceda:check({ relationName:'Seceda Ridge Trail' }) });

    expect(item.identityCheck).toBeNull();
    expect(item.campaignState).toBe('identity-check-queued');
  });

  test('the name match ignores case, accents and punctuation', () => {
    const named = trail({ name:'Sassolungo–Sassopiatto Loop' });
    const item = campaignItem(named, { seceda:check({ relationName:'sassolungo sassopiatto loop' }) });

    expect(item.identityCheck).toBeNull();
  });

  test('a fragmented reconstruction cannot be compared on length', () => {
    // A relation carrying variants and spurs comes back as several components
    // whose lengths sum to far more than the walk. That total says nothing
    // about which route the relation is.
    const item = campaignItem(trail(), { seceda:check({ componentCount:4 }) });

    expect(item.identityCheck).toBeNull();
    expect(item.campaignState).toBe('identity-check-queued');
  });

  test('a check taken before components were counted condemns nobody', () => {
    const item = campaignItem(trail(), { seceda:check({ componentCount:null }) });

    expect(item.identityCheck).toBeNull();
  });

  test('a missing official distance is a geometry question, not a wrong route', () => {
    // The cartographer blocks on it, but it says nothing about which route the
    // relation is. Treating every blocker as a contradiction would strand
    // trails whose distance simply was never recorded.
    const item = campaignItem(trail(), {
      seceda:check({ blockers:['official-distance-unavailable'], closedLoop:true }) });

    expect(item.identityCheck).toBeNull();
    expect(item.campaignState).toBe('identity-check-queued');
  });

  test('the campaign counts contradicted identities separately', () => {
    const campaign = planCatalogueCampaign([trail()], { jobLimit:1, identityChecks:{ seceda:check() } });

    expect(campaign.summary.sourceIdentityContradicted).toBe(1);
    expect(campaign.summary.identityCheckQueued).toBe(0);
    expect(campaign.summary.sourceIdentityRequired).toBe(1);
  });
});

describe('the batch reports what the reconstruction found', () => {
  const campaign = { generatedAt:'2026-09-05T20:00:00.000Z',
    jobs:[{ id:'job-1', candidateId:'seceda', action:'verify-current-relation', agentId:'cartographer' }] };

  async function run(result){
    return runCatalogueBatch(campaign, [trail()], { at:'2026-09-05T20:01:00.000Z',
      runCartographer: async () => result });
  }

  test('a blocked reconstruction is not reported as ready for a human', async () => {
    // Both branches of this used to say `needs-human`, so a failed identity
    // check was counted as a route waiting for the operator's approval.
    const execution = await run({ candidateId:'seceda', reviewState:'blocked',
      blockers:['official-distance-conflict'], assessment:{ issues:['not-closed-loop'] },
      comparison:{ reconstructedDistanceKm:8.81, officialDistanceKm:10.8, distanceDeltaPercent:-18.4 },
      components:[{}], source:{ externalId:'relation/6528494' }, generatedAt:'2026-09-05T20:01:00.000Z' });

    expect(execution.jobs[0].status).toBe('blocked');
    expect(execution.summary).toMatchObject({ attempted:1, needsHuman:0, blocked:1, failed:0 });
  });

  test('it records the check against the relation it examined', async () => {
    const execution = await run({ candidateId:'seceda', reviewState:'blocked',
      blockers:['official-distance-conflict'], assessment:{ issues:['not-closed-loop'] },
      comparison:{ reconstructedDistanceKm:8.81, officialDistanceKm:10.8, distanceDeltaPercent:-18.4 },
      components:[{}], source:{ externalId:'relation/6528494' }, generatedAt:'2026-09-05T20:01:00.000Z' });

    expect(execution.identityChecks.seceda).toEqual({ externalRelationId:'relation/6528494',
      checkedAt:'2026-09-05T20:01:00.000Z', reviewState:'blocked',
      blockers:['official-distance-conflict'], closedLoop:false, relationName:null, componentCount:1,
      reconstructedDistanceKm:8.81, officialDistanceKm:10.8, distanceDeltaPercent:-18.4 });
  });

  test('a clean reconstruction still goes to the geometry gate', async () => {
    const execution = await run({ candidateId:'seceda', reviewState:'ready-for-human-review',
      blockers:[], assessment:{ issues:[] },
      comparison:{ reconstructedDistanceKm:10.7, officialDistanceKm:10.8, distanceDeltaPercent:-0.9 },
      components:[{}], source:{ externalId:'relation/6528494' }, generatedAt:'2026-09-05T20:01:00.000Z' });

    expect(execution.jobs[0].status).toBe('needs-human');
    expect(execution.identityChecks.seceda.closedLoop).toBe(true);
  });
});

describe('loop detection', () => {
  test('a path that returns to its start is a loop', () => {
    expect(pathIsClosedLoop(trail())).toBe(true);
  });

  test('a path that ends 4 km away is not', () => {
    expect(pathIsClosedLoop(trail({ path:LINE }))).toBe(false);
  });

  test('a trail with no usable path is not a loop', () => {
    expect(pathIsClosedLoop(trail({ path:[] }))).toBe(false);
    expect(identityContradiction(trail({ path:[] }), { seceda:check({ blockers:['not-closed-loop'] }) })).toBeNull();
  });
});
