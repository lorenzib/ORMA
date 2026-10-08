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

  // #678 said "return that single claim". Forced through one trail
  // (osm-1116675, worker run on 5927aad0) the agent did exactly that: it
  // answered water with a sourced "none" and omitted the other four, and the
  // error moved from `water, mountain-huts, food-drink, other-places` to
  // `mountain-huts, food-drink, other-places, animals`. The fix worked and the
  // sentence was ambiguous, which only a real run was going to show.
  test('every empty category needs its own claim, not one standing in for all', () => {
    expect(PROMPTS.terrainPoi).toContain('Answer every empty category with its own claim');
    expect(PROMPTS.terrainPoi).toContain('one per category');
    expect(PROMPTS.terrainPoi).toContain('One claim never stands in for several');
    expect(PROMPTS.terrainPoi)
      .toContain('answering water and leaving the rest out is the same omission');
    // The wording that caused it must not come back.
    expect(PROMPTS.terrainPoi).not.toContain('return that single claim');
  });

  test('a sourced "none" for water alone leaves the other five unresolved', () => {
    const result={claims:[{id:'water',finding:'supported-proposal',
      proposedValue:'None on this route.',sources:SOURCE}]};
    expect(()=>validateSpecialistResult(result,'terrainPoi',SCOUTED)).not.toThrow();

    // The run that produced exactly this on 2026-10-08 died and spent a life.
    // Now the five it skipped are unfinished research, and water keeps the
    // sourced answer the agent actually gave.
    expect(result.claims.find(entry=>entry.id==='water').finding).toBe('supported-proposal');
    const rest=SCOUTED.filter(id=>id!=='water').map(id=>result.claims.find(e=>e.id===id));
    expect(rest.every(entry=>entry&&entry.finding==='unresolved')).toBe(true);
  });

  test('an analyst that returned nothing at all is still a failure', () => {
    expect(()=>validateSpecialistResult({claims:[]},'terrainPoi',SCOUTED))
      .toThrow('returned no claims at all');
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

  // This made the honest answer available. Leaving a category out is no longer
  // fatal either -- it is recorded unresolved and researched -- because two
  // wording fixes failed to make the agent reliable and each failure cost the
  // job a life.
  test('a category left out is recorded unresolved, asserting nothing', () => {
    const result={claims:SCOUTED.filter(id=>id!=='water')
      .map(id=>({id,finding:'unresolved',proposedValue:'Not established.',sources:[]}))};
    expect(()=>validateSpecialistResult(result,'terrainPoi',SCOUTED)).not.toThrow();

    const water=result.claims.find(entry=>entry.id==='water');
    expect(water).toMatchObject({finding:'unresolved',confidence:0,category:'water'});
    expect(water.sources).toEqual([]);
    expect(water.blockers).toEqual(['water-not-answered']);
    expect(water.rationale).toContain('not evidence that there is nothing to report');
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
