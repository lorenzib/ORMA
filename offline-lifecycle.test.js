const { TextEncoder } = require('util');
const { webcrypto, createHash } = require('crypto');

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
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    require('./offline-packages.js');
  });

  function useFakeIndexedDb(){
    const records = new Map();
    const store = {
      get: jest.fn(key => requestFor(() => records.get(key))),
      put: jest.fn(value => requestFor(() => {
        records.set(value.trailId, JSON.parse(JSON.stringify(value)));
        return value.trailId;
      })),
      delete: jest.fn(key => requestFor(() => records.delete(key))),
    };
    function requestFor(action){
      const request = {};
      queueMicrotask(() => {
        try{
          request.result = action();
          if(request.onsuccess) request.onsuccess();
        }catch(error){
          request.error = error;
          if(request.onerror) request.onerror();
        }
      });
      return request;
    }
    const database = {
      objectStoreNames:{ contains:jest.fn().mockReturnValue(true) },
      createObjectStore:jest.fn(),
      transaction:jest.fn(() => ({ objectStore:() => store })),
      close:jest.fn(),
    };
    const indexedDB = {
      open:jest.fn(() => {
        const request = { result:database };
        queueMicrotask(() => request.onsuccess && request.onsuccess());
        return request;
      }),
    };
    Object.defineProperty(window, 'indexedDB', {
      configurable:true,
      value:indexedDB,
    });
    return { records, store, database, indexedDB };
  }

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

  test('migrates legacy package metadata into IndexedDB without losing ownership', async () => {
    const legacy = {
      cacheName:'dolopaws-trail-lago-carezza-beta',
      version:'beta',
      ownerMarker:'v1:opaque',
    };
    localStorage.setItem('dolopaws-offline:lago-carezza', JSON.stringify(legacy));
    const fake = useFakeIndexedDb();

    await expect(window.DoloPawsOffline.readPackageMetadata('lago-carezza'))
      .resolves.toMatchObject({ ...legacy, trailId:'lago-carezza' });
    expect(fake.records.get('lago-carezza')).toMatchObject(legacy);
    expect(localStorage.getItem('dolopaws-offline:lago-carezza')).toBeNull();
  });

  test('stores and removes multiple package records independently in IndexedDB', async () => {
    const fake = useFakeIndexedDb();
    await window.DoloPawsOffline.writePackageMetadata('lago-carezza', { version:'carezza-v1' });
    await window.DoloPawsOffline.writePackageMetadata('alpe-siusi', { version:'alpe-v1' });

    await expect(window.DoloPawsOffline.readPackageMetadata('lago-carezza'))
      .resolves.toMatchObject({ trailId:'lago-carezza', version:'carezza-v1' });
    await expect(window.DoloPawsOffline.readPackageMetadata('alpe-siusi'))
      .resolves.toMatchObject({ trailId:'alpe-siusi', version:'alpe-v1' });

    await window.DoloPawsOffline.removePackageMetadata('lago-carezza');
    expect(fake.records.has('lago-carezza')).toBe(false);
    expect(fake.records.get('alpe-siusi')).toMatchObject({ version:'alpe-v1' });
  });

  test('falls back to legacy metadata when IndexedDB is unavailable', async () => {
    await window.DoloPawsOffline.writePackageMetadata('alpe-siusi', { version:'fallback-v1' });
    expect(localStorage.getItem('dolopaws-offline:alpe-siusi')).toContain('fallback-v1');
    await expect(window.DoloPawsOffline.readPackageMetadata('alpe-siusi'))
      .resolves.toMatchObject({ version:'fallback-v1' });
  });

  test('removes every DoloPaws package cache and registry without touching other caches', async () => {
    const deletedCaches = [];
    Object.defineProperty(window, 'caches', {
      configurable:true,
      value:{
        keys:jest.fn().mockResolvedValue([
          'dolopaws-trail-lago-carezza-v1',
          'dolopaws-trail-alpe-siusi-v1',
          'another-app-cache',
        ]),
        delete:jest.fn(async name => { deletedCaches.push(name); return true; }),
      },
    });
    const deleteRequest = {};
    Object.defineProperty(window, 'indexedDB', {
      configurable:true,
      value:{
        deleteDatabase:jest.fn(() => {
          queueMicrotask(() => deleteRequest.onsuccess && deleteRequest.onsuccess());
          return deleteRequest;
        }),
      },
    });
    localStorage.setItem('dolopaws-offline:lago-carezza', '{}');
    localStorage.setItem('dolopaws-offline:alpe-siusi', '{}');
    localStorage.setItem('dolopaws-offline-owner-salt', 'salt');
    localStorage.setItem('another-site-key', 'keep');

    await window.DoloPawsOffline.removeAllPackages();

    expect(deletedCaches).toEqual([
      'dolopaws-trail-lago-carezza-v1',
      'dolopaws-trail-alpe-siusi-v1',
    ]);
    expect(localStorage.getItem('dolopaws-offline:lago-carezza')).toBeNull();
    expect(localStorage.getItem('dolopaws-offline:alpe-siusi')).toBeNull();
    expect(localStorage.getItem('dolopaws-offline-owner-salt')).toBeNull();
    expect(localStorage.getItem('another-site-key')).toBe('keep');
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
    expect(window.DoloPawsOffline.formatPackageVersion('2026.07.29-beta.5'))
      .toBe('Beta package 5');
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
    expect(updateBranch).toContain('localizedOwnershipLabel(ownership)');
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

    expect(source).toContain("tr('downloads.action.restartDownload', 'Restart download')");
    expect(source).toContain("tr('offlinePanel.action.retryDownload', 'Retry download')");
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

  test('distinguishes mandatory resources from optional map layers', () => {
    expect(window.DoloPawsOffline.resourceIsRequired({ required: true })).toBe(true);
    expect(window.DoloPawsOffline.resourceIsRequired({})).toBe(true);
    expect(window.DoloPawsOffline.resourceIsRequired({ required: false })).toBe(false);
  });

  test('rejects a package larger than its declared corridor budget', () => {
    expect(() => window.DoloPawsOffline.validateManifest({
      schemaVersion: 1,
      trailId: 'lago-carezza',
      version: 'too-large',
      packageBytes: 101,
      packageBudgetBytes: 100,
      resources: [{
        role: 'map',
        url: 'map.svg',
        bytes: 101,
        sha256: 'abc',
      }],
    }, 'lago-carezza')).toThrow(/exceeds its declared storage budget/);
  });

  test('publishes every truthful OFF-05 lifecycle state', () => {
    expect(window.DoloPawsOffline.PACKAGE_STATES).toEqual([
      'not-downloaded',
      'downloading',
      'ready',
      'stale',
      'incomplete',
      'update-available',
      'failed',
      'removed',
    ]);
  });

  test('derives stale content without treating unknown dates as current', () => {
    const freshness = state => ({
      evidence: {
        categories: {
          route: { freshnessState: state },
          water: { freshnessState: 'current' },
        },
      },
    });
    expect(window.DoloPawsOffline.contentFreshnessState(freshness('stale'))).toBe('stale');
    expect(window.DoloPawsOffline.contentFreshnessState({
      evidence: {
        categories: {
          route: { freshnessState: 'stale' },
          access: { freshnessState: 'unknown' },
        },
      },
    })).toBe('stale');
    expect(window.DoloPawsOffline.contentFreshnessState(freshness('aging'))).toBe('aging');
    expect(window.DoloPawsOffline.contentFreshnessState(freshness('unknown'))).toBe('unknown');
    expect(window.DoloPawsOffline.contentFreshnessState({})).toBe('unknown');
  });

  function cacheFixture(resourceResponse){
    const bytes = new TextEncoder().encode('verified map bytes');
    const manifest = {
      schemaVersion: 1,
      trailId: 'lago-carezza',
      version: 'self-test',
      packageBytes: bytes.byteLength,
      evidence: {
        categories: {
          route: { freshnessState: 'current' },
        },
      },
      resources: [{
        role: 'map',
        required: true,
        label: 'Stored map',
        url: 'map.svg',
        bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      }, {
        role: 'optional',
        required: false,
        label: 'Optional overlay',
        url: 'overlay.json',
        bytes: 1,
        sha256: 'optional',
      }],
    };
    const cache = {
      match: jest.fn(async input => {
        const url = String(input && input.url || input);
        if(url.endsWith('/manifest.json')){
          return { json: jest.fn().mockResolvedValue(manifest) };
        }
        if(url.endsWith('/map.svg')) return resourceResponse(bytes);
        return undefined;
      }),
    };
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: jest.fn().mockResolvedValue([
          'dolopaws-trail-lago-carezza-self-test',
        ]),
        open: jest.fn().mockResolvedValue(cache),
      },
    });
    return { bytes, cache };
  }

  test('self-test checksum-verifies required cached resources without optional layers', async () => {
    const fixture = cacheFixture(bytes => ({
      arrayBuffer: jest.fn().mockResolvedValue(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      ),
    }));
    const previousFetch = global.fetch;
    const fetchMock = jest.fn();
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
    try{
      const result = await window.DoloPawsOffline.verifyInstalledPackage('lago-carezza');
      expect(result).toMatchObject({
        state: 'ready',
        usable: true,
        requiredChecked: 1,
        contentFreshness: 'current',
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(fixture.cache.match).not.toHaveBeenCalledWith(
        expect.stringContaining('overlay.json')
      );
    }finally{
      Object.defineProperty(global, 'fetch', {
        configurable: true,
        value: previousFetch,
      });
    }
  });

  test.each([
    ['missing', () => undefined, /missing from this device/],
    ['corrupt', () => ({
      arrayBuffer: jest.fn().mockResolvedValue(
        new TextEncoder().encode('wrong bytes').buffer
      ),
    }), /unexpected stored size|stored checksum/],
  ])('self-test rejects a %s required cached resource', async (_case, response, message) => {
    cacheFixture(response);
    const result = await window.DoloPawsOffline.verifyInstalledPackage('lago-carezza');

    expect(result.state).toBe('failed');
    expect(result.usable).toBe(false);
    expect(result.message).toMatch(message);
  });
});
