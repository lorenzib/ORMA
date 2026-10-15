'use strict';

/**
 * Spending the scout's budget on walks somebody has actually published.
 *
 * Measured 16 October 2026: of the 60 catalogue trails that can cite nothing,
 * 24 are generic village loops no board has ever written up, and the scout was
 * reaching them before walks with a real description because it took the queue
 * in order. The slugs below are the ones the portal actually returned that day,
 * so the matcher is tested against what it will meet rather than a tidied-up
 * invention of the same shape.
 */

const { PORTALS, portalFor, slugKeys, probeName, slugIsWalk, probeLead, leadsFirst } =
  require('./workflows/route-source-leads');

// Verbatim from suedtirol.live, 16 October 2026.
const SLUGS = Object.freeze({
  toblach: 'toblacher-hoehenweg-t20294',
  grosseSchloss: 'die-grosse-schlossrunde-t23624',
  karerSee: 'mittlerer-rundweg-am-karer-see-t20080',
  rodaDlesViles: 'roda-dles-viles-weilerrundgang-t18750',
  // The page five different "Rundweg X" walks were once all matched to.
  trejerAlm: 'rundweg-trejer-alm-aeussere-michlreis-alm-sonnklar-nock-t19868',
});

const results = slugs => `<html><body>${slugs
  .map(slug => `<a href="/de/tour/${slug}">tour</a>`).join('')}</body></html>`;

const page = slugs => async () => ({ ok: true, status: 200,
  text: async () => results(slugs) });

const trail = (over = {}) => ({ id: 'osm-1', name: 'Toblacher Höhenweg',
  province: 'alto-adige', ...over });

describe('a walk is looked up by the name a portal would index it under', () => {
  test('a German slug spells an umlaut oe, and the name still matches', () => {
    // The bug this exists for: stripping the diaeresis gives "hohenweg", which
    // is in no slug anywhere, so every umlaut name missed. Both spellings are
    // generated.
    expect(slugKeys('Toblacher Höhenweg')).toContain('toblacher-hoehenweg');
    expect(slugIsWalk(SLUGS.toblach, slugKeys('Toblacher Höhenweg'))).toBe(true);
  });

  test('an eszett spells ss', () => {
    expect(slugIsWalk(SLUGS.grosseSchloss, slugKeys('Große Schlossrunde'))).toBe(true);
  });

  test('an Italian or Ladin name keeps its plain spelling', () => {
    expect(slugIsWalk(SLUGS.rodaDlesViles, slugKeys('Roda dles Viles'))).toBe(true);
    expect(slugIsWalk(SLUGS.karerSee, slugKeys('Mittlerer Rundweg am Karer See'))).toBe(true);
  });

  test('a walk named in two languages is looked up under one of them', () => {
    // OSM carries the double; a portal indexes one side, so the whole string
    // matches neither.
    expect(probeName('Ruine Castelfeder - Rovine Castelfeder')).toBe('Ruine Castelfeder');
  });

  test('the generic head of a name never carries a match', () => {
    // The other bug: "Rundweg Peitlerkofel", "Rundweg Kasserol" and
    // "Rundweg Reischach" all contain "rundweg", and all three were once
    // matched to this one unrelated page.
    for(const name of ['Rundweg Peitlerkofel', 'Rundweg Kasserol', 'Rundweg Reischach']){
      expect(slugIsWalk(SLUGS.trejerAlm, slugKeys(name))).toBe(false);
    }
  });

  test('a name too short to identify anything is not looked up', async () => {
    const result = await probeLead(trail({ name: 'archeo' }), { fetchImpl: page([]) });
    expect(result.lead).toBe('unknown');
    expect(result.reason).toBe('name-too-short-to-look-up');
  });
});

describe('what the portal says, and what it cannot say', () => {
  test('a walk the portal has is a lead, with the page it was found at', async () => {
    const result = await probeLead(trail(), { fetchImpl: page([SLUGS.trejerAlm, SLUGS.toblach]) });
    expect(result).toEqual(expect.objectContaining({ lead: 'likely',
      portal: 'suedtirol.live', slug: SLUGS.toblach }));
  });

  test('a walk it does not have is unlikely, not unknown', async () => {
    const result = await probeLead(trail({ name: 'Kranterrunde' }), { fetchImpl: page([]) });
    expect(result.lead).toBe('unlikely');
  });

  test('an area no portal covers is unknown, so the walk keeps its place', async () => {
    // Savoy. The one portal that answers a plain request is South Tyrol's, and
    // a walk nobody could look up must not be demoted below one looked up and
    // found absent.
    const result = await probeLead(trail({ name: 'La Croix des Salles', province: 'savoie' }),
      { fetchImpl: page([]) });
    expect(result.lead).toBe('unknown');
    expect(result.reason).toBe('no-portal-covers-this-area');
    expect(portalFor({ province: 'savoie' })).toBeNull();
  });

  test('a portal that is down is unknown and never throws', async () => {
    const down = await probeLead(trail(), { fetchImpl: async () => { throw new Error('ECONNRESET'); } });
    expect(down.lead).toBe('unknown');
    const refused = await probeLead(trail(), { fetchImpl: async () => ({ ok: false, status: 503 }) });
    expect(refused.lead).toBe('unknown');
    expect(refused.reason).toBe('HTTP 503');
  });

  test('every portal declares where it is trustworthy', () => {
    for(const portal of PORTALS){
      expect(portal.provinces.length).toBeGreaterThan(0);
      expect(portal.search('x')).toMatch(/^https:\/\//);
    }
  });
});

describe('the budget goes to the leads, and nothing is dropped', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map(id => trail({ id, name: `Rundweg ${id}` }));
  // b and d are published; the rest are looked up and absent.
  const probe = async candidate => ({ trailId: candidate.id,
    lead: ['b', 'd'].includes(candidate.id) ? 'likely' : 'unlikely' });

  test('the published walks are scouted first', async () => {
    const { batch } = await leadsFirst(five, { limit: 2, probe });
    expect(batch.map(entry => entry.id)).toEqual(['b', 'd']);
  });

  test('a budget bigger than the leads is topped up, not left short', async () => {
    // The guard that keeps this an ordering and not a filter: the pass still
    // scouts as many trails as it would have.
    const { batch } = await leadsFirst(five, { limit: 4, probe });
    expect(batch).toHaveLength(4);
    expect(batch.slice(0, 2).map(entry => entry.id)).toEqual(['b', 'd']);
    expect(batch.slice(2).map(entry => entry.id)).toEqual(['a', 'c']);
  });

  test('no trail is lost, whatever the probe said', async () => {
    const { ordered } = await leadsFirst(five, { limit: 2, probe });
    expect([...ordered.map(entry => entry.id)].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('a walk nobody could look up outranks one looked up and absent', async () => {
    const mixed = [trail({ id: 'absent' }), trail({ id: 'unknowable' })];
    const { ordered } = await leadsFirst(mixed, { limit: 2,
      probe: async candidate => ({ trailId: candidate.id,
        lead: candidate.id === 'absent' ? 'unlikely' : 'unknown' }) });
    expect(ordered.map(entry => entry.id)).toEqual(['unknowable', 'absent']);
  });

  test('within one rank the queue keeps its own order', async () => {
    const { ordered } = await leadsFirst(five, { limit: 1,
      probe: async () => ({ lead: 'unlikely' }) });
    expect(ordered.map(entry => entry.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('it stops asking once the budget is full of leads', async () => {
    // Bounds what a run costs a third party: leads near the front mean a
    // handful of requests, not one per waiting trail.
    let asked = 0;
    await leadsFirst(five, { limit: 1, probe: async candidate => {
      asked += 1; return { trailId: candidate.id, lead: 'likely' }; } });
    expect(asked).toBe(1);
  });

  test('the window caps the requests when nothing is a lead', async () => {
    let asked = 0;
    const { batch } = await leadsFirst(five, { limit: 2, window: 3,
      probe: async () => { asked += 1; return { lead: 'unlikely' }; } });
    expect(asked).toBe(3);
    expect(batch).toHaveLength(2);
  });
});
