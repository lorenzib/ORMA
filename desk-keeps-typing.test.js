/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://dolopaws-backoffice.web.app/trail-verify-desk.html"}
 */
const fs=require('fs');
const source=fs.readFileSync('./trail-verify-desk.js','utf8');

// Six decisions never reached Firestore. The desk rebuilds every card once a
// minute, and a note typed into one came back as the string "[object Object]"
// because the draft is stored as {note} and was read back as the entry itself.
// A moderator who cleared that and pressed the button sent an empty note, which
// is refused -- and the refusal was wiped by the next rebuild sixty seconds on.

describe('a draft comes back as what was typed', () => {
  test('the stored shape and the read shape agree', () => {
    expect(source).toContain("drafts[decision.key]={note:note.value}");
    expect(source).toContain("note.value=(drafts[decision.key]?.note||receipt?.note||'')");
  });

  test('reading the entry itself is what produced the object string', () => {
    const drafts={r1:{note:'Route guidance is missing entirely.'}};
    expect(String(drafts.r1||'')).toBe('[object Object]');
    expect(drafts.r1?.note||'').toBe('Route guidance is missing entirely.');
  });
});

describe('the queue waits while somebody is deciding', () => {
  function busy(dom){
    const start=source.indexOf('  function busy(){');
    const end=source.indexOf('  window.setInterval(',start);
    return new Function('queueNode','document',`${source.slice(start,end)}\nreturn busy;`)(dom,document);
  }
  function queueWith(html){
    document.body.innerHTML=`<div id="q">${html}</div>`;
    return document.getElementById('q');
  }

  test('an empty queue refreshes', () => {
    expect(busy(queueWith('<article></article>'))()).toBe(false);
  });

  test('a note being typed is not taken away', () => {
    const node=queueWith('<textarea></textarea>');
    node.querySelector('textarea').value='Route guidance is missing entirely.';
    expect(busy(node)()).toBe(true);
  });

  test('a reason typed against a blocker is not taken away either', () => {
    const node=queueWith('<input class="vd-accept-why">');
    node.querySelector('.vd-accept-why').value='Walked it in August.';
    expect(busy(node)()).toBe(true);
  });

  // The line that says what happened is the whole point of pressing the button.
  test('a message that just appeared is not wiped', () => {
    const node=queueWith('<p class="vd-status">Could not save: permission-denied</p>');
    expect(busy(node)()).toBe(true);
  });

  test('the cursor sitting in a field holds it too', () => {
    const node=queueWith('<textarea id="t"></textarea>');
    document.getElementById('t').focus();
    expect(busy(node)()).toBe(true);
  });

  test('an untouched card still refreshes', () => {
    const node=queueWith('<textarea></textarea><p class="vd-status">   </p>');
    expect(busy(node)()).toBe(false);
  });
});
