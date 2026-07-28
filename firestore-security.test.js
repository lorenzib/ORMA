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
      'hikeEvents',
      'flags',
      'reviews',
      'trailPhotos',
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

  test('community publication depends on immutable authentication claims', () => {
    expect(rules).toContain("request.auth.token.get('email_verified', false) == true");
    expect(rules).toContain("request.auth.token.get('contributor', false) == true");
    expect(rules).toContain("request.auth.token.get('suspended', false) != true");
    expect(rules).toContain("request.auth.token.get('moderator', false) == true");
    expect(rules).toContain('request.resource.data.uid == request.auth.uid');
    expect(rules).toContain('request.resource.data.createdAt == resource.data.createdAt');
    expect(rules.match(/request\.resource\.data\.createdAt == request\.time/g).length)
      .toBeGreaterThanOrEqual(4);
    expect(rules).toContain("hasOnly(['status', 'moderatedAt', 'moderatedBy'])");
    expect(rules).not.toContain('request.resource.data.contributor');
    expect(rules).not.toContain('request.resource.data.moderator');
  });

  test('client contribution states match the create rules', () => {
    expect(client).toContain('status: "active"');
    expect(client.match(/status: "visible"/g)).toHaveLength(2);
    expect(client).toContain('status: "open"');
    expect(rules).toContain("request.resource.data.status == 'active'");
    expect(rules.match(/request\.resource\.data\.status == 'visible'/g)).toHaveLength(2);
    expect(rules).toContain("request.resource.data.status == 'open'");
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
});
