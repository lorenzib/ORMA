'use strict';

const { discoverRouteComposite, relationsFromPayload } = require('./workflows/discover-route-composite');
const { campaignItem, planCatalogueCampaign } = require('./workflows/plan-catalogue-campaign');
const { buildRoutesNearPathQuery, samplePath } = require('./services/osm-relation-client');

// Many ORMA walks are not one OSM relation. Seceda goes up path 1 and back
// path 1A; the Sassolungo loop runs over three. A check that can only read one
// relation calls every such trail unsourced, which is what stranded them.

// Two straight legs meeting at a corner: a walk up one and back the other.
const LEG_A = [[46.600, 11.700], [46.601, 11.700], [46.602, 11.700], [46.603, 11.700]];
const LEG_B = [[46.603, 11.700], [46.603, 11.701], [46.603, 11.702], [46.603, 11.703]];

function way(id, points){
  return { type:'way', id, geometry:points.map(([lat, lon]) => ({ lat, lon })) };
}
function relation(id, wayIds, tags = {}){
  return { type:'relation', id, tags:{ type:'route', route:'hiking', ...tags },
    members:wayIds.map(ref => ({ type:'way', ref, role:'' })) };
}

const PAYLOAD = { elements:[
  way(101, LEG_A), way(102, LEG_B),
  relation(1, [101], { ref:'1' }),
  relation(2, [102], { ref:'1A' }),
  // A path that touches the walk only at its corner.
  way(103, [[46.603, 11.700], [46.610, 11.740], [46.620, 11.780]]),
  relation(3, [103], { ref:'9', name:'Somewhere else' }),
]};

function trail(overrides = {}){
  return { id:'seceda', name:'Seceda Ridge Trail', curated:false, osmRelation:6528494,
    path:[...LEG_A, ...LEG_B.slice(1)], distance:10.8, ...overrides };
}

describe('discovering the paths a walk follows', () => {
  test('two legs are proposed in the order they are walked', () => {
    const found = discoverRouteComposite(trail(), PAYLOAD);

    expect(found.coveragePercent).toBe(100);
    expect(found.relations.map(entry => entry.ref)).toEqual(['1', '1A']);
    expect(found.relations[0]).toMatchObject({ externalRelationId:'relation/1', coveragePercent:expect.any(Number) });
  });

  test('a path that only touches the walk is not proposed', () => {
    // Relation 3 shares one point. Set cover never picks it, because by then
    // that point is already explained.
    const found = discoverRouteComposite(trail(), PAYLOAD);

    expect(found.relations.map(entry => entry.externalRelationId)).not.toContain('relation/3');
    expect(found.candidateRelationCount).toBe(3);
  });

  test('the set stays as small as the route allows', () => {
    const found = discoverRouteComposite(trail({ path:LEG_A }), PAYLOAD);

    expect(found.relations).toHaveLength(1);
    expect(found.relations[0].ref).toBe('1');
  });

  test('a walk nothing follows is reported as uncovered, not guessed at', () => {
    const elsewhere = trail({ path:[[45.0, 10.0], [45.001, 10.0], [45.002, 10.0]] });
    const found = discoverRouteComposite(elsewhere, PAYLOAD);

    expect(found.coveragePercent).toBe(0);
    expect(found.relations).toEqual([]);
  });

  test('a trail without a usable path yields nothing', () => {
    expect(discoverRouteComposite(trail({ path:[] }), PAYLOAD)).toBeNull();
  });

  test('relations whose ways were not returned are skipped', () => {
    const partial = { elements:[relation(9, [999], { ref:'X' })] };
    expect(relationsFromPayload(partial)).toEqual([]);
  });
});

describe('a composite is a route source only after approval', () => {
  const composite = (state, coveragePercent = 100) => ({ seceda:{ state, coveragePercent,
    relations:[{ externalRelationId:'relation/1' }, { externalRelationId:'relation/2' }] } });
  const checks = { seceda:{ externalRelationId:'relation/6528494', pathContainmentPercent:56 } };

  test('a proposal changes nothing', () => {
    const item = campaignItem(trail(), checks, composite('proposed'));

    expect(item.campaignState).toBe('source-identity-required');
    expect(item.routeComposite).toBeNull();
    expect(item.baselineBlockers).toContain('route-source-identity-contradicted');
  });

  test('an approved composite is a source that covers the walk', () => {
    const item = campaignItem(trail(), checks, composite('approved'));

    expect(item.campaignState).toBe('identity-check-queued');
    expect(item.baselineBlockers).not.toContain('route-source-identity-contradicted');
    expect(item.routeComposite).toEqual({ coveragePercent:100,
      relations:['relation/1', 'relation/2'] });
  });

  test('an approved composite that still misses the walk is not a source', () => {
    const item = campaignItem(trail(), checks, composite('approved', 62));

    expect(item.campaignState).toBe('source-identity-required');
    expect(item.routeComposite).toBeNull();
  });

  test('a rejected composite leaves the trail where it was', () => {
    expect(campaignItem(trail(), checks, composite('rejected')).routeComposite).toBeNull();
  });

  test('an approved composite sources a trail that records no relation at all', () => {
    const item = campaignItem(trail({ id:'seceda', osmRelation:undefined, curated:true }), {}, composite('approved'));

    expect(item.baselineBlockers).not.toContain('route-source-identity-unresolved');
  });

  test('the campaign counts trails sourced this way', () => {
    const campaign = planCatalogueCampaign([trail()], { jobLimit:1, identityChecks:checks,
      composites:composite('approved') });

    expect(campaign.summary.sourcedByComposite).toBe(1);
    expect(campaign.summary.sourceIdentityContradicted).toBe(0);
  });
});

describe('looking for the paths near a walk', () => {
  test('the corridor is sampled so a long trail does not oversize the query', () => {
    const long = Array.from({ length:400 }, (_, index) => [46 + index / 10000, 11]);
    expect(samplePath(long)).toHaveLength(60);
    expect(samplePath(long)[0]).toEqual(long[0]);
    expect(samplePath(long)[59]).toEqual(long[399]);
  });

  test('the query asks only for walking routes and their geometry', () => {
    const query = buildRoutesNearPathQuery([[46.1, 11.1], [46.2, 11.2]], 60);

    expect(query).toContain('rel(around:60,46.1,11.1,46.2,11.2)');
    expect(query).toContain('["route"~"hiking|foot"]');
    expect(query).toContain('out geom;');
  });

  test('a trail with no path cannot be looked up', () => {
    expect(() => buildRoutesNearPathQuery([])).toThrow('drawn path is required');
  });
});

const { ruleOnComposite, rejectComposite } = require('./workflows/discover-route-composite');

// Approving is the moment a proposal becomes a route source, so it rests on a
// fresh measurement rather than on the number discovery happened to store.
describe('ruling on a proposal', () => {
  const proposal = () => ({ state:'proposed', trailName:'Seceda Ridge Trail', coveragePercent:100,
    relations:[{ externalRelationId:'relation/1', ref:'1' }, { externalRelationId:'relation/2', ref:'1A' }] });
  const measured = (overrides = {}) => ({ coveragePercent:100,
    relations:[{ externalRelationId:'relation/1', ref:'1' }, { externalRelationId:'relation/2', ref:'1A' }],
    ...overrides });

  test('a fresh measurement that covers the walk opens the gate', () => {
    const ruled = ruleOnComposite(proposal(), measured(), { approvedBy:'human-moderator', at:'2026-09-06T04:00:00.000Z' });

    expect(ruled.outcome).toBe('approved');
    expect(ruled.composite).toMatchObject({ state:'approved', approvedBy:'human-moderator',
      approvedAt:'2026-09-06T04:00:00.000Z', coveragePercent:100, relationsUnchangedSinceProposal:true });
  });

  test('the approved paths are the ones just measured, not the ones proposed', () => {
    // OSM may have moved between proposal and approval. What gets approved is
    // what is there now, and the record says the two disagreed.
    const ruled = ruleOnComposite(proposal(), measured({
      relations:[{ externalRelationId:'relation/1', ref:'1' }, { externalRelationId:'relation/77', ref:'1B' }] }));

    expect(ruled.composite.relations.map(entry => entry.ref)).toEqual(['1', '1B']);
    expect(ruled.composite.relationsUnchangedSinceProposal).toBe(false);
  });

  test('a proposal that no longer covers the walk is held, not approved', () => {
    const ruled = ruleOnComposite(proposal(), measured({ coveragePercent:71 }));

    expect(ruled.outcome).toBe('held');
    expect(ruled.reason).toBe('covers 71% today');
    expect(ruled.composite.state).toBe('proposed');
  });

  test('a coverage that could not be measured approves nothing', () => {
    expect(ruleOnComposite(proposal(), null).outcome).toBe('held');
    expect(ruleOnComposite(proposal(), null).composite.state).toBe('proposed');
  });

  test('holding leaves the proposal exactly as it was', () => {
    const before = proposal();
    const ruled = ruleOnComposite(before, measured({ coveragePercent:10 }));

    expect(ruled.composite).toEqual(before);
  });

  test('a composite already ruled on is never re-ruled', () => {
    const approved = { ...proposal(), state:'approved' };
    expect(ruleOnComposite(approved, measured()).outcome).toBe('left-alone');
    expect(rejectComposite(approved).outcome).toBe('left-alone');
  });

  test('rejecting records who and when, and is not an approval', () => {
    const ruled = rejectComposite(proposal(), { approvedBy:'human-moderator', at:'2026-09-06T04:00:00.000Z' });

    expect(ruled.composite).toMatchObject({ state:'rejected', rejectedBy:'human-moderator',
      rejectedAt:'2026-09-06T04:00:00.000Z' });
    expect(ruled.composite.approvedAt).toBeUndefined();
  });
});
