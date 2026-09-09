const {validateSpecialistResult}=require('./workflows/run-trail-specialist.js');
const {operationalFactsFromClaims,POLICY_BY_RULE}=require('./workflows/compile-operational-facts.js');

// osm-10116283 crosses the Plateau des Glières and passes no hut at all, like 92
// of the 165 trails in the catalogue. Its regulatoryRanger job failed validation
// with "Entity policy claim rifugio-dog-policy requires the entity it is about",
// because there was no valid way to say so: naming no entity threw, and
// answering unresolved instead became a dossier gate blocker.
const entityClaim=over=>({id:'rifugio-dog-policy',category:'access',
  proposedValue:'No rifugio, hut or lift lies on this route.',
  finding:'supported-proposal',confidence:1,rationale:'',blockers:[],
  sources:[{label:'Route description',url:'https://example.org/route',
    authority:'municipality',accessedAt:'2026-09-09'}],
  entityName:null,rule:'not-applicable',observedAt:null,...over});

describe('a route with no huts can say so', () => {
  test('a not-applicable entity claim validates', () => {
    expect(()=>validateSpecialistResult({claims:[entityClaim()]},'regulatoryRanger')).not.toThrow();
  });

  test('it needs neither an entity nor a date it was read', () => {
    expect(()=>validateSpecialistResult({claims:[entityClaim({observedAt:null,entityName:null})]},'regulatoryRanger'))
      .not.toThrow();
  });

  // Otherwise it is not a claim about nothing.
  test('but it must not name an entity', () => {
    expect(()=>validateSpecialistResult({claims:[entityClaim({entityName:'Refuge de Gramusset'})]},'regulatoryRanger'))
      .toThrow(/not-applicable but names Refuge de Gramusset/);
  });

  test('not-applicable is exactly what the schema already offered', () => {
    // The schema and prompt allowed it; only the validator refused.
    expect(Object.hasOwn(POLICY_BY_RULE,'not-applicable')).toBe(false);
  });
});

describe('a real hut is still held to the full contract', () => {
  test('a policy claim naming no entity is still refused', () => {
    expect(()=>validateSpecialistResult({claims:[entityClaim({rule:'accepted-leashed',entityName:null})]},'regulatoryRanger'))
      .toThrow(/requires the entity it is about/);
  });

  test('an invented rule is still refused', () => {
    expect(()=>validateSpecialistResult({claims:[entityClaim({rule:'dogs-welcome-ish',entityName:'Refuge X'})]},'regulatoryRanger'))
      .toThrow(/requires a rule from the published vocabulary/);
  });

  test('a policy claim with no reading date is still refused', () => {
    expect(()=>validateSpecialistResult({claims:[entityClaim({rule:'accepted',entityName:'Refuge X',observedAt:null})]},'regulatoryRanger'))
      .toThrow(/requires the date its source was read/);
  });

  test('a supported claim with no source is still refused', () => {
    expect(()=>validateSpecialistResult({claims:[entityClaim({sources:[]})]},'regulatoryRanger'))
      .toThrow(/requires a source/);
  });
});

// A claim about nothing must publish nothing: it must not reach a trail page as
// a hut whose dog policy is blank.
describe('nothing is published for a hut that is not there', () => {
  test('it compiles to no operational fact', () => {
    // The compiler reads accepted dossier claims, which carry state rather than
    // finding, so the fixtures are shaped the way it will actually meet them.
    expect(operationalFactsFromClaims([{...entityClaim(),state:'supported'}],
      {trailId:'osm-10116283'})).toEqual([]);
    // A real hut still compiles to a published fact.
    const real=operationalFactsFromClaims(
      [{...entityClaim({rule:'accepted-leashed',entityName:'Refuge de Gramusset',observedAt:'2026-09-09'}),
        state:'supported',verifiedSource:'website'}],
      {trailId:'osm-10116283'});
    expect(real).toHaveLength(1);
    expect(real[0].entity_name).toBe('Refuge de Gramusset');
  });
});
