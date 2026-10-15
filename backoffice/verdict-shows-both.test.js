'use strict';

const {verdictOf}=require('./cli/dry-run-gate');

// A trail can carry a fault and a real blocker at once, and the two want
// completely different work: one is a bug to fix, the other a walk somebody has
// to go and research. The verdict returned the fault first and stopped, so
// Boucle du Taillefer read as a pure bug on 15 October 2026 when it also
// genuinely carries no route number at all.

const report=over=>({unwaivable:[],overruledAnswers:[],
  wouldDecideWhenResearchEnds:'reject',...over});

describe('a fault never hides a real blocker',()=>{
  test('a trail with both says both',()=>{
    expect(verdictOf(report({
      unwaivable:['logistics/recommended-start','logistics/route-number-sequence'],
      overruledAnswers:['logistics/recommended-start'],
    }))).toBe('FAULT logistics/recommended-start + blocked by logistics/route-number-sequence');
  });

  test('a fault alone reads as a fault',()=>{
    expect(verdictOf(report({unwaivable:['logistics/recommended-start'],
      overruledAnswers:['logistics/recommended-start']})))
      .toBe('FAULT: answered, yet blocked by logistics/recommended-start');
  });

  test('a real blocker alone reads as a refusal',()=>{
    expect(verdictOf(report({unwaivable:['logistics/route-number-switches']})))
      .toBe('cannot: blocked by logistics/route-number-switches');
  });

  test('an approval outranks both, because the verdict is what matters',()=>{
    expect(verdictOf(report({wouldDecideWhenResearchEnds:'approve',
      unwaivable:['logistics/recommended-start'],
      overruledAnswers:['logistics/recommended-start']}))).toBe('CAN be verified');
  });

  test('nothing standing and still no approval is called unclear, not refused',()=>{
    expect(verdictOf(report({wouldDecideWhenResearchEnds:'request-revision'})))
      .toBe('unclear: nothing unwaivable, yet request-revision');
  });
});
