const fs = require('fs');
const path = require('path');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('MOD-02 minimum moderation queue', () => {
  const client = read('backoffice-firebase.js');
  const rules = read('firestore.rules');
  const page = read('moderation-page.js');
  const shell = read('community-moderation-desk.html');
  const account = read('account.html');
  const navigation = read('mobile-nav.js');
  const homepage = read('index.html');
  const customerClient = read('firebase-init.js');

  test('requires the trusted moderator claim on client and server', () => {
    expect(client).toContain('getIdTokenResult(currentUser,true)');
    expect(client).toContain('token.claims?.moderator===true');
    expect(rules).toContain("request.auth.token.get('moderator', false) == true");
    expect(shell).toContain('Protected human gate');
    expect(shell).toContain('noindex,nofollow,noarchive');
    expect(shell).toContain('backoffice-auth-guard.js');
  });

  test('keeps the operator tool in the private backoffice, never customer navigation', () => {
    expect(account).not.toContain('moderatorToolsBox');
    expect(navigation).not.toContain('moderation.html');
    expect(navigation).not.toContain('summary.moderator === true');
    expect(homepage).not.toContain('liModeratorLink');
    expect(shell).toContain('href="community-moderation-desk.html" aria-current="page">Community</a>');
    // No moderation surface survives on the customer site — not even a redirect.
    expect(fs.existsSync(path.join(__dirname, 'moderation.html'))).toBe(false);
    expect(customerClient).not.toContain('DoloPawsModeration');
    expect(customerClient).not.toContain('getModerationQueue');
  });

  test('queues every state needing a decision or restoration', () => {
    expect(client).toContain(
      "type==='flag'?['pending','visible','reported','hidden','removed']"
    );
    expect(client).toContain(
      ":['pending','reported','hidden','removed']"
    );
    expect(client).toContain('!item.content.lifecyclePresent');
    expect(client).toContain("where('status','==','open')");
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
    expect(projection).toContain('authorUid:data.uid');
    expect(projection).toContain('trailId:data.trailId');
    expect(projection).not.toContain('dogContext');
    expect(projection).not.toContain('email');
    expect(projection).not.toContain('owner');
  });

  test('writes the decision, audit, and report resolution together', () => {
    expect(client).toContain('const batch=writeBatch(db)');
    expect(client).toContain("collection(db,'moderationAudit')");
    expect(client).toContain('batch.update(doc(db,MODERATION_COLLECTIONS[item.type]');
    expect(client).toContain("batch.update(doc(db,'reports',reportId)");
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

  test('renders one filterable queue for hazards, photos, reviews, and places', async () => {
    const dom = new JSDOM(shell, { url:'http://localhost/community-moderation-desk.html', runScripts:'outside-only' });
    const { window } = dom;
    const createdAt = { toDate:() => new Date('2026-09-04T10:00:00Z'), toMillis:() => 1 };
    window.DoloPawsAuth = {};
    window.DoloPawsModeration = {
      getQueue:async() => ({ ok:true, items:[
        { type:'flag', id:'flag-1', trailId:'trail-1', targetId:'trail-1', authorUid:'user-1', status:'pending', createdAt, content:{ type:'water-dry' } },
        { type:'photo', id:'photo-1', trailId:'trail-1', targetId:'trail-1', authorUid:'user-2', status:'pending', createdAt, content:{ caption:'Dry fountain' } },
        { type:'review', id:'review-1', trailId:'trail-1', targetId:'trail-1', authorUid:'user-3', status:'pending', createdAt, content:{ rating:4,text:'Useful path' } },
        { type:'placeDog', id:'place-1', targetId:'place-1', authorUid:'user-4', status:'pending', createdAt, content:{ placeName:'Rifugio',policy:'outside',evidence:'sign' } },
      ] }),
      getSiteNotices:async() => ({ ok:true, notices:[] }),
    };
    window.DoloPawsAuthReady = true;
    window.eval(page);
    await new Promise(resolve => window.setTimeout(resolve, 10));
    expect(window.document.getElementById('communityPendingCount').textContent).toBe('4');
    expect(window.document.getElementById('communityHazardCount').textContent).toBe('1');
    expect(window.document.getElementById('communityPhotoCount').textContent).toBe('1');
    expect(window.document.getElementById('communityReviewCount').textContent).toBe('2');
    window.document.querySelector('[data-moderation-filter="photo"]').click();
    expect(window.document.getElementById('moderationQueue').textContent).toContain('Dry fountain');
    expect(window.document.getElementById('moderationQueue').textContent).not.toContain('Useful path');
    dom.window.close();
  });
});
