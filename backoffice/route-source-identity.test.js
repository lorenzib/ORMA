'use strict';

const { planCatalogueCampaign, campaignItem, identityContradiction, pathIsClosedLoop }
  = require('./workflows/plan-catalogue-campaign');
const { runCatalogueBatch, pathContainmentPercent } = require('./workflows/run-catalogue-batch');

// The identity check asks one thing: does the recorded relation cover the walk?
//
// Earlier versions asked about length, loop shape and the relation's name.
// Measured across the catalogue each proved a bad proxy. A trail may walk
// 3.4 km of a 7.2 km named route and be perfectly sourced, and a relation may
// carry the trail's exact name while sharing a quarter of its path.

const LOOP = [[46.5979, 11.7243], [46.5990, 11.7300], [46.5950, 11.7350], [46.5979, 11.7243]];
const LINE = [[46.5979, 11.7243], [46.5990, 11.7300], [46.5586, 11.7283]];

function trail(overrides = {}){
  return { id:'seceda', name:'Seceda Ridge Trail', curated:false, osmRelation:6528494,
    path:LOOP, distance:10.8, elevation:550, ...overrides };
}

function check(overrides = {}){
  return { externalRelationId:'relation/6528494', checkedAt:'2026-09-05T20:51:19.572Z',
    reviewState:'blocked', blockers:['not-closed-loop','official-distance-conflict'],
    closedLoop:false, relationName:null, componentCount:1, pathContainmentPercent:56,
    reconstructedDistanceKm:8.81, officialDistanceKm:10.8, distanceDeltaPercent:-18.4, ...overrides };
}

describe('a relation that covers only part of the walk', () => {
  test('leaves the trail needing a source rather than queued for a check', () => {
    const item = campaignItem(trail(), { seceda:check() });

    expect(item.campaignState).toBe('source-identity-required');
    expect(item.baselineBlockers).toContain('route-source-identity-contradicted');
    expect(item.identityCheck).toMatchObject({ reason:'relation-covers-part-of-the-route',
      pathContainmentPercent:56, externalRelationId:'relation/6528494' });
  });

  test('does not earn the priority bonus for having an identity', () => {
    const queued = campaignItem(trail(), {});
    const contradicted = campaignItem(trail(), { seceda:check() });

    expect(contradicted.priorityScore).toBe(queued.priorityScore - 15 + 1);
  });

  test('a check of a different relation is ignored, so correcting the source clears it', () => {
    const item = campaignItem(trail({ osmRelation:9430475 }), { seceda:check() });

    expect(item.campaignState).toBe('identity-check-queued');
    expect(item.identityCheck).toBeNull();
  });

  test('the campaign counts these separately', () => {
    const campaign = planCatalogueCampaign([trail()], { jobLimit:1, identityChecks:{ seceda:check() } });

    expect(campaign.summary.sourceIdentityContradicted).toBe(1);
    expect(campaign.summary.identityCheckQueued).toBe(0);
  });
});

describe('a relation that does cover the walk', () => {
  test('a trail walking part of a longer route is properly sourced', () => {
    // Cadini di Misurina Viewpoint walks 3.4 km of the 7.2 km Sentiero
    // Bonacossa, every point of it on the relation. The length gap is the
    // point of the trail, not a fault in its source.
    const cadini = trail({ id:'cadini', name:'Cadini di Misurina Viewpoint', path:LINE, distance:3.4 });
    const item = campaignItem(cadini, { cadini:check({ pathContainmentPercent:100,
      relationName:'Sentiero Bonacossa', reconstructedDistanceKm:7.24, officialDistanceKm:3.4 }) });

    expect(item.identityCheck).toBeNull();
    expect(item.campaignState).toBe('identity-check-queued');
  });

  test('a matching name does not rescue a relation that shares a quarter of the path', () => {
    // relation/12174210 is named "Rundweg Reischach", exactly as the trail,
    // and carries 25% of it.
    const item = campaignItem(trail({ name:'Rundweg Reischach' }),
      { seceda:check({ relationName:'Rundweg Reischach', pathContainmentPercent:25 }) });

    expect(item.identityCheck).toMatchObject({ reason:'relation-covers-part-of-the-route' });
  });

  test('a fragmented reconstruction is judged on coverage like any other', () => {
    expect(campaignItem(trail(), { seceda:check({ componentCount:4, pathContainmentPercent:97 }) })
      .identityCheck).toBeNull();
  });

  test('a check taken before coverage was measured condemns nobody', () => {
    expect(campaignItem(trail(), { seceda:check({ pathContainmentPercent:null }) })
      .identityCheck).toBeNull();
  });

  test('the threshold tolerates a path that strays at a point or two', () => {
    expect(identityContradiction(trail(), { seceda:check({ pathContainmentPercent:90 }) })).toBeNull();
    expect(identityContradiction(trail(), { seceda:check({ pathContainmentPercent:89 }) }))
      .toMatchObject({ reason:'relation-covers-part-of-the-route' });
  });
});

describe('measuring coverage', () => {
  const relation = { geometry:{ coordinates:LOOP.map(([lat, lng]) => [lng, lat]) } };

  test('a path drawn on the relation is fully covered', () => {
    expect(pathContainmentPercent(trail(), relation)).toBe(100);
  });

  test('a path that leaves the relation is not', () => {
    const away = trail({ path:[LOOP[0], [46.20, 11.20], [46.30, 11.30], [46.40, 11.40]] });
    expect(pathContainmentPercent(away, relation)).toBe(25);
  });

  test('coverage is unmeasurable without a path or a reconstruction', () => {
    expect(pathContainmentPercent(trail({ path:[] }), relation)).toBeNull();
    expect(pathContainmentPercent(trail(), { geometry:{ coordinates:[] } })).toBeNull();
  });
});

describe('the batch reports what the reconstruction found', () => {
  const campaign = { generatedAt:'2026-09-05T20:00:00.000Z',
    jobs:[{ id:'job-1', candidateId:'seceda', action:'verify-current-relation', agentId:'cartographer' }] };

  function result(overrides = {}){
    return { candidateId:'seceda', reviewState:'blocked', blockers:['official-distance-conflict'],
      assessment:{ issues:['not-closed-loop'] }, components:[{}],
      comparison:{ reconstructedDistanceKm:8.81, officialDistanceKm:10.8, distanceDeltaPercent:-18.4 },
      geometry:{ coordinates:LOOP.map(([lat, lng]) => [lng, lat]) },
      source:{ externalId:'relation/6528494' }, generatedAt:'2026-09-05T20:01:00.000Z', ...overrides };
  }

  async function run(value){
    return runCatalogueBatch(campaign, [trail()], { at:'2026-09-05T20:01:00.000Z',
      runCartographer: async () => value });
  }

  test('a blocked reconstruction is not reported as ready for a human', async () => {
    // Both branches of this used to say `needs-human`, so a failed identity
    // check was counted as a route waiting for the operator's approval.
    const execution = await run(result());

    expect(execution.jobs[0].status).toBe('blocked');
    expect(execution.summary).toMatchObject({ attempted:1, needsHuman:0, blocked:1, failed:0 });
  });

  test('it measures coverage against the trail it was checking', async () => {
    const execution = await run(result());

    expect(execution.identityChecks.seceda).toMatchObject({
      externalRelationId:'relation/6528494', pathContainmentPercent:100,
      checkedAt:'2026-09-05T20:01:00.000Z', reviewState:'blocked' });
  });

  test('a clean reconstruction still goes to the geometry gate', async () => {
    const execution = await run(result({ reviewState:'ready-for-human-review',
      blockers:[], assessment:{ issues:[] } }));

    expect(execution.jobs[0].status).toBe('needs-human');
  });
});

describe('loop detection', () => {
  test('a path that returns to its start is a loop', () => {
    expect(pathIsClosedLoop(trail())).toBe(true);
  });

  test('a path that ends 4 km away is not', () => {
    expect(pathIsClosedLoop(trail({ path:LINE }))).toBe(false);
  });
});
