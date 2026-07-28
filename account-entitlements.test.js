const policy = require('./config/account-entitlements.json');

const states = policy.states;
const stateNames = [
  'guest',
  'authenticated',
  'verifiedContributor',
  'expiredSession',
  'loggedOut',
  'deletedAccount',
];

describe('AUTH-01 account entitlement contract', () => {
  test('defines every required identity and session state', () => {
    expect(Object.keys(states)).toEqual(stateNames);
  });

  test.each(stateNames)(
    '%s can open, use GPS with, and remove an installed package',
    state => {
      expect(states[state].capabilities.openInstalledPackage).toBe(true);
      expect(states[state].capabilities.useInstalledPackageGps).toBe(true);
      expect(states[state].capabilities.removeInstalledPackage).toBe(true);
    }
  );

  test.each(['guest', 'expiredSession', 'loggedOut', 'deletedAccount'])(
    '%s cannot install or update an offline package',
    state => {
      expect(states[state].capabilities.installOfflinePackage).toBe(false);
      expect(states[state].capabilities.updateOfflinePackage).toBe(false);
    }
  );

  test.each(['authenticated', 'verifiedContributor'])(
    '%s can install and update an offline package',
    state => {
      expect(states[state].capabilities.installOfflinePackage).toBe(true);
      expect(states[state].capabilities.updateOfflinePackage).toBe(true);
    }
  );

  test('community publication is restricted to verified contributors', () => {
    for (const state of stateNames) {
      expect(states[state].capabilities.publishCommunityContribution)
        .toBe(state === 'verifiedContributor');
    }
  });

  test('expired sessions may queue private outcomes but cannot sync them', () => {
    expect(states.expiredSession.capabilities.queueOwnerBoundPrivateOutcome).toBe(true);
    expect(states.expiredSession.capabilities.syncOwnerBoundPrivateOutcome).toBe(false);
  });

  test('offline packages never store identity or authentication details', () => {
    expect(policy.offlinePackage.containsPersonalData).toBe(false);
    expect(policy.offlinePackage.ownerMarkerMustNotContain).toEqual(
      expect.arrayContaining([
        'authentication token',
        'email address',
        'location history',
      ])
    );
  });

  test('logout discloses retention and provides shared-device cleanup', () => {
    expect(policy.logout.defaultRetainsVerifiedOfflinePackages).toBe(true);
    expect(policy.logout.mustDiscloseRetainedPackages).toBe(true);
    expect(policy.logout.mustOfferRemoveLocalDataAction).toBe(true);
    expect(policy.logout.locksOwnerBoundPrivateData).toBe(true);
  });

  test('account deletion separates server deletion from device cleanup', () => {
    expect(policy.accountDeletion.serverDeletionAndDeviceCleanupAreSeparate).toBe(true);
    expect(policy.accountDeletion.alwaysRemovesOwnerBoundPrivateDataFromCurrentDevice).toBe(true);
    expect(policy.accountDeletion.mustNotClaimSuccessBeforeServerDeletionSucceeds).toBe(true);
  });

  test('a pending authentication intent is short-lived, single-use, and safe', () => {
    expect(policy.pendingIntent.maximumAgeMinutes).toBeLessThanOrEqual(30);
    expect(policy.pendingIntent.singleUse).toBe(true);
    expect(policy.pendingIntent.returnTargetMustBeSameOriginAllowlistedPath).toBe(true);
    expect(policy.pendingIntent.mustNotContain).toContain('authentication token');
    expect(policy.pendingIntent.mustNotContain).toContain('free-form contribution body');
  });
});
