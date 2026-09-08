const discovery = require('./discovery-state');

describe('canonical discovery state', () => {
  test('round-trips search, region, filters, dog context, and page', () => {
    const input = {
      search: ' Carezza ',
      country: 'italy',
      region: 'dolomites',
      valley: 'Val di Fassa',
      risk: 'low-risk',
      distance: '6',
      duration: 'day',
      water: true,
      collection: 'water',
      dog: 'rufus',
      difficulty: 'Easy',
      terrain: 'soft',
      heat: 'shade-reviewed',
      exposure: 'none-reviewed',
      access: 'leash-ok-reviewed',
      shade: true,
      minMatch: '75',
      page: 2,
    };

    const href = discovery.browseHref(input);
    const restored = discovery.normalize(new URLSearchParams(href.split('?')[1]));

    expect(restored).toEqual({ ...input, search: 'Carezza' });
  });

  test('defaults duration to day and only serialises the multi-day opt-in', () => {
    // Absent in the URL means the default day-hike view.
    expect(discovery.normalize(new URLSearchParams('region=dolomites')).duration).toBe('day');
    // 'day' is the baseline, so it is never written to the query string...
    expect(discovery.browseHref({ duration: 'day' })).not.toContain('duration');
    // ...but the multi-day opt-in survives a round-trip.
    const href = discovery.browseHref({ duration: 'multi' });
    expect(href).toContain('duration=multi');
    expect(discovery.normalize(new URLSearchParams(href.split('?')[1])).duration).toBe('multi');
  });

  test('drops unsupported and unsafe values', () => {
    const state = discovery.normalize(new URLSearchParams(
      'search=%20Lago%20&region=../../etc&risk=perfect&dog=javascript:alert(1)&page=-4'
    ));

    expect(state.search).toBe('Lago');
    expect(state.region).toBe('');
    expect(state.risk).toBe('');
    expect(state.dog).toBe('medium');
    expect(state.page).toBe(1);
  });

  test('drops the retired verification filter from legacy links', () => {
    const state = discovery.normalize(new URLSearchParams(
      'region=dolomites&verification=route-audited'
    ));

    expect(state).not.toHaveProperty('verification');
    expect(discovery.toParams(state).has('verification')).toBe(false);
  });

  test('trail links carry the exact canonical browse return target', () => {
    const state = { search: 'Braies', country:'italy', region:'dolomites', dog:'bella', water:true };
    const trail = new URL(discovery.trailHref('lago-braies', state), 'https://www.app-orma.com/');

    expect(trail.searchParams.get('id')).toBe('lago-braies');
    expect(trail.searchParams.get('from')).toBe(discovery.browseHref(state));
  });

  test('dog context alone is not treated as a restrictive filter', () => {
    expect(discovery.hasFilters({ dog: 'rufus' })).toBe(false);
    expect(discovery.hasFilters({ dog: 'rufus', water: true })).toBe(true);
  });
});
