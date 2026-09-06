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
  verified_by:'Benedetta',
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
  test('an unchecked place is named and labelled, never given a policy', () => {
    const [row] = facts.rowsFor(trail, shipped, '2026-09-05');

    expect(row.entityName).toBe('Baita Troier');
    expect(row.km).toBe(6.5);
    // The acceptance criterion is explicit: never a guessed or empty policy.
    expect(row.policy).toBeNull();
    expect(row.policyLabel).toBeNull();
    expect(row.label).toBe('Not yet verified, check before you go');
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

  test('rows read in walking order', () => {
    const withKm = { id:'tre-cime', rifugi:[{ km:6.5, name:'Baita Troier' }, { km:2.1, name:'Rifugio Lavaredo' }] };
    expect(facts.rowsFor(withKm, shipped, '2026-09-05').map(row => row.entityName))
      .toEqual(['Rifugio Lavaredo', 'Baita Troier']);
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
