const metrics = require('./metrics');
const fs = require('fs');
const path = require('path');

const NOW = Date.UTC(2026, 6, 30, 10, 42, 19);

function harness(options){
  let now = NOW;
  let online = options && options.online !== undefined ? options.online : true;
  const storage = metrics.memoryStorage();
  const api = metrics.create({
    storage,
    now:() => now,
    isOnline:() => online,
    crypto:{ randomUUID:(() => {
      let sequence = 0;
      return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
    })() },
    transport:options && options.transport,
  });
  return {
    api,
    storage,
    setNow:value => { now = value; },
    setOnline:value => { online = value; },
  };
}

describe('METRIC-01 privacy-safe event API', () => {
  test('defines exactly the eight Day 4 event families and their states', () => {
    expect(Object.keys(metrics.CONTRACT)).toEqual([
      'discovery_search',
      'dog_profile',
      'trail_decision',
      'trail_saved',
      'offline_package',
      'hike_session',
      'community_contribution',
      'post_hike_outcome',
    ]);
    expect(metrics.CONTRACT.post_hike_outcome.states).toContain(
      'appropriate_with_unexpected_cautions'
    );
  });

  test('does not collect anything before explicit consent', () => {
    const { api } = harness();
    expect(api.record('trail_decision', 'opened', {
      trailId:'lago-carezza',
    })).toEqual({ ok:false, reason:'consent-required' });
    expect(api.queued()).toEqual([]);
    expect(api.inspect()).toEqual(expect.objectContaining({
      consent:'unset',
      queueLength:0,
      hasClientId:false,
    }));
  });

  test('validates family, state, property names, and bounded values', () => {
    const { api } = harness();
    api.setConsent('granted');
    expect(api.record('made_up', 'opened', {})).toEqual({
      ok:false,
      reason:'unknown-family',
    });
    expect(api.record('trail_decision', 'made_up', {})).toEqual({
      ok:false,
      reason:'unknown-state',
    });
    expect(api.record('trail_decision', 'opened', { score:82 })).toEqual({
      ok:false,
      reason:'unknown-property',
    });
    expect(api.record('trail_decision', 'opened', { warningCount:-1 })).toEqual({
      ok:false,
      reason:'invalid-property-value',
    });
  });

  test.each([
    ['ownerName', 'Benedetta'],
    ['email', 'private@example.com'],
    ['reviewText', 'free form'],
    ['latitude', 46.4],
    ['longitude', 11.5],
    ['gpsHistory', 'trace'],
    ['authToken', 'secret'],
    ['medicalNotes', 'private'],
  ])('rejects prohibited property %s', (key, value) => {
    const { api } = harness();
    api.setConsent('granted');
    expect(api.record('hike_session', 'started', { [key]:value })).toEqual({
      ok:false,
      reason:'prohibited-property',
    });
  });

  test('stores only an allowlisted payload with a coarse timestamp', () => {
    const { api } = harness();
    api.setConsent('granted');
    const result = api.record('hike_session', 'gps_acquired', {
      trailId:'lago-carezza',
      connectivity:'offline',
      packagePresent:true,
      gpsAccuracyBand:'good',
    });
    expect(result.ok).toBe(true);
    expect(result.event.occurredHour).toBe('2026-07-30T10:00:00.000Z');
    expect(result.event).not.toHaveProperty('occurredAt');
    expect(result.event.properties).toEqual({
      trailId:'lago-carezza',
      connectivity:'offline',
      packagePresent:true,
      gpsAccuracyBand:'good',
    });
  });

  test('queues offline and retries the same event id without duplication', async () => {
    const delivered = [];
    const context = harness({
      online:false,
      transport:async event => {
        delivered.push(event.id);
        return true;
      },
    });
    context.api.setConsent('granted');
    const event = context.api.record('offline_package', 'ready', {
      trailId:'lago-carezza',
      packageSizeBand:'under_1_mb',
    }).event;
    expect((await context.api.flush()).reason).toBe('offline');
    expect(context.api.queued()).toHaveLength(1);

    context.setOnline(true);
    expect(await context.api.flush()).toEqual({ ok:true, sent:1 });
    expect(delivered).toEqual([event.id]);
    expect(context.api.queued()).toEqual([]);
    expect(await context.api.flush()).toEqual({ ok:true, sent:0 });
  });

  test('failed delivery remains queued with the same id for later retry', async () => {
    const ids = [];
    let succeeds = false;
    const { api } = harness({
      transport:async event => {
        ids.push(event.id);
        return succeeds;
      },
    });
    api.setConsent('granted');
    const event = api.record('trail_saved', 'failed', {
      trailId:'lago-carezza',
      failureCategory:'network',
    }).event;
    expect((await api.flush()).reason).toBe('send-failed');
    succeeds = true;
    expect(await api.flush()).toEqual({ ok:true, sent:1 });
    expect(ids).toEqual([event.id, event.id]);
  });

  test('withdrawal immediately clears queued events and the pseudonymous id', () => {
    const { api } = harness();
    api.setConsent('granted');
    api.record('dog_profile', 'completed', {
      completenessBand:'complete',
      relevantFactorsKnown:true,
    });
    expect(api.inspect()).toEqual(expect.objectContaining({
      queueLength:1,
      hasClientId:true,
    }));
    expect(api.setConsent('denied')).toEqual({ ok:true, consent:'denied' });
    expect(api.inspect()).toEqual(expect.objectContaining({
      queueLength:0,
      hasClientId:false,
    }));
  });

  test('expires queued analytics after 30 days and caps retained events', () => {
    const context = harness();
    context.api.setConsent('granted');
    context.api.record('discovery_search', 'started', { region:'dolomites' });
    context.setNow(NOW + metrics.RETENTION_MS + 1);
    expect(context.api.queued()).toEqual([]);

    for(let index = 0; index < metrics.MAX_QUEUE + 8; index += 1){
      context.api.record('discovery_search', 'filters_changed', {
        activeFilterCount:index % 12,
      });
    }
    expect(context.api.queued()).toHaveLength(metrics.MAX_QUEUE);
  });

  test('settings and the privacy notice expose truthful opt-in and withdrawal copy', () => {
    const settings = fs.readFileSync(path.join(__dirname, 'settings.html'), 'utf8');
    const privacy = fs.readFileSync(path.join(__dirname, 'privacy.html'), 'utf8');
    expect(settings).toContain('Share anonymous product usage');
    expect(settings).toContain("setConsent(on ? 'granted' : 'denied')");
    expect(settings.indexOf('metrics.js')).toBeLessThan(
      settings.indexOf("document.addEventListener('DOMContentLoaded'")
    );
    expect(privacy).toContain('It is off until you enable');
    expect(privacy).toContain('Switching the setting off deletes that queue');
    expect(privacy).toContain('no advertising or third-party tracking scripts');
  });

  test('analytics storage remains separate from operational hike and profile data', () => {
    const source = fs.readFileSync(path.join(__dirname, 'metrics.js'), 'utf8');
    expect(source).not.toContain('dolopaws-active-hike');
    expect(source).not.toContain('dolopaws-hike-completions');
    expect(source).not.toContain('dolopaws-profile-summary');
    expect(source).not.toContain('dolopaws-dog-profile');
  });
});
