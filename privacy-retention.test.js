const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('PRIV-01 retention and deletion contract', () => {
  test('public privacy copy covers every required data category', () => {
    const page = read('privacy.html');
    expect(page).toContain('id="retention"');
    [
      'Login, dog profiles, saved trails and match history',
      'Downloaded trail packages',
      'An active hike',
      'Private post-hike outcomes',
      'Reviews, trail photos and hazard reports',
      'Abuse reports and moderation audit records',
      'Anonymous hike-start counters',
    ].forEach(label => expect(page).toContain(label));
  });

  test('public copy distinguishes private deletion from safety retention', () => {
    const page = read('privacy.html');
    expect(page).toContain('Community content and safety or moderation records are handled separately');
    expect(page).toContain('community contributions waiting to sync');
    expect(page).toContain('Queued contributions stay private on this device');
    expect(page).toContain('not automatically erased with the private account');
    expect(page).not.toContain('profile, saved trails, journal');
  });

  test('account deletion links to the detailed retention explanation', () => {
    expect(read('account.html')).toContain('href="privacy.html#retention"');
  });

  test('enforceable local lifetimes match the published values', () => {
    expect(read('hike-session.js')).toContain('36 * 60 * 60 * 1000');
    expect(read('firebase-init.js')).toContain("localStorage.removeItem('dolopaws-metrics-v1')");
    expect(read('firebase-init.js')).toContain("key.startsWith('dolopaws-funnel-v1:')");
    expect(fs.existsSync(path.join(__dirname, 'metrics.js'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, 'metric-funnel.js'))).toBe(false);
  });
});
