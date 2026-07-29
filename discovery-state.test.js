const discovery = require('./discovery-state');

describe('canonical discovery state', () => {
  test('round-trips search, region, filters, dog context, and page', () => {
    const input = {
      search: ' Carezza ',
      region: 'dolomites',
      risk: 'low-risk',
      distance: '6',
      water: true,
      collection: 'water',
      dog: 'rufus',
      difficulty: 'Easy',
      terrain: 'soft',
      shade: true,
      minMatch: '75',
      page: 2,
    };

    const href = discovery.browseHref(input);
    const restored = discovery.normalize(new URLSearchParams(href.split('?')[1]));

    expect(restored).toEqual({ ...input, search: 'Carezza' });
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

  test('trail links carry the exact canonical browse return target', () => {
    const state = { search: 'Braies', region: 'dolomites', dog: 'bella', water: true };
    const trail = new URL(discovery.trailHref('lago-braies', state), 'https://www.dolopaws.com/');

    expect(trail.searchParams.get('id')).toBe('lago-braies');
    expect(trail.searchParams.get('from')).toBe(discovery.browseHref(state));
  });

  test('dog context alone is not treated as a restrictive filter', () => {
    expect(discovery.hasFilters({ dog: 'rufus' })).toBe(false);
    expect(discovery.hasFilters({ dog: 'rufus', water: true })).toBe(true);
  });
});
