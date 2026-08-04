const metrics = require('./metrics');
const funnelLibrary = require('./metric-funnel');

function journey(){
  const metricStorage = metrics.memoryStorage();
  const api = metrics.create({
    storage:metricStorage,
    now:() => Date.UTC(2026, 7, 4, 8, 0, 0),
    crypto:{ randomUUID:(() => {
      let sequence = 0;
      return () => `journey-${++sequence}`;
    })() },
  });
  const funnel = funnelLibrary.create({
    metrics:api,
    storage:funnelLibrary.memoryStorage(),
  });
  return { api, funnel };
}

describe('METRIC-02 core journey funnel', () => {
  test('records the expected ordered journey exactly once', () => {
    const { api, funnel } = journey();
    api.setConsent('granted');
    const stages = [
      ['discovery-results', 'browse', 'discovery_search', 'results_viewed', { resultCount:6, activeFilterCount:1 }],
      ['trail-selected', 'lago-carezza', 'trail_decision', 'selected', { trailId:'lago-carezza' }],
      ['trail-opened', 'lago-carezza', 'trail_decision', 'opened', { trailId:'lago-carezza' }],
      ['explanation-viewed', 'lago-carezza', 'trail_decision', 'explanation_viewed', { trailId:'lago-carezza' }],
      ['package-ready', 'lago-carezza', 'offline_package', 'ready', { trailId:'lago-carezza', packageSizeBand:'one_to_ten_mb' }],
      ['airplane-test', 'lago-carezza', 'offline_package', 'airplane_test_passed', { trailId:'lago-carezza' }],
      ['hike-started', 'lago-carezza', 'hike_session', 'started', { trailId:'lago-carezza', connectivity:'offline', packagePresent:true }],
      ['hike-completed', 'lago-carezza', 'hike_session', 'completed', { trailId:'lago-carezza', durationBand:'over_two_minutes' }],
      ['outcome', 'lago-carezza', 'post_hike_outcome', 'appropriate', { trailId:'lago-carezza', offlinePackageUsed:true, recordedHikePresent:true, conditionsDiffered:false }],
    ];
    stages.forEach(args => {
      expect(funnel.recordOnce(...args).ok).toBe(true);
      expect(funnel.recordOnce(...args)).toEqual({ ok:true, duplicate:true });
    });
    expect(api.queued().map(event => `${event.family}:${event.state}`)).toEqual([
      'discovery_search:results_viewed',
      'trail_decision:selected',
      'trail_decision:opened',
      'trail_decision:explanation_viewed',
      'offline_package:ready',
      'offline_package:airplane_test_passed',
      'hike_session:started',
      'hike_session:completed',
      'post_hike_outcome:appropriate',
    ]);
  });

  test('does not mark a stage complete before consent is granted', () => {
    const { api, funnel } = journey();
    const args = ['trail-opened', 'lago-carezza', 'trail_decision', 'opened', { trailId:'lago-carezza' }];
    expect(funnel.recordOnce(...args)).toEqual({ ok:false, reason:'consent-required' });
    expect(funnel.recorded('trail-opened', 'lago-carezza')).toBe(false);
    api.setConsent('granted');
    expect(funnel.recordOnce(...args).ok).toBe(true);
  });

  test('allows a fresh journey after consent withdrawal and re-grant', () => {
    const { api, funnel } = journey();
    const args = ['trail-opened', 'lago-carezza', 'trail_decision', 'opened', { trailId:'lago-carezza' }];
    api.setConsent('granted');
    expect(funnel.recordOnce(...args).ok).toBe(true);
    api.setConsent('denied');
    api.setConsent('granted');
    expect(funnel.recordOnce(...args).ok).toBe(true);
    expect(api.queued()).toHaveLength(1);
  });

  test('classifies operational failures without storing error content', () => {
    expect(funnelLibrary.failureCategory(new Error('Failed to fetch'))).toBe('network');
    expect(funnelLibrary.failureCategory(new Error('checksum mismatch'))).toBe('verification');
    expect(funnelLibrary.failureCategory(new Error('IndexedDB quota exceeded'))).toBe('storage');
    expect(funnelLibrary.failureCategory(new Error('private details'))).toBe('unknown');
  });
});
