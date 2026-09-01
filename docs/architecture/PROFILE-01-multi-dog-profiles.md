# PROFILE-01 — Multiple dog profiles

**Status:** Complete in code; physical and observed usability coverage remains part of QA-03.

## Product boundary

An account may keep up to five dog profiles. Exactly one existing dog is the
active dog used by recommendation, trail-ranking, navigation preparation, and
the shared profile summary. Multiple dogs are optional supporting account
functionality; creating a second dog is not required to complete the core beta
journey.

## Storage contract

The private `users/{uid}` document stores:

- `dogs`: the bounded list of sanitized profiles;
- `activeDogId`: the selected dog identifier; and
- `dog`: a compatibility mirror of the active dog for older deployed clients.

Adding a dog appends a new profile instead of overwriting an existing one.
Switching changes only `activeDogId` and the compatibility mirror. Each dog
owns a bounded gallery of up to four compressed data-image photos. `photo`
remains the primary/avatar compatibility field and mirrors the first item in
`photos`; selecting or editing another dog must not copy that gallery. The
client also bounds total account photo data before syncing so the private user
document stays below Firestore's document limit. The legacy single-photo dog
record is migrated into the gallery once and is not repeatedly duplicated.

## User experience

- The homepage and account screen expose the same explicit dog switch.
- Both add-dog entry points use the shared comprehensive breed catalogue.
- Adding from the homepage and from account management uses the same append
  operation and returns to the same account experience.
- A dog can be removed only when another dog remains.
- Removing the active dog selects a remaining profile deterministically.
- Moderator access is an account capability and never appears as a dog trait.

## Safety and security

Firestore validates the bounded list, each dog shape, and `activeDogId` as
private owner data. Client-side switching is not an authorization boundary.
Recommendation consumers always resolve the active dog through the shared
profile summary, preventing different pages from silently scoring different
dogs.

## Verification

`multi-dog-profile.test.js` covers append, select, remove, legacy migration,
photo isolation, shared breed data, homepage switching, account-screen
behavior, and the charter scope. Firestore emulator tests cover the private
owner boundary and valid multi-dog document shape.
