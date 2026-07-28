const fs = require('fs');
const path = require('path');

describe('OFF-03 downloaded-trail management surface', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    window.DoloPawsOffline = {
      formatBytes: bytes => `${bytes} bytes`,
      formatInstalledDate: value => value,
      ownershipLabel: state => `owner:${state}`,
    };
    require('./offline-downloads.js');
  });

  test('renders lifecycle metadata and safe open, detail, and removal controls', () => {
    const markup = window.DoloPawsOfflineDownloads.packageCard({
      trailId: 'lago-carezza',
      name: 'Lago di Carezza Loop',
      trailUrl: '/trail.html?id=lago-carezza',
      offlineUrl: '/offline/trail.html?id=lago-carezza',
      version: '2026.07.28-beta.3',
      packageBytes: 35_560,
      installedAt: '28 Jul 2026',
      verificationStatus: 'field-review-required',
      ownership: 'current-account',
      incomplete: false,
      updateAvailable: false,
    }, true);

    document.body.innerHTML = markup;
    expect(document.querySelector('.od-card').dataset.trailId).toBe('lago-carezza');
    expect(document.querySelector('.od-meta').textContent).toContain('Beta field review pending');
    expect(document.querySelector('.od-owner').textContent).toContain('current-account');
    expect(document.querySelector('a[href^="/offline/trail.html"]')).not.toBeNull();
    expect(document.querySelector('a[href^="/trail.html"]')).not.toBeNull();
    expect(document.querySelector('[data-action="request-remove"]')).not.toBeNull();
    expect(document.querySelector('[data-action="confirm-remove"]')).not.toBeNull();
  });

  test('requires login for updates while retaining local open and remove actions', () => {
    const markup = window.DoloPawsOfflineDownloads.packageCard({
      trailId: 'lago-carezza',
      name: 'Lago di Carezza Loop',
      trailUrl: '/trail.html?id=lago-carezza',
      offlineUrl: '/offline/trail.html?id=lago-carezza',
      version: 'old',
      packageBytes: 35_560,
      installedAt: '28 Jul 2026',
      verificationStatus: 'field-review-required',
      ownership: 'signed-out-owner-retained',
      incomplete: false,
      updateAvailable: true,
    }, false);

    document.body.innerHTML = markup;
    expect(document.querySelector('[data-action="update"]').textContent)
      .toBe('Log in to update');
    expect(document.querySelector('a[href^="/offline/trail.html"]')).not.toBeNull();
    expect(document.querySelector('[data-action="request-remove"]')).not.toBeNull();
  });

  test('page and controller expose empty, error, update, and confirmed removal paths', () => {
    const page = fs.readFileSync(path.join(__dirname, 'downloads.html'), 'utf8');
    const controller = fs.readFileSync(path.join(__dirname, 'offline-downloads.js'), 'utf8');

    expect(page).toContain('id="downloadsEmpty"');
    expect(page).toContain('id="downloadsError"');
    expect(page).toContain('id="downloadsSignedOut"');
    expect(controller).toContain('listInstalledPackages');
    expect(controller).toContain('installPackage');
    expect(controller).toContain('removePackage');
    expect(controller).toContain("data-action=\"confirm-remove\"");
    expect(controller).toContain('Your existing package remains ready offline.');
  });

  test('requires an explicit second action before removing a package', async () => {
    const record = {
      trailId: 'lago-carezza',
      name: 'Lago di Carezza Loop',
      trailUrl: '/trail.html?id=lago-carezza',
      offlineUrl: '/offline/trail.html?id=lago-carezza',
      version: '2026.07.28-beta.3',
      packageBytes: 35_560,
      installedAt: '28 Jul 2026',
      verificationStatus: 'field-review-required',
      ownership: 'current-account',
      incomplete: false,
      updateAvailable: false,
    };
    const removePackage = jest.fn().mockResolvedValue(undefined);
    window.DoloPawsOffline.listInstalledPackages = jest.fn().mockResolvedValue([record]);
    window.DoloPawsOffline.removePackage = removePackage;
    window.DoloPawsAuth = { currentUser: { uid: 'user-1' }, onChange: jest.fn() };
    document.body.innerHTML = `
      <button id="accountBtn"></button>
      <div id="downloadsList"></div>
      <div id="downloadsLoading"></div>
      <div id="downloadsEmpty" hidden></div>
      <div id="downloadsError" hidden></div>
      <div id="downloadsSummary" hidden></div>
      <div id="downloadsSignedOut" hidden></div>
      <button id="downloadsLoginBtn"></button>
      <button id="downloadsRetryBtn"></button>`;

    window.DoloPawsOfflineDownloads.init();
    await Promise.resolve();
    await Promise.resolve();

    document.querySelector('[data-action="request-remove"]').click();
    expect(removePackage).not.toHaveBeenCalled();
    expect(document.querySelector('.od-remove-confirm').hidden).toBe(false);
    expect(document.querySelector('.od-actions').hidden).toBe(true);

    document.querySelector('[data-action="confirm-remove"]').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(removePackage).toHaveBeenCalledWith('lago-carezza');
  });
});
