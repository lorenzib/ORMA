const fs = require('fs');

describe('opt-in social profiles', () => {
  const firebase = fs.readFileSync('firebase-init.js', 'utf8');
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const account = fs.readFileSync('account.html', 'utf8');
  const journal = fs.readFileSync('journal.html', 'utf8');
  const card = require('./walk-card.js');

  test('public profile projection is separate from private user records', () => {
    expect(firebase).toContain('"publicProfiles"');
    expect(rules).toContain('match /publicProfiles/{uid}');
    const validator = rules.slice(rules.indexOf('function validPublicProfile'), rules.indexOf('function validFollow'));
    ['ownerEmail', 'ownerPhone', 'vetName', 'medical', 'journal'].forEach(field => expect(validator).not.toContain(field));
  });

  test('member explicitly controls public dog visibility and tag permissions', () => {
    expect(account).toContain('id="publicDogEnabled"');
    expect(account).toContain('id="publicTagPermission"');
    expect(account).toContain('separate from your contact, vet and journal information');
  });

  test('Trail Tale sharing supports dog voice and explicit public tags', () => {
    expect(journal).toContain('id="jnDogVoice"');
    expect(journal).toContain('id="jnTagDog"');
    expect(journal).toContain('id="jnCompanionTags"');
    expect(card.shareText({ dist:3, dur:30, trail:'Forest loop' }, 'Teo', ['Teo', 'Bea']))
      .toContain('@Teo @Bea');
    expect(card.shareText({ dist:3, dur:30 }, 'Teo', [], 'https://www.app-orma.com/profile.html?uid=abc'))
      .toContain('Follow our trails: https://www.app-orma.com/profile.html?uid=abc');
  });

  test('follow records carry no contact data', () => {
    expect(rules).toContain('match /follows/{edgeId}');
    const validator = rules.match(/function validFollow\(data\) \{[\s\S]*?\n    \}/)[0];
    expect(validator).not.toContain('email');
    expect(validator).not.toContain('phone');
  });
});
