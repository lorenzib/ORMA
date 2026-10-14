'use strict';

const {auditSources,hasFindings,daysBetween,STALE_AFTER_DAYS,RELIANCE_SHARE}
  =require('./workflows/source-audit');
const {PROMPTS}=require('./workflows/run-trail-specialist');

// The Evidence Librarian is asked to audit outputs for "source authority,
// freshness, duplication, applicability and claim-to-source traceability".
// Three of those five are counting, and a model asked to count will sometimes
// notice and sometimes not -- at stage five, two stages after the claim was
// written. Counted here instead, so what is left for the Librarian is the half
// that needs reading.

const at='2026-10-14T00:00:00Z';
const cite=(over={})=>({url:'https://a.test/p',authority:'Commune',accessedAt:'2026-10-01',...over});
const output=(agentId,claims)=>({agentId,claims});

describe('the counting half of the evidence audit',()=>{
  test('a citation naming no authority is found',()=>{
    const audit=auditSources([output('logistics',[{id:'parking',sources:[cite({authority:''})]}])],{at});
    expect(audit.sourcesWithoutAuthority).toEqual([
      {agentId:'logistics',claimId:'parking',url:'https://a.test/p'}]);
  });

  test('a citation with no access date is found, and is not also called stale',()=>{
    // Unknown age is a gap in the record, not an old source.
    const audit=auditSources([output('logistics',[{id:'parking',sources:[cite({accessedAt:''})]}])],{at});
    expect(audit.sourcesWithoutAccessDate).toHaveLength(1);
    expect(audit.staleSources).toEqual([]);
  });

  test('a source older than a year is found, with its age',()=>{
    const audit=auditSources([output('terrainPoi',[{id:'water',sources:[cite({accessedAt:'2023-01-04'})]}])],{at});
    expect(audit.staleSources[0]).toEqual(expect.objectContaining({claimId:'water'}));
    expect(audit.staleSources[0].ageDays).toBeGreaterThan(STALE_AFTER_DAYS);
  });

  test('one page answering most of a dossier is found',()=>{
    const leaning=output('logistics',[
      {id:'a',sources:[cite()]},{id:'b',sources:[cite()]},{id:'c',sources:[cite()]},
      {id:'d',sources:[cite({url:'https://b.test/x'})]}]);
    const audit=auditSources([leaning],{at});
    expect(audit.singleSourceReliance).toEqual([
      {url:'https://a.test/p',claimCount:3,ofCited:4}]);
    expect(3/4).toBeGreaterThanOrEqual(RELIANCE_SHARE);
  });

  test('two citations are too few to call anything over-relied on',()=>{
    const audit=auditSources([output('logistics',[{id:'a',sources:[cite()]},{id:'b',sources:[cite()]}])],{at});
    expect(audit.singleSourceReliance).toEqual([]);
  });

  test('a clean dossier reports nothing worth the Librarian’s attention',()=>{
    const clean=output('logistics',[
      {id:'a',sources:[cite()]},
      {id:'b',sources:[cite({url:'https://b.test/x',authority:'Park'})]},
      {id:'c',sources:[cite({url:'https://c.test/y',authority:'Operator'})]}]);
    const audit=auditSources([clean],{at});
    expect(hasFindings(audit)).toBe(false);
  });

  test('it reads an output whichever shape it arrives in',()=>{
    // The context carries bare results; the queue carries {agentId, result}.
    const bare=auditSources([{agentId:'x',claims:[{id:'a',sources:[cite({authority:''})]}]}],{at});
    const wrapped=auditSources([{agentId:'x',result:{claims:[{id:'a',sources:[cite({authority:''})]}]}}],{at});
    expect(bare.citationsChecked).toBe(1);
    expect(wrapped.citationsChecked).toBe(1);
  });

  test('an unreadable access date is not counted as stale',()=>{
    expect(daysBetween('not a date',at)).toBeNull();
    const audit=auditSources([output('x',[{id:'a',sources:[cite({accessedAt:'soon'})]}])],{at});
    expect(audit.staleSources).toEqual([]);
  });

  test('it reports, and never downgrades a claim',()=>{
    // A missing access date is a gap in the record, not evidence the fact is
    // wrong, and sending it round the research ladder spends a search to learn
    // nothing. Only the gate's own requirements downgrade.
    const claim={id:'a',finding:'supported-proposal',sources:[cite({authority:'',accessedAt:''})]};
    auditSources([output('logistics',[claim])],{at});
    expect(claim.finding).toBe('supported-proposal');
  });
});

describe('what is left for the Librarian',()=>{
  test('the prompt hands it the counting and asks for the reading',()=>{
    const prompt=PROMPTS.evidenceLibrarian;
    expect(prompt).toContain('sourceAudit has already counted');
    expect(prompt).toContain('do not recount them');
    // The half that needs a model.
    expect(prompt).toContain('actually describes this exact route');
    expect(prompt).toContain('whether two sources disagree');
  });

  test('only the Librarian is given the audit',()=>{
    const src=require('fs').readFileSync(
      require('path').join(__dirname,'workflows/run-trail-specialist.js'),'utf8');
    expect(src).toContain("job.agentId==='evidenceLibrarian'?{sourceAudit:");
  });
});
