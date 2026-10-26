/** @jest-environment node */

// JOURNAL-03 — storage.rules against the real Storage emulator. Run by
// scripts/run-storage-rules-tests.cjs, which starts the emulator around it.

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { ref, uploadBytes, getBytes, deleteObject, listAll } = require('firebase/storage');
const photos = require('./journal-photos.js');

const PROJECT_ID = 'demo-dolopaws';
const BUCKET = 'dolopaws.firebasestorage.app';
let testEnv;

const storageFor = uid => testEnv.authenticatedContext(uid).storage(`gs://${BUCKET}`);
const guestStorage = () => testEnv.unauthenticatedContext().storage(`gs://${BUCKET}`);
const jpeg = (bytes = 2048) => new Uint8Array(bytes).fill(7);
const JPEG = { contentType:'image/jpeg' };

beforeAll(async () => {
  const [host, rawPort] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199').split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      host,
      port: Number(rawPort),
      rules: fs.readFileSync(path.join(__dirname, 'storage.rules'), 'utf8'),
    },
  });
});

afterEach(async () => {
  await testEnv.clearStorage();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('walk photos belong to their account', () => {
  const entryId = 'w1770000000000-aa11bb';
  const photoId = photos.newPhotoId(1770000000000);
  const photoPath = photos.photoPath('owner-1', entryId, photoId);

  test('only the owner may add, read, list and remove a photo', async () => {
    const owner = storageFor('owner-1');
    const other = storageFor('other-1');

    await assertSucceeds(uploadBytes(ref(owner, photoPath), jpeg(), JPEG));
    await assertSucceeds(getBytes(ref(owner, photoPath)));
    await assertSucceeds(listAll(ref(owner, 'users/owner-1/journal')));

    await assertFails(getBytes(ref(other, photoPath)));
    await assertFails(getBytes(ref(guestStorage(), photoPath)));
    await assertFails(listAll(ref(other, 'users/owner-1/journal')));
    await assertFails(uploadBytes(ref(other, photoPath), jpeg(), JPEG));
    await assertFails(uploadBytes(ref(guestStorage(), photoPath), jpeg(), JPEG));
    await assertFails(deleteObject(ref(other, photoPath)));
    await assertSucceeds(deleteObject(ref(owner, photoPath)));
  });

  test('only a small JPEG, named as the journal names it, inside a walk folder', async () => {
    const owner = storageFor('owner-1');
    const base = `users/owner-1/journal/${entryId}`;

    await assertFails(uploadBytes(ref(owner, photoPath), jpeg(), { contentType:'image/png' }));
    await assertFails(uploadBytes(ref(owner, photoPath), jpeg(), { contentType:'text/html' }));
    await assertFails(uploadBytes(ref(owner, photoPath), jpeg(2 * 1024 * 1024 + 1), JPEG));
    await assertFails(uploadBytes(ref(owner, photoPath), new Uint8Array(0), JPEG));
    await assertFails(uploadBytes(ref(owner, `${base}/index.html`), jpeg(), JPEG));
    await assertFails(uploadBytes(ref(owner, `${base}/${photoId}.jpg/extra.jpg`), jpeg(), JPEG));
    await assertFails(uploadBytes(ref(owner, `users/owner-1/${photoId}.jpg`), jpeg(), JPEG));
    await assertFails(uploadBytes(ref(owner, `public/${photoId}.jpg`), jpeg(), JPEG));
    // Right at the limit is fine.
    await assertSucceeds(uploadBytes(ref(owner, photoPath), jpeg(2 * 1024 * 1024), JPEG));
  });
});
