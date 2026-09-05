const { runTrailSpecialist } = require('./workflows/run-trail-specialist');
const { compileVerifiedDossier } = require('./workflows/compile-verified-dossier');
const { operationalFactsFromClaims } = require('./workflows/compile-operational-facts');

// These tests run the seam, not the pieces. Each piece passed its own tests
// while the pipeline produced nothing: the dossier namespaces a claim id by its
// agent, so a compiler matching on the Ranger's own id never matched anything.
// Everything here therefore starts at the specialist and ends at the table.

const AT = '2026-09-05T09:00:00.000Z';

function source(overrides = {}){
  return { label:'Seceda Cableways, summer access and dog ticket', url:'https://www.seceda.it/en/tickets',
    authority:'Seceda Cableways', accessedAt:'2026-09-02', ...overrides };
}

function claim(overrides = {}){
  return { id:'rifugio-dog-policy', category:'access', proposedValue:'Dogs welcome on the terrace on a lead',
    finding:'supported-proposal', confidence:0.8, rationale:'Operator states dogs welcome outdoors on a lead.',
    sources:[source()], blockers:[], entityName:'Rifugio Firenze', rule:'accepted-leashed',
    observedAt:'2026-09-02', ...overrides };
}

// The dossier gate demands authoritative route guidance before anything is
// verified, so a Ranger claim can only be tested behind a passing Logistics set.
const LOGISTICS = ['recommended-start','route-number-status','route-number-sequence','route-number-switches']
  .map(id => ({ id, category:id === 'recommended-start' ? 'parking' : 'route', proposedValue:'Established from the operator route description',
    finding:'supported-proposal', confidence:0.9, rationale:'Operator map.', sources:[source()], blockers:[],
    entityName:null, rule:'not-applicable', observedAt:null }));

async function specialist(agentId, claims, trail){
  const runAgent = async () => ({ data:{ summary:'', claims, openQuestions:[], recommendation:'advance' },
    responseId:'test', model:'test' });
  const { result } = await runTrailSpecialist(
    { job:{ agentId, action:'verify-dog-and-seasonal-rules', candidateId:trail.candidateId }, trail, context:[] },
    { runAgent, at:AT });
  return { agentId, jobId:`${trail.trailId}-${agentId}`, result };
}

async function factsFor(claims, trailId = 'seceda'){
  const trail = { candidateId:`cand-${trailId}`, trailId, trailName:trailId, sourceTrail:{} };
  const review = { reviewId:`rev-${trailId}`, approvalAllowed:true,
    specialistOutputs:[await specialist('logistics', LOGISTICS, trail), await specialist('regulatoryRanger', claims, trail)] };
  const dossier = compileVerifiedDossier(review, trail, { at:AT });
  return { dossier, facts:operationalFactsFromClaims(dossier.claims, { trailId }) };
}

describe('a Ranger claim reaches the operational facts table', () => {
  test('a rifugio and a lift on one route become two facts', async () => {
    const { facts } = await factsFor([
      claim(),
      claim({ id:'lift-dog-policy', entityName:'Seceda Cableway', rule:'accepted-leashed',
        proposedValue:'Dogs carried with a dog ticket, on a lead in the cabin' }),
      // A route-level claim is not about one entity and must not become a row.
      claim({ id:'dog-access', proposedValue:'Dogs permitted on the ridge path',
        entityName:null, rule:'not-applicable', observedAt:null }),
    ]);

    expect(facts.map(fact => [fact.entity_type, fact.entity_name, fact.dog_policy])).toEqual([
      ['rifugio','Rifugio Firenze','accepted_leashed'],
      ['lift','Seceda Cableway','accepted_leashed'],
    ]);
  });

  test('the dossier keeps the agent id the compiler matches on', async () => {
    const { dossier } = await factsFor([claim()]);
    const entry = dossier.claims.find(item => item.claimId === 'rifugio-dog-policy');

    expect(entry.id).toBe('regulatoryRanger-rifugio-dog-policy');
    expect(entry).toMatchObject({ agentId:'regulatoryRanger', entityName:'Rifugio Firenze',
      rule:'accepted-leashed', observedAt:'2026-09-02' });
  });

  test('an unresolved finding is not a verified fact, even in an accepted dossier', async () => {
    // An accepted dossier marks every claim supported, because that is what the
    // human accepted it to mean. Accepting a record that no rule is published
    // accepts the absence, not a policy.
    const { dossier, facts } = await factsFor([
      claim({ finding:'unresolved', rule:'contact-required', entityName:'Rifugio Auronzo',
        proposedValue:'No dog rule published; a walker must ask', blockers:['no published policy'] }),
    ], 'tre-cime');

    expect(dossier.claims.find(item => item.claimId === 'rifugio-dog-policy').state).toBe('supported');
    expect(facts).toEqual([]);
  });

  test('a supported entity policy with no observation date fails the job', async () => {
    // The twelve-month staleness rule reads that date. Dropping the claim quietly
    // would let the Ranger keep making the same mistake unseen, so the job fails.
    await expect(factsFor([claim({ observedAt:null })]))
      .rejects.toThrow(/requires the date its source was read/);
  });

  test('a supported entity policy with no entity fails the job', async () => {
    await expect(factsFor([claim({ entityName:'  ' })]))
      .rejects.toThrow(/requires the entity it is about/);
  });

  test('a rule outside the published vocabulary fails the job', async () => {
    await expect(factsFor([claim({ rule:'dogs ok in summer' })]))
      .rejects.toThrow(/requires a rule from the published vocabulary/);
  });

  test('an unresolved claim may stay vague without failing the job', async () => {
    const { facts } = await factsFor([
      claim({ finding:'unresolved', entityName:null, rule:'not-applicable', observedAt:null,
        proposedValue:'Could not establish a rule', blockers:['no source'] }),
    ]);

    expect(facts).toEqual([]);
  });
});
