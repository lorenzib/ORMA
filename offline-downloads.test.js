const fs = require('fs');
const path = require('path');

describe('OFF-03 downloaded-trail management surface', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    window.DoloPawsOffline = {
      formatBytes: bytes => `${bytes} bytes`,
      formatInstalledDate: value => value,
      formatPackageVersion: value => value ? `Package ${value}` : 'Package revision unavailable',
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
      state: 'ready',
      usable: true,
      hasLocalData: true,
      updateAvailable: false,
    }, true);

    document.body.innerHTML = markup;
    expect(document.querySelector('.od-card').dataset.trailId).toBe('lago-carezza');
    expect(document.querySelector('.od-meta').textContent).toContain('Beta field review pending');
    expect(document.querySelector('.od-owner').textContent).toContain('current-account');
    expect(document.querySelector('a[href^="/offline/trail.html"]')).not.toBeNull();
    expect(document.querySelector('[data-action="self-test"]')).not.toBeNull();
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
      state: 'update-available',
      usable: true,
      hasLocalData: true,
      updateAvailable: true,
    }, false);

    document.body.innerHTML = markup;
    expect(document.querySelector('[data-action="update"]').textContent)
      .toBe('Log in to update');
    expect(document.querySelector('a[href^="/offline/trail.html"]')).not.toBeNull();
    expect(document.querySelector('[data-action="request-remove"]')).not.toBeNull();
  });

  test('renders lifecycle actions through the active language dictionary', () => {
    const translations = {
      'downloads.state.updateAvailable':'Aggiornamento disponibile',
      'downloads.action.loginUpdate':'Accedi per aggiornare',
      'downloads.action.openMap':'Apri mappa',
      'downloads.action.remove':'Rimuovi',
      'downloads.action.details':'Dettagli sentiero',
      'downloads.card.kicker':'Mappa offline del sentiero',
      'downloads.downloaded':'Scaricata il {date}',
      'downloads.version.package':'Pacchetto {version}',
      'downloads.owner.signed-out-owner-retained':'Account conservato su questo dispositivo',
    };
    const t = (key, vars) => {
      let value = translations[key] || key;
      for(const name of Object.keys(vars || {})){
        value = value.split(`{${name}}`).join(vars[name]);
      }
      return value;
    };
    const markup = window.DoloPawsOfflineDownloads.packageCard({
      trailId:'lago-carezza',
      name:'Lago di Carezza Loop',
      trailUrl:'/trail.html?id=lago-carezza',
      offlineUrl:'/offline/trail.html?id=lago-carezza',
      version:'old',
      packageBytes:100,
      installedAt:'28 Jul 2026',
      verificationStatus:'unknown',
      ownership:'signed-out-owner-retained',
      state:'update-available',
      usable:true,
      hasLocalData:true,
    }, false, t);

    document.body.innerHTML = markup;
    expect(document.querySelector('.od-kicker').textContent).toBe('Mappa offline del sentiero');
    expect(document.querySelector('.od-state').textContent).toBe('Aggiornamento disponibile');
    expect(document.querySelector('[data-action="update"]').textContent).toBe('Accedi per aggiornare');
    expect(document.querySelector('a[href^="/offline/trail.html"]').textContent).toBe('Apri mappa');
    expect(document.querySelector('.od-meta').textContent).toContain('Pacchetto old');
    expect(document.querySelector('.od-owner').textContent).toBe('Account conservato su questo dispositivo');
  });

  test('uses the concise ORMA-vetted label without freshness detail', () => {
    const markup = window.DoloPawsOfflineDownloads.packageCard({
      trailId: 'vetted-trail',
      name: 'Vetted trail',
      trailUrl: '/trail.html?id=vetted-trail',
      offlineUrl: '/offline/trail.html?id=vetted-trail',
      version: '1',
      packageBytes: 100,
      installedAt: '29 Jul 2026',
      verificationStatus: 'verified',
      ownership: 'current-account',
      state: 'ready',
      usable: true,
      hasLocalData: true,
    }, true);

    expect(markup).toContain('Vetted by ORMA');
    expect(markup).not.toContain('freshness');
  });

  test('keeps a failed local package visible for repair or removal but not opening', () => {
    const markup = window.DoloPawsOfflineDownloads.packageCard({
      trailId: 'lago-carezza',
      name: 'Lago di Carezza Loop',
      trailUrl: '/trail.html?id=lago-carezza',
      offlineUrl: '/offline/trail.html?id=lago-carezza',
      version: null,
      packageBytes: 35_560,
      installedAt: '28 Jul 2026',
      verificationStatus: 'field-review-required',
      ownership: 'legacy-owner-unknown',
      state: 'failed',
      stateMessage: 'Stored map failed its checksum.',
      usable: false,
      hasLocalData: true,
      updateAvailable: false,
    }, true);

    document.body.innerHTML = markup;
    expect(document.querySelector('.od-state').textContent).toBe('Verification failed');
    expect(document.querySelector('[data-action="update"]').textContent).toBe('Repair download');
    expect(document.querySelector('[data-action="request-remove"]')).not.toBeNull();
    expect(document.querySelector('[data-action="self-test"]')).toBeNull();
    expect(document.querySelector('a[href^="/offline/trail.html"]')).toBeNull();
  });

  test('page and controller expose empty, error, update, and confirmed removal paths', () => {
    const page = fs.readFileSync(path.join(__dirname, 'downloads.html'), 'utf8');
    const controller = fs.readFileSync(path.join(__dirname, 'offline-downloads.js'), 'utf8');

    expect(page).toContain('id="downloadsEmpty"');
    expect(page).toContain('id="downloadsError"');
    expect(page).toContain('id="downloadsSignedOut"');
    expect(controller).toContain('listPackageStates');
    expect(controller).toContain('verifyInstalledPackage');
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
      state: 'ready',
      usable: true,
      hasLocalData: true,
      updateAvailable: false,
    };
    const removePackage = jest.fn().mockResolvedValue(undefined);
    window.DoloPawsOffline.listPackageStates = jest.fn().mockResolvedValue([record]);
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
