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
});
