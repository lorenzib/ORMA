const { TextEncoder } = require('util');
const { webcrypto } = require('crypto');

describe('OFF-03 offline package ownership metadata', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    Object.defineProperty(global, 'TextEncoder', {
      configurable: true,
      value: TextEncoder,
    });
    document.documentElement.lang = 'en';
    document.body.innerHTML = '';
    delete window.caches;
    require('./offline-packages.js');
  });

  test('creates a stable, device-scoped opaque marker without storing identity', async () => {
    const first = await window.DoloPawsOffline.ownerMarkerFor({ uid: 'firebase-user-1' });
    const repeated = await window.DoloPawsOffline.ownerMarkerFor({ uid: 'firebase-user-1' });
    const other = await window.DoloPawsOffline.ownerMarkerFor({ uid: 'firebase-user-2' });

    expect(first).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(repeated).toBe(first);
    expect(other).not.toBe(first);
    expect(first).not.toContain('firebase-user-1');
    expect(JSON.stringify({ ownerMarker: first })).not.toContain('firebase-user-1');
  });

  test('distinguishes current, different, signed-out, and legacy ownership', async () => {
    const user = { uid: 'firebase-user-1' };
    const marker = await window.DoloPawsOffline.ownerMarkerFor(user);
    const metadata = { ownerMarker: marker };

    await expect(window.DoloPawsOffline.ownershipState(metadata, user))
      .resolves.toBe('current-account');
    await expect(window.DoloPawsOffline.ownershipState(metadata, { uid: 'firebase-user-2' }))
      .resolves.toBe('another-account');
    await expect(window.DoloPawsOffline.ownershipState(metadata, null))
      .resolves.toBe('signed-out-owner-retained');
    await expect(window.DoloPawsOffline.ownershipState({}, user))
      .resolves.toBe('legacy-owner-unknown');
  });

  test('keeps ownership labels identity-free and dates human-readable', () => {
    const labels = [
      'current-account',
      'another-account',
      'signed-out-owner-retained',
      'legacy-owner-unknown',
    ].map(window.DoloPawsOffline.ownershipLabel);

    expect(labels.join(' ')).not.toMatch(/email|uid|dog|token/i);
    expect(window.DoloPawsOffline.formatInstalledDate('2026-07-28T12:00:00.000Z'))
      .not.toBe('date unavailable');
    expect(window.DoloPawsOffline.formatInstalledDate(null))
      .toBe('date unavailable');
  });

  test('keeps lifecycle details visible when an update is available', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'offline-packages.js'),
      'utf8'
    );
    const updateBranch = source.slice(
      source.indexOf('if(updateAvailable)'),
      source.indexOf('}else if(manifest)')
    );

    expect(updateBranch).toContain('formatBytes(manifest.packageBytes)');
    expect(updateBranch).toContain('formatInstalledDate');
    expect(updateBranch).toContain('ownershipLabel(ownership)');
    expect(updateBranch).toContain('remains usable offline');
  });

  test('detects abandoned installing caches without treating them as ready', async () => {
    const cacheApi = {
      keys: jest.fn().mockResolvedValue([
        'dolopaws-trail-lago-carezza-2026.07.28-installing',
        'unrelated-cache',
      ]),
    };
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: cacheApi,
    });

    await expect(
      window.DoloPawsOffline.incompleteInstallation('lago-carezza')
    ).resolves.toBe(true);
    await expect(
      window.DoloPawsOffline.incompleteInstallation('another-trail')
    ).resolves.toBe(false);
  });

  test('publishes distinct retry copy for interrupted and failed downloads', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'offline-packages.js'),
      'utf8'
    );

    expect(source).toContain("'Restart download'");
    expect(source).toContain("'Retry download'");
    expect(source).toContain("'incomplete'");
    expect(source).toContain("'failed'");
    expect(source).toContain('No incomplete package has been marked ready.');
    expect(source).toContain('Your existing package remains ready offline.');
  });

  test('reserves two package copies and a safety buffer during installation', () => {
    const packageBytes = 35_560;
    expect(window.DoloPawsOffline.requiredStorageBytes(packageBytes))
      .toBe((packageBytes * 2) + (1024 * 1024));
  });

  test('allows download when the browser cannot report its storage quota', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: undefined,
    });

    await expect(window.DoloPawsOffline.storageCapacity(35_560)).resolves.toMatchObject({
      supported: false,
      enough: null,
    });
    await expect(window.DoloPawsOffline.assertStorageCapacity(35_560))
      .resolves.toMatchObject({ supported: false });
  });

  test('reports available storage and rejects an insufficient estimate', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: jest.fn().mockResolvedValue({
          quota: 2_000_000,
          usage: 1_500_000,
        }),
      },
    });

    await expect(window.DoloPawsOffline.storageCapacity(35_560)).resolves.toMatchObject({
      supported: true,
      enough: false,
      availableBytes: 500_000,
    });
    await expect(window.DoloPawsOffline.assertStorageCapacity(35_560))
      .rejects.toThrow(/Not enough browser storage.+Remove a saved offline map/s);
  });

  test('recognises runtime quota failures and publishes actionable recovery copy', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'offline-packages.js'),
      'utf8'
    );

    expect(window.DoloPawsOffline.isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(window.DoloPawsOffline.isQuotaError({ code: 22 })).toBe(true);
    expect(window.DoloPawsOffline.isQuotaError(new TypeError('network'))).toBe(false);
    expect(source).toContain('Your browser ran out of storage');
    expect(source).toContain('free device storage, then retry');
  });
});
