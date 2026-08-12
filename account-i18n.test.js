const fs = require('fs');
const path = require('path');

const account = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');

describe('account-management translation boundary', () => {
  test('core profile and destructive lifecycle states use stable keys', () => {
    [
      'account.validation.name',
      'account.saving',
      'account.savedReturning',
      'account.dogAdded',
      'account.saveError',
      'account.removeConfirm',
      'account.logout.activeData',
      'account.logout.error',
      'account.delete.deleting',
      'account.signedOut',
      'account.yourDog',
      'account.breedHint',
      'account.card.copied',
    ].forEach(key => expect(account).toContain(`tKey('${key}'`));
    expect(account).toContain("labelKey:'account.sensitivity.heat'");
    expect(account).toContain('serviceMessage(result)');
  });

  test('verification and credential-management outcomes use stable keys', () => {
    [
      'account.contribution.verified',
      'account.contribution.checking',
      'account.email.sent',
      'account.password.sent',
    ].forEach(key => expect(account).toContain(`tKey('${key}'`));
  });

  test('account deletion displays stable service messages instead of raw English results', () => {
    expect(account).toContain('deleteStatus.textContent = serviceMessage(result)');
  });
});
