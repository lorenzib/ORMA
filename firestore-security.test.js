const fs = require('fs');
const path = require('path');

const root = __dirname;
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
const indexes = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));
const client = fs.readFileSync(path.join(root, 'firebase-init.js'), 'utf8');

describe('SEC-01 Firestore configuration contract', () => {
  test('Firebase configuration versions the rules and index sources', () => {
    expect(firebaseConfig.firestore).toEqual({
      rules: 'firestore.rules',
      indexes: 'firestore.indexes.json',
    });
    expect(rules).toContain("rules_version = '2';");
    expect(firebaseConfig.storage).toBeUndefined();
  });

  test('trail-photo uploads use a bounded private Firestore staging queue',()=>{
    const uploadBlock=rules.slice(rules.indexOf('match /backofficeImageUploads'),rules.indexOf('match /backofficeNewsletterReviews'));
    expect(uploadBlock).toContain('allow get: if isModerator();');
    expect(uploadBlock).toContain('allow list: if false;');
    expect(uploadBlock).toContain('request.resource.data.fileSize <= 573440');
    expect(uploadBlock).toContain('request.resource.data.uploadData.size() <= 800000');
    expect(uploadBlock).toContain("request.resource.data.mimeType in ['image/jpeg', 'image/png', 'image/webp']");
    expect(uploadBlock).toContain('allow update: if false;');
    expect(rules).toContain("'upload-owner-photo', 'approve-uploaded-photo', 'approve-image-candidate'");
    expect(rules).toContain("request.resource.data.uploadRef.matches('^backofficeImageUploads/[A-Za-z0-9_-]+$')");
  });

  test('every client-side collection has an explicit rule boundary', () => {
    const clientCollections = [
      'users',
      'outcomes',
      'hikeEvents',
      'flags',
      'reviews',
      'trailPhotos',
      'placeDogReports',
      'moderationAudit',
      'reports',
      'backofficeArtifacts',
      'backofficeJobs',
      'backofficeReviews',
      'backofficePublicationReviews',
      'backofficeDossierReviews',
      'backofficeNewTrailReviews',
      'backofficeHazardReviews',
      'backofficeEditorialReviews',
      'backofficeImageReviews',
      'backofficeImageUploads',
      'backofficeNewsletterReviews',
      'backofficeAnalystReviews',
    ];
    clientCollections.forEach(collection => {
      expect(rules).toContain(`/` + collection + '/{');
    });
    expect(rules).toContain('match /{document=**}');
    expect(rules).toMatch(/match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
  });

  test('agent backoffice is moderator-readable and worker-owned', () => {
    const artifactBlock = rules.slice(rules.indexOf('match /backofficeArtifacts'), rules.indexOf('match /backofficeJobs'));
    const jobBlock = rules.slice(rules.indexOf('match /backofficeJobs'), rules.indexOf('match /backofficeReviews'));
    expect(artifactBlock).toContain('allow get, list: if isModerator();');
    expect(artifactBlock).toContain('allow create, update, delete: if false;');
    expect(jobBlock).toContain('allow get, list: if isModerator();');
    expect(jobBlock).toContain('allow create, update, delete: if false;');
    expect(rules).toContain("request.resource.data.type == 'verified-trail-content-review'");
    expect(rules).toContain("request.resource.data.type == 'trail-dossier-review'");
    expect(rules).toContain("request.resource.data.type == 'new-trail-selection'");
    expect(rules).toContain("request.resource.data.type == 'hazard-resolution-review'");
    expect(rules).toContain("request.resource.data.type == 'website-editorial-review'");
    expect(rules).toContain("request.resource.data.type == 'image-coverage-review'");
    expect(rules).toContain("request.resource.data.type == 'newsletter-issue-review'");
    expect(rules).toContain("request.resource.data.type == 'analyst-opportunity-review'");
    expect(rules).toContain("request.resource.data.action in ['approve', 'request-revision', 'reject']");
    expect(rules).toContain("request.resource.data.submittedBy == request.auth.uid");
    expect(client).toContain('window.ORMABackoffice');
    expect(client).toContain('submitDossierReview:submitBackofficeDossierReview');
  });

  test('private account documents are owner-only and cannot carry role grants', () => {
    const userValidator = rules.slice(
      rules.indexOf('function validUserDocument'),
      rules.indexOf('function validModerationMetadata')
    );
    expect(rules).toContain('match /users/{uid}');
    expect(rules).toContain('allow get, delete: if isOwner(uid);');
    expect(rules).toContain('allow list: if false;');
    expect(rules).toContain('function validDog(data)');
    expect(rules).toContain("data.keys().hasOnly(['name', 'phone', 'email', 'emName', 'emPhone'])");
    expect(rules).toContain('function validDogs(data)');
    expect(rules).toContain("'favorites', 'dog', 'dogs', 'activeDogId'");
    expect(rules).toContain('data.size() <= 5');
    expect(rules).toContain('data.size() <= 25');
    expect(rules).toContain("data.fitness in ['low', 'moderate', 'high']");
    expect(rules).toContain('data.photos is list && data.photos.size() <= 4');
    expect(rules).not.toContain('request.resource.data.dogs == resource.data.dogs');
    expect(client).toContain('async function setDogProfile(dogObj, targetDogId)');
    expect(client).toContain('function reconcileLegacyDogPhotos(dogs)');
    expect(client).toContain('profileSummarySyncVersion');
    expect(client).toContain('nextDog.photoId = newDogPhotoId(existingDog.id)');
    expect(client).toContain('clean.photos = photos.slice(0, 4)');
    expect(client).toContain('runTransaction');
    expect(userValidator).not.toContain('contributor');
    expect(userValidator).not.toContain('moderator');
  });

  test('user documents may carry the synced notification read list, bounded', () => {
    expect(rules).toContain("'notifSeen', 'notifSeenAt'");
    expect(rules).toContain('data.notifSeen is list && data.notifSeen.size() <= 300');
    expect(rules).toContain('data.notifSeenAt is timestamp');
  });

  test('site notices are operator-written broadcast content', () => {
    expect(rules).toContain('match /siteNotices/{noticeId}');
    const block = rules.slice(rules.indexOf('match /siteNotices'));
    expect(block).toContain('allow read: if true;');
    expect(block).toContain('allow create: if isModerator()');
    expect(block).toContain('allow update: if false;');
    expect(block).toContain('allow delete: if isModerator();');
    // Links stay inside the site — absolute schemes (https:, javascript:)
    // are rejected so a notice can never smuggle an external redirect.
    expect(block).toContain("!request.resource.data.href.matches('^[a-zA-Z]+:.*$')");
  });

  test('community submission requires verified email and respects operator blocks', () => {
    expect(rules).toContain("request.auth.token.get('email_verified', false) == true");
    expect(rules).toContain('documents/contributionBlocks/$(request.auth.uid)');
    expect(rules).toContain('match /contributionBlocks/{uid}');
    expect(rules).not.toContain("request.auth.token.get('contributor'");
    expect(rules).toContain("request.auth.token.get('moderator', false) == true");
    expect(rules).toContain('request.resource.data.uid == request.auth.uid');
    expect(rules).toContain('request.resource.data.createdAt == resource.data.createdAt');
    expect(rules.match(/request\.resource\.data\.createdAt == request\.time/g).length)
      .toBeGreaterThanOrEqual(4);
    expect(rules).toContain("hasOnly(['status', 'moderatedAt', 'moderatedBy'])");
    expect(rules).not.toContain('request.resource.data.contributor');
    expect(rules).not.toContain('request.resource.data.moderator == true');
  });

  test('client contribution states match the create rules', () => {
    expect(client.match(/status: "pending"/g)).toHaveLength(4);
    expect(client).toContain('status: "open"');
    expect(rules.match(/request\.resource\.data\.status == 'pending'/g)).toHaveLength(5);
    expect(rules).toContain("request.resource.data.status == 'open'");
  });

  test('community publication uses the MOD-01 state contract', () => {
    const states = fs.readFileSync(path.join(root, 'community-content-states.js'), 'utf8');
    const trailShell = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
    const reports = fs.readFileSync(path.join(root, 'trail-reports.js'), 'utf8');
    const photoPage = fs.readFileSync(path.join(root, 'photo-upload-page.js'), 'utf8');
    const hazardPage = fs.readFileSync(path.join(root, 'trail-report-page.js'), 'utf8');
    expect(states).toContain("'draft', 'pending', 'visible', 'reported', 'hidden', 'removed'");
    expect(rules).toContain("function isCommunityState(status)");
    expect(rules).not.toContain("'active'");
    expect(rules).toContain("resource.data.status in ['visible', 'reported']");
    expect(rules).toContain("request.resource.data.status == 'pending'");
    expect(rules).toContain('validModeratorTransition(');
    expect(client.match(/where\("status", "in", \["visible", "reported"\]\)/g))
      .toHaveLength(4);
    expect(trailShell.indexOf('community-content-states.js')).toBeLessThan(
      trailShell.indexOf('trail-reports.js')
    );
    expect(reports).toContain('countsTowardRating(review.status)');
    expect(photoPage).toContain('DoloPawsCommunity.addTrailPhoto');
    expect(hazardPage).toContain('DoloPawsCommunity.addFlag');
    expect(hazardPage).not.toContain('dolopaws-design-reports');
    expect(hazardPage).not.toContain('within the hour');
  });

  test('current compound queries and the moderation queue have declared indexes', () => {
    const signatures = indexes.indexes.map(index => ({
      collectionGroup: index.collectionGroup,
      fields: index.fields.map(field => field.fieldPath),
    }));
    expect(signatures).toEqual(expect.arrayContaining([
      { collectionGroup: 'flags', fields: ['trailId', 'status', 'expiresAt'] },
      { collectionGroup: 'reviews', fields: ['trailId', 'status'] },
      { collectionGroup: 'trailPhotos', fields: ['trailId', 'status'] },
      { collectionGroup: 'reports', fields: ['status', 'createdAt'] },
    ]));
    expect(indexes.fieldOverrides).toEqual([]);
  });

  test('anonymous hike events cannot contain identity or location', () => {
    expect(rules).toContain("request.resource.data.keys().hasOnly(['startedAt'])");
    expect(rules).toContain('request.resource.data.startedAt == request.time');
    expect(rules).toContain('allow update: if false;');
  });

  test('post-hike outcomes are private, structured, and immutable', () => {
    expect(rules).toContain('match /users/{uid}/outcomes/{outcomeId}');
    expect(rules).toContain('validPrivateOutcome(request.resource.data, outcomeId)');
    expect(rules).toContain('allow get, list, delete: if isOwner(uid);');
    expect(rules).toContain('allow update: if false;');
    expect(rules).toContain("data.response in [");
    expect(rules).toContain("'prefer_not_to_answer'");
    expect(rules).toContain("data.hazards.hasOnly([");
    expect(client).toContain('window.DoloPawsPrivateOutcomes');
    expect(client).toContain('saveOutcome: saveHikeOutcome');
    expect(client).not.toContain('publicReview');
  });

  test('moderation audits are explicit and immutable', () => {
    expect(rules).toContain('match /moderationAudit/{auditId}');
    expect(rules).toContain('validModerationAudit(request.resource.data)');
    expect(rules).toContain('allow get, list: if isModerator()');
    expect(rules).toContain('allow update, delete: if false');
    expect(client).toContain('window.DoloPawsModeration');
  });
});
