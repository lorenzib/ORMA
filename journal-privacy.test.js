const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('JOURNAL-01 private local journal contract', () => {
  const journal = read('journal.html');
  const hikeMode = read('hike-mode.js');
  const walkPage = read('walk-page.js');
  const localData = read('local-data.js');
  const settings = read('settings.html');
  const privacy = read('privacy.html');
  const firebaseClient = read('firebase-init.js');
  const rules = read('firestore.rules');

  test('every journal producer and consumer uses an account-namespaced local key', () => {
    expect(journal).toContain("return 'dolopaws-journal-' + uid");
    expect(walkPage).toContain("return 'dolopaws-journal-' + uid");
    expect(hikeMode).toContain('`dolopaws-journal-${user.uid}`');
    expect(journal).toContain('localStorage.getItem(key())');
    expect(journal).toContain('localStorage.setItem(key(), JSON.stringify(state.entries))');
  });

  test('export and private-data cleanup cover the local journal', () => {
    expect(settings).toContain("localStorage.getItem('dolopaws-journal-' + user.uid)");
    expect(localData).toContain("'dolopaws-journal-'");
    expect(localData).toContain('PRIVATE_PREFIXES');
  });

  test('the product tells users that journal records stay in this browser', () => {
    expect(journal).toContain('Journal entries are stored in this browser for your account.');
    expect(privacy).toContain('DoloPaws does not sync the journal to the server.');
    expect(privacy).toContain('Completed hikes and journal entries:');
  });

  test('journal storage failures do not report a successful save', () => {
    expect(journal).toContain('catch(e){ return false; }');
    expect(journal).toContain('if(!persist())');
    expect(journal).toContain("showStatus(window.t('journal.saveError'))");
    expect(journal).toContain('state.entries = previousEntries');
    expect(journal).toContain('Object.assign(entry, previousEntry)');
  });

  test('the Firebase client and rules expose no journal collection', () => {
    expect(firebaseClient).not.toMatch(/collection\(db,\s*["'](?:journal|walkJournal|walks)["']/);
    expect(rules).not.toMatch(/match \/(?:journal|walkJournal|walks)\//);
  });
});
