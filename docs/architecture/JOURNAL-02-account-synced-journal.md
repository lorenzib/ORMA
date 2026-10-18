# JOURNAL-02 — The walk journal belongs to the account

Status: complete (2026-10-16). Supersedes JOURNAL-01.

## Why this changed

JOURNAL-01 kept every journal record in the browser that made it, and said so
on the page: "Private in this browser". A walk recorded on a phone was then
gone from any other browser, and gone with the browser's storage. That is not a
walk journal; it is a note that happens to survive until the next cleanup.

JOURNAL-01 did not refuse sync, it deferred it behind six requirements. Those
are answered below.

## Decision

A journal entry is account data. The browser keeps the working copy so the
journal opens, records and accepts a walk with no signal; the account keeps the
durable copy, under `users/{uid}/journal/{entryId}`.

- Local key `dolopaws-journal-<uid>` stays exactly as it was. Nothing about
  reading or writing the journal waits on a network.
- Opening the journal pulls the account's entries, merges them into the local
  list, and pushes anything the account does not have or has an older copy of.
- A failed read is not an empty account: the local copy is kept and retried.
  This is what stops a dropped signal from looking like a journal with no walks
  in it and overwriting the account with nothing.
- Saving a walk — recorded, hand-logged or from Hike Mode — writes locally
  first and stamps `updatedAt`, then pushes. An unsent walk is pushed on the
  next sync, so a walk recorded offline, or on a session restored from the
  cached profile summary, reaches the account by itself.

### Signed-out recording

`walk.html` still asks for an account before it will start recording, which is
the behaviour this change inherited and did not widen: a walk has to belong to
somebody's journal. So there is no discarded signed-out capture to adopt.

What is adopted is the case that actually loses walks: a recording made while
the account is only *locally* known — the page's own offline path, which lets a
cached member start recording while Firebase restores — or saved while the
network is down. That walk is kept locally with its `updatedAt`, and the first
sync that succeeds puts it in the account. Nothing is discarded on the way.

## Conflicts between devices

Entries are keyed by id and compared by `updatedAt`, falling back to the walk's
own date. The later edit of the same walk wins; a walk only one side has is
kept. A journal never silently loses a walk, and deleting a walk is an explicit
act that goes to the account, not an absence inferred from a list.

Entry ids are `w<timestamp>-<random>`: before this, two devices saving a walk in
the same millisecond would have minted the same id, and one walk would have
overwritten the other in the account.

## What a stored entry may contain

`journal-store.js` owns the shape, and `firestore.rules` mirrors it with a
closed key list. Fields outside the list are refused by the server, not just
by the client.

Firestore cannot nest arrays, so a walk's track travels as one string:
stretches separated by `|`, points by `;`, coordinates by `,` at five decimal
places. The `|` marks are the breaks where the phone stopped reporting, and
they survive the round trip, so an unrecorded stretch is still drawn as a gap
on another device. The track is bounded at 60,000 characters and truncated on
a point boundary; a photo over 700,000 characters stays on the device rather
than being refused by the rule.

## The six requirements JOURNAL-01 set

1. **Opt-in and a useful no-sync mode.** Not taken. Syncing a member's own
   private records to their own account is what signing in is for, and the
   product said it did this ("Walks are saved to your journal, so recording
   needs your account") while not doing it. The offline path is the no-sync
   mode: the journal works in full with no network.
2. **Owner-only authorization.** `users/{uid}/journal/{entryId}` is readable,
   listable and writable by its owner alone, proven against the emulator. No
   journal field is projected onto a public profile.
3. **Bounded records and photos.** Above, enforced in the rule.
4. **Offline conflict and retry.** Above: local-first, newest edit wins,
   unsent entries retried on the next sync.
5. **Deletion across devices.** Account deletion removes every
   `users/{uid}/journal` document before the sign-in is removed, and reports
   how many were removed; "Remove all local data" still clears the local keys.
6. **Export and disclosure.** "Download my data" exports the account's journal
   as it already did, from the local copy that sync keeps current. The privacy
   page and the journal page both now say the journal is saved to the account,
   private to its owner, and deleted with the account.

## What this does not do

No end-to-end encryption: the journal is stored like the rest of the member's
private profile data, protected by the owner-only rule. No sharing, no public
activity feed, no server-side processing of journal content.
