const { advanceTrailOrchestration } = require('./backoffice/workflows/advance-trail-orchestration');

// Sixteen trails sat at agent-failure gates after a billing outage killed their
// jobs. The jobs were later put back and ran, but nothing re-examined the gates,
// so the trails stayed parked with nothing to approve and nothing running. A
// gate opened by a failure is not a decision anyone asked for; when the failure
// clears, the gate should clear with it.

const at = '2026-09-08T10:00:00.000Z';

function parkedTrail(over = {}){
  return {
    trailId:'osm-1', candidateId:'osm-1', trailName:'Test', jobIds:['job-1'],
    state:'dossier-human-gate', stage:'agent-execution-failure',
    blockers:['agent-job-blocked:logistics', 'OpenAI request failed (429): You have no credits remaining'],
    gate:{ id:'agent-failure', status:'awaiting-human', openedAt:'2026-09-01T00:00:00.000Z' },
    attempts:{}, ...over,
  };
}

function storeWith(trails, jobs, queueItems = []){
  const artifacts = {
    'trail-orchestration':{ trails },
    'dossier-review-queue':{ contractVersion:'1.0.0', items:queueItems },
  };
  const written = {};
  return {
    written,
    store:{
      getArtifact: async id => artifacts[id] || null,
      setArtifact: async (id, value) => { written[id] = value; },
      listJobs: async () => jobs,
      putJob: async () => {},
      putJobIfAbsent: async () => true,
    },
  };
}

const gateItem = { reviewId:'agent-failure-osm-1-job-1', trailId:'osm-1', candidateId:'osm-1',
  gateType:'agent-failure', state:'awaiting-human', approvalAllowed:false };

describe('a gate opened by a failure closes when the failure clears', () => {
  test('the trail is released once its job is no longer blocked', async () => {
    const { store, written } = storeWith(
      [parkedTrail()],
      [{ id:'job-1', candidateId:'osm-1', agentId:'logistics', status:'queued', createdAt:at }],
      [gateItem],
    );
    const result = await advanceTrailOrchestration(store, { at });
    expect(result.releasedGates).toEqual(['osm-1']);

    const trail = written['trail-orchestration'].trails[0];
    expect(trail.gate).toBeNull();
    expect(trail.blockers).toEqual([]);
    // The state a revision would have set, so it rejoins by the existing route.
    expect(trail.state).toBe('evidence-research');
  });

  test('the stale question disappears from the review queue', async () => {
    const { store, written } = storeWith(
      [parkedTrail()],
      [{ id:'job-1', candidateId:'osm-1', agentId:'logistics', status:'queued', createdAt:at }],
      [gateItem],
    );
    await advanceTrailOrchestration(store, { at });
    const items = written['dossier-review-queue'].items || [];
    expect(items.filter(item => item.gateType === 'agent-failure')).toEqual([]);
  });

  test('a cartographer failure returns to the geometry state', async () => {
    const { store, written } = storeWith(
      [parkedTrail({ blockers:['agent-job-blocked:cartographer','boom'], state:'geometry-human-gate' })],
      [{ id:'job-1', candidateId:'osm-1', agentId:'cartographer', status:'running', createdAt:at }],
      [gateItem],
    );
    await advanceTrailOrchestration(store, { at });
    expect(written['trail-orchestration'].trails[0].state).toBe('geometry-audit');
  });

  // The important negative: a job that is still blocked is still a real problem.
  test('a trail whose job is still blocked stays parked', async () => {
    const { store } = storeWith(
      [parkedTrail()],
      [{ id:'job-1', candidateId:'osm-1', agentId:'logistics', status:'blocked', createdAt:at }],
      [gateItem],
    );
    const result = await advanceTrailOrchestration(store, { at });
    expect(result.releasedGates).toEqual([]);
  });

  // Gates opened by a finding are decisions, not failures, and must survive.
  test('a dossier-approval gate is never released this way', async () => {
    const { store } = storeWith(
      [parkedTrail({ gate:{ id:'dossier-approval', status:'awaiting-human' },
        blockers:['logistics/recommended-start: supported authoritative route guidance is required'] })],
      [{ id:'job-1', candidateId:'osm-1', agentId:'logistics', status:'completed', createdAt:at }],
      [{ ...gateItem, gateType:'dossier-approval' }],
    );
    const result = await advanceTrailOrchestration(store, { at });
    expect(result.releasedGates).toEqual([]);
  });
});
