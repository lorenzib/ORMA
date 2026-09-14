'use strict';

const { compactOrchestration } = require('./workflows/advance-trail-orchestration');
const { STRATEGIES, strategyById, attemptStrategyText } = require('./workflows/claim-resolution');

function attempt(index) {
  const strategy = STRATEGIES[index];
  return { attemptNumber:index + 1, strategy:strategy.id, strategyLabel:strategy.label,
    instruction:strategy.instruction, status:'completed', jobId:`job-${index}`, blockers:['b'] };
}
function trail(number) {
  return { trailId:`t${number}`, jobIds:['j'],
    claimResolution:Object.fromEntries(['water','heat','access','livestock'].map(category =>
      [category, { key:category, agentId:'a', claimId:category, state:'unresolved',
        attempts:[0, 1, 2, 3, 4].map(attempt) }])) };
}

describe('orchestration size', () => {
  test('the strategy wording comes from the table, not from every attempt', () => {
    // claimResolution was 84% of trail-orchestration at 287 KB, and most of
    // that was two columns of a frozen table copied onto every attempt, of
    // every claim, of every trail.
    const wording = attemptStrategyText({ strategy:STRATEGIES[0].id });
    expect(wording.label).toBe(STRATEGIES[0].label);
    expect(wording.instruction).toBe(STRATEGIES[0].instruction);
  });

  test('a stored attempt loses the duplicate and keeps everything else', () => {
    const compacted = compactOrchestration({ trails:[trail(1)] });
    const kept = compacted.trails[0].claimResolution.water.attempts[0];
    expect(kept.instruction).toBeUndefined();
    expect(kept.strategyLabel).toBeUndefined();
    // The strategy id is what the wording is looked up by, and the findings
    // are the attempt's own: neither is derivable from anywhere else.
    expect(kept.strategy).toBe(STRATEGIES[0].id);
    expect(kept.attemptNumber).toBe(1);
    expect(kept.jobId).toBe('job-0');
    expect(kept.blockers).toEqual(['b']);
    expect(kept.status).toBe('completed');
  });

  test('an attempt whose strategy the table no longer knows keeps its own words', () => {
    // Compaction is only safe where the value can be produced again. A
    // strategy removed from the table cannot be, so that attempt is left alone
    // rather than quietly losing what it was asked to do.
    const orphan = { trails:[{ claimResolution:{ x:{ attempts:[
      { strategy:'a-strategy-since-removed', instruction:'what it was asked to do' },
    ] } } }] };
    expect(compactOrchestration(orphan).trails[0].claimResolution.x.attempts[0].instruction)
      .toBe('what it was asked to do');
    expect(strategyById('a-strategy-since-removed')).toBeNull();
  });

  test('a new attempt never stores the duplicate in the first place', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'workflows/claim-resolution.js'), 'utf8');
    const added = source.slice(source.indexOf('function addQueuedAttempt'), source.indexOf('function annotateResolvedClaim'));
    expect(added).not.toMatch(/strategyLabel:strategy\.label/);
    expect(added).not.toMatch(/instruction:strategy\.instruction/);
    expect(added).toMatch(/strategy:strategy\.id/);
  });

  test('the job still carries the wording the agent needs', () => {
    // Dropping it from storage must not drop it from the instruction an agent
    // is actually given.
    const advance = require('fs').readFileSync(
      require('path').join(__dirname, 'workflows/advance-trail-orchestration.js'), 'utf8');
    expect(advance).toMatch(/const wording=attemptStrategyText\(attempt\)/);
    expect(advance).toMatch(/job\.resolutionInstruction=wording\.instruction/);
    expect(advance).toMatch(/job\.resolutionStrategyLabel=wording\.label/);
  });

  test('the artifact already written compacts itself on the next pass', () => {
    const before = { trails:Array.from({ length:25 }, (unused, index) => trail(index)) };
    const after = compactOrchestration(before);
    const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
    expect(bytes(after)).toBeLessThan(bytes(before) * 0.45);

    const advance = require('fs').readFileSync(
      require('path').join(__dirname, 'workflows/advance-trail-orchestration.js'), 'utf8');
    expect(advance).toMatch(/setArtifact\('trail-orchestration',compactOrchestration\(next\)\)/);
  });

  test('a trail with no ledger is returned untouched', () => {
    const plain = { trails:[{ trailId:'t', jobIds:[] }] };
    expect(compactOrchestration(plain).trails[0]).toBe(plain.trails[0]);
    expect(compactOrchestration(null)).toBeNull();
  });
});
