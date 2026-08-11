const parity = require('./scripts/check-i18n-parity.js');

describe('I18N-01 dictionary and reference boundary', () => {
  test('English and Italian dictionaries have matching keys and placeholders', () => {
    const result = parity.audit(__dirname);
    expect(result.errors).toEqual([]);
    expect(result.en.size).toBeGreaterThan(350);
    expect(result.it.size).toBe(result.en.size);
  });

  test('placeholder extraction is order-independent but name-sensitive', () => {
    expect(parity.placeholders('{name} has {n} walks; hello {name}')).toEqual(['n', 'name']);
  });
});
