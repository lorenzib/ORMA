const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('MOD-02 minimum moderation queue', () => {
  const client = read('firebase-init.js');
  const rules = read('firestore.rules');
  const page = read('moderation-page.js');
  const shell = read('moderation.html');
  const account = read('account.html');
  const navigation = read('mobile-nav.js');
  const homepage = read('index.html');

  test('requires the trusted moderator claim on client and server', () => {
    expect(client).toContain('getIdTokenResult(currentUser, true)');
    expect(client).toContain('token.claims.moderator === true');
    expect(rules).toContain("request.auth.token.get('moderator', false) == true");
    expect(shell).toContain('Private operator tool');
    expect(shell).toContain('noindex,nofollow');
  });

  test('authorized operators discover the private tool outside dog profiles', () => {
    expect(account).not.toContain('moderatorToolsBox');
    expect(navigation).toContain("'moderation.html', 'mobile.moderator'");
    expect(navigation).toContain('summary.moderator === true');
    expect(homepage).toContain('id="liModeratorLink" href="moderation.html" hidden');
  });

  test('queues every state needing a decision or restoration', () => {
    expect(client).toContain(
      '? ["pending", "visible", "reported", "hidden", "removed"]'
    );
    expect(client).toContain(
      ': ["pending", "reported", "hidden", "removed"]'
    );
    expect(client).toContain('!item.content.lifecyclePresent');
    expect(client).toContain('where("status", "==", "open")');
    expect(client).toContain('reportReasons');
    expect(page).toContain("action('visible', 'Publish')");
    expect(page).toContain("action('hidden', 'Hide')");
    expect(page).toContain("action('removed', 'Remove')");
    expect(page).toContain("action('visible', 'Restore')");
  });

  test('returns only moderation-relevant contribution fields', () => {
    const itemStart = client.indexOf('function moderationItem');
    const itemEnd = client.indexOf('async function getModerationQueue');
    const projection = client.slice(itemStart, itemEnd);
    expect(projection).toContain('authorUid: data.uid');
    expect(projection).toContain('trailId: data.trailId');
    expect(projection).not.toContain('dogContext');
    expect(projection).not.toContain('email');
    expect(projection).not.toContain('owner');
  });

  test('writes the decision, audit, and report resolution together', () => {
    expect(client).toContain('const batch = writeBatch(db)');
    expect(client).toContain('collection(db, "moderationAudit")');
    expect(client).toContain('batch.update(doc(db, MODERATION_COLLECTIONS[item.type]');
    expect(client).toContain('batch.update(doc(db, "reports", reportId)');
    expect(client).toContain('await batch.commit()');
  });

  test('audit records are private, identity-bound, and immutable', () => {
    expect(rules).toContain('match /moderationAudit/{auditId}');
    expect(rules).toContain('validModerationAudit(request.resource.data)');
    expect(rules).toContain('request.resource.data.moderatorUid == request.auth.uid');
    expect(rules).toContain('request.resource.data.createdAt == request.time');
    expect(rules).toContain('allow update, delete: if false');
    expect(rules).not.toContain('authorEmail');
  });

  test('renders submitted content as text rather than interpolated HTML', () => {
    expect(page).toContain('node.textContent = text');
    expect(page).not.toContain('innerHTML');
  });
});
