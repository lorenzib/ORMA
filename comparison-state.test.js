const comparison = require('./comparison-state');

function memoryStorage(initial){
  let value = initial || null;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    value: () => value,
  };
}

describe('comparison selection state', () => {
  test('normalizes unique allowlisted IDs and caps selection at three', () => {
    expect(comparison.normalizeIds(
      ['lago-carezza', 'bad/id', 'lago-carezza', 'lago-braies', 'alpe-siusi', 'fourth'],
      ['lago-carezza', 'lago-braies', 'alpe-siusi', 'fourth']
    )).toEqual(['lago-carezza', 'lago-braies', 'alpe-siusi']);
  });

  test('persists a versioned selection and fails safely on corrupt storage', () => {
    const storage = memoryStorage();
    comparison.save(storage, ['lago-carezza', 'lago-braies']);
    expect(comparison.load(storage)).toEqual(['lago-carezza', 'lago-braies']);
    expect(comparison.load(memoryStorage('{broken'))).toEqual([]);
  });

  test('toggle removes an existing trail and refuses a fourth trail', () => {
    expect(comparison.toggle(['one','two'], 'one')).toEqual(['two']);
    expect(comparison.toggle(['one','two','three'], 'four')).toEqual(['one','two','three']);
  });

  test('comparison URL preserves dog and validated Browse return context', () => {
    const href = comparison.compareHref(['lago-carezza','lago-braies'], {
      dog:'rufus',
      from:'browse-trails.html?region=dolomites&water=1',
    });
    const url = new URL(href, 'https://www.dolopaws.com/');
    expect(url.searchParams.get('ids')).toBe('lago-carezza,lago-braies');
    expect(url.searchParams.get('dog')).toBe('rufus');
    expect(url.searchParams.get('from')).toBe('browse-trails.html?region=dolomites&water=1');
  });
});
