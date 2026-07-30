const context = require('./guest-context');

function storage(){
  const data = new Map();
  return {
    getItem:key => data.has(key) ? data.get(key) : null,
    setItem:(key, value) => data.set(key, value),
    removeItem:key => data.delete(key),
    data,
  };
}

const NOW = Date.UTC(2026, 6, 30, 10, 0, 0);

describe('UX-05 guest context contract', () => {
  test('captures trail action, return target, and discovery state', () => {
    const store = storage();
    const record = context.capture(store, {
      action:'download',
      trailId:'lago-carezza',
      returnTarget:'trail.html?id=lago-carezza&action=download',
      discovery:{ region:'dolomites', distance:'5', water:'1', unsafe:'drop-me' },
    }, NOW);

    expect(record.action).toBe('download');
    expect(record.trailId).toBe('lago-carezza');
    expect(record.discovery).toEqual({ region:'dolomites', distance:'5', water:'1' });
    expect(context.load(store, NOW)).toEqual(record);
  });

  test('action consumption is trail-bound and single-use', () => {
    const store = storage();
    context.capture(store, {
      action:'save',
      trailId:'lago-carezza',
      returnTarget:'trail.html?id=lago-carezza',
    }, NOW);

    expect(context.consumeAction(store, 'save', 'another-trail', NOW)).toBeNull();
    expect(context.consumeAction(store, 'save', 'lago-carezza', NOW))
      .toEqual(expect.objectContaining({ action:'save', trailId:'lago-carezza' }));
    expect(context.consumeAction(store, 'save', 'lago-carezza', NOW)).toBeNull();
  });

  test('expired and malformed state fails closed and is removed', () => {
    const store = storage();
    store.setItem(context.STORAGE_KEY, JSON.stringify({
      version:1,
      createdAt:NOW - context.MAX_AGE_MS - 1,
      action:'save',
    }));
    expect(context.load(store, NOW)).toBeNull();
    expect(store.getItem(context.STORAGE_KEY)).toBeNull();

    store.setItem(context.STORAGE_KEY, '{bad json');
    expect(context.load(store, NOW)).toBeNull();
  });

  test('legacy dog profile is only adopted with a fresh timestamped draft', () => {
    const store = storage();
    store.setItem('dolopaws-pending-dog-profile', JSON.stringify({
      name:'Eddie', breed:'Podenco', fitness:'high',
    }));
    store.setItem('dolopaws-dog-draft', JSON.stringify({
      ts:NOW - 1000,
      data:{ name:'Eddie' },
    }));

    const record = context.adoptLegacyDogDraft(store, NOW);
    expect(record.dogDraft.profile.name).toBe('Eddie');
    expect(store.getItem('dolopaws-pending-dog-profile')).toBeNull();
  });

  test('a newer account profile produces a conflict, never an overwrite decision', () => {
    const pending = {
      dogDraft:{ profile:{ name:'Eddie' }, updatedAt:NOW },
    };
    expect(context.migrationState(pending, { name:'Luna' })).toEqual({
      kind:'conflict',
      draft:{ name:'Eddie' },
      existing:{ name:'Luna' },
    });
    expect(context.migrationState(pending, null).kind).toBe('ready');
  });

  test('unsafe return targets and excess profile fields are discarded', () => {
    expect(context.safeReturnTarget('https://evil.example/trail.html')).toBe('');
    expect(context.safeReturnTarget('/trail.html?id=x')).toBe('');
    expect(context.safeReturnTarget('trail.html?id=lago-carezza')).toContain('trail.html');
    const clean = context.sanitizeProfile({
      name:' Eddie ',
      breed:'Podenco',
      email:'private@example.com',
      token:'secret',
    });
    expect(clean.email).toBeUndefined();
    expect(clean.token).toBeUndefined();
  });
});
