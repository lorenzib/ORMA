const fs = require('fs');
const path = require('path');

const source = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('AUTH-03 account deletion and device cleanup', () => {
  test('private nested outcomes are removed before the profile and authentication identity', () => {
    const firebase = source('firebase-init.js');
    const outcomes = firebase.indexOf('getDocs(collection(db, "users", uid, "outcomes"))');
    const profile = firebase.indexOf('deleteDoc(doc(db, "users", uid))');
    const authentication = firebase.indexOf('deleteUser(currentUser)');
    expect(outcomes).toBeGreaterThan(-1);
    expect(profile).toBeGreaterThan(outcomes);
    expect(authentication).toBeGreaterThan(profile);
    expect(firebase).toContain('retainedForSafetyAndModeration');
    expect(firebase).toContain('stage: "private-data"');
    expect(firebase).toContain('stage: "authentication"');
  });

  test('the destructive confirmation names server deletions, retained records, and device choices', () => {
    const account = source('account.html');
    expect(account).toContain('Deleted from the server:');
    expect(account).toContain('May be retained:');
    expect(account).toContain('journal entries');
    expect(account).toContain('analytics queues');
    expect(account).toContain('Keep downloaded public maps');
  });

  test('all logout entry points use the explicit shared-device choice', () => {
    const settings = source('settings.html');
    expect(settings).toContain("window.location.href = 'account.html?logout=1'");
    expect(settings).not.toContain("DoloPawsAuth.logOut().then(function(){ window.location.href = 'index.html'; })");
  });

  test('completion receipt distinguishes removed, retained, and incomplete device cleanup', () => {
    const account = source('account.js');
    const homepage = source('script.js');
    expect(account).toContain("deviceState = removePackages ? 'removed' : 'maps-retained'");
    expect(account).toContain("'index.html?accountDeleted=1&device='");
    expect(homepage).toContain("device === 'removed'");
    expect(homepage).toContain("device === 'maps-retained'");
    expect(homepage).toContain('device cleanup did not finish');
  });
});
