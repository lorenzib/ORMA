// The homepage card said "We don't know the local rules for dogs" on 342 of
// 380 Dolomites walks, 301 of which carry their commune's sourced rule in
// trail.dogNotes. The scoring now reads that note.
const A = require('./scoring/recommendation-adapters-v1.js');

const access = trail => A.normalizeTrail(trail).suitability.dogAccess.status;

describe('dog rules from the walk’s dog notes', () => {
  test('a lead rule in the notes means dogs are allowed on a lead', () => {
    expect(access({ dogNotes: 'Villnöss requires dogs on a lead of at most 1.5 m on all public paths.' })).toBe('leash-required');
    expect(access({ dogNotes: 'Keep your dog on a leash near the cattle.' })).toBe('leash-required');
  });

  test('a partial ban in the notes never makes the whole walk prohibited', () => {
    expect(access({ dogNotes: 'Badia requires a lead no longer than 1.5 m everywhere. Dogs are not allowed onto farmed meadows in the growing season.' })).toBe('leash-required');
  });

  test('a walk with no rule on file stays unknown', () => {
    expect(access({})).toBe('unknown');
    expect(access({ dogNotes: 'Bring water for your dog.' })).toBe('unknown');
  });

  test('a ban in the description still wins', () => {
    expect(access({ desc: 'Dogs are not allowed in the reserve.', dogNotes: 'A lead is required.' })).toBe('prohibited');
  });
});

describe('a ban beside the path is not a ban on the walk', () => {
  const adapters = require('./scoring/recommendation-adapters-v1.js');
  const access = trail => adapters.normalizeTrail(trail).suitability.dogAccess.status;

  test.each([
    'Dogs are not allowed on farmed meadows, so keep to the path where it crosses them.',
    'From 1 April to 31 October dogs are not allowed on meadows and fields, even where there is no sign.',
    'Where signs say so, dogs are not allowed in public parks and green areas.',
    'Keep your dog on a short lead on the track through the vineyards, where dogs are not allowed.',
    'Dogs are not allowed on farmed land during the growing season, so keep your dog out of the vineyards.',
  ])('"%s" leaves the walk open', tips => {
    expect(access({ tips })).not.toBe('prohibited');
  });

  test.each([
    'Dogs are not allowed on this trail.',
    'Dogs are not permitted anywhere in the reserve.',
    'Dogs are not allowed in the national park, which the walk crosses.',
  ])('"%s" still closes it', tips => {
    expect(access({ tips })).toBe('prohibited');
  });
});
