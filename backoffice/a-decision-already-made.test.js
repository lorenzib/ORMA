'use strict';

const {blockedLanes,benignBlock,DECISION_ALREADY_MADE}=require('./cli/live-worker');

/**
 * The evidence policy runs three times in a pass so a gate opening mid-pass is
 * settled in the same pass. A gate can therefore be decided and applied between
 * two of those calls, leaving an earlier decision with nothing to apply to.
 * That is the automation agreeing with itself. Before this, it reported
 * "10 jobs completed" and then exited 1.
 */

const stale={status:'blocked',error:'Dossier review item is no longer awaiting a decision'};
const real={status:'blocked',error:'Cannot approve: logistics/recommended-start is unwaivable and still standing'};

describe('a gate already decided is not a failed run',()=>{
  test('the stale decision is recognised',()=>{
    expect(benignBlock(stale)).toBe(true);
    expect(DECISION_ALREADY_MADE.test(stale.error)).toBe(true);
  });

  test('a run whose only block is a settled gate is not failed',()=>{
    expect(blockedLanes({dossierReviews:[{status:'processed'},stale]})).toEqual([]);
  });

  // The rule has to keep catching what it was written for.
  test('a decision that genuinely could not be applied still fails the run',()=>{
    expect(blockedLanes({dossierReviews:[real]})).toEqual(['dossierReviews']);
  });

  test('a real failure beside a stale one still fails',()=>{
    expect(blockedLanes({dossierReviews:[stale,real]})).toEqual(['dossierReviews']);
  });

  test('a blocked item with no error recorded is still a failure',()=>{
    expect(blockedLanes({dossierReviews:[{status:'blocked'}]})).toEqual(['dossierReviews']);
  });

  test('the other review lanes are unchanged by this',()=>{
    expect(blockedLanes({routeReviews:[{status:'blocked',error:'anything'}]})).toEqual(['routeReviews']);
    expect(blockedLanes({publications:[stale]})).toEqual([]);
  });

  test('a clean run is still clean',()=>{
    expect(blockedLanes({})).toEqual([]);
    expect(blockedLanes({dossierReviews:[{status:'processed'}]})).toEqual([]);
  });

  // The hazard lane's own benign reason is untouched.
  test('a provider outage in the hazard lane is still forgiven',()=>{
    expect(blockedLanes({communityHazards:{vetted:[
      {status:'vetting-failed',error:'OpenAI request failed (429): You have no credits remaining.'}]}})).toEqual([]);
  });
});
