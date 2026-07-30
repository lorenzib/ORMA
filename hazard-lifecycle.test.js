const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('MOD-03 hazard confirmation and expiry', () => {
  const client = read('firebase-init.js');
  const rules = read('firestore.rules');
  const reports = read('trail-reports.js');
  const moderation = read('moderation-page.js');
  const indexes = read('firestore.indexes.json');

  test('new hazards carry bounded lifecycle metadata', () => {
    expect(client).toContain('confirmationSource: "community"');
    expect(client).toContain('confirmations: 0');
    expect(client).toContain('disputes: 0');
    expect(client).toContain('expiresAt: Timestamp.fromDate(expiry)');
    expect(rules).toContain('function hazardMaximumLifetime(type)');
    expect(rules).toContain('validNewHazardLifecycle(request.resource.data)');
  });

  test('the active query and public rules exclude expired reports', () => {
    expect(client).toContain('where("expiresAt", ">", activeCutoff)');
    expect(rules).toContain('resource.data.expiresAt > request.time');
    expect(indexes).toContain('"fieldPath": "expiresAt"');
    expect(reports).toContain('hazardIsExpired(f)');
  });

  test('independent verified users can respond once without exposing identities', () => {
    expect(client).toContain('async function respondToHazard');
    expect(client).toContain('"responses", currentUser.uid');
    expect(rules).toContain('function communityFlagResponseUpdate(flagId)');
    expect(rules).toContain('resource.data.uid != request.auth.uid');
    expect(rules).toContain('!exists(');
    expect(rules).toContain('existsAfter(');
    expect(rules).toContain('allow list: if isModerator()');
    expect(rules).toContain('allow update, delete: if false');
  });

  test('public labels distinguish community, DoloPaws, and official evidence', () => {
    expect(reports).toContain("'reports.communityConfirmed'");
    expect(reports).toContain("'reports.communityDisputed'");
    expect(reports).toContain("'reports.dolopawsReviewed'");
    expect(reports).toContain("'reports.officialConfirmed'");
    expect(moderation).toContain("'dolopaws-reviewed'");
    expect(moderation).toContain("'official'");
  });
});
