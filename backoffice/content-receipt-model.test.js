'use strict';

const model=require('./content-receipt-model');

describe('trail content submission receipts',()=>{
  const output={candidateId:'lago-braies',jobId:'verified-lago-braies-copy',agentId:'copywriter'};
  const waiting={items:[{candidateId:'lago-braies',missingApprovals:['editorial-approval']}]};

  test('a queued submission locks the unchanged proposal and tells the moderator not to click again',()=>{
    const receipt=model.latestReceipt(output,[{id:'review-1',status:'queued',submittedAt:'2026-08-19T18:00:00Z',decisions:[{jobId:output.jobId,action:'approve'}]}],[]);
    expect(receipt).toEqual(expect.objectContaining({decision:expect.objectContaining({action:'approve'})}));
    expect(model.receiptText(output,receipt,waiting,[],()=> '19:00')).toContain('Do not click again');
  });

  test('a completed revision unlocks only the newer proposal for another review',()=>{
    const receipt=model.latestReceipt(output,[{id:'review-1',status:'processed',submittedAt:'2026-08-19T18:00:00Z',decisions:[{jobId:output.jobId,action:'request-revision'}]}],[{jobId:output.jobId,status:'ready-for-review',createdAt:'2026-08-19T18:01:00Z',completedAt:'2026-08-19T18:02:00Z'}]);
    expect(receipt).toBeNull();
  });

  test('the original first-pass job is not mislabelled as a human-requested revision',()=>{
    expect(model.latestRevision(output,[{id:'first-pass',jobId:output.jobId,jobType:'verified-trail-editorial-first-pass',status:'ready-for-review',createdAt:'2026-08-19T17:00:00Z'}])).toBeNull();
  });

  test('a processed approval remains visibly advanced after refresh',()=>{
    const advanced={items:[{candidateId:'lago-braies',missingApprovals:[]}]};
    expect(model.stillNeedsApproval(output,advanced)).toBe(false);
    expect(model.receiptText(output,null,advanced,[])).toContain('advanced to the next trail gate');
  });
});
