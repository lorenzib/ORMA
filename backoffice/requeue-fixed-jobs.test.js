'use strict';

const {planRequeue,matcher,requeueFields}=require('./workflows/requeue-fixed-jobs');
const {main}=require('./cli/requeue-fixed-jobs');

const VARIES_ERROR='Claim seasonal-restrictions cannot be answered "varies" before resolution attempt 2; it has had 0';
const blocked=(over={})=>({id:'j1',status:'blocked',jobType:'trail-verification-specialist',
  candidateId:'osm-1',lastError:VARIES_ERROR,blockedAt:'2026-09-20T00:00:00Z',...over});

describe('releasing jobs whose cause has been fixed',()=>{
  test('it takes the named error and leaves every other blocked job alone',()=>{
    // Releasing a job whose cause is still live spends the model budget to
    // re-learn it, which is roughly how the backlog was built.
    const plan=planRequeue([
      blocked(),
      blocked({id:'j2',lastError:'route-source-identity-unresolved'}),
      blocked({id:'j3',status:'queued'}),
    ],{errorPattern:'cannot be answered "varies"'});
    expect(plan.matched).toBe(1);
    expect(plan.releasing.map(job=>job.id)).toEqual(['j1']);
    expect(plan.unmatched).toBe(1);
  });

  test('it refuses to run without an error named',()=>{
    expect(()=>planRequeue([blocked()],{})).toThrow(/error pattern is required/);
    expect(()=>matcher('   ')).toThrow(/error pattern is required/);
  });

  test('a bounded pass takes the oldest first and says what it held back',()=>{
    const plan=planRequeue([
      blocked({id:'new',blockedAt:'2026-10-01T00:00:00Z'}),
      blocked({id:'old',blockedAt:'2026-09-01T00:00:00Z'}),
      blocked({id:'mid',blockedAt:'2026-09-15T00:00:00Z'}),
    ],{errorPattern:'varies',limit:2});
    expect(plan.releasing.map(job=>job.id)).toEqual(['old','mid']);
    expect(plan.held).toBe(1);
  });

  test('it can be scoped to one trail or one lane',()=>{
    const jobs=[blocked({id:'a',candidateId:'osm-1'}),blocked({id:'b',candidateId:'osm-2'}),
      blocked({id:'c',jobType:'trail-claim-resolution'})];
    expect(planRequeue(jobs,{errorPattern:'varies',candidateId:'osm-2'}).releasing.map(j=>j.id)).toEqual(['b']);
    expect(planRequeue(jobs,{errorPattern:'varies',jobTypes:['trail-claim-resolution']}).releasing.map(j=>j.id)).toEqual(['c']);
  });

  test('the record of why a job stalled survives the release',()=>{
    // requeueOutageBlockedJobs keeps lastError for the same reason: it is the
    // only trace of the stall, and every report groups by it.
    const fields=requeueFields('prompt now states the rule','2026-10-05T00:00:00Z');
    expect(fields).toEqual(expect.objectContaining({status:'queued',systemFailures:0,
      requeuedAt:'2026-10-05T00:00:00Z',requeueReason:'prompt now states the rule'}));
    expect(fields).not.toHaveProperty('lastError');
  });
});

describe('the CLI will not change anything by accident',()=>{
  const store=jobs=>({listJobs:async()=>jobs,requeueBlockedJobsMatching:jest.fn(async ids=>ids)});

  test('with no pattern it only reports what is blocked and on what',async()=>{
    const s=store([blocked(),blocked({id:'j2',lastError:'route-source-identity-unresolved'})]);
    const result=await main({argv:[],store:s});
    expect(result.releasing).toEqual([]);
    expect(s.requeueBlockedJobsMatching).not.toHaveBeenCalled();
  });

  test('without --apply it is a dry run',async()=>{
    const s=store([blocked()]);
    const plan=await main({argv:['--error-pattern','cannot be answered "varies"'],store:s});
    expect(plan.releasing).toHaveLength(1);
    expect(s.requeueBlockedJobsMatching).not.toHaveBeenCalled();
  });

  test('with --apply it releases exactly the jobs it listed',async()=>{
    const s=store([blocked(),blocked({id:'other',lastError:'something else'})]);
    await main({argv:['--error-pattern','cannot be answered "varies"','--reason','prompt now states the rule','--apply'],store:s});
    expect(s.requeueBlockedJobsMatching).toHaveBeenCalledWith(['j1'],
      expect.objectContaining({requeueReason:'prompt now states the rule'}));
  });
});
