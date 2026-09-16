'use strict';

const { decisionHistory } = require('./cli/report-verification-state');

function store(lanes){
  return { listDossierReviews:async status => {
    const lane = lanes[status];
    if(lane instanceof Error) throw lane;
    return lane || [];
  } };
}

describe('the decision history', () => {
  test('tells "never approved" apart from "approved and did not land"', () => {
    // A desk approval writes a queued document; the worker applies it later.
    // Those two causes of "nothing is verified" need opposite responses, and
    // the review queue on its own shows the same thing for both.
    return decisionHistory(store({})).then(empty => {
      expect(empty.total).toBe(0);
      return decisionHistory(store({ blocked:[{ candidateId:'osm-1', action:'approve', error:'contract moved' }] }));
    }).then(failed => {
      expect(failed.total).toBe(1);
      expect(failed.recent[0].error).toBe('contract moved');
    });
  });

  test('a decision still queued is counted, because that is the stuck case', async () => {
    const history = await decisionHistory(store({
      queued:[{ candidateId:'osm-1', action:'approve' }, { candidateId:'osm-2', action:'approve' }],
      processed:[{ candidateId:'osm-3', action:'approve' }],
    }));
    expect(history.stuckQueued).toBe(2);
    expect(history.byStatus).toEqual({ queued:2, processed:1, blocked:0 });
  });

  test('a lane that cannot be read is not reported as empty', async () => {
    // Zero and unknown are different, and only one of them is good news.
    const history = await decisionHistory(store({ blocked:new Error('permission denied'), processed:[{ action:'approve' }] }));
    expect(history.byStatus.blocked).toBe('unreadable');
    expect(history.byStatus.processed).toBe(1);
  });

  test('the newest decisions come first, whichever lane they are in', async () => {
    const history = await decisionHistory(store({
      processed:[{ candidateId:'old', submittedAt:'2026-09-01T00:00:00Z', processedAt:'2026-09-01T00:00:00Z' }],
      blocked:[{ candidateId:'new', submittedAt:'2026-09-15T00:00:00Z', processedAt:'2026-09-15T00:00:00Z' }],
    }));
    expect(history.recent.map(entry => entry.candidateId)).toEqual(['new', 'old']);
  });

  test('an error is carried only where there is one', async () => {
    const history = await decisionHistory(store({ processed:[{ candidateId:'ok', action:'approve' }] }));
    expect(history.recent[0].error).toBeUndefined();
  });

  test('a store too old to list decisions says so rather than reporting none', async () => {
    expect(await decisionHistory({})).toBeNull();
  });
});
