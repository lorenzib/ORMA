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

  test('the client verifies identity and receives claims only from a callable function', () => {
    expect(client).toContain('sendEmailVerification(credential.user)');
    expect(client).toContain('refreshContributorEligibilityCall');
    expect(client).toContain('getIdToken(currentUser, true)');
    expect(client).not.toMatch(/setCustomUserClaims/);
  });

  test('every public contribution write checks eligibility before Firestore', () => {
    expect(client.match(/getContributionEligibility\(\{ activate: true \}\)/g)).toHaveLength(3);
    expect(rules).toContain("request.auth.token.get('email_verified', false) == true");
    expect(rules).toContain("request.auth.token.get('contributor', false) == true");
    expect(rules).toContain("request.auth.token.get('suspended', false) != true");
  });

  test('the trusted function is isolated from static hosting', () => {
    expect(firebase.functions).toEqual({
      source: 'functions',
      runtime: 'nodejs22',
    });
    expect(read('functions/index.js')).toContain('setCustomUserClaims');
    expect(read('functions/index.js')).toContain('getUser(request.auth.uid)');
  });

  test('recovery copy names a concrete verification action', () => {
    expect(client).toContain('Open Account → Settings to resend the verification link.');
    expect(read('account.html')).toContain('contributionEligibilityAction');
    expect(read('account.js')).toContain('Resend verification email');
  });
});
