const compiler = require('./workflows/compile-operational-facts');
const table = require('../route-operational-facts');
const { materializeApprovedPublications } = require('./workflows/materialize-approved-publications');

const context = { trailId:'seceda', at:'2026-09-05T10:00:00Z', verifiedBy:'ORMA Regulatory Ranger' };

function claim(overrides = {}){
  return {
    id:'rifugio-dog-policy',
    state:'supported',
    entityName:'Rifugio Fuciade',
    rule:'accepted-leashed',
    observedAt:'2026-08-14',
    sourceIds:['source-1'],
    ...overrides,
  };
}

describe('Regulatory Ranger claims become operational facts', () => {
  test.each(['constructor','toString','__proto__','hasOwnProperty'])(
    'the inherited key %s is not a rule or an entity type', key => {
      expect(compiler.operationalFactsFromClaims([claim({ rule:key })], context)).toEqual([]);
      expect(compiler.operationalFactsFromClaims([claim({ id:key })], context)).toEqual([]);
    });

  test('a supported, dated, sourced claim becomes a valid fact', () => {
    const [fact] = compiler.operationalFactsFromClaims([claim({ notes:'Not in the dining room.' })], context);

    expect(fact).toEqual(expect.objectContaining({
      trail_id:'seceda',
      entity_type:'rifugio',
      entity_name:'Rifugio Fuciade',
      dog_policy:'accepted_leashed',
      policy_notes:'Not in the dining room.',
      verified_at:'2026-08-14',
      verified_source:'website',
    }));
    expect(table.validateFact(fact, 0)).toEqual([]);
  });

  test('lifts are the same work at the same gate', () => {
    const [fact] = compiler.operationalFactsFromClaims([claim({
      id:'lift-dog-policy', entityName:'Col Margherita cable car', rule:'accepted-muzzled',
    })], context);

    expect(fact.entity_type).toBe('lift');
    expect(fact.dog_policy).toBe('accepted_muzzled');
  });

  test('a claim the Ranger could not support is not a fact', () => {
    expect(compiler.operationalFactsFromClaims([claim({ state:'unsupported' })], context)).toEqual([]);
    expect(compiler.operationalFactsFromClaims([claim({ state:'disputed' })], context)).toEqual([]);
  });

  test('an undated claim is skipped rather than stamped with today', () => {
    // The twelve-month staleness rule reads verified_at. Falling back to the
    // publication run's clock would assert a verification nobody performed.
    expect(compiler.operationalFactsFromClaims([claim({ observedAt:null, verifiedAt:null })], context))
      .toEqual([]);
  });

  test('an unsourced claim is skipped', () => {
    expect(compiler.operationalFactsFromClaims([claim({ sourceIds:[], verifiedSource:null })], context))
      .toEqual([]);
  });

  test('a rule the table does not model is left for a human', () => {
    // Mapping "dogs welcome in the garden only" onto the nearest enum is how a
    // safety page starts telling people things nobody said.
    expect(compiler.operationalFactsFromClaims([claim({ rule:'garden-only' })], context)).toEqual([]);
  });

  test('contact-required is recorded as unknown, which is a real answer', () => {
    // The Ranger marks ambiguity rather than choosing the convenient rule.
    // "Somebody asked and no rule is published" is worth keeping.
    const [fact] = compiler.operationalFactsFromClaims([claim({ rule:'contact-required' })], context);
    expect(fact.dog_policy).toBe('unknown');
  });

  test('route-level claims are not entity facts', () => {
    expect(compiler.operationalFactsFromClaims([
      { id:'dog-access', state:'supported', proposedValue:'accepted' },
      { id:'leash-rules', state:'supported', proposedValue:'accepted-leashed' },
    ], context)).toEqual([]);
  });
});

describe('merging facts into the table', () => {
  const empty = { contractVersion:'1.0.0', updatedAt:null, facts:[] };

  test('re-materialising the same fact changes nothing', () => {
    const facts = compiler.operationalFactsFromClaims([claim()], context);
    const first = compiler.mergeOperationalFacts(empty, facts, '2026-09-05T10:00:00Z');
    const second = compiler.mergeOperationalFacts(first.table, facts, '2026-09-06T10:00:00Z');

    expect(first.changed).toBe(1);
    expect(second.changed).toBe(0);
    expect(second.table.updatedAt).toBe('2026-09-05');
  });

  test('a newer verification replaces the earlier one for that entity', () => {
    const before = compiler.mergeOperationalFacts(empty,
      compiler.operationalFactsFromClaims([claim()], context), '2026-09-05T10:00:00Z');
    const after = compiler.mergeOperationalFacts(before.table,
      compiler.operationalFactsFromClaims([claim({ rule:'not-accepted', observedAt:'2026-09-01' })], context),
      '2026-09-05T10:00:00Z');

    expect(after.table.facts).toHaveLength(1);
    expect(after.table.facts[0].dog_policy).toBe('not_accepted');
    expect(after.table.facts[0].verified_at).toBe('2026-09-01');
  });

  test('another trail\'s facts are never disturbed', () => {
    const other = { ...empty, facts:[{
      id:'tre-cime-rifugio-auronzo', trail_id:'tre-cime', entity_type:'rifugio',
      entity_name:'Rifugio Auronzo', dog_policy:'accepted', policy_notes:null,
      verified_at:'2026-07-01', verified_source:'phone', verified_by:'Benedetta',
    }] };
    const merged = compiler.mergeOperationalFacts(other,
      compiler.operationalFactsFromClaims([claim()], context), '2026-09-05T10:00:00Z');

    expect(merged.table.facts).toHaveLength(2);
    expect(merged.table.facts.find(f => f.trail_id === 'tre-cime').verified_by).toBe('Benedetta');
    expect(table.validateTable(merged.table)).toEqual([]);
  });
});

describe('facts only reach the table through the publication gate', () => {
  test('an approved publication carries its facts; nothing else does', () => {
    const at = '2026-09-05T10:00:00Z';
    const result = materializeApprovedPublications({
      requests:{ requests:[{ id:'approval-1', candidateId:'cand-1', status:'approved-for-pr-creation', approvedBy:'Benedetta' }] },
      staging:{ items:[{
        candidateId:'cand-1',
        targetTrailId:'seceda',
        state:'ready-for-publication-preview',
        proposedWebsiteFields:{ name:'Seceda' },
        proposedOperationalClaims:[claim()],
      }] },
      routesByCandidate:{ 'cand-1':{ geometry:{ coordinates:[[11.5, 46.5], [11.6, 46.6]] } } },
      overrides:{ contractVersion:'1.0.0', trails:[] },
      operationalFacts:{ contractVersion:'1.0.0', updatedAt:null, facts:[] },
      at,
    });

    expect(result.materialized).toBe(1);
    expect(result.operationalFactsChanged).toBe(1);
    expect(result.operationalFacts.facts[0].entity_name).toBe('Rifugio Fuciade');
    // The approver is recorded, not the agent, because the approval is what
    // makes the fact publishable.
    expect(result.operationalFacts.facts[0].verified_by).toBe('Benedetta');
    expect(table.validateTable(result.operationalFacts)).toEqual([]);
  });

  test('a publication with no operational claims leaves the table alone', () => {
    const result = materializeApprovedPublications({
      requests:{ requests:[{ id:'approval-2', candidateId:'cand-2', status:'approved-for-pr-creation' }] },
      staging:{ items:[{
        candidateId:'cand-2', targetTrailId:'cadini', state:'ready-for-publication-preview',
        proposedWebsiteFields:{ name:'Cadini' },
      }] },
      routesByCandidate:{ 'cand-2':{ geometry:{ coordinates:[[12.3, 46.6], [12.4, 46.7]] } } },
      overrides:{ contractVersion:'1.0.0', trails:[] },
      operationalFacts:{ contractVersion:'1.0.0', updatedAt:null, facts:[] },
      at:'2026-09-05T10:00:00Z',
    });

    expect(result.materialized).toBe(1);
    expect(result.operationalFactsChanged).toBe(0);
    expect(result.operationalFacts.facts).toEqual([]);
  });
});
