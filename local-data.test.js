describe('OFF-03 local device cleanup', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    delete window.DoloPawsLocalData;
    delete window.DoloPawsOffline;
    require('./local-data.js');
  });

  test('detects an unfinished hike without exposing its location history', () => {
    localStorage.setItem('dolopaws-active-hike-v1', JSON.stringify({
      trailId:'alpe-siusi',
      state:'paused',
      updatedAt:1234,
      lastProgress:{ km:1.2, pathIndex:10 },
    }));
    expect(window.DoloPawsLocalData.activeHike()).toEqual({
      trailId:'alpe-siusi',
      state:'paused',
      updatedAt:1234,
    });
  });

  test('clears private records while retaining downloaded-package ownership', async () => {
    localStorage.setItem('dolopaws-active-hike-v1', '{}');
    localStorage.setItem('dolopaws-dog-photo-user-1', 'private');
    localStorage.setItem('dolopaws-journal-user-1', 'private journal');
    localStorage.setItem('dolopaws-offline-contributions-v1', 'private queue');
    localStorage.setItem('dolopaws-offline:lago-carezza', 'package');
    localStorage.setItem('dolopaws-offline-owner-salt', 'salt');
    localStorage.setItem('dolopaws-lang', 'it');
    localStorage.setItem('unrelated-site-key', 'keep');
    sessionStorage.setItem('dolopaws-pending-auth-action', 'private');

    const result = await window.DoloPawsLocalData.cleanup({ removePackages:false });

    expect(result.removePackages).toBe(false);
    expect(localStorage.getItem('dolopaws-active-hike-v1')).toBeNull();
    expect(localStorage.getItem('dolopaws-dog-photo-user-1')).toBeNull();
    expect(localStorage.getItem('dolopaws-journal-user-1')).toBeNull();
    expect(localStorage.getItem('dolopaws-offline-contributions-v1')).toBeNull();
    expect(sessionStorage.getItem('dolopaws-pending-auth-action')).toBeNull();
    expect(localStorage.getItem('dolopaws-offline:lago-carezza')).toBe('package');
    expect(localStorage.getItem('dolopaws-offline-owner-salt')).toBe('salt');
    expect(localStorage.getItem('dolopaws-lang')).toBe('it');
    expect(localStorage.getItem('unrelated-site-key')).toBe('keep');
  });

  test('delegates complete package removal without touching unrelated browser data', async () => {
    const removeAllPackages = jest.fn().mockResolvedValue(true);
    window.DoloPawsOffline = { removeAllPackages };
    localStorage.setItem('dolopaws-profile-summary', 'private');
    localStorage.setItem('dolopaws-privacy-prefs', 'preferences');
    localStorage.setItem('dolopaws-units-prefs', 'preferences');
    localStorage.setItem('unrelated-site-key', 'keep');

    const result = await window.DoloPawsLocalData.cleanup({ removePackages:true });

    expect(result.removePackages).toBe(true);
    expect(removeAllPackages).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('dolopaws-profile-summary')).toBeNull();
    expect(localStorage.getItem('dolopaws-privacy-prefs')).toBeNull();
    expect(localStorage.getItem('dolopaws-units-prefs')).toBeNull();
    expect(localStorage.getItem('unrelated-site-key')).toBe('keep');
  });

  test('account exits expose explicit retain and remove choices', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, 'account.html'), 'utf8');
    const account = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');
    const homepage = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

    expect(html).toContain('id="keepLocalLogoutBtn"');
    expect(html).toContain('id="removeLocalLogoutBtn"');
    expect(html).toContain('name="deleteLocalData" value="remove" checked');
    expect(html).toContain('name="deleteLocalData" value="retain"');
    expect(html.indexOf('offline-packages.js')).toBeLessThan(html.indexOf('local-data.js'));
    expect(account).toContain('cleanup({ removePackages:true })');
    expect(account).toContain("const removePackages = !choice || choice.value === 'remove'");
    expect(account).toContain("deviceState = 'cleanup-incomplete'");
    expect(homepage).toContain("account.html?logout=1");
  });
});
