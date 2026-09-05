'use strict';

const {providerOutage}=require('./services/provider-outage');
const {blockedLanes}=require('./cli/live-worker');

describe('a provider outage is not the job’s fault',()=>{
  test.each([
    'OpenAI request failed (429): You have no credits remaining. Add credits to continue using the API',
    'OpenAI request failed (429): Rate limit reached',
    'OpenAI request failed (503): The engine is currently overloaded',
    '8 RESOURCE_EXHAUSTED: Quota exceeded.',
    'fetch failed',
    'connect ETIMEDOUT 1.2.3.4:443',
  ])('treats %s as an outage',message=>expect(providerOutage(message)).toBe(true));

  test.each([
    'Image gap no longer exists',
    'The selected ORMA-owned image is no longer available',
    'The uploaded photo must complete visual preview review before publication approval',
    'OpenAI response did not contain structured output text',
    'The approved image source is not publishable',
    'OpenAI request failed (400): invalid schema',
  ])('treats %s as a real failure',message=>expect(providerOutage(message)).toBe(false));

  test('handles an Error, an empty value and a non-string',()=>{
    expect(providerOutage(new Error('no credits remaining'))).toBe(true);
    expect(providerOutage('')).toBe(false);
    expect(providerOutage(null)).toBe(false);
    expect(providerOutage(undefined)).toBe(false);
  });

  test('an outage does not fail the worker run, a real vetting fault does',()=>{
    expect(blockedLanes({communityHazards:{vetted:[
      {status:'vetting-failed',error:'OpenAI request failed (429): You have no credits remaining'}]}})).toEqual([]);
    expect(blockedLanes({communityHazards:{vetted:[
      {status:'vetting-failed',error:'Hazard report is missing a trail'}]}})).toEqual(['communityHazards']);
  });
});

describe('failJob does not spend the failure budget on an outage',()=>{
  // The store needs firebase-admin, so exercise the decision the transaction makes
  // rather than the transaction itself.
  function decide(job,error,options={}){
    const outage=providerOutage(error);
    const failures=outage?Number(job.systemFailures||0):Number(job.systemFailures||0)+1;
    const maximum=options.maximumFailures||3;
    return {outage,failures,blocked:!outage&&failures>=maximum};
  }

  test('a job one failure from blocking survives an outage unchanged',()=>{
    expect(decide({systemFailures:2},'OpenAI request failed (429): You have no credits remaining'))
      .toEqual({outage:true,failures:2,blocked:false});
  });

  test('the same job still blocks on a real fault',()=>{
    expect(decide({systemFailures:2},'Image gap no longer exists'))
      .toEqual({outage:false,failures:3,blocked:true});
  });

  test('an outage never blocks, however often it repeats',()=>{
    expect(decide({systemFailures:99},'fetch failed').blocked).toBe(false);
  });
});
