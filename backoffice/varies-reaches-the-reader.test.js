const {seasonalSuitabilityFrom}=require('./workflows/build-publication-staging.js');
const scoring=require('../scoring/recommendation-v1.js');

// The engine already knows what to do with a seasonal pasture; nothing was
// carrying the agent's answer to it, so a verified trail told the reader that
// livestock was unknown while declaring livestock a reviewed category.
const livestockFact=over=>({id:'terrainPoi-livestock',claimId:'livestock',agentId:'terrainPoi',
  state:'supported',humanAcceptedFinding:'varies',
  value:'Cattle graze the alpage between June and late September.',
  variesWith:'The grazing season, roughly June to late September.',...over});

describe('a varying livestock claim reaches the trail record', () => {
  test('it becomes the seasonal value the schema already has', () => {
    expect(seasonalSuitabilityFrom({lockedFacts:[livestockFact()]}))
      .toEqual({livestockPresence:'seasonal'});
  });

  test('a livestock claim that did not vary is left alone', () => {
    expect(seasonalSuitabilityFrom({lockedFacts:[livestockFact({humanAcceptedFinding:'supported-proposal'})]}))
      .toBeNull();
    expect(seasonalSuitabilityFrom({lockedFacts:[livestockFact({humanAcceptedFinding:'unresolved'})]}))
      .toBeNull();
  });

  // Reading a sentence for a safety value is how a description that mentions
  // cattle becomes a claim about grazing on the day someone walks.
  test('nothing else is inferred from the claim text', () => {
    expect(Object.keys(seasonalSuitabilityFrom({lockedFacts:[livestockFact()]}))).toEqual(['livestockPresence']);
  });

  test('a trail with no livestock fact proposes nothing', () => {
    expect(seasonalSuitabilityFrom({lockedFacts:[]})).toBeNull();
    expect(seasonalSuitabilityFrom({})).toBeNull();
    expect(seasonalSuitabilityFrom(null)).toBeNull();
  });

  test('the claim keeps what it varies with, so the copy can say when', () => {
    const handoff=require('fs').readFileSync('backoffice/workflows/verified-editorial-handoff.js','utf8');
    const dossier=require('fs').readFileSync('backoffice/workflows/compile-verified-dossier.js','utf8');
    expect(dossier).toContain('variesWith:claim.variesWith||null');
    expect(handoff).toContain('variesWith:claim.variesWith||null');
  });
});

// What the walker actually gets out of it.
describe('what the walker is told', () => {
  // Behaviour is declared, because the engine says nothing about livestock to a
  // dog whose owner has told it nothing.
  const dog={fitness:'moderate',ageYears:4,weightKg:22,conditions:[],
    behaviour:{recall:'variable',livestockComfort:'reactive'}};
  const trailWith=livestockPresence=>({id:'t1',name:'Trail',distance:6,elevation:300,
    terrainRank:0,safetyLevel:'moderate',path:[[46.5,11.6],[46.51,11.61]],
    suitability:{livestockPresence}});
  const run=presence=>scoring.calculateRecommendation({dog,trail:trailWith(presence)});
  const said=presence=>JSON.stringify([...(run(presence).cautions||[]),...(run(presence).unknowns||[])]);

  test('seasonal grazing is said plainly instead of left unknown', () => {
    expect(said('seasonal')).toContain('Livestock graze this route in season');
    expect(said('unknown')).toContain('Whether livestock graze this route is unknown');
  });

  // 'varies' is not a way of quietly upgrading a trail: it is scored, just at
  // the lighter seasonal weight the engine already applies.
  test('a seasonal pasture is scored, but not as though stock were always there', () => {
    expect(run('seasonal').score).toBeGreaterThan(run('likely').score);
    expect(run('seasonal').cautions.map(entry=>entry.code))
      .toContain('trail.livestock.behaviour-risk');
  });
});
