'use strict';

const {verdictOf}=require('./cli/dry-run-gate');

// Three different things were reading alike, and each wants different work: a
// fault is code to fix, a contested answer is a judgement somebody can make,
// and a blocker is a walk somebody has to go and research.
//
// They all printed as `cannot` once. Then ten trails printed as FAULT on 15
// October 2026 while the rule was working exactly as written -- their start was
// answered and deliberately held by a contradiction the agent had found -- and
// a FAULT returned first hid a real blocker behind it, so Boucle du Taillefer
// read as a pure bug when it also genuinely carries no route number.

const report=over=>({unwaivable:[],reportVersusDecision:[],contestedAnswers:[],
  wouldDecideWhenResearchEnds:'reject',...over});

describe('a verdict names which of the three it is',()=>{
  test('an approval outranks everything, because the verdict is what matters',()=>{
    expect(verdictOf(report({wouldDecideWhenResearchEnds:'approve',
      unwaivable:['logistics/recommended-start'],
      contestedAnswers:['logistics/recommended-start']}))).toBe('CAN be verified');
  });

  test('a fault reads as a fault',()=>{
    expect(verdictOf(report({reportVersusDecision:['logistics/recommended-start']})))
      .toBe('FAULT logistics/recommended-start');
  });

  test('an answered claim held by a contradiction is contested, not a fault',()=>{
    expect(verdictOf(report({unwaivable:['logistics/recommended-start'],
      contestedAnswers:['logistics/recommended-start']})))
      .toBe('contested logistics/recommended-start');
  });

  test('a real blocker reads as a refusal',()=>{
    expect(verdictOf(report({unwaivable:['logistics/route-number-switches']})))
      .toBe('blocked by logistics/route-number-switches');
  });

  test('a trail with a contested answer and a real blocker says both',()=>{
    // The one that was hidden. Itinéraire de découverte historique carries
    // exactly this shape: a start ORMA holds and no route number at all.
    expect(verdictOf(report({
      unwaivable:['logistics/recommended-start','logistics/route-number-sequence'],
      contestedAnswers:['logistics/recommended-start'],
    }))).toBe('contested logistics/recommended-start + blocked by logistics/route-number-sequence');
  });

  test('all three at once still says all three',()=>{
    expect(verdictOf(report({
      unwaivable:['logistics/recommended-start','logistics/route-number-sequence'],
      contestedAnswers:['logistics/recommended-start'],
      reportVersusDecision:['logistics/route-number-status'],
    }))).toBe('FAULT logistics/route-number-status + contested logistics/recommended-start'
      +' + blocked by logistics/route-number-sequence');
  });

  test('nothing standing and still no approval is called unclear, not refused',()=>{
    expect(verdictOf(report({wouldDecideWhenResearchEnds:'request-revision'})))
      .toBe('unclear: nothing unwaivable, yet request-revision');
  });
});
