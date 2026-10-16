'use strict';

const { assignSlugs } = require('./scripts/trail-adapter');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { pinnedSlug, retiredSlugs, allRetiredSlugs,
  validateSlugOverrides, loadSlugOverrides } = require('./scripts/trail-slug-overrides');

// A slug was read off the trail's name, so renaming a trail moved its web
// address and the old one stopped working. 141 trail pages are committed and
// crawlable, and seven of them carry a tourist-office code a customer has never
// seen -- en02-le-terroir-de-serpoliere, b02-le-tour-de-l-armelaz. Fixing the
// name meant breaking the link, so neither got fixed.

const root = __dirname;
// From the producer, so these cannot pass against a trail that does not exist.
const trails = loadProductionTrails(root);
// By id, not by name: the name is now overridden to the readable one, so a
// test looking for the old code would find nothing -- which is the point.
const coded = trails.find(trail => trail.id === 'osm-12121798');

const overridesFor = (id, entry) => ({ schemaVersion: 1, trails: { [id]: entry } });

describe('a trail URL outlives its name', () => {
  test('without an override a slug comes from whatever the name is', () => {
    // Derived, as it always was. The name it derives from is now the readable
    // one, which is exactly why the address had to be pinned.
    expect(assignSlugs(trails)[trails.indexOf(coded)]).toBe('le-terroir-de-serpoliere');
    expect(coded.name).toBe('Le terroir de Serpolière');
  });

  test('the live overrides carry the renames, and the old addresses with them', () => {
    const live = loadSlugOverrides(root);
    expect(pinnedSlug(live, 'osm-12121798')).toBe('le-terroir-de-serpoliere');
    expect(retiredSlugs(live, 'osm-12121798')).toEqual(['en02-le-terroir-de-serpoliere']);
    // Every rename keeps the address it was published at, or a shared link dies.
    const renamed = Object.entries(live.trails).filter(([, entry]) => entry.name);
    expect(renamed.length).toBeGreaterThanOrEqual(13);
  });

  test('a pinned slug is where the page lives, whatever the name says', () => {
    const renamed = trails.map(trail => trail === coded
      ? { ...trail, name: 'Something else entirely' } : trail);
    const overrides = overridesFor(coded.id, { slug: 'le-terroir-de-serpoliere' });
    // The name is the reader's; the address does not move with it.
    expect(assignSlugs(renamed, overrides)[trails.indexOf(coded)])
      .toBe('le-terroir-de-serpoliere');
    // And without the pin, renaming does move it -- which is the whole problem.
    expect(assignSlugs(renamed)[trails.indexOf(coded)]).toBe('something-else-entirely');
  });

  test('a retired slug is carried so the old address can still answer', () => {
    const overrides = overridesFor(coded.id,
      { slug: 'le-terroir-de-serpoliere', retired: ['en02-le-terroir-de-serpoliere'] });
    expect(retiredSlugs(overrides, coded.id)).toEqual(['en02-le-terroir-de-serpoliere']);
    expect(allRetiredSlugs(overrides)).toEqual([['en02-le-terroir-de-serpoliere', coded.id]]);
    expect(pinnedSlug(overrides, coded.id)).toBe('le-terroir-de-serpoliere');
  });

  test('the id stays the key, and is never what an override changes', () => {
    const overrides = overridesFor(coded.id, { slug: 'anything-at-all' });
    const slugs = assignSlugs(trails, overrides);
    expect(trails.map(trail => trail.id)).toEqual(loadProductionTrails(root).map(trail => trail.id));
    expect(slugs).toHaveLength(trails.length);
  });

  test('two trails cannot be pinned to one address', () => {
    const ids = trails.slice(0, 2).map(trail => trail.id);
    const overrides = { schemaVersion: 1, trails: {
      [ids[0]]: { slug: 'shared' }, [ids[1]]: { slug: 'shared' } } };
    expect(validateSlugOverrides(overrides, trails.map(t => t.id)).join(' '))
      .toMatch(/already pinned to/);
  });

  test('a retired slug cannot be somebody else’s live address', () => {
    // The dangerous one: the redirect and the page both claim it, and which
    // answers depends on build order.
    const ids = trails.slice(0, 2).map(trail => trail.id);
    const overrides = { schemaVersion: 1, trails: {
      [ids[0]]: { slug: 'taken' }, [ids[1]]: { retired: ['taken'] } } };
    expect(validateSlugOverrides(overrides, trails.map(t => t.id)).join(' '))
      .toMatch(/live slug/);
  });

  test('a trail cannot retire the address it is living at', () => {
    const overrides = overridesFor(coded.id, { slug: 'same', retired: ['same'] });
    expect(validateSlugOverrides(overrides, trails.map(t => t.id)).join(' '))
      .toMatch(/both its slug and a retired one/);
  });

  test('an unusable slug and an unknown trail are both refused', () => {
    expect(validateSlugOverrides(overridesFor(coded.id, { slug: 'Not A Slug' }),
      trails.map(t => t.id)).join(' ')).toMatch(/not a usable slug/);
    expect(validateSlugOverrides(overridesFor('osm-nonsense', { slug: 'fine' }),
      trails.map(t => t.id)).join(' ')).toMatch(/not a trail in the catalogue/);
  });

  test('the live overrides file is valid, whatever is in it', () => {
    // So a bad entry fails here rather than in a page build.
    expect(validateSlugOverrides(loadSlugOverrides(root), trails.map(t => t.id))).toEqual([]);
  });

  test('no published name still carries an import code or a scraper artefact', () => {
    const bad = trails.filter(trail => /^\s*[A-Z]{0,3}\s?\d+[a-z]?\s*[-–—:.]\s/.test(trail.name)
      || /=>|\|/.test(trail.name) || /^[A-Z\s'’-]{8,}$/.test(trail.name));
    expect(bad.map(trail => `${trail.id}: ${trail.name}`)).toEqual([]);
  });
});
