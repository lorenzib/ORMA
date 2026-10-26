const fs = require('fs');
const path = require('path');
const store = require('./journal-store.js');
const photos = require('./journal-photos.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const INLINE = 'data:image/jpeg;base64,AAAA';

describe('JOURNAL-03 a walk keeps several photos', () => {
  test('photo ids are minted unique and in the shape both rules accept', () => {
    const ids = new Set(Array.from({ length:50 }, () => photos.newPhotoId(1770000000000)));
    expect(ids.size).toBe(50);
    ids.forEach(id => {
      expect(id).toMatch(/^p[a-z0-9]{6,32}$/);
      expect(photos.validPhotoId(id)).toBe(true);
    });
    expect(photos.validPhotoId('../p123456')).toBe(false);
    expect(photos.validPhotoId('P1234567')).toBe(false);
  });

  test('a walk shows its old inline photo first, then at most six in all', () => {
    const ids = Array.from({ length:8 }, (_, i) => `p00000${i}aa`);
    expect(photos.photoListOf({ photoIds:ids })).toHaveLength(6);
    const withInline = photos.photoListOf({ photo:INLINE, photoIds:ids });
    expect(withInline).toHaveLength(6);
    expect(withInline[0]).toBe(photos.LEGACY_ID);
    expect(photos.photoListOf({ photoIds:['p000000aa', 'p000000aa', 'nope', 7] })).toEqual(['p000000aa']);
    expect(photos.photoListOf({})).toEqual([]);
  });

  test('photo paths stay inside the owner\'s walk folder', () => {
    expect(photos.photoPath('owner-1', 'w1770000000000-aa11bb', 'p000000aa'))
      .toBe('users/owner-1/journal/w1770000000000-aa11bb/p000000aa.jpg');
    expect(photos.photoPath('owner-1', '../other', 'p000000aa')).toBe('');
    expect(photos.photoPath('owner-1', 'w1', '../../x')).toBe('');
    expect(photos.photoPath('', 'w1', 'p000000aa')).toBe('');
  });
});

describe('the account copy of a walk lists its photos', () => {
  const entry = { id:'w1770000000000-aa11bb', date:'2026-10-20T08:00:00.000Z', trail:'Lago', updatedAt:1 };

  test('photo ids travel to the account and back', () => {
    const remote = store.toRemote({ ...entry, photoIds:['p000000aa', 'p000000bb'] }, { now:1 });
    expect(remote.photoIds).toEqual(['p000000aa', 'p000000bb']);
    expect(store.fromRemote(remote).photoIds).toEqual(['p000000aa', 'p000000bb']);
  });

  test('a walk without stored photos writes exactly the fields older rules accept', () => {
    expect(store.toRemote(entry, { now:1 })).not.toHaveProperty('photoIds');
    expect(store.toRemote({ ...entry, photoIds:[] }, { now:1 })).not.toHaveProperty('photoIds');
  });

  test('an older walk keeps its inline photo, which counts towards the six', () => {
    const ids = Array.from({ length:6 }, (_, i) => `p00000${i}aa`);
    const remote = store.toRemote({ ...entry, photo:INLINE, photoIds:ids }, { now:1 });
    expect(remote.photo).toBe(INLINE);
    expect(remote.photoIds).toHaveLength(5);
    const back = store.fromRemote(remote);
    expect(back.photo).toBe(INLINE);
    expect(photos.photoListOf(back)).toHaveLength(6);
  });
});

describe('this browser\'s copy of the photos', () => {
  const blob = { size:10 };

  test('a new photo waits for the account; a removed one waits to be deleted there', async () => {
    const local = photos.createLocalStore(photos.memoryBackend());
    await local.add('u1', 'w1', 'p000000aa', blob);
    await local.add('u1', 'w1', 'p000000bb', blob);
    await local.add('u2', 'w9', 'p000000cc', blob);
    expect((await local.outstanding('u1')).map(row => row.photoId).sort()).toEqual(['p000000aa', 'p000000bb']);
    expect(await local.get('u1', 'w1', 'p000000aa')).toBe(blob);

    await local.markSynced('u1', 'w1', 'p000000aa');
    // Removing a photo the account has queues its deletion…
    await local.remove('u1', 'w1', 'p000000aa');
    // …removing one it never had just drops it.
    await local.remove('u1', 'w1', 'p000000bb');
    const left = await local.outstanding('u1');
    expect(left).toEqual([expect.objectContaining({ photoId:'p000000aa', state:'delete', blob:null })]);
    expect(await local.get('u1', 'w1', 'p000000aa')).toBeNull();
  });

  test('a sync uploads and deletes, and keeps whatever failed for next time', async () => {
    const local = photos.createLocalStore(photos.memoryBackend());
    await local.add('u1', 'w1', 'p000000aa', blob);
    await local.add('u1', 'w1', 'p000000bb', blob);
    await local.keep('u1', 'w1', 'p000000cc', blob);
    await local.remove('u1', 'w1', 'p000000cc');
    const uploaded = [];
    const deleted = [];
    const remote = {
      upload: (entryId, photoId) => {
        if(photoId === 'p000000bb') return Promise.resolve(false);
        uploaded.push(`${entryId}/${photoId}`);
        return Promise.resolve(true);
      },
      remove: (entryId, photoId) => { deleted.push(`${entryId}/${photoId}`); return Promise.resolve(true); },
    };
    expect(await photos.syncOutstanding(local, 'u1', remote)).toEqual({ done:2, left:1 });
    expect(uploaded).toEqual(['w1/p000000aa']);
    expect(deleted).toEqual(['w1/p000000cc']);
    expect((await local.outstanding('u1')).map(row => row.photoId)).toEqual(['p000000bb']);
    // A thrown upload is a failure like any other, not the end of the sync.
    const flaky = { upload: () => Promise.reject(new Error('offline')), remove: remote.remove };
    expect(await photos.syncOutstanding(local, 'u1', flaky)).toEqual({ done:0, left:1 });
  });
});

describe('the pages use it', () => {
  const journal = read('journal.html');
  const hike = read('hike-mode.js');

  test('the after-walk sheet takes several photos and the row shows the first plus a count', () => {
    expect(journal).toContain('<script src="journal-photos.js?v=');
    expect(journal).toContain('id="jnAfterPhotos"');
    expect(journal).toContain('id="jnAfterPhotoInput" accept="image/*" multiple');
    expect(journal).toContain("'<span class=\"jn-thumb-more\">+' + (photos.length - 1) + '</span>'");
    // Photos go up before the walks that list them.
    expect(journal.indexOf('return syncPhotos().then(')).toBeGreaterThan(journal.indexOf('function pushUnsentEntries()'));
  });

  test('photos picked during a walk reach the walk', () => {
    expect(hike).toContain('keepPhotos(user, id).then(photoIds =>');
    expect(hike).toContain('store.add(user.uid, entryId, photoId, blob)');
    expect(hike).not.toContain('slice(0, 4 - photos.length)');
    const { SOURCES } = require('./scripts/build-trail-page-bundle.js');
    expect(SOURCES.indexOf('journal-photos.js')).toBeGreaterThan(SOURCES.indexOf('journal-store.js'));
    expect(SOURCES.indexOf('journal-photos.js')).toBeLessThan(SOURCES.indexOf('hike-mode.js'));
  });

  test('deleting an account takes the walk photos too', () => {
    const client = read('firebase-init.js');
    const del = client.slice(client.indexOf('async function deleteAccount('));
    expect(del.indexOf('await deleteAllJournalPhotos(uid);'))
      .toBeLessThan(del.indexOf('getDocs(collection(db, "users", uid, "journal"))'));
  });

  test('Storage rules deploy on their own, apart from Firestore', () => {
    const workflow = read('.github/workflows/deploy-storage-rules.yml');
    expect(workflow).toContain('- storage.rules');
    expect(workflow).toContain('deploy --only storage --project dolopaws');
    expect(read('.github/workflows/deploy-firestore-rules.yml')).not.toContain('storage');
  });
});
