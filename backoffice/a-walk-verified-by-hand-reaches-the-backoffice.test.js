'use strict';

const fs = require('fs');
const path = require('path');
const { planHandVerifications, verifiedByHand, HAND_STATE, RETIRED_REASON } = require('./workflows/record-hand-verifications');
const { buildTrailBoard } = require('./workflows/build-trail-board');
const { recordHandVerifications } = require('./workflows/run-live-backoffice-worker');
const { validateTrailOrchestration } = require('./contracts/trail-orchestration-v1');
const { actionsFor } = require('./workflows/trail-requests');
const { planResurvey } = require('./workflows/resurvey-named-trails');
const { TERMINAL_STATES, agentWorking } = require('./workflows/start-live-trail-campaign');

const ALL = ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];
const AT = '2026-10-24T09:00:00.000Z';
const trail = (id, extra = {}) => ({ id, name: `Trail ${id}`, area: 'Somewhere / Valley', region: 'dolomites', path: [[46.5, 11.6], [46.51, 11.61]], curated: true, ...extra });
const byHand = (id, extra = {}) => trail(id, { tier: 'route-audited', reviewedAt: '2026-10-23', reviewedBy: 'ORMA route audit',
  graduation: { status: 'verified', required: ALL, completed: ALL, blockers: {} },
  verified: { categories: ALL.slice(5), sources: ['Tourist board page', 'Province trail register'], date: '2026-10-23' }, ...extra });
const flow = (id, state, extra = {}) => ({ trailId: id, candidateId: id, trailName: `Trail ${id}`, state, stage: 'x',
  attempts: { cartographer: 1 }, resolutionAttempts: {}, jobIds: [`job-${id}`], blockers: ['something open'],
  gate: null, publicMutationAllowed: false, updatedAt: '2026-10-20T10:00:00Z', ...extra });
const orchestration = trails => ({ contractVersion: '1.0.0', publicMutationAllowed: false, trails });

describe('a walk verified by hand reaches the backoffice', () => {
  test('a hand-verified trail the pipeline was still researching is recorded as verified by hand, with who, when and where from', () => {
    const plan = planHandVerifications({ trails: [byHand('a')], orchestration: orchestration([flow('a', 'evidence-research')]), at: AT });
    const recorded = plan.orchestration.trails[0];
    expect(plan.recorded).toEqual(['a']);
    expect(recorded.state).toBe(HAND_STATE);
    expect(recorded.blockers).toEqual([]);
    expect(recorded.handVerification).toEqual({ reviewedAt: '2026-10-23', reviewedBy: 'ORMA route audit',
      sources: ['Tourist board page', 'Province trail register'], recordedAt: AT, previousState: 'evidence-research' });
    expect(validateTrailOrchestration(plan.orchestration)).toEqual([]);
  });

  test('it never becomes ready-for-editorial: the evidence policy did not pass it', () => {
    const plan = planHandVerifications({ trails: [byHand('a'), byHand('b')],
      orchestration: orchestration([flow('a', 'rejected'), flow('b', 'geometry-audit')]), at: AT });
    expect(plan.orchestration.trails.map(item => item.state)).toEqual([HAND_STATE, HAND_STATE]);
  });

  test('one the pipeline already passed is left as it is', () => {
    const plan = planHandVerifications({ trails: [byHand('a')], orchestration: orchestration([flow('a', 'ready-for-editorial')]), at: AT });
    expect(plan.orchestration).toBeNull();
    expect(plan.recorded).toEqual([]);
  });

  test('one verified by hand before the pipeline ever saw it gets a record, so intake never admits it', () => {
    const plan = planHandVerifications({ trails: [byHand('new')], orchestration: orchestration([]), at: AT });
    const recorded = plan.orchestration.trails[0];
    expect(recorded).toMatchObject({ trailId: 'new', state: HAND_STATE, jobIds: [], publicMutationAllowed: false });
    expect(recorded.handVerification.previousState).toBeNull();
    expect(validateTrailOrchestration(plan.orchestration)).toEqual([]);
  });

  test('a trail that is not verified by hand is not touched', () => {
    const plan = planHandVerifications({ trails: [trail('r', { graduation: { status: 'reviewed' } }), trail('p')],
      orchestration: orchestration([flow('r', 'evidence-research')]), at: AT });
    expect(plan.orchestration).toBeNull();
    expect(verifiedByHand(trail('p'))).toBe(false);
  });

  test('running it twice changes nothing the second time', () => {
    const first = planHandVerifications({ trails: [byHand('a')], orchestration: orchestration([flow('a', 'evidence-research')]), at: AT });
    const second = planHandVerifications({ trails: [byHand('a')], orchestration: first.orchestration, at: '2026-10-24T12:00:00Z' });
    expect(second.orchestration).toBeNull();
  });

  test('a re-verification on a later date is recorded again, keeping where the pipeline had got to', () => {
    const first = planHandVerifications({ trails: [byHand('a')], orchestration: orchestration([flow('a', 'evidence-research')]), at: AT });
    const second = planHandVerifications({ trails: [byHand('a', { reviewedAt: '2026-11-02' })], orchestration: first.orchestration, at: AT });
    expect(second.recorded).toEqual(['a']);
    expect(second.orchestration.trails[0].handVerification).toMatchObject({ reviewedAt: '2026-11-02', previousState: 'evidence-research' });
  });

  test('a seal taken off by hand sends the trail to rest, not back into research', () => {
    const first = planHandVerifications({ trails: [byHand('a')], orchestration: orchestration([flow('a', 'evidence-research')]), at: AT });
    const after = planHandVerifications({ trails: [trail('a', { graduation: { status: 'reviewed' } })], orchestration: first.orchestration, at: AT });
    expect(after.withdrawn).toEqual(['a']);
    expect(after.orchestration.trails[0].state).toBe('imported');
    expect(after.orchestration.trails[0].stage).toBe('hand-verification-withdrawn');
  });

  test('the queued work a hand-verified trail still owns is retired; other trails keep theirs, and running jobs finish', () => {
    const plan = planHandVerifications({ trails: [byHand('a'), trail('b')],
      orchestration: orchestration([flow('a', 'evidence-resolution'), flow('b', 'evidence-research')]),
      jobs: [{ id: 'q-a', candidateId: 'a', status: 'queued' }, { id: 'r-a', candidateId: 'a', status: 'running' },
        { id: 'q-b', candidateId: 'b', status: 'queued' }], at: AT });
    expect(plan.retireJobIds).toEqual(['q-a']);
  });

  test('the worker writes the record and retires the jobs, and spends no model call doing it', async () => {
    const writes = []; const retired = [];
    const store = {
      getArtifact: async id => (id === 'trail-orchestration' ? orchestration([flow('a', 'rejected')]) : null),
      setArtifact: async (id, value) => writes.push([id, value]),
      listJobs: async () => [{ id: 'q-a', candidateId: 'a', status: 'queued' }],
      completeSystemJob: async (id, fields) => retired.push([id, fields]),
    };
    const result = await recordHandVerifications(store, { productionTrails: [byHand('a')], at: AT });
    expect(result).toEqual({ recorded: ['a'], withdrawn: [], retiredJobs: ['q-a'] });
    expect(writes[0][0]).toBe('trail-orchestration');
    expect(writes[0][1].summary.states).toEqual({ [HAND_STATE]: 1 });
    expect(retired[0][1]).toMatchObject({ retiredReason: RETIRED_REASON, retiredFrom: 'queued' });
  });

  test('the worker records hand verifications before the intake runs', () => {
    const source = fs.readFileSync(path.join(__dirname, 'workflows/run-live-backoffice-worker.js'), 'utf8');
    const body = source.slice(source.indexOf('async function runLiveBackofficeWorker'));
    expect(body.indexOf('recordHandVerifications(store')).toBeGreaterThan(-1);
    expect(body.indexOf('recordHandVerifications(store')).toBeLessThan(body.indexOf('runScheduledTrailCampaign('));
  });

  test('a merge that changes the published verification runs the sync, in the worker\'s concurrency group', () => {
    const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/orma-hand-verifications.yml'), 'utf8');
    expect(workflow).toContain("- 'trail-audits.js'");
    expect(workflow).toContain("- 'data/verified-trail-overrides.json'");
    expect(workflow).toContain('group: orma-backoffice-worker');
    expect(workflow).toContain('npm run backoffice:hand-verifications');
    expect(workflow).not.toContain('OPENAI');
  });
});

describe('the pipeline leaves a hand-verified trail alone', () => {
  test('it is terminal for the intake budget', () => {
    expect(TERMINAL_STATES.has(HAND_STATE)).toBe(true);
    expect(agentWorking(HAND_STATE)).toBe(false);
  });

  test('the board offers no button to re-measure it, and a named re-survey holds it', () => {
    expect(actionsFor({ inPipeline: true, state: HAND_STATE, stage: 'hand' })).toEqual([]);
    const plan = planResurvey(orchestration([flow('a', HAND_STATE)]), ['a']);
    expect(plan.queueing).toEqual([]);
    expect(plan.resting.map(item => item.trailId)).toEqual(['a']);
  });
});

describe('the board shows it beside Passed, not inside it', () => {
  const board = (flows, trails) => buildTrailBoard({ trails, orchestration: orchestration(flows), at: AT, slugs: {} });

  test('a recorded hand verification is its own stage with its sources, and no disagreement', () => {
    const recorded = planHandVerifications({ trails: [byHand('a')], orchestration: orchestration([flow('a', 'rejected')]), at: AT }).orchestration;
    const b = board(recorded.trails, [byHand('a')]);
    const row = b.trails[0];
    expect(row.stage).toBe('hand');
    expect(row.stageLabel).toBe('Verified by hand');
    expect(row.flag).toBeNull();
    expect(row.hand.sources).toEqual(['Tourist board page', 'Province trail register']);
    expect(row.detail).toContain('the pipeline had reached rejected');
    expect(b.summary.stages.passed).toBe(0);
    expect(b.summary.stages.hand).toBe(1);
    expect(b.summary.verifiedByHand).toBe(1);
    expect(b.summary.disagree).toBe(0);
  });

  test('before the first sync, a hand-verified trail outside the pipeline is still shown as by hand, not passed', () => {
    const row = board([], [byHand('a')]).trails[0];
    expect(row.stage).toBe('hand');
    expect(row.detail).toContain('next pass records it');
  });

  test('a pipeline pass stays Passed', () => {
    const row = board([flow('d', 'ready-for-editorial')], [byHand('d')]).trails[0];
    expect(row.stage).toBe('passed');
  });

  test('if the record says verified by hand but the site does not, the board says they disagree', () => {
    const row = board([flow('a', HAND_STATE, { handVerification: { reviewedAt: '2026-10-23' } })], [trail('a')]).trails[0];
    expect(row.stage).toBe('hand');
    expect(row.flag).toBe('disagree');
  });
});
