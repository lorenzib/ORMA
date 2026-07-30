const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

describe('AUTH-02 verified contributor contract', () => {
  const client = read('firebase-init.js');
  const rules = read('firestore.rules');
  const firebase = JSON.parse(read('firebase.json'));
  const entitlements = JSON.parse(read('config/account-entitlements.json'));

  test('download entitlement stays separate from contribution eligibility', () => {
    expect(entitlements.states.authenticated.capabilities.installOfflinePackage).toBe(true);
    expect(entitlements.states.authenticated.capabilities.publishCommunityContribution).toBe(false);
    expect(entitlements.states.verifiedContributor.capabilities.installOfflinePackage).toBe(true);
    expect(entitlements.states.verifiedContributor.capabilities.publishCommunityContribution).toBe(true);
  });

  test('the client sends and checks Firebase email verification without a paid function', () => {
    expect(client).toContain('sendEmailVerification(credential.user)');
    expect(client).toContain('currentUser.emailVerified');
    expect(client).not.toContain('getFunctions');
    expect(client).not.toContain('httpsCallable');
    expect(firebase.functions).toBeUndefined();
  });

  test('every contribution checks eligibility and starts pending', () => {
    // Reviews, photos, hazard reports, and hazard confirmation/dispute all
    // require the same verified-contributor decision.
    expect(client.match(/await getContributionEligibility\(\)/g)).toHaveLength(4);
    expect(client.match(/status: "pending"/g)).toHaveLength(3);
    expect(client).toContain('permission-denied"))');
    expect(client).toContain('existing && existing.exists()');
    expect(rules).toContain('isOwner(resource.data.uid)');
    expect(rules).toContain("request.auth.token.get('email_verified', false) == true");
    expect(rules).toContain('documents/contributionBlocks/$(request.auth.uid)');
    expect(rules).not.toContain("request.auth.token.get('contributor'");
  });

  test('manual moderation is explicit in the trail UX', () => {
    const reports = read('trail-reports.js');
    expect(reports).toContain('submitted for review');
    expect(reports).toContain('submitted for moderation');
    expect(rules.match(/request\.resource\.data\.status == 'pending'/g)).toHaveLength(4);
  });

  test('recovery copy names a concrete verification action', () => {
    expect(client).toContain('Open Account → Settings to resend the verification link.');
    expect(read('account.html')).toContain('contributionEligibilityAction');
    expect(read('account.js')).toContain('Resend verification email');
  });
});
