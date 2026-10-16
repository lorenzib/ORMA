'use strict';

/**
 * A mirror that cannot work is skipped, and a total failure says why.
 *
 * `overpass.osm.jp`'s certificate expired. The loop treated it like a busy
 * server, so a run spent three attempts and their backoff on a handshake that
 * could never succeed, then threw that mirror's TLS error as the reason the
 * whole fetch failed -- with the three mirrors actually tried nowhere in the
 * message. That cost a real regeneration run and sent the diagnosis to the
 * wrong place.
 */

const { fetchWithRetries, permanentForThisHost, PERMANENT_FOR_THIS_HOST } =
  require('./fetch-dog-friendly-routes');

const A = 'https://mirror-a.invalid/api/interpreter';
const B = 'https://mirror-b.invalid/api/interpreter';

// Node's fetch wraps a transport failure and puts the code on `cause`.
const transportError = code => Object.assign(new TypeError('fetch failed'), { cause: { code } });
const httpError = status => ({ ok: false, status });
const ok = payload => ({ ok: true, status: 200, json: async () => payload });

// Never actually waits: the backoff is minutes, and the test is about which
// requests are made, not how long the real run sleeps between them.
const run = (handlers, options = {}) => {
  const calls = [];
  const slept = [];
  const fetchImpl = async url => {
    calls.push(url);
    const answer = handlers[url];
    const result = typeof answer === 'function' ? answer(calls.filter(u => u === url).length) : answer;
    if (result instanceof Error) throw result;
    return result;
  };
  return { calls, slept,
    promise: fetchWithRetries('[out:json];', { fetchImpl, urls: [A, B],
      sleep: ms => { slept.push(ms); return Promise.resolve(); }, ...options }) };
};

describe('which failures are worth asking again about', () => {
  test('an expired certificate is not', () => {
    expect(permanentForThisHost(transportError('CERT_HAS_EXPIRED'))).toBe('CERT_HAS_EXPIRED');
  });

  test('nor a name that does not resolve, nor a refused connection', () => {
    expect(permanentForThisHost(transportError('ENOTFOUND'))).toBe('ENOTFOUND');
    expect(permanentForThisHost(transportError('ECONNREFUSED'))).toBe('ECONNREFUSED');
  });

  test('a busy server is', () => {
    expect(permanentForThisHost(Object.assign(new Error('Overpass returned HTTP 502'), { status: 502 }))).toBeNull();
    expect(permanentForThisHost(new Error('The operation was aborted due to timeout'))).toBeNull();
  });

  test('a code on the error itself is read too', () => {
    // Not every thrower wraps in `cause`.
    expect(permanentForThisHost({ code: 'CERT_HAS_EXPIRED' })).toBe('CERT_HAS_EXPIRED');
    expect(permanentForThisHost(undefined)).toBeNull();
  });

  test('every code listed is one a retry genuinely cannot cure', () => {
    for(const code of PERMANENT_FOR_THIS_HOST) expect(code).toMatch(/CERT|SIGNATURE|ENOTFOUND|ECONNREFUSED/);
  });
});

describe('a dead mirror costs one request, not three and the backoff', () => {
  test('an expired certificate moves straight to the next mirror', async () => {
    const { calls, slept, promise } = run({
      [A]: transportError('CERT_HAS_EXPIRED'),
      [B]: ok({ elements: [] }),
    });
    await expect(promise).resolves.toEqual({ elements: [] });
    // One request to the dead mirror, not three, and no wait before moving on.
    expect(calls).toEqual([A, B]);
    expect(slept).toEqual([]);
  });

  test('a busy mirror still gets its retries', async () => {
    const { calls, promise } = run({
      [A]: attempt => (attempt < 3 ? httpError(502) : ok({ elements: ['third time'] })),
      [B]: ok({ elements: [] }),
    });
    await expect(promise).resolves.toEqual({ elements: ['third time'] });
    expect(calls).toEqual([A, A, A]);
  });

  test('a rate-limited mirror waits the long backoff, not the short one', async () => {
    const { slept, promise } = run({
      [A]: attempt => (attempt < 2 ? httpError(429) : ok({ elements: [] })),
      [B]: ok({ elements: [] }),
    });
    await promise;
    expect(slept).toEqual([45000]);
  });
});

describe('when nothing answers, the error says what each mirror did', () => {
  test('both mirrors are named, with their own reason', async () => {
    const { promise } = run({
      [A]: transportError('CERT_HAS_EXPIRED'),
      [B]: httpError(504),
    });
    await expect(promise).rejects.toThrow(/All 2 Overpass mirror\(s\) failed/);
    const error = await promise.catch(e => e);
    expect(error.message).toContain(`${A}: CERT_HAS_EXPIRED, which a retry cannot change`);
    expect(error.message).toContain(`${B}: Overpass returned HTTP 504`);
  });

  test('it no longer reports only whichever mirror happened to be last', async () => {
    // The old behaviour threw the last error, so a dead certificate on the
    // final mirror became the stated cause of a failure the others shared.
    const { promise } = run({ [A]: httpError(502), [B]: transportError('CERT_HAS_EXPIRED') });
    const error = await promise.catch(e => e);
    expect(error.message).toContain('502');
    expect(error.message).toContain('CERT_HAS_EXPIRED');
  });

  test('nothing is waited for after the last attempt at the last mirror', async () => {
    const { slept, calls, promise } = run({ [A]: httpError(502), [B]: httpError(502) });
    await promise.catch(() => {});
    expect(calls).toEqual([A, A, A, B, B, B]);
    // Five gaps between six attempts, and no sixth wait before giving up.
    expect(slept).toHaveLength(5);
  });
});
