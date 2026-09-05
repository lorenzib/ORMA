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

const { buildVerifiedEditorialHandoff } = require('./workflows/verified-editorial-handoff');
const { buildPublicationStaging } = require('./workflows/build-publication-staging');
const { materializeApprovedPublications } = require('./workflows/materialize-approved-publications');

// The chain from an approved Ranger claim to a published row runs through five
// modules. Each one passed its own tests while the chain produced nothing,
// because two of them dropped the fields the last one needs. This test is the
// chain, so a link cannot be removed without a failure.
describe('the whole chain, from Ranger claim to published fact', () => {
  // Tre Cime, the one candidate with both a website target and structured
  // fields already mapped, so the staging item can actually reach publication.
  const CANDIDATE = 'osm-relation-1484751';

  function copyPayload(item){
    return { title:'Tre Cime di Lavaredo Loop', summary:'Locked-fact first pass.',
      changes:item.editorialBrief.requiredSections.map(section => ({ section, before:'None.',
        after:`Verified ${section.toLowerCase()} copy.`, reason:'Uses locked facts.' })),
      sources:[{ label:'Locked ORMA dossier', url:item.dossierRef, checkedAt:'2026-09-05', supports:'All statements' }],
      openQuestions:[] };
  }

  const VISUAL = { searchSummary:'Licensed.', coverageGaps:[], candidates:[{ title:'Tre Cime',
    sourcePageUrl:'https://example.test/photo', assetUrl:'https://example.test/photo.jpg', creator:'Creator',
    license:'CC BY-SA 4.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/', credit:'Creator',
    matchEvidence:'Location.', altText:'Tre Cime.', status:'ready' }] };

  async function publish(rangerClaims){
    const trail = { candidateId:CANDIDATE, trailId:'tre-cime', trailName:'Tre Cime di Lavaredo Loop', sourceTrail:{} };
    const review = { reviewId:'rev-tre-cime', approvalAllowed:true, specialistOutputs:[
      await specialist('logistics', LOGISTICS, trail), await specialist('regulatoryRanger', rangerClaims, trail)] };
    const dossier = compileVerifiedDossier(review, trail, { at:AT });
    const handoff = buildVerifiedEditorialHandoff(dossier,
      { candidateId:CANDIDATE, trailName:trail.trailName, verifiedAt:AT, conditions:[] }, null, { at:AT });
    const staging = buildPublicationStaging(handoff.queue,
      { outputs:[
        { jobId:`verified-${CANDIDATE}-copy`, candidateId:CANDIDATE, agentId:'copywriter', result:copyPayload(handoff.item) },
        { jobId:`verified-${CANDIDATE}-visual`, candidateId:CANDIDATE, agentId:'visualDirector', result:VISUAL }] },
      { submissions:[{ submissionId:'sub-1', decisions:[
        { jobId:`verified-${CANDIDATE}-copy`, action:'approve' },
        { jobId:`verified-${CANDIDATE}-visual`, action:'approve' }] }] }, { at:AT });

    return { staging, result:materializeApprovedPublications({
      requests:{ requests:[{ id:'approval-1', candidateId:CANDIDATE, status:'approved-for-pr-creation',
        approvedBy:'ORMA Regulatory Ranger' }] },
      staging,
      routesByCandidate:{ [CANDIDATE]:{ geometry:{ type:'LineString', coordinates:[[12.29,46.61],[12.30,46.62],[12.29,46.61]] } } },
      overrides:{ contractVersion:'1.0.0', trails:[] },
      operationalFacts:{ contractVersion:'1.0.0', updatedAt:null, facts:[] },
      at:AT }) };
  }

  test('an approved rifugio policy lands in the table with its source and date', async () => {
    const { staging, result } = await publish([
      claim({ entityName:'Rifugio Auronzo', rule:'accepted-leashed',
        proposedValue:'Dogs accepted on the terrace on a lead' }),
      claim({ id:'lift-dog-policy', entityName:'Col de Varda chairlift', rule:'not-accepted',
        proposedValue:'Dogs are not carried' }),
    ]);

    expect(staging.items[0].state).toBe('ready-for-publication-preview');
    expect(result.operationalFactsChanged).toBe(2);
    expect(result.operationalFacts.facts.map(fact => [fact.entity_name, fact.dog_policy, fact.verified_at])).toEqual([
      ['Rifugio Auronzo','accepted_leashed','2026-09-02'],
      ['Col de Varda chairlift','not_accepted','2026-09-02'],
    ]);
    expect(result.operationalFacts.facts[0]).toMatchObject({ trail_id:'tre-cime',
      policy_notes:'Dogs accepted on the terrace on a lead', verified_source:'website' });
  });

  test('publishing a trail with no entity policy touches no facts', async () => {
    const { result } = await publish([
      claim({ id:'dog-access', proposedValue:'Dogs permitted on the loop',
        entityName:null, rule:'not-applicable', observedAt:null }),
    ]);

    expect(result.materialized).toBe(1);
    expect(result.operationalFactsChanged).toBe(0);
    expect(result.operationalFacts.facts).toEqual([]);
  });

  test('an unresolved policy is published as a trail but never as a fact', async () => {
    const { result } = await publish([
      claim({ finding:'unresolved', entityName:'Rifugio Locatelli', rule:'contact-required',
        proposedValue:'No dog rule published', blockers:['no published policy'] }),
    ]);

    expect(result.materialized).toBe(1);
    expect(result.operationalFacts.facts).toEqual([]);
  });
});
