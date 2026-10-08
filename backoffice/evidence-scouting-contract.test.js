'use strict';

const {EVIDENCE_SCOUTING_CONTRACT,PROMPTS}=require('./workflows/run-trail-specialist');
const {STRATEGIES}=require('./workflows/claim-resolution');

describe('global verification evidence-scouting contract',()=>{
  const agents=['logistics','regulatoryRanger','terrainPoi','evidenceLibrarian','redTeam','auditor'];

  test.each(agents)('%s receives the complete source-ladder instruction',agentId=>{
    expect(PROMPTS[agentId]).toContain(EVIDENCE_SCOUTING_CONTRACT);
    expect(PROMPTS[agentId]).toContain('Optional does not mean optional research');
    expect(PROMPTS[agentId]).toContain('linked PDFs, GPX files, maps, geoportals and current notices');
    expect(PROMPTS[agentId]).toContain('credible local or specialist secondary sources');
    expect(PROMPTS[agentId]).toContain('exact authority contact, field observation or measurement');
  });

  test('source exhaustion still requires all materially different resolution passes',()=>{
    expect(STRATEGIES.map(strategy=>strategy.id)).toEqual([
      'primary-authority-scope-check',
      'geospatial-source-triangulation',
      'local-institution-cross-check',
      'counter-evidence-and-freshness-review',
      'direct-verification-escalation-check',
    ]);
  });
});

/**
 * Drain run 37831560802: every one of the nine job failures was an agent
 * omitting a mandatory claim, and seven were the Terrain & POI Analyst — `water`
 * missing from all seven, `other-places` from six. No provider error, no
 * throttling. The validator refused the result because a required claim was not
 * there, and a refused result spends one of the job's three lives.
 *
 * A route with no fountain is not unresolved: nothing was left unestablished,
 * there is nothing there. Asked to choose between saying something false and
 * saying nothing, the agent said nothing.
 */
describe('a route with no fountain can say so', () => {
  const {PROMPTS,validateSpecialistResult}=require('./workflows/run-trail-specialist.js');
  const SCOUTED=['water','mountain-huts','food-drink','other-places','livestock','animals'];
  const SOURCE=[{url:'https://www.example-park.it/sentiero/facilities',authority:'Parco Naturale Esempio'}];

  test('the prompt offers "there is none" as a finding, with a source', () => {
    expect(PROMPTS.terrainPoi).toContain('there is none on this route');
    expect(PROMPTS.terrainPoi).toContain('citing the source that establishes it');
  });

  test('it still forbids inferring absence from silence', () => {
    expect(PROMPTS.terrainPoi).toContain('not the same as inferring absence from silence');
    expect(PROMPTS.terrainPoi).toContain('the honest finding is unresolved');
    // The rule that predates this change and must survive it.
    expect(PROMPTS.terrainPoi).toContain('Do not infer absence from lack of web mentions');
  });

  test('omitting the claim is named as never the answer', () => {
    expect(PROMPTS.terrainPoi).toContain('never omit one because you have nothing to list under it');
    expect(PROMPTS.terrainPoi).toContain('Omitting a claim is never the answer');
  });

  // The output contract is unchanged: this makes the honest answer available,
  // it does not stop the validator refusing a result that leaves one out.
  test('a result that leaves water out is still refused', () => {
    const result={claims:SCOUTED.filter(id=>id!=='water')
      .map(id=>({id,finding:'unresolved',proposedValue:'Not established.',sources:[]}))};
    expect(()=>validateSpecialistResult(result,'terrainPoi',SCOUTED))
      .toThrow('omitted mandatory scouting claim(s): water');
  });

  test('a sourced "none" for every category is accepted', () => {
    const result={claims:SCOUTED.map(id=>({id,finding:'supported-proposal',
      proposedValue:'None on this route.',sources:SOURCE}))};
    expect(()=>validateSpecialistResult(result,'terrainPoi',SCOUTED)).not.toThrow();
  });

  // The guard that stops "none" becoming a free pass: a supported proposal
  // still needs a source, so an unsourced "none" is refused as it always was.
  test('an unsourced "none" is refused like any other bare assertion', () => {
    const result={claims:SCOUTED.map(id=>({id,finding:'supported-proposal',
      proposedValue:'None on this route.',sources:[]}))};
    expect(()=>validateSpecialistResult(result,'terrainPoi',SCOUTED))
      .toThrow('requires a source');
  });
});
