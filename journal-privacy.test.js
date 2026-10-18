const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

// JOURNAL-02 replaced JOURNAL-01: the journal is account data now, kept on the
// device as the working copy. What has not changed is that it is private — only
// its owner may read it, and nothing in it reaches a public profile.
describe('JOURNAL-02 account walk journal contract', () => {
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

  test('the walk journal has its own owner-only collection', () => {
    expect(rules).toContain('match /users/{uid}/journal/{entryId}');
    expect(rules).toContain('allow get, list, delete: if isOwner(uid);');
    expect(rules).toContain('validJournalEntry(request.resource.data, entryId)');
    expect(firebaseClient).toContain('collection(db, "users", currentUser.uid, "journal")');
    expect(firebaseClient).toContain('getJournalEntries');
    expect(firebaseClient).toContain('saveJournalEntries');
  });

  test('the journal is local-first: a failed read never replaces the local copy', () => {
    // A dropped signal must not look like an account with no walks in it.
    expect(journal).toContain("if(!result || !result.ok){ storageNote('unsent'); return false; }");
    expect(firebaseClient).toContain('return { ok: false, entries: [] };');
    expect(journal).toContain('pushUnsentEntries');
    expect(journal).toContain('syncJournal()');
  });

  test('deleting an account takes the server journal with it', () => {
    expect(firebaseClient).toContain('getDocs(collection(db, "users", uid, "journal"))');
    expect(firebaseClient).toContain('removedJournalEntries');
  });

  test('no journal field is projected onto a public profile', () => {
    // validPublicProfile is an allowlist; these must never appear in it.
    const publicProfile = rules.slice(
      rules.indexOf('function validPublicProfile'),
      rules.indexOf('function validFollow')
    );
    ['track', 'note', 'journal', 'dist', 'cond'].forEach(field => {
      expect(publicProfile).not.toContain(`'${field}'`);
    });
  });

  test('the product tells users where their journal is kept', () => {
    expect(journal).toContain('Journal entries are saved to your ORMA account and kept on this device');
    expect(journal).toContain('Private, saved to your account');
    expect(privacy).toContain('saved to your account so your walks follow you to another phone');
    expect(privacy).toContain('Completed hikes and journal entries:');
    expect(privacy).not.toContain('ORMA does not sync the journal to the server.');
  });

  test('journal storage failures do not report a successful save', () => {
    expect(journal).toContain('catch(e){ return false; }');
    expect(journal).toContain('if(!persist())');
    expect(journal).toContain("showStatus(window.t('journal.saveError'))");
    expect(journal).toContain('state.entries = previousEntries');
    expect(journal).toContain('Object.assign(entry, previousEntry)');
  });
});
