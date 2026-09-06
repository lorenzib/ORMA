const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { applyRouteNumberEvidence } = require('./scripts/route-number-evidence');

// routeNumberStatus decides whether a trail can ever clear the verification
// gate, which asks for supported authoritative route guidance. It used to be
// derived only while generating site data, so the backoffice campaign ranked
// candidates without it: 3 of 165 trails carried the field, and the queue
// filled with routes that cannot produce route guidance at all.

const root = __dirname;

function statusFromGeneratedSiteData(){
  const found = new Map();
  for(const region of ['dolomites', 'savoy']){
    const source = fs.readFileSync(path.join(root, 'data/regions', `${region}-trails.js`), 'utf8');
    for(const chunk of source.split(/"id"\s*:/).slice(1)){
      const id = (chunk.match(/^\s*"([^"]+)"/) || [])[1];
      const status = (chunk.match(/"routeNumberStatus"\s*:\s*"([^"]*)"/) || [])[1];
      if(id && status) found.set(id, status);
    }
  }
  return found;
}

describe('the campaign sees the same route numbers the site does', () => {
  const production = loadProductionTrails(root);

  test('every production trail carries a route number status', () => {
    const missing = production.filter(trail => !trail.routeNumberStatus).map(trail => trail.id);
    expect(missing).toEqual([]);
  });

  // The point of the shared module: one derivation, so the two cannot drift.
  test('production status matches the generated site data exactly', () => {
    const site = statusFromGeneratedSiteData();
    const disagreements = production
      .filter(trail => site.has(trail.id) && site.get(trail.id) !== trail.routeNumberStatus)
      .map(trail => `${trail.id}: site=${site.get(trail.id)} production=${trail.routeNumberStatus}`);
    expect(disagreements).toEqual([]);
    expect(site.size).toBeGreaterThan(0);
  });

  test('a trail that already declares a status keeps it', () => {
    const [kept] = applyRouteNumberEvidence(
      [{ id:'x', routeNumberStatus:'official-numbered-route' }], root);
    expect(kept.routeNumberStatus).toBe('official-numbered-route');
  });

  test('a trail with no mapped relation is pending, not unavailable', () => {
    // "Not listed in the mapped source" is a finding; "pending" is the absence
    // of one. Collapsing them would tell the campaign a trail is hopeless when
    // nobody has looked yet.
    const [pending] = applyRouteNumberEvidence([{ id:'y', osmRelation:'no-such-relation' }], root);
    expect(pending.routeNumberStatus).toBe('verification-pending');
  });

  test('enough trails can clear the gate to fill the queue', () => {
    const obtainable = new Set(['mapped-relation-ref','official-numbered-route','official-landmark-route','documented']);
    const canClear = production.filter(trail => obtainable.has(trail.routeNumberStatus));
    // 10 admissions a day; this is what the campaign now has to choose from.
    expect(canClear.length).toBeGreaterThanOrEqual(40);
  });
});
