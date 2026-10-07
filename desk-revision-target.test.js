const fs=require('fs');
const source=fs.readFileSync('./trail-verify-desk.js','utf8');

// The desk sent a revision to whichever specialist output happened to be first.
// Six trails sit at the dossier gate blocked entirely on logistics route
// guidance; handing those to terrainPoi returns the same dossier and costs a
// model call to learn nothing.
// The rule now lives in backoffice/revision-target.js, where the worker pass
// that dispatches a standing gate reads the same function. Requiring it means
// these cases cover the rule the automation actually runs, not a copy of it.
const {agentFromBlockers}=require('./backoffice/revision-target');

// The wording comes from the producer; only the claim id varies per case.
const {routeGuidanceBlockingReasons,dossierBlockingReasons}=require('./backoffice/workflows/compile-verified-dossier.js');
const ROUTE_GUIDANCE_SHAPE=routeGuidanceBlockingReasons([])[0];
const ROUTE_GUIDANCE=id=>ROUTE_GUIDANCE_SHAPE.replace(/^logistics\/[^:]+/,`logistics/${id}`);

describe('a revision goes to the agent its blockers name', () => {
  let pick;
  beforeEach(()=>{pick=agentFromBlockers;});

  test('the six dossier-gate trails ask logistics', () => {
    expect(pick(['recommended-start','route-number-status','route-number-sequence','route-number-switches']
      .map(ROUTE_GUIDANCE))).toBe('logistics');
  });

  test('an agent named without a slash is read too', () => {
    expect(pick(['logistics: open question — is the parking usable?',
      'logistics: recommendation is needs-resolution'])).toBe('logistics');
  });

  test('a terrain problem asks terrainPoi', () => {
    expect(pick(['terrainPoi/livestock: five automated resolution strategies exhausted',
      'terrainPoi/shade: conflicted'])).toBe('terrainPoi');
  });

  // Route guidance cannot be waived and only Logistics can supply it, so it is
  // the first revision even when later reviews also left other findings.
  test('mandatory route guidance takes priority in a mixed dossier', () => {
    expect(pick([ROUTE_GUIDANCE('recommended-start'),'terrainPoi/shade: conflicted'])).toBe('logistics');
  });

  test('a concrete official-route geometry conflict is resolved before directions', () => {
    expect(pick([
      ROUTE_GUIDANCE('recommended-start'),
      'regulatoryRanger: open question — Does the 6.6 km supplied OSM geometry exactly correspond to the official 5.5 km loop?',
    ])).toBe('cartographer');
  });

  // The agents more often file that mismatch as a terse claim-status blocker
  // than as prose: evidenceLibrarian/provenance-geometry-and-distance,
  // redTeam/rt3-osm-line-not-closed-as-rendered, rt3-geometry-official-gpx-
  // uncompared. Whoever files it, the line is the cartographer's to settle, so
  // it outranks a heavier terrain load. Built from the producer, osm-16363583's
  // real shape. See [[gate-dispatch-single-agent-gap]].
  test('a terse geometry/GPX claim-status conflict goes to the cartographer, whoever filed it', () => {
    const blockers=dossierBlockingReasons([
      {agentId:'evidenceLibrarian',result:{recommendation:'block',claims:[
        {id:'provenance-geometry-and-distance',finding:'conflicted'}]}},
      {agentId:'redTeam',result:{recommendation:'block',claims:[
        {id:'rt3-osm-line-not-closed-as-rendered',finding:'counter-evidence'},
        {id:'rt3-geometry-official-gpx-uncompared',finding:'unresolved'}]}},
      {agentId:'terrainPoi',result:{recommendation:'block',claims:[
        {id:'shade',finding:'conflicted'},{id:'livestock',finding:'unresolved'}]}},
    ]);
    expect(pick(blockers)).toBe('cartographer');
  });

  test('raw geometry blockers go to the cartographer; unreadable blockers fall back', () => {
    expect(pick(['not-closed-loop'])).toBe('cartographer');
    expect(pick([])).toBeNull();
    expect(pick(undefined)).toBeNull();
    expect(pick([ROUTE_GUIDANCE('recommended-start'),'not-closed-loop'])).toBe('cartographer');
  });
});

describe('the fallback is still there', () => {
  test('it still supplies the first output when no blocker determines an agent', () => {
    expect(source).toContain("agentFromBlockers(item.blockingReasons)||(item.specialistOutputs||[])[0]?.agentId||'auditor'");
  });

  test('both the decision and its submit use the same target', () => {
    const uses=source.split('agentFromBlockers(item.blockingReasons)').length-1;
    expect(uses).toBe(2);
  });
});
