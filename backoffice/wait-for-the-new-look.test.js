'use strict';

const {afterReconsideration}=require('./workflows/advance-trail-orchestration');

/**
 * Twenty rejected trails were sent back for another look on 13 October and all
 * twenty were re-rejected in the very next pass. Not because the fresh audit
 * disagreed -- it had not run. `latest()` returns the newest COMPLETED job,
 * which at that moment is still the one that produced the rejection, so the
 * gate reopened on the old verdict.
 */

const at='2026-10-13T13:18:00.000Z';
const before={completedAt:'2026-10-12T22:43:21.000Z'};
const after={completedAt:'2026-10-13T13:25:00.000Z'};

describe('a trail must not advance on the evidence that sent it back',()=>{
  test('a job finished before it was reconsidered does not count',()=>{
    expect(afterReconsideration({reconsideredAt:at},before)).toBe(false);
  });

  test('a job finished after it was reconsidered does',()=>{
    expect(afterReconsideration({reconsideredAt:at},after)).toBe(true);
  });

  test('a job finished at the very moment counts, so nothing stalls on a tie',()=>{
    expect(afterReconsideration({reconsideredAt:at},{completedAt:at})).toBe(true);
  });

  // A trail that was never sent back is unaffected, which is almost all of them.
  test('a trail that was never reconsidered is never held',()=>{
    expect(afterReconsideration({},before)).toBe(true);
    expect(afterReconsideration(null,before)).toBe(true);
  });

  test('a job with only a creation time is judged on that',()=>{
    expect(afterReconsideration({reconsideredAt:at},{createdAt:'2026-10-12T10:00:00.000Z'})).toBe(false);
    expect(afterReconsideration({reconsideredAt:at},{createdAt:'2026-10-13T14:00:00.000Z'})).toBe(true);
  });

  test('a Firestore timestamp is read like any other time',()=>{
    expect(afterReconsideration({reconsideredAt:at},{completedAt:{toMillis:()=>Date.parse(at)+1000}})).toBe(true);
    expect(afterReconsideration({reconsideredAt:at},{completedAt:{seconds:Math.floor(Date.parse(at)/1000)-60}})).toBe(false);
  });

  test('no job at all is not something to wait on',()=>{
    expect(afterReconsideration({reconsideredAt:at},null)).toBe(true);
  });
});
