'use strict';

const {latestCartographerJobId,findTrail,readGeometryAudit}=require('./workflows/geometry-audit-read');
const {main}=require('./cli/show-geometry-audit');

/**
 * The gate records a blocker's name and nothing else, and once the evidence
 * policy decides a gate the trail leaves the queue -- so every other reader
 * finds nothing and the measurement behind the verdict is unreachable.
 */

const job=(agent,n,stamp)=>`trail-verification-osm-1-${agent}-${n}-${stamp}`;
const trail=(overrides={})=>({trailId:'osm-1',candidateId:'osm-1',state:'rejected',
  jobIds:[job('cartographer',6,'2026-10-12T22-43-21-515Z'),job('terrainPoi',2,'2026-10-12T23-00-00-000Z'),
    job('cartographer',7,'2026-10-13T01-00-00-000Z')],...overrides});
const assessment=(overrides={})=>({assessment:{status:'rejected',routeShape:null,circular:true,
  isClosed:false,closureDistanceM:812,distanceKm:6.7,maxSegmentM:94,pointCount:147,
  issues:['not-closed-loop'],...overrides}});

describe('finding the pass that produced the verdict',()=>{
  test('the newest cartographer job is taken, not the newest job',()=>{
    expect(latestCartographerJobId(trail())).toBe(job('cartographer',7,'2026-10-13T01-00-00-000Z'));
  });

  test('a trail with no cartographer pass yields nothing rather than guessing',()=>{
    expect(latestCartographerJobId({jobIds:[job('terrainPoi',1,'x')]})).toBeNull();
    expect(latestCartographerJobId({})).toBeNull();
  });

  test('a trail is found by either of its ids',()=>{
    const orchestration={trails:[trail()]};
    expect(findTrail(orchestration,'osm-1')).not.toBeNull();
    expect(findTrail(orchestration,'nope')).toBeNull();
    expect(findTrail(null,'osm-1')).toBeNull();
  });
});

describe('what the check measured',()=>{
  test('the gap and the verdict are both read, not just the blocker name',()=>{
    const audit=readGeometryAudit(assessment());
    expect(audit).toEqual(expect.objectContaining({
      isClosed:false,closureDistanceM:812,issues:['not-closed-loop'],distanceKm:6.7}));
  });

  // The distinction the blocker's name hides: whether the closure test applied
  // at all. An undeclared route is assumed circular and then faulted.
  test('it says whether the closure test applied and on what declaration',()=>{
    const audit=readGeometryAudit(assessment({routeShape:null,circular:true}));
    expect(audit.circular).toBe(true);
    expect(audit.routeShape).toBeNull();
    expect(readGeometryAudit(assessment({routeShape:'out-and-back',circular:false})).circular).toBe(false);
  });

  test('an output with no assessment reads as nothing rather than throwing',()=>{
    expect(readGeometryAudit(null)).toBeNull();
    expect(readGeometryAudit({})).toBeNull();
  });

  test('route conformance travels with it when the pass measured it',()=>{
    const audit=readGeometryAudit({...assessment(),routeConformance:{status:'follows',offRouteKm:0.2,distanceKm:6.7}});
    expect(audit.routeConformance.status).toBe('follows');
  });
});

describe('the reader end to end',()=>{
  const store=artifacts=>({getArtifact:async id=>artifacts[id]||null});

  test('it reports the audit for a trail the gate has already decided',async()=>{
    const result=await main({argv:['--trail','osm-1'],store:store({
      'trail-orchestration':{trails:[trail()]},
      [`trail-specialist-output-${job('cartographer',7,'2026-10-13T01-00-00-000Z')}`]:assessment(),
    })});
    expect(result).toEqual(expect.objectContaining({closureDistanceM:812,isClosed:false}));
  });

  test('an unknown trail is said so rather than failing',async()=>{
    expect(await main({argv:['--trail','nope'],store:store({'trail-orchestration':{trails:[]}})})).toBeNull();
  });

  // It must refuse without marking the calling process as failed: setting
  // process.exitCode here reported 3523 passing tests and then exit 1.
  test('a missing --trail is refused without failing the caller',async()=>{
    const before=process.exitCode;
    await expect(main({argv:[],store:store({})})).rejects.toThrow('--trail <id> is required');
    expect(process.exitCode).toBe(before);
  });
});
