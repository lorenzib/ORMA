const { planRetirement, retirementFields, PROTECTED_JOB_TYPES } = require('./backoffice/workflows/retire-blocked-jobs');
const { parseArgs, main } = require('./backoffice/cli/retire-blocked-jobs');

const job = (id, jobType, status = 'blocked') => ({ id, jobType, status, agentId: 'a', lastError: 'x' });

describe('retiring blocked jobs', () => {
  test('retires only the job types the caller named', () => {
    const jobs = [job('1', 'hosted-editorial-publication'), job('2', 'hosted-editorial-revision')];
    const { retire } = planRetirement(jobs, ['hosted-editorial-publication']);
    expect(retire.map(item => item.id)).toEqual(['1']);
  });

  test('never touches a job that is not blocked', () => {
    // A queued or running job of a dead lane is the scheduler's problem,
    // not something to mark completed behind its back.
    const jobs = [job('1', 'dead-lane', 'queued'), job('2', 'dead-lane', 'running'), job('3', 'dead-lane')];
    expect(planRetirement(jobs, ['dead-lane']).retire.map(item => item.id)).toEqual(['3']);
  });

  test('refuses the job types that carry trail verification', () => {
    expect(PROTECTED_JOB_TYPES).toEqual(['trail-verification-specialist', 'trail-claim-resolution']);
    const jobs = PROTECTED_JOB_TYPES.map((type, index) => job(String(index), type));
    const { retire, refused, skipped } = planRetirement(jobs, PROTECTED_JOB_TYPES);
    expect(retire).toEqual([]);              // nothing retired
    expect(refused).toEqual(PROTECTED_JOB_TYPES);
    expect(skipped).toHaveLength(2);         // and it says so, per job
  });

  test('records why a job was retired, and does not delete it', () => {
    const fields = retirementFields('editorial lane parked', '2026-09-07T12:00:00.000Z');
    expect(fields).toEqual({
      retiredReason: 'editorial lane parked',
      retiredAt: '2026-09-07T12:00:00.000Z',
      retiredFrom: 'blocked',
    });
  });

  test('changes nothing without --apply', async () => {
    const calls = [];
    const store = {
      listJobs: async () => [job('1', 'dead-lane')],
      completeSystemJob: async (...args) => calls.push(args),
    };
    const result = await main({ argv: ['--job-type', 'dead-lane'], store });
    expect(calls).toEqual([]);               // the safety that matters
    expect(result.retired).toBe(0);
    expect(result.wouldRetire).toBe(1);
  });

  test('with --apply, completes each named job with its reason', async () => {
    const calls = [];
    const store = {
      listJobs: async () => [job('1', 'dead-lane'), job('2', 'trail-claim-resolution')],
      completeSystemJob: async (id, fields) => calls.push({ id, fields }),
    };
    const result = await main({ argv: ['--job-type', 'dead-lane', '--job-type', 'trail-claim-resolution', '--apply'], store });
    expect(calls.map(call => call.id)).toEqual(['1']);   // the protected one is not touched
    expect(calls[0].fields.retiredFrom).toBe('blocked');
    expect(result.refused).toEqual(['trail-claim-resolution']);
  });

  test('with no job type, lists the lanes instead of acting', async () => {
    const calls = [];
    const store = {
      listJobs: async () => [job('1', 'dead-lane'), job('2', 'dead-lane'), job('3', 'other')],
      completeSystemJob: async (...args) => calls.push(args),
    };
    const result = await main({ argv: [], store });
    expect(calls).toEqual([]);
    expect(result.blocked).toBe(3);
    expect(result.retired).toBe(0);
  });

  test('parses repeated job types and the apply flag', () => {
    expect(parseArgs(['--job-type', 'a', '--job-type', 'b', '--apply', '--reason', 'gone']))
      .toEqual({ jobTypes: ['a', 'b'], apply: true, reason: 'gone' });
  });
});
