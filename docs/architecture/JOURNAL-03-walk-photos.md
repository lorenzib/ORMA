# JOURNAL-03 — A walk keeps several photos

Status: built (2026-10-26). Builds on JOURNAL-02.

## Why this changed

A journal walk held one photo, as a data URL inside the walk itself (`photo`,
at most 700 KB). A Firestore document stops at 1 MB, so a second photo could
not fit. The trail page's recorder already let people pick up to four photos
at the end of a walk, but only their count was saved; the files were dropped.

## Decision

Each photo is its own file in Firebase Storage:

    users/{uid}/journal/{entryId}/{photoId}.jpg

The walk keeps the list of ids, `photoIds` (at most six), and nothing else
about them. The project moved to the Blaze plan for this (Storage is not
available on Spark); a Google Cloud budget alert is the early warning, since
Blaze has no hard stop.

- **Private.** `storage.rules` lets only the owning account read, list, add or
  remove its photos. Everything else in the bucket is closed.
- **Small.** The page downscales to 1600 px JPEG before saving. The rule refuses
  anything that is not `image/jpeg`, is empty, or is over 2 MB, and any file not
  named `p<id>.jpg` inside a walk folder.
- **Offline first.** A new photo goes into this browser's IndexedDB
  (`orma-journal-photos`) before the walk lists it, so a walk never names a
  photo nothing holds. The journal sends waiting photos up before the walks
  that list them, and deletes removed ones the same way. Whatever fails waits
  for the next sync, and the page says the journal is not fully sent.
  localStorage is not used for photos: it holds about 5 MB.
- **Old walks keep their photo.** The inline `photo` is still read and shown
  first. It counts towards the six. It is removed only when its owner removes
  it.
- **Hike Mode.** Photos picked on the completion screen are downscaled into
  the same IndexedDB store under the walk's id, and the walk lists them, so the
  journal opens with them already there.
- **Account deletion** removes every walk photo before the walks.

## Deploy

`deploy-storage-rules.yml` deploys `storage.rules` on a push to `main` that
changes it, apart from the Firestore rules workflow, so a Storage problem
never holds up a Firestore change. The bucket needs CORS for the site's
origins, or the share card cannot draw a stored photo (an `<img>` still shows
it, through its download address).

## Tests

- `journal-photos.test.js` — ids, ordering, the local store and the sync.
- `firestore-emulator.spec.cjs` — `photoIds` accepted at six, refused at seven,
  as a string, or with an id that is not one.
- `storage-emulator.spec.cjs` — `storage.rules` on the Storage emulator, run by
  `npm run test:storage-rules` (pinned `firebase-tools`) as a quality-gate step.

## Not done

- Photos are not yet shown on trail pages, although Hike Mode still asks
  whether to share them there. That needs a public copy and moderation.
- A tab still running an older journal page can rewrite a walk without
  `photoIds`. The files stay in Storage, unlisted, until the walk is edited
  again on a current page.
