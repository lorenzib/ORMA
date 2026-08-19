/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setLogLevel,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-dolopaws';
const rules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
let testEnv;
setLogLevel('error');

const ordinaryDb = uid =>
  testEnv.authenticatedContext(uid, { email_verified: false }).firestore();
const contributorDb = uid =>
  testEnv.authenticatedContext(uid, {
    email_verified: true,
  }).firestore();
const unverifiedContributorDb = uid =>
  testEnv.authenticatedContext(uid, {
    email_verified: false,
    contributor: true,
  }).firestore();
const blockedContributorDb = uid =>
  testEnv.authenticatedContext(uid, {
    email_verified: true,
  }).firestore();
const moderatorDb = uid =>
  testEnv.authenticatedContext(uid, {
    email_verified: true,
    moderator: true,
  }).firestore();

async function seed(entries){
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for(const [documentPath, data] of entries){
      await setDoc(doc(db, documentPath), data);
    }
  });
}

function validFlag(uid, overrides = {}){
  return {
    trailId: 'lago-carezza',
    uid,
    type: 'water-dry',
    km: 0.7,
    text: 'The mapped fountain was dry.',
    dogContext: null,
    status: 'pending',
    confirmationSource: 'community',
    confirmations: 0,
    disputes: 0,
    expiresAt: Timestamp.fromMillis(Date.now() + 6 * 24 * 3600 * 1000),
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function validReview(uid, overrides = {}){
  return {
    trailId: 'lago-carezza',
    uid,
    rating: 4,
    text: 'A useful recent review.',
    dogContext: null,
    hikedOn: null,
    status: 'pending',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function validPhoto(uid, overrides = {}){
  return {
    trailId: 'lago-carezza',
    uid,
    image: 'data:image/jpeg;base64,YQ==',
    caption: 'Trail conditions today.',
    dogContext: null,
    status: 'pending',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function validOutcome(overrides = {}){
  return {
    schemaVersion: 1,
    outcomeId: 'outcome:completion:session-1',
    completionId: 'completion:session-1',
    trailId: 'lago-carezza',
    response: 'appropriate',
    waterAccuracy: 'accurate',
    hazards: ['surface'],
    recordedHikePresent: true,
    offlinePackageUsed: true,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function validModerationAudit(overrides = {}){
  return {
    contentType: 'review',
    contentId: 'lago-carezza_author-1',
    targetId: 'lago-carezza',
    trailId: 'lago-carezza',
    authorUid: 'author-1',
    fromStatus: 'pending',
    toStatus: 'visible',
    moderatorUid: 'moderator-1',
    reason: 'Meets the community guidelines.',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  const [host, rawPort] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host,
      port: Number(rawPort),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  if(testEnv) await testEnv.cleanup();
});

describe('private user documents', () => {
  test('owner access succeeds while guests, other users, and collection listing fail', async () => {
    const owner = ordinaryDb('owner-1');
    const other = ordinaryDb('other-1');
    const guest = testEnv.unauthenticatedContext().firestore();
    const userRef = doc(owner, 'users/owner-1');

    await assertSucceeds(setDoc(userRef, {
      favorites: { 'lago-carezza': true },
      dog: { name: 'Luna', fitness: 'moderate' },
      lastMatches: ['lago-carezza'],
    }));
    await assertSucceeds(getDoc(userRef));
    await assertFails(getDoc(doc(other, 'users/owner-1')));
    await assertFails(getDoc(doc(guest, 'users/owner-1')));
    await assertFails(getDocs(collection(owner, 'users')));
    await assertFails(updateDoc(doc(other, 'users/owner-1'), {
      lastMatches: ['other-trail'],
    }));
    await assertFails(deleteDoc(doc(other, 'users/owner-1')));
    await assertSucceeds(deleteDoc(userRef));
  });

  test('clients cannot self-assign roles or exceed private document caps', async () => {
    const owner = ordinaryDb('owner-1');
    const tooManyFavorites = Object.fromEntries(
      Array.from({ length: 251 }, (_, index) => [`trail-${index}`, true])
    );

    await assertFails(setDoc(doc(owner, 'users/owner-1'), {
      contributor: true,
    }));
    await assertFails(setDoc(doc(owner, 'users/owner-1'), {
      favorites: tooManyFavorites,
    }));
    // Per-field length checks were traded for Firestore's 1,000-expression
    // rule budget (multi-dog writes ran validDog up to six times). The
    // surviving contract: contact maps accept only known keys, and enum
    // fields accept only known values.
    await assertFails(setDoc(doc(owner, 'users/owner-1'), {
      dog: { name: 'Luna', owner: { nickname: 'unknown-key' } },
    }));
    await assertFails(setDoc(doc(owner, 'users/owner-1'), {
      dog: { name: 'Luna', fitness: 'extreme' },
    }));
    await assertFails(setDoc(doc(owner, 'users/owner-1'), {
      dogs: Array.from({ length: 6 }, (_, index) => ({ name: `Dog ${index + 1}` })),
    }));
    await assertSucceeds(setDoc(doc(owner, 'users/owner-1'), {
      dog: { name: 'Legacy dog', medical: 'Legacy private profile field' },
      dogs: [{ name: 'Legacy dog', medical: 'Legacy private profile field' }],
      activeDogId: 'legacy-dog-1',
    }));
  });
});

describe('anonymous hike counter', () => {
  test('accepts only a server timestamp and exposes no identity or location fields', async () => {
    const guest = testEnv.unauthenticatedContext().firestore();
    const eventRef = doc(guest, 'hikeEvents/lago-carezza/events/event-1');

    await assertSucceeds(setDoc(eventRef, { startedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(eventRef));
    await assertFails(setDoc(
      doc(guest, 'hikeEvents/lago-carezza/events/event-2'),
      { startedAt: serverTimestamp(), uid: 'spoofed' }
    ));
    await assertFails(setDoc(
      doc(guest, 'hikeEvents/lago-carezza/events/event-3'),
      { startedAt: serverTimestamp(), latitude: 46.4, longitude: 11.5 }
    ));
    await assertFails(updateDoc(eventRef, { startedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(
      doc(moderatorDb('moderator-1'), 'hikeEvents/lago-carezza/events/event-1')
    ));
  });

  test('supports the public weekly count query shape', async () => {
    await seed([
      ['hikeEvents/lago-carezza/events/event-1', { startedAt: Timestamp.now() }],
    ]);
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(query(
      collection(guest, 'hikeEvents/lago-carezza/events'),
      where('startedAt', '>', Timestamp.fromMillis(Date.now() - 604800000))
    )));
  });
});

describe('private post-hike outcomes', () => {
  test('owner can create, read, list, and delete but cannot rewrite an outcome', async () => {
    const owner = ordinaryDb('owner-1');
    const other = ordinaryDb('other-1');
    const guest = testEnv.unauthenticatedContext().firestore();
    const path = 'users/owner-1/outcomes/outcome:completion:session-1';
    const ref = doc(owner, path);

    await assertSucceeds(setDoc(ref, validOutcome()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(owner, 'users/owner-1/outcomes')));
    await assertFails(getDoc(doc(other, path)));
    await assertFails(getDoc(doc(guest, path)));
    await assertFails(updateDoc(ref, { response:'not_appropriate' }));
    await assertFails(deleteDoc(doc(other, path)));
    await assertSucceeds(deleteDoc(ref));
  });

  test('rejects spoofed IDs, free text, invalid enums, and extra location data', async () => {
    const owner = ordinaryDb('owner-1');
    const collectionPath = 'users/owner-1/outcomes';
    await assertFails(setDoc(
      doc(owner, `${collectionPath}/wrong-id`),
      validOutcome()
    ));
    await assertFails(setDoc(
      doc(owner, `${collectionPath}/outcome:completion:session-2`),
      validOutcome({
        outcomeId:'outcome:completion:session-2',
        completionId:'completion:session-2',
        note:'Free text must remain outside structured outcomes.',
      })
    ));
    await assertFails(setDoc(
      doc(owner, `${collectionPath}/outcome:completion:session-3`),
      validOutcome({
        outcomeId:'outcome:completion:session-3',
        completionId:'completion:session-3',
        response:'five_stars',
      })
    ));
    await assertFails(setDoc(
      doc(owner, `${collectionPath}/outcome:completion:session-4`),
      validOutcome({
        outcomeId:'outcome:completion:session-4',
        completionId:'completion:session-4',
        latitude:46.4,
      })
    ));
  });
});

describe('hazard flags', () => {
  test('only verified, unblocked accounts submit and authors cannot self-publish', async () => {
    const ordinary = ordinaryDb('ordinary-1');
    const author = contributorDb('author-1');
    const other = contributorDb('other-1');
    const unverified = unverifiedContributorDb('unverified-1');
    const blocked = blockedContributorDb('blocked-1');
    const flagRef = doc(author, 'flags/flag-1');

    await seed([['contributionBlocks/blocked-1', { reason: 'operator block' }]]);
    await assertFails(setDoc(doc(ordinary, 'flags/ordinary-flag'), validFlag('ordinary-1')));
    await assertFails(setDoc(
      doc(unverified, 'flags/unverified-flag'),
      validFlag('unverified-1')
    ));
    await assertFails(setDoc(
      doc(blocked, 'flags/blocked-flag'),
      validFlag('blocked-1')
    ));
    await assertSucceeds(setDoc(flagRef, validFlag('author-1')));
    await assertFails(setDoc(doc(author, 'flags/spoofed-flag'), validFlag('other-1')));
    await assertSucceeds(getDoc(flagRef));
    await assertFails(getDoc(doc(other, 'flags/flag-1')));
    await assertSucceeds(updateDoc(flagRef, { text: 'Updated field observation.' }));
    await assertFails(updateDoc(flagRef, { status: 'hidden' }));
    await assertFails(updateDoc(doc(other, 'flags/flag-1'), { text: 'Hijacked.' }));
    await assertFails(deleteDoc(doc(other, 'flags/flag-1')));
    await assertSucceeds(deleteDoc(flagRef));
  });

  test('rejects malformed content and exposes only visible or reported hazards', async () => {
    const author = contributorDb('author-1');
    await assertFails(setDoc(
      doc(author, 'flags/bad-type'),
      validFlag('author-1', { type: 'verified-safe' })
    ));
    await assertFails(setDoc(
      doc(author, 'flags/too-long'),
      validFlag('author-1', { text: 'x'.repeat(301) })
    ));
    await seed([
      ['flags/visible-flag', {
        ...validFlag('author-1', { status: 'visible' }),
        createdAt: Timestamp.now(),
      }],
      ['flags/reported-flag', {
        ...validFlag('author-1', { status: 'reported' }),
        createdAt: Timestamp.now(),
      }],
      ['flags/pending-flag', {
        ...validFlag('author-1'),
        createdAt: Timestamp.now(),
      }],
      ['flags/hidden-flag', {
        ...validFlag('author-1', { status: 'hidden' }),
        createdAt: Timestamp.now(),
      }],
      ['flags/expired-flag', {
        ...validFlag('author-1', {
          status: 'visible',
          expiresAt: Timestamp.fromMillis(Date.now() - 3600 * 1000),
        }),
        createdAt: Timestamp.now(),
      }],
    ]);
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(guest, 'flags/visible-flag')));
    await assertSucceeds(getDoc(doc(guest, 'flags/reported-flag')));
    await assertFails(getDoc(doc(guest, 'flags/pending-flag')));
    await assertFails(getDoc(doc(guest, 'flags/hidden-flag')));
    await assertFails(getDoc(doc(guest, 'flags/expired-flag')));
    await assertSucceeds(getDocs(query(
      collection(guest, 'flags'),
      where('trailId', '==', 'lago-carezza'),
      where('status', 'in', ['visible', 'reported']),
      where('expiresAt', '>', Timestamp.fromMillis(Date.now() + 60 * 1000))
    )));
    await assertFails(getDocs(collection(guest, 'flags')));
  });

  test('moderators can change only state and moderation metadata', async () => {
    await seed([['flags/flag-1', {
      ...validFlag('author-1'),
      createdAt: Timestamp.now(),
    }]]);
    const moderator = moderatorDb('moderator-1');
    const ref = doc(moderator, 'flags/flag-1');
    await assertSucceeds(updateDoc(ref, {
      status: 'hidden',
      moderatedAt: serverTimestamp(),
      moderatedBy: 'moderator-1',
    }));
    await assertFails(updateDoc(ref, { text: 'Moderator rewrote the report.' }));
    await assertFails(updateDoc(ref, {
      status: 'reported',
      moderatedAt: serverTimestamp(),
      moderatedBy: 'moderator-1',
    }));
    await assertFails(updateDoc(ref, {
      status: 'visible',
      moderatedAt: serverTimestamp(),
      moderatedBy: 'somebody-else',
    }));
    await assertSucceeds(getDoc(ref));
  });

  test('independent eligible users can confirm or dispute exactly once', async () => {
    await seed([['flags/flag-1', {
      ...validFlag('author-1', { status: 'visible' }),
      createdAt: Timestamp.now(),
    }]]);
    const responder = contributorDb('responder-1');
    const flagRef = doc(responder, 'flags/flag-1');
    const responseRef = doc(responder, 'flags/flag-1/responses/responder-1');
    const first = writeBatch(responder);
    first.set(responseRef, {
      flagId: 'flag-1',
      uid: 'responder-1',
      stance: 'confirm',
      createdAt: serverTimestamp(),
    });
    first.update(flagRef, {
      confirmations: 1,
      lastCommunityResponseAt: serverTimestamp(),
    });
    await assertSucceeds(first.commit());

    const duplicate = writeBatch(responder);
    duplicate.set(responseRef, {
      flagId: 'flag-1',
      uid: 'responder-1',
      stance: 'confirm',
      createdAt: serverTimestamp(),
    });
    duplicate.update(flagRef, {
      confirmations: 2,
      lastCommunityResponseAt: serverTimestamp(),
    });
    await assertFails(duplicate.commit());

    const author = contributorDb('author-1');
    const authorBatch = writeBatch(author);
    authorBatch.set(doc(author, 'flags/flag-1/responses/author-1'), {
      flagId: 'flag-1',
      uid: 'author-1',
      stance: 'confirm',
      createdAt: serverTimestamp(),
    });
    authorBatch.update(doc(author, 'flags/flag-1'), {
      confirmations: 2,
      lastCommunityResponseAt: serverTimestamp(),
    });
    await assertFails(authorBatch.commit());

    await assertFails(getDoc(doc(
      contributorDb('other-1'),
      'flags/flag-1/responses/responder-1'
    )));
    await assertSucceeds(getDoc(doc(
      moderatorDb('moderator-1'),
      'flags/flag-1/responses/responder-1'
    )));
  });
});

describe('reviews and ratings', () => {
  test('enforces verified-email eligibility, deterministic ownership, and bounded ratings', async () => {
    const ordinary = ordinaryDb('ordinary-1');
    const author = contributorDb('author-1');
    const other = contributorDb('other-1');
    const reviewRef = doc(author, 'reviews/lago-carezza_author-1');

    await assertFails(setDoc(
      doc(ordinary, 'reviews/lago-carezza_ordinary-1'),
      validReview('ordinary-1')
    ));
    await assertFails(setDoc(
      doc(author, 'reviews/arbitrary-id'),
      validReview('author-1')
    ));
    await assertFails(setDoc(
      doc(author, 'reviews/lago-carezza_author-1'),
      validReview('author-1', { rating: 6 })
    ));
    await assertSucceeds(setDoc(reviewRef, validReview('author-1')));
    await assertSucceeds(getDoc(reviewRef));
    await assertFails(getDoc(doc(other, 'reviews/lago-carezza_author-1')));
    await assertFails(getDoc(doc(
      testEnv.unauthenticatedContext().firestore(),
      'reviews/lago-carezza_author-1'
    )));
    await assertFails(updateDoc(
      doc(other, 'reviews/lago-carezza_author-1'),
      { text: 'Attempted ownership bypass.' }
    ));
    await assertFails(deleteDoc(doc(other, 'reviews/lago-carezza_author-1')));
    await assertSucceeds(deleteDoc(reviewRef));
  });

  test('allows an author edit but rejects duplicate writes that reset freshness', async () => {
    const author = contributorDb('author-1');
    const ref = doc(author, 'reviews/lago-carezza_author-1');
    await assertSucceeds(setDoc(ref, validReview('author-1')));
    await assertSucceeds(updateDoc(ref, { text: 'Edited without resetting time.' }));
    await assertFails(setDoc(ref, validReview('author-1', {
      text: 'Attempted freshness reset.',
    })));
    await assertFails(updateDoc(ref, { status: 'hidden' }));
  });

  test('returns an edited visible review to pending moderation', async () => {
    const createdAt = Timestamp.now();
    await seed([['reviews/lago-carezza_author-1', {
      ...validReview('author-1', { status: 'visible' }),
      createdAt,
    }]]);
    const author = contributorDb('author-1');
    await assertSucceeds(setDoc(
      doc(author, 'reviews/lago-carezza_author-1'),
      validReview('author-1', {
        text: 'Edited review awaiting another moderation pass.',
        createdAt,
      })
    ));
    await seed([['reviews/lago-carezza_author-2', {
      ...validReview('author-2', { status: 'visible' }),
      createdAt,
    }]]);
    await assertFails(updateDoc(
      doc(contributorDb('author-2'), 'reviews/lago-carezza_author-2'),
      { text: 'Malicious edit kept visible.' }
    ));
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'reviews/lago-carezza_author-1')));
  });

  test('visible queries succeed while hidden records and unfiltered lists fail publicly', async () => {
    await seed([
      ['reviews/lago-carezza_author-1', {
        ...validReview('author-1', { status: 'visible' }),
        createdAt: Timestamp.now(),
      }],
      ['reviews/lago-carezza_author-2', {
        ...validReview('author-2', { status: 'reported' }),
        createdAt: Timestamp.now(),
      }],
      ['reviews/lago-carezza_author-3', {
        ...validReview('author-3', { status: 'hidden' }),
        createdAt: Timestamp.now(),
      }],
      ['reviews/lago-carezza_author-4', {
        ...validReview('author-4'),
        createdAt: Timestamp.now(),
      }],
    ]);
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(query(
      collection(guest, 'reviews'),
      where('trailId', '==', 'lago-carezza'),
      where('status', 'in', ['visible', 'reported'])
    )));
    await assertSucceeds(getDoc(doc(guest, 'reviews/lago-carezza_author-2')));
    await assertFails(getDoc(doc(guest, 'reviews/lago-carezza_author-3')));
    await assertFails(getDoc(doc(guest, 'reviews/lago-carezza_author-4')));
    await assertFails(getDocs(collection(guest, 'reviews')));
  });
});

describe('trail photos', () => {
  test('only verified accounts can submit valid bounded images', async () => {
    const ordinary = ordinaryDb('ordinary-1');
    const author = contributorDb('author-1');
    const other = contributorDb('other-1');
    await assertFails(setDoc(doc(ordinary, 'trailPhotos/photo-1'), validPhoto('ordinary-1')));
    await assertFails(setDoc(
      doc(author, 'trailPhotos/photo-2'),
      validPhoto('author-1', { image: 'https://example.com/tracker.jpg' })
    ));
    await assertFails(setDoc(
      doc(author, 'trailPhotos/photo-3'),
      validPhoto('author-1', { caption: 'x'.repeat(241) })
    ));
    const photoRef = doc(author, 'trailPhotos/photo-4');
    await assertSucceeds(setDoc(photoRef, validPhoto('author-1')));
    await assertSucceeds(getDoc(photoRef));
    await assertFails(getDoc(doc(other, 'trailPhotos/photo-4')));
  });

  test('public photo queries require visible status', async () => {
    await seed([
      ['trailPhotos/photo-1', {
        ...validPhoto('author-1', { status: 'visible' }),
        createdAt: Timestamp.now(),
      }],
      ['trailPhotos/photo-2', {
        ...validPhoto('author-2', { status: 'reported' }),
        createdAt: Timestamp.now(),
      }],
      ['trailPhotos/photo-3', {
        ...validPhoto('author-3'),
        createdAt: Timestamp.now(),
      }],
    ]);
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(query(
      collection(guest, 'trailPhotos'),
      where('trailId', '==', 'lago-carezza'),
      where('status', 'in', ['visible', 'reported'])
    )));
    await assertSucceeds(getDoc(doc(guest, 'trailPhotos/photo-2')));
    await assertFails(getDoc(doc(guest, 'trailPhotos/photo-3')));
    await assertFails(getDocs(collection(guest, 'trailPhotos')));
  });
});

describe('abuse reports and default denial', () => {
  test('signed-in users can open reports but only moderators can list and resolve them', async () => {
    const reporter = ordinaryDb('reporter-1');
    const other = ordinaryDb('other-1');
    const guest = testEnv.unauthenticatedContext().firestore();
    const reportRef = doc(reporter, 'reports/report-1');
    const report = {
      targetType: 'review',
      targetId: 'lago-carezza_author-1',
      uid: 'reporter-1',
      reason: 'Potentially inaccurate trail information',
      status: 'open',
      createdAt: serverTimestamp(),
    };

    await assertFails(setDoc(doc(guest, 'reports/guest-report'), report));
    await assertSucceeds(setDoc(reportRef, report));
    await assertSucceeds(getDoc(reportRef));
    await assertFails(getDoc(doc(other, 'reports/report-1')));
    await assertFails(getDocs(collection(reporter, 'reports')));
    await assertFails(updateDoc(reportRef, { status: 'dismissed' }));

    const moderator = moderatorDb('moderator-1');
    await assertSucceeds(getDocs(query(
      collection(moderator, 'reports'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    )));
    await assertSucceeds(updateDoc(doc(moderator, 'reports/report-1'), {
      status: 'reviewed',
      resolvedAt: serverTimestamp(),
      resolvedBy: 'moderator-1',
    }));
  });

  test('malformed reports and unknown collections fail closed', async () => {
    const reporter = ordinaryDb('reporter-1');
    await assertFails(setDoc(doc(reporter, 'reports/bad-target'), {
      targetType: 'user',
      targetId: 'someone',
      uid: 'reporter-1',
      reason: 'Not an allowed target',
      status: 'open',
      createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(reporter, 'admin/self-grant'), {
      moderator: true,
    }));
    await assertFails(getDoc(doc(reporter, 'admin/config')));
  });
});

describe('moderation queue and audit trail', () => {
  test('only moderators can inspect all queue states', async () => {
    await seed([
      ['reviews/lago-carezza_author-1', {
        ...validReview('author-1'),
        createdAt: Timestamp.now(),
      }],
      ['reviews/lago-carezza_author-2', {
        ...validReview('author-2', { status: 'removed' }),
        createdAt: Timestamp.now(),
      }],
    ]);
    const moderator = moderatorDb('moderator-1');
    const ordinary = contributorDb('author-3');
    const queueQuery = db => query(
      collection(db, 'reviews'),
      where('status', 'in', ['pending', 'reported', 'hidden', 'removed'])
    );
    await assertSucceeds(getDocs(queueQuery(moderator)));
    await assertFails(getDocs(queueQuery(ordinary)));
  });

  test('moderator audit records are identity-bound and immutable', async () => {
    const moderator = moderatorDb('moderator-1');
    const ordinary = contributorDb('author-1');
    const auditRef = doc(moderator, 'moderationAudit/audit-1');
    await assertFails(setDoc(
      doc(ordinary, 'moderationAudit/audit-ordinary'),
      validModerationAudit({ moderatorUid: 'author-1' })
    ));
    await assertFails(setDoc(
      doc(moderator, 'moderationAudit/audit-spoofed'),
      validModerationAudit({ moderatorUid: 'somebody-else' })
    ));
    await assertFails(setDoc(
      doc(moderator, 'moderationAudit/audit-private-data'),
      {
        ...validModerationAudit(),
        authorEmail: 'private@example.com',
      }
    ));
    await assertSucceeds(setDoc(auditRef, validModerationAudit()));
    await assertSucceeds(getDoc(auditRef));
    await assertFails(getDoc(doc(ordinary, 'moderationAudit/audit-1')));
    await assertFails(updateDoc(auditRef, { reason: 'Rewritten history.' }));
    await assertFails(deleteDoc(auditRef));
  });
});
