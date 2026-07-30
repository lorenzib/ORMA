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
  });

  test('every client-side collection has an explicit rule boundary', () => {
    const clientCollections = [
      'users',
      'outcomes',
      'hikeEvents',
      'flags',
      'reviews',
      'trailPhotos',
      'moderationAudit',
      'reports',
    ];
    clientCollections.forEach(collection => {
      expect(rules).toContain(`/` + collection + '/{');
    });
    expect(rules).toContain('match /{document=**}');
    expect(rules).toMatch(/match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
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
    expect(rules).toContain("request.method != 'create'");
    expect(rules).toContain('request.resource.data.dogs == resource.data.dogs');
    expect(userValidator).not.toContain('contributor');
    expect(userValidator).not.toContain('moderator');
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
    expect(client.match(/status: "pending"/g)).toHaveLength(3);
    expect(client).toContain('status: "open"');
    expect(rules.match(/request\.resource\.data\.status == 'pending'/g)).toHaveLength(4);
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
      .toHaveLength(3);
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
      { collectionGroup: 'flags', fields: ['trailId', 'status'] },
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
