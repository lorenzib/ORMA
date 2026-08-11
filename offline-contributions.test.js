/** @jest-environment jsdom */

const queue = require('./offline-contributions');

function memoryStorage(){
  const values = new Map();
  return {
    getItem:key => values.has(key) ? values.get(key) : null,
    setItem:(key, value) => values.set(key, String(value)),
    removeItem:key => values.delete(key),
  };
}

describe('MOD-04 offline community contribution queue', () => {
  test('keeps valid content owner-bound and private until synchronization', () => {
    const storage = memoryStorage();
    const result = queue.enqueue('review', {
      trailId:'lago-carezza', rating:5, text:'Good loop', hikedOn:null,
    }, 'user-1', { id:'review-1', now:1000, storage });
    expect(result).toEqual(expect.objectContaining({ ok:true, queued:true, created:true }));
    expect(queue.pending('user-1', storage)).toHaveLength(1);
    expect(queue.pending('user-2', storage)).toEqual([]);
  });

  test('repeated queue writes with the same client id are idempotent', () => {
    const storage = memoryStorage();
    const input = { trailId:'lago-carezza', type:'water-dry', km:0.4, text:'Dry' };
    expect(queue.enqueue('hazard', input, 'user-1', { id:'hazard-1', storage }).created).toBe(true);
    expect(queue.enqueue('hazard', input, 'user-1', { id:'hazard-1', storage }).created).toBe(false);
    expect(queue.pending('user-1', storage)).toHaveLength(1);
  });

  test('sync retries the same id and removes a record only after acceptance', async () => {
    const storage = memoryStorage();
    queue.enqueue('review', { trailId:'demo-loop', rating:4, text:'Fine' }, 'user-1', {
      id:'review-stable', storage,
    });
    const failed = jest.fn().mockResolvedValue({ ok:false });
    expect(await queue.syncPending('user-1', { review:failed }, storage))
      .toEqual({ ok:false, error:'sync-failed', synced:0, pending:1 });
    expect(failed).toHaveBeenCalledWith(expect.any(Object), 'review-stable');
    const accepted = jest.fn().mockResolvedValue({ ok:true });
    expect(await queue.syncPending('user-1', { review:accepted }, storage))
      .toEqual({ ok:true, synced:1, pending:0 });
    expect(queue.pending('user-1', storage)).toEqual([]);
  });

  test('rejects unsafe or oversized payloads and caps queue growth', () => {
    const storage = memoryStorage();
    expect(queue.enqueue('photo', { trailId:'demo-loop', image:'javascript:bad' }, 'user-1', { storage }).ok).toBe(false);
    for(let index = 0; index < queue.MAX_RECORDS; index++){
      expect(queue.enqueue('review', {
        trailId:'demo-loop', rating:5, text:`Review ${index}`,
      }, 'user-1', { id:`review-${index}`, storage }).ok).toBe(true);
    }
    expect(queue.enqueue('review', {
      trailId:'demo-loop', rating:5, text:'One too many',
    }, 'user-1', { id:'review-overflow', storage }))
      .toEqual({ ok:false, error:'queue-full' });
  });

  test('all production contribution pages load the queue before Firebase', () => {
    const fs = require('fs');
    const path = require('path');
    ['trail.html', 'reviews.html', 'photo-upload.html', 'trail-report.html'].forEach(file => {
      const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(html.indexOf('offline-contributions.js')).toBeGreaterThan(-1);
      expect(html.indexOf('offline-contributions.js')).toBeLessThan(html.indexOf('firebase-init.js'));
    });
  });
});
