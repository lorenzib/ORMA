'use strict';

const fs = require('fs');
const path = require('path');
const { buildTrailBoard, badgeOf } = require('./workflows/build-trail-board');
const { ACTIONS, actionsFor, planRequestPass, runForDispatch, settleDispatched, MAX_NAMED_ADMISSIONS } = require('./workflows/trail-requests');
const { planReconsideration } = require('./workflows/reconsider-rejected-trails');
const { recordTrailBoard } = require('./workflows/run-live-backoffice-worker');
const processor = require('./cli/process-trail-requests');

const ALL = ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];
const path2 = [[46.5, 11.6], [46.51, 11.61]];
const trail = (id, extra = {}) => ({ id, name: `Trail ${id}`, area: 'Somewhere / Valley', region: 'dolomites', path: path2, curated: false, ...extra });
const verified = id => trail(id, { curated: true, tier: 'route-audited',
  graduation: { status: 'verified', required: ALL, completed: ALL, blockers: {} },
  verified: { categories: ALL.slice(5), sources: ['a'], date: '2026-10-21' } });
const flow = (id, state, extra = {}) => ({ trailId: id, candidateId: id, trailName: `Trail ${id}`, state, blockers: [], updatedAt: '2026-10-20T10:00:00Z', ...extra });

function board(){
  return buildTrailBoard({
    trails: [trail('a'), trail('b'), trail('c'), trail('d'), trail('e'), verified('f'), trail('g'), trail('h'), verified('v')],
    orchestration: { trails: [
      flow('b', 'geometry-audit'), flow('c', 'evidence-research'), flow('d', 'ready-for-editorial'),
      flow('e', 'rejected', { blockers: ['not-closed-loop'] }), flow('f', 'rejected', { blockers: ['off-declared-route'] }),
      flow('g', 'imported'), flow('h', 'blocked', { blockers: ['automated-resolution-attempts-exhausted'] }),
    ] },
    publicationRequests: { requests: [{ candidateId: 'd', status: 'publication-failed', retryable: true,
      retryMode: 'automatic', retryAfter: '2026-10-22T09:00:00Z', failedAt: '2026-10-21T09:00:00Z' }] },
    jobs: [{ candidateId: 'c', status: 'queued' }],
    at: '2026-10-21T12:00:00Z',
  });
}
const byId = b => new Map(b.trails.map(entry => [entry.id, entry]));

describe('the trail board', () => {
  test('every catalogue trail has a row, including the ones nobody has started', () => {
    const b = board();
    expect(b.summary.trails).toBe(9);
    expect(b.trails.map(entry => entry.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'v']);
  });

  test('eleven orchestration states fold into six stages', () => {
    const rows = byId(board());
    expect(rows.get('a').stage).toBe('queued');
    expect(rows.get('b').stage).toBe('route');
    expect(rows.get('c').stage).toBe('research');
    expect(rows.get('d').stage).toBe('publish');
    expect(rows.get('e').stage).toBe('stopped');
    expect(rows.get('g').stopKind).toBe('resting');
    expect(rows.get('h').stopKind).toBe('blocked');
    // Verified by hand and never through the pipeline: beside Passed, not in it.
    expect(rows.get('v').stage).toBe('hand');
  });

  test('the badge is the one the public page shows', () => {
    for(const entry of board().trails){
      expect(['verified', 'reviewed', 'imported']).toContain(entry.badge);
    }
    expect(badgeOf(verified('x'))).toBe('verified');
    expect(badgeOf(trail('y'))).toBe('imported');
  });

  test('a seal the pipeline later rejected is flagged, not hidden', () => {
    const f = byId(board()).get('f');
    expect(f.badge).toBe('verified');
    expect(f.flag).toBe('disagree');
    expect(f.detail).toContain('the line leaves the declared route');
  });

  test('a blocked trail with a badge counts as stuck, not as a disagreement', () => {
    const b = buildTrailBoard({ trails: [trail('h', { curated: true })],
      orchestration: { trails: [flow('h', 'blocked', { blockers: ['not-closed-loop'] })] } });
    expect(b.trails[0].badge).toBe('reviewed');
    expect(b.trails[0].flag).toBe('stuck');
    expect(b.summary.stuck).toBe(1);
    expect(b.summary.disagree).toBe(0);
  });

  test('a publication failure says when it retries rather than claiming it never will', () => {
    const d = byId(board()).get('d');
    expect(d.next).toBe('Publication failed');
    expect(d.detail).toContain('Retries automatically after 2026-10-22');
    expect(d.flag).toBe(null);
    const manual = buildTrailBoard({ trails: [trail('d')], orchestration: { trails: [flow('d', 'ready-for-editorial')] },
      publicationRequests: { requests: [{ candidateId: 'd', status: 'publication-failed', retryable: true, retryMode: 'manual' }] } });
    expect(manual.trails[0].flag).toBe('stuck');
    expect(manual.trails[0].detail).toContain('Needs a fix');
  });

  test('blockers are written in words, not slugs', () => {
    expect(byId(board()).get('e').detail).toBe('the line does not close into a loop');
  });

  test('a row carries the slug the public page lives at', () => {
    const { loadProductionTrails } = require('../scripts/load-production-trails');
    const manifest = require('../data/regions-manifest.json');
    const [first] = loadProductionTrails(path.resolve(__dirname, '..'));
    const real = buildTrailBoard({ trails: [first] });
    expect(real.trails[0].slug).toBe(manifest.trailSlug[first.id]);
  });

  test('the whole catalogue fits comfortably in one Firestore document', () => {
    const { loadProductionTrails } = require('../scripts/load-production-trails');
    const real = buildTrailBoard({ trails: loadProductionTrails(path.resolve(__dirname, '..')) });
    expect(JSON.stringify(real).length).toBeLessThan(400 * 1024);
  });
});

describe('which requests a trail can make', () => {
  test('each stage offers only levers that apply to it', () => {
    const rows = byId(board());
    expect(rows.get('a').actions).toEqual(['start']);
    expect(rows.get('b').actions).toEqual([]);
    expect(rows.get('c').actions).toEqual(['prioritise', 'resurvey']);
    expect(rows.get('d').actions).toEqual(['retry-publication', 'resurvey']);
    expect(rows.get('e').actions).toEqual(['reconsider', 'resurvey']);
    expect(rows.get('g').actions).toEqual([]);
    expect(rows.get('v').actions).toEqual([]);
  });

  test('work-on-next is offered only when there is a job to put first', () => {
    const entry = byId(board()).get('c');
    expect(actionsFor({ ...entry, jobOwed: false })).not.toContain('prioritise');
  });

  test('the page, the processor and the Firestore rule name the same actions', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const client = fs.readFileSync(path.join(__dirname, '..', 'backoffice-firebase.js'), 'utf8');
    const page = fs.readFileSync(path.join(__dirname, '..', 'backoffice-trail-board.js'), 'utf8');
    const block = rules.slice(rules.indexOf('match /backofficeTrailRequests/'));
    for(const action of Object.keys(ACTIONS)){
      expect(block.slice(0, 1600)).toContain(`'${action}'`);
      expect(client).toContain(`'${action}'`);
      expect(page).toMatch(new RegExp(`['"]?${action.replace('-', '\\-')}['"]?:\\[`));
    }
    expect(block.slice(0, 1600)).toContain('allow update, delete: if false;');
  });
});

describe('a pass of the request processor', () => {
  const at = '2026-10-21T12:00:00Z';
  const req = (id, trailId, action, minute = 0) => ({ id, trailId, action, status: 'queued',
    submittedAt: `2026-10-21T11:${String(minute).padStart(2, '0')}:00Z` });

  test('combines requests into one dispatch per workflow', () => {
    const plan = planRequestPass({ board: board(), queued: [
      req('1', 'a', 'start'), req('2', 'c', 'prioritise', 1), req('3', 'd', 'retry-publication', 2),
      req('4', 'e', 'reconsider', 3), req('5', 'c', 'resurvey', 4),
    ] });
    expect(plan.refused).toEqual([]);
    const worker = plan.dispatches.find(item => item.workflow === 'worker');
    const requeue = plan.dispatches.find(item => item.workflow === 'requeue');
    expect(worker.inputs).toEqual({ reverify_trail_ids: 'a', candidate_id: 'c', force_publication_retry: 'true' });
    expect(requeue.inputs).toMatchObject({ apply: 'true', resurvey_trail_ids: 'c', reconsider_trail_ids: 'e' });
    expect(plan.dispatches).toHaveLength(2);
  });

  test('refuses what the trail can no longer do, and says why', () => {
    const plan = planRequestPass({ board: board(), queued: [
      req('1', 'b', 'start'), req('2', 'zz', 'start'), req('3', 'a', 'delete-everything')] });
    expect(plan.dispatches).toEqual([]);
    expect(plan.refused.map(item => item.reason)).toEqual([
      'not available while the trail is Route check', 'not in the catalogue', 'unknown action']);
  });

  test('one trail per work-on-next run, the rest wait for the next pass', () => {
    const b = buildTrailBoard({ trails: [trail('p'), trail('q')],
      orchestration: { trails: [flow('p', 'evidence-research'), flow('q', 'evidence-research')] },
      jobs: [{ candidateId: 'p' }, { candidateId: 'q' }] });
    const plan = planRequestPass({ board: b, queued: [req('1', 'p', 'prioritise'), req('2', 'q', 'prioritise', 1)] });
    expect(plan.dispatches[0].inputs.candidate_id).toBe('p');
    expect(plan.waiting.map(item => item.id)).toEqual(['2']);
  });

  test('never names more trails than the worker admits in one pass', () => {
    const ids = Array.from({ length: MAX_NAMED_ADMISSIONS + 2 }, (_, i) => `n${i}`);
    const b = buildTrailBoard({ trails: ids.map(id => trail(id)) });
    const plan = planRequestPass({ board: b, queued: ids.map((id, i) => req(String(i), id, 'start', i)) });
    expect(plan.dispatches[0].inputs.reverify_trail_ids.split(',')).toHaveLength(MAX_NAMED_ADMISSIONS);
    expect(plan.waiting).toHaveLength(2);
  });

  test('the same ask twice is answered once', () => {
    const plan = planRequestPass({ board: board(), queued: [req('1', 'a', 'start'), req('2', 'a', 'start', 1)] });
    expect(plan.dispatches[0].requests.map(item => item.id)).toEqual(['1']);
    expect(plan.refused[0].reason).toBe('already requested');
  });

  test('a replaced run sends the request back to the queue, a lost one after an hour', () => {
    const r = { dispatchedAt: '2026-10-21T11:00:00Z' };
    expect(settleDispatched(r, { status: 'completed', conclusion: 'success', databaseId: 7 }, at).status).toBe('done');
    expect(settleDispatched(r, { status: 'completed', conclusion: 'cancelled', databaseId: 7 }, at).status).toBe('queued');
    expect(settleDispatched(r, { status: 'completed', conclusion: 'failure', databaseId: 7 }, at).status).toBe('failed');
    expect(settleDispatched(r, { status: 'in_progress', databaseId: 7 }, at).unchanged).toBe(true);
    expect(settleDispatched({ dispatchedAt: '2026-10-21T10:50:00Z' }, null, at).status).toBe('queued');
    expect(settleDispatched({ dispatchedAt: '2026-10-21T11:45:00Z' }, null, at)).toBe(null);
  });

  test('finds the run a dispatch started', () => {
    const runs = [{ event: 'schedule', createdAt: '2026-10-21T11:01:00Z', databaseId: 1 },
      { event: 'workflow_dispatch', createdAt: '2026-10-21T10:00:00Z', databaseId: 2 },
      { event: 'workflow_dispatch', createdAt: '2026-10-21T11:00:03Z', databaseId: 3 }];
    expect(runForDispatch(runs, '2026-10-21T11:00:00Z').databaseId).toBe(3);
  });

  function fakeStore(requests, artifacts){
    const marks = [];
    return { marks, artifacts,
      async listTrailRequests(status){ return requests.filter(item => item.status === status); },
      async markTrailRequest(id, status, fields){ marks.push({ id, status, ...fields }); },
      async getArtifact(id){ return artifacts[id] || null; },
      async setArtifact(id, data){ artifacts[id] = data; },
      async listJobs(){ return []; } };
  }

  test('with nothing asked for it reads twice and writes nothing', async () => {
    const store = fakeStore([], {});
    const sent = [];
    await processor.main({ store, dispatch: (...args) => sent.push(args), runs: () => [] });
    expect(store.marks).toEqual([]);
    expect(sent).toEqual([]);
  });

  test('dispatches, records, and refreshes the board', async () => {
    const b = board();
    const store = fakeStore([req('1', 'a', 'start'), req('2', 'b', 'start', 1)],
      { 'trail-board': b, 'trail-orchestration': { trails: [] } });
    const sent = [];
    await processor.main({ store, now: at, trails: [trail('a')], dispatch: (file, inputs) => sent.push({ file, inputs }), runs: () => [] });
    expect(sent).toEqual([{ file: 'orma-backoffice-worker.yml', inputs: { reverify_trail_ids: 'a' } }]);
    expect(store.marks.find(mark => mark.id === '1').status).toBe('dispatched');
    expect(store.marks.find(mark => mark.id === '2').status).toBe('refused');
    expect(store.artifacts['trail-board'].generatedAt).toBe(at);
  });

  test('a dispatch that fails to start leaves the request queued', async () => {
    const store = fakeStore([req('1', 'a', 'start')], { 'trail-board': board() });
    await processor.main({ store, now: at, refreshBoard: false, runs: () => [],
      dispatch: () => { throw new Error('no token'); } });
    expect(store.marks).toEqual([]);
  });
});

describe('looking again at a rejected trail by name', () => {
  const orchestration = { trails: [
    flow('e', 'rejected', { blockers: [] }), flow('k', 'rejected', { blockers: ['not-closed-loop'] }), flow('c', 'evidence-research'),
  ] };
  test('a named trail goes back even with no blocker recorded', () => {
    const plan = planReconsideration(orchestration, { trailIds: ['e'] });
    expect(plan.returning.map(entry => entry.candidateId)).toEqual(['e']);
  });
  test('a name that is not rejected sends nothing back', () => {
    expect(planReconsideration(orchestration, { trailIds: ['c'] }).returning).toEqual([]);
  });
  test('a reason still works as before', () => {
    expect(planReconsideration(orchestration, { reason: 'not-closed-loop' }).returning.map(entry => entry.candidateId)).toEqual(['k']);
  });
});

describe('the worker writes the board', () => {
  test('as the last thing a pass does, and never fails the pass', async () => {
    const written = {};
    const store = { async getArtifact(){ return null; }, async setArtifact(id, data){ written[id] = data; }, async listJobs(){ return []; } };
    const summary = await recordTrailBoard(store, { productionTrails: [trail('a')], at: '2026-10-21T12:00:00Z' });
    expect(summary.trails).toBe(1);
    expect(written['trail-board'].trails[0].stage).toBe('queued');
    const broken = { async getArtifact(){ throw new Error('quota'); }, async setArtifact(){} };
    await expect(recordTrailBoard(broken, { productionTrails: [] })).resolves.toEqual({ error: 'quota' });
  });
});
