// St. Ulrich/Ortisei (Gemeinderat 28/2019, Art. 6) and Villnöss (Art. 8(1)(d))
// keep dogs off farmed land all year; the other communes' regulations say "in
// the growing season". A walk's dog notes naming either of the two must not
// give the season alone.
global.window = {};
require('./data/regions/dolomites-trails.js');

const ALL_YEAR = /St\. Ulrich|Ortisei|Villnöss/;

test('dog notes do not put the all-year meadow bans in a growing season', () => {
  const wrong = window.trails.filter((trail) => {
    const notes = String(trail.dogNotes || '');
    return ALL_YEAR.test(notes) && /growing season/.test(notes) && !/all year/.test(notes);
  }).map((trail) => trail.id);
  expect(wrong).toEqual([]);
});

test('St. Ulrich is cited by its own regulation, not as having none', () => {
  const text = JSON.stringify(window.trails);
  expect(text).not.toMatch(/St\. Ulrich[^.]{0,40}publishes no dog rule/);
});
