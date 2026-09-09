'use strict';

const { summarisePipeline, causeOf } = require('./workflows/pipeline-health');
const { providerOutage } = require('./services/provider-outage');

function job(fields){
  return { id:fields.id||'j', jobType:'x', status:'blocked', createdAt:'2026-08-01T00:00:00.000Z', ...fields };
}

describe('pipeline health', () => {
  test('separates work that resumes itself from work that needs a decision', () => {
    const health = summarisePipeline([
      job({ id:'a', lastError:'OpenAI error: no credits remaining' }),
      job({ id:'b', lastError:'OpenAI error: no credits remaining' }),
      job({ id:'c', lastError:'Unexpected workspace changes prevent editorial publication' }),
    ]);
    expect(health.stopped.total).toBe(3);
    // The worker requeues outage-blocked jobs on its own, so calling them
    // failures sends someone chasing a fault that does not exist.
    expect(health.stopped.resumesItself).toBe(2);
    expect(health.stopped.needsDecision).toBe(1);
  });

  test('classifies exactly as the worker does, never as a second opinion', () => {
    // requeueOutageBlockedJobs filters on providerOutage(). If the desk drew its
    // own line, it would promise a restart the worker never makes, or report a
    // fault the worker is already fixing.
    const errors = [
      'no credits remaining', 'request failed (429)', 'request failed (503)',
      'fetch failed', 'RESOURCE_EXHAUSTED: Quota exceeded',
      'spawn codex ENOENT', 'Unexpected workspace changes', 'route source unresolved',
    ];
    errors.forEach(error => {
      const health = summarisePipeline([job({ lastError:error })]);
      expect(health.stopped.resumesItself).toBe(providerOutage(error) ? 1 : 0);
    });
  });

  test('a lane that carries verification is marked so it cannot be offered a stop button', () => {
    const health = summarisePipeline([
      job({ jobType:'trail-verification-specialist', lastError:'boom' }),
      job({ jobType:'hosted-editorial-publication', lastError:'boom' }),
    ]);
    const byType = Object.fromEntries(health.lanes.map(lane => [lane.jobType, lane]));
    expect(byType['trail-verification-specialist'].carriesVerification).toBe(true);
    expect(byType['hosted-editorial-publication'].carriesVerification).toBe(false);
  });

  test('dates the stoppage so a dead lane can be told from a live fault', () => {
    const health = summarisePipeline([
      job({ id:'old', updatedAt:'2026-07-02T00:00:00.000Z', lastError:'boom' }),
      job({ id:'new', updatedAt:'2026-09-01T00:00:00.000Z', lastError:'boom' }),
    ]);
    expect(health.stopped.oldest).toBe('2026-07-02T00:00:00.000Z');
    expect(health.stopped.newest).toBe('2026-09-01T00:00:00.000Z');
  });

  test('counts what is still moving, not only what has stopped', () => {
    const health = summarisePipeline([
      job({ status:'queued' }), job({ status:'queued' }),
      job({ status:'running' }), job({ status:'ready-for-review' }),
    ]);
    expect(health.working).toEqual({ queued:2, running:1, readyForReview:1 });
    expect(health.stopped.total).toBe(0);
  });

  test('an unrecognised failure keeps its own words instead of a category', () => {
    // A shared bucket named "other" is the same as not reporting it: the text is
    // the only thing that says which fault this is.
    const cause = causeOf('Unexpected workspace changes prevent editorial publication');
    expect(cause.id).toBe('fault');
    expect(cause.message).toContain('Unexpected workspace changes');
  });

  test('a missing error is said to be missing rather than counted as a fault type', () => {
    expect(causeOf('').id).toBe('unrecorded');
    expect(causeOf(null).message).toMatch(/without recording an error/);
  });

  test('stays small enough to be one document the desk can poll', () => {
    const many = [];
    for(let index=0; index<400; index+=1){
      many.push(job({ id:`j${index}`, jobType:`lane-${index % 30}`, lastError:`fault number ${index}` }));
    }
    const health = summarisePipeline(many);
    expect(health.lanes.length).toBeLessThanOrEqual(12);
    health.lanes.forEach(lane => expect(lane.causes.length).toBeLessThanOrEqual(3));
    expect(JSON.stringify(health).length).toBeLessThan(20000);
  });

  test('lanes with nothing in them are left out', () => {
    const health = summarisePipeline([job({ jobType:'busy', status:'queued' })]);
    expect(health.lanes.map(lane => lane.jobType)).toEqual(['busy']);
  });

  test('work needing a decision is listed before work that clears itself', () => {
    // A lane of 65 that is only waiting on a bill is the biggest number and the
    // least useful thing to read first.
    const health = summarisePipeline([
      ...Array.from({ length:60 }, (unused, index) => job({ id:`bill${index}`, jobType:'big-but-self-clearing', lastError:'no credits remaining' })),
      ...Array.from({ length:3 }, (unused, index) => job({ id:`fault${index}`, jobType:'small-but-stuck', lastError:'workspace is dirty' })),
    ]);
    expect(health.lanes[0].jobType).toBe('small-but-stuck');
  });

  test('a missing route source is named, not filed as a generic fault', () => {
    // It is the ceiling on the catalogue and the one failure a person can
    // clear. Reading as "a fault, it will not clear on its own" sends someone
    // to debug code when the answer is to find a document.
    const cause = causeOf('route-source-identity-unresolved: supported authoritative route guidance is required');
    expect(cause.id).toBe('route-guidance');
    expect(cause.remedy).toMatch(/official route sheet/);
    expect(cause.remedy).toMatch(/Retrying cannot invent one/);
  });

  test('the words a reader sees are not the words the code uses', () => {
    // "lane", "job type" and "worker" are this system's vocabulary, not an
    // operator's. They belong in the comments, never in a remedy.
    const { CAUSES } = require('./workflows/pipeline-health');
    [...CAUSES.map(cause => cause.message), ...CAUSES.map(cause => cause.remedy)].forEach(text => {
      expect(text.toLowerCase()).not.toMatch(/\blane\b|\bworker\b|\bjob type\b/);
    });
  });
});
