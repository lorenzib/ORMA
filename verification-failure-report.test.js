const { buildVerificationReport } = require('./backoffice/cli/report-verification-state');

// "agent-execution-failure" says a job is blocked and nothing more. failJob is
// the only path to a blocked job, so each one threw three times with a real
// error, and provider outages are excluded from that budget by design. Whether
// the same thing broke repeatedly or many different things broke once needs
// opposite responses, and only lastError separates them.

function storeWith(jobs, trails = []){
  const artifacts = {
    'trail-orchestration':{ trails },
    'dossier-review-queue':{ items:[] },
    'orma-verified-registry-live':{ verified:[] },
    'verified-trail-editorial-execution':{ outputs:[] },
    'publication-staging':{ items:[] },
  };
  return {
    getArtifact: async id => artifacts[id] || null,
    listJobs: async () => jobs,
  };
}

const blocked = (id, over = {}) => ({
  id, status:'blocked', agentId:'cartographer', jobType:'trail-claim-resolution',
  systemFailures:3, lastError:'Timeout contacting route source', ...over,
});

describe('the report says what actually broke', () => {
  test('one error repeated reads as one problem', async () => {
    const report = await buildVerificationReport({ store: storeWith([
      blocked('a'), blocked('b'), blocked('c'),
    ]) });
    expect(report.agentFailures.total).toBe(3);
    expect(report.agentFailures.byError).toEqual([['Timeout contacting route source', 3]]);
  });

  test('different errors are not collapsed into one', async () => {
    const report = await buildVerificationReport({ store: storeWith([
      blocked('a', { lastError:'Timeout contacting route source' }),
      blocked('b', { lastError:'Waymarked relation not found' }),
      blocked('c', { lastError:'Waymarked relation not found' }),
    ]) });
    expect(report.agentFailures.byError[0]).toEqual(['Waymarked relation not found', 2]);
    expect(report.agentFailures.byError).toHaveLength(2);
  });

  test('a missing error is named rather than silently empty', async () => {
    const report = await buildVerificationReport({ store: storeWith([blocked('a', { lastError:undefined })]) });
    expect(report.agentFailures.byError[0][0]).toBe('(no error recorded)');
  });

  test('the failure budget is reported, so an unexpected path shows up', async () => {
    // A blocked job should carry the full budget. Anything less means it got
    // there by a route failJob does not describe.
    const report = await buildVerificationReport({ store: storeWith([
      blocked('a', { systemFailures:3 }), blocked('b', { systemFailures:1 }),
    ]) });
    expect(report.agentFailures.bySystemFailures).toEqual(
      expect.arrayContaining([['3', 1], ['1', 1]]));
  });

  test('outages are counted separately, since they never block on their own', async () => {
    const report = await buildVerificationReport({ store: storeWith([
      blocked('a', { providerOutages:2 }), blocked('b'),
    ]) });
    expect(report.agentFailures.everSawOutage).toBe(1);
  });

  test('jobs that are not blocked are left out of the failure view', async () => {
    const report = await buildVerificationReport({ store: storeWith([
      blocked('a'), { id:'b', status:'queued', jobType:'trail-claim-resolution' },
    ]) });
    expect(report.agentFailures.total).toBe(1);
    expect(report.sampleAgentFailures).toHaveLength(1);
    expect(report.sampleAgentFailures[0].jobId).toBe('a');
  });
});
