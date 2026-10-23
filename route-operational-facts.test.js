const fs = require('fs');
const path = require('path');
const facts = require('./route-operational-facts.js');

const shipped = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'route-operational-facts.json'), 'utf8')
);

function table(rows){
  return { contractVersion:facts.CONTRACT_VERSION, updatedAt:null, facts:rows };
}

const verifiedRifugio = {
  id:'fuciade-dogs',
  trail_id:'tre-cime',
  entity_type:'rifugio',
  entity_name:'Rifugio Fuciade',
  dog_policy:'accepted_leashed',
  policy_notes:'Not in the dining room.',
  verified_at:'2026-08-14',
  verified_source:'phone',
  verified_by:'ORMA owner',
};

const trail = { id:'tre-cime', rifugi:[{ km:6.5, name:'Baita Troier' }] };

describe('P0-2 route operational facts', () => {
  test('the shipped table is valid and deliberately empty', () => {
    expect(facts.validateTable(shipped)).toEqual([]);
    expect(shipped.facts).toEqual([]);
  });

  // Scenario: trail with verified operational data
  test('a verified fact shows its policy and the month it was checked', () => {
    const [row] = facts.rowsFor({ id:'tre-cime' }, table([verifiedRifugio]), '2026-09-05');

    expect(row.entityName).toBe('Rifugio Fuciade');
    expect(row.policyLabel).toBe('dogs accepted, leashed');
    expect(row.notes).toBe('Not in the dining room.');
    expect(row.state).toBe('verified');
    expect(row.label).toBe('Verified Aug 2026');
  });

  // Scenario: trail without verified data
  test('an unchecked place is not listed at all', () => {
    // 473 such places across 110 trails were each stamped "not yet verified";
    // a list of things nobody has checked is not something to act on.
    expect(facts.rowsFor(trail, shipped, '2026-09-05')).toEqual([]);
    // A checked fact on the same trail is still listed, and only that.
    expect(facts.rowsFor(trail, table([verifiedRifugio]), '2026-09-05').map(row => row.entityName))
      .toEqual(['Rifugio Fuciade']);
  });

  test('an undated fact is not listed either', () => {
    const undated = {
      ...verifiedRifugio, dog_policy:'unknown', verified_at:null, verified_source:null, verified_by:null,
    };
    expect(facts.validateFact(undated, 0)).toEqual([]);
    expect(facts.rowsFor({ id:'tre-cime' }, table([undated]), '2026-09-05')).toEqual([]);
  });

  // Scenario: verification age is visible
  test('a fact older than twelve months says so', () => {
    const stale = { ...verifiedRifugio, verified_at:'2025-07-02' };
    const [row] = facts.rowsFor({ id:'tre-cime' }, table([stale]), '2026-09-05');

    expect(row.state).toBe('stale');
    expect(row.label).toBe('Last verified Jul 2025, may have changed');
    // The policy is still shown: it was checked, just a while ago.
    expect(row.policyLabel).toBe('dogs accepted, leashed');
  });

  test('twelve months is the boundary, and it is inclusive', () => {
    const asOf = '2026-09-05';
    const justInside = { ...verifiedRifugio, verified_at:'2025-10-01' };
    const justOutside = { ...verifiedRifugio, verified_at:'2025-09-01' };

    expect(facts.verification(justInside, asOf).state).toBe('verified');
    expect(facts.verification(justOutside, asOf).state).toBe('stale');
  });

  test('a policy with nothing standing behind it is rejected outright', () => {
    // An unattributable policy on a dog-safety page is worse than none.
    const unattributed = { ...verifiedRifugio, verified_at:null, verified_source:null, verified_by:null };
    expect(facts.validateFact(unattributed, 0)).toEqual([
      expect.stringContaining("may only record 'unknown'"),
    ]);

    const noReviewer = { ...verifiedRifugio, verified_by:'' };
    expect(facts.validateFact(noReviewer, 0)).toEqual([
      expect.stringContaining('verified_by'),
    ]);
  });

  test('"unknown" is a recorded answer, distinct from unverified', () => {
    // Somebody asked and the policy is not published. That is a fact.
    const asked = {
      ...verifiedRifugio, dog_policy:'unknown', policy_notes:'No published dog rule.',
    };
    expect(facts.validateFact(asked, 0)).toEqual([]);
    const [row] = facts.rowsFor({ id:'tre-cime' }, table([asked]), '2026-09-05');
    expect(row.policyLabel).toBe('policy not published');
    expect(row.state).toBe('verified');
  });

  test('rows read in name order', () => {
    const second = { ...verifiedRifugio, id:'lavaredo-dogs', entity_name:'Rifugio Auronzo' };
    expect(facts.rowsFor({ id:'tre-cime' }, table([verifiedRifugio, second]), '2026-09-05').map(row => row.entityName))
      .toEqual(['Rifugio Auronzo', 'Rifugio Fuciade']);
  });

  test('duplicate ids are refused so the table stays a plain key-addressable table', () => {
    const errors = facts.validateTable(table([verifiedRifugio, { ...verifiedRifugio }]));
    expect(errors).toEqual([expect.stringContaining('duplicate id')]);
  });

  test('the trail page renders the block and ships the module', () => {
    const trailJs = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    const bundle = fs.readFileSync(path.join(__dirname, 'trail-app.bundle.js'), 'utf8');

    expect(trailJs).toContain('On this route');
    expect(trailJs).toContain('renderOnThisRoute');
    expect(bundle).toContain('// ---- route-operational-facts.js ----');
  });
});
