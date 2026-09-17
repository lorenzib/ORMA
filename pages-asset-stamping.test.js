'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { contentKey, alreadyKeyed, stampPage, stampEmbeddedKeys, stampSite } =
  require('./scripts/build-pages-site.js');

// A cache key typed by hand goes stale the moment somebody forgets it, and
// forgetting is invisible: the deploy succeeds and the reader gets old code.
// #460 shipped a scoring fix whose accessor never loaded because the bundle
// changed and the number beside it did not, and a third of the site's asset
// references were already behind the file they named. These build a small site
// in a temp directory rather than the real one, because the real build writes
// into a directory other suites read and jest runs suites in parallel.

function site(files){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-stamp-'));
  for(const [name, body] of Object.entries(files)){
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return dir;
}
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8');
const sha = body => createHash('sha256').update(body).digest('hex');

describe('asset cache keys are derived from the file', () => {
  test('a reference is keyed by the hash of what it points at', () => {
    const dir = site({ 'index.html':'<script src="app.js"></script>', 'app.js':'console.log(1)' });
    stampSite(dir);
    expect(read(dir,'index.html')).toContain(`app.js?v=${sha('console.log(1)').slice(0,10)}`);
  });

  test('a hand-typed key is replaced, not kept', () => {
    const dir = site({ 'index.html':'<script src="app.js?v=20260917-4"></script>', 'app.js':'x' });
    stampSite(dir);
    expect(read(dir,'index.html')).not.toContain('20260917-4');
    expect(read(dir,'index.html')).toContain(`app.js?v=${sha('x').slice(0,10)}`);
  });

  test('the same build of the same files gives the same key', () => {
    const one = site({ 'index.html':'<script src="app.js"></script>', 'app.js':'same' });
    const two = site({ 'index.html':'<script src="app.js"></script>', 'app.js':'same' });
    stampSite(one); stampSite(two);
    expect(read(one,'index.html')).toBe(read(two,'index.html'));
  });

  test('changing the file changes the key, which is the whole point', () => {
    const before = site({ 'index.html':'<script src="app.js"></script>', 'app.js':'before' });
    const after = site({ 'index.html':'<script src="app.js"></script>', 'app.js':'after' });
    stampSite(before); stampSite(after);
    expect(read(before,'index.html')).not.toBe(read(after,'index.html'));
  });

  // The generated trail pages sit a directory down and reach back up. Both
  // references must resolve to one file and carry one key, or the page and the
  // homepage fight over the same cache entry.
  test('one file reached from two depths gets one key', () => {
    const dir = site({
      'index.html':'<link href="styles.css">',
      'trails/one.html':'<link href="../styles.css">',
      'styles.css':'body{}',
    });
    stampSite(dir);
    const key = sha('body{}').slice(0,10);
    expect(read(dir,'index.html')).toContain(`styles.css?v=${key}`);
    expect(read(dir,'trails/one.html')).toContain(`../styles.css?v=${key}`);
  });

  test('a root-relative path is this site, not somebody else', () => {
    const dir = site({ 'trails/one.html':'<script src="/app.js"></script>', 'app.js':'y' });
    stampSite(dir);
    expect(read(dir,'trails/one.html')).toContain(`/app.js?v=${sha('y').slice(0,10)}`);
  });

  test('somebody else’s CDN is left alone', () => {
    const cdn = '<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>';
    const dir = site({ 'index.html':cdn });
    stampSite(dir);
    expect(read(dir,'index.html')).toBe(cdn);
  });

  test('a reference to something not published is left alone', () => {
    const dir = site({ 'index.html':'<script src="missing.js?v=20260101-1"></script>' });
    stampSite(dir);
    expect(read(dir,'index.html')).toContain('missing.js?v=20260101-1');
  });

  // build-regional-runtime-data.js keys trail-details files by the same sha256
  // sliced to twelve. Rewriting those to ten would shorten a correct key and
  // leave two systems disagreeing about one file.
  describe('a key that is already correct', () => {
    test('is recognised whatever length its author chose', () => {
      const dir = site({ 'a.js':'payload' });
      const full = sha('payload');
      expect(alreadyKeyed(full.slice(0,12), path.join(dir,'a.js'))).toBe(true);
      expect(alreadyKeyed(full.slice(0,10), path.join(dir,'a.js'))).toBe(true);
      expect(alreadyKeyed('20260917-4', path.join(dir,'a.js'))).toBe(false);
      expect(alreadyKeyed(sha('different').slice(0,12), path.join(dir,'a.js'))).toBe(false);
    });

    test('survives the build untouched', () => {
      const twelve = sha('payload').slice(0,12);
      const dir = site({ 'index.html':`<script src="a.js?v=${twelve}"></script>`, 'a.js':'payload' });
      stampSite(dir);
      expect(read(dir,'index.html')).toContain(`a.js?v=${twelve}`);
    });
  });

  // mobile-nav builds `new URL('device-handoff.js?v=...')` at runtime, and a
  // page or two assigns .src from a string. No attribute pass can see those.
  describe('keys written into script rather than an attribute', () => {
    test('are stamped too', () => {
      const dir = site({
        'nav.js':"new URL('handoff.js?v=20260901-1', import.meta.url)",
        'handoff.js':'z',
      });
      stampSite(dir);
      expect(read(dir,'nav.js')).toContain(`handoff.js?v=${sha('z').slice(0,10)}`);
    });

    test('but a filename merely mentioned is not', () => {
      const prose = '// see handoff.js for the depth logic\n';
      const dir = site({ 'nav.js':prose, 'handoff.js':'z' });
      stampSite(dir);
      expect(read(dir,'nav.js')).toBe(prose);
    });

    test('and a key is never invented where none was written', () => {
      const dir = site({ 'nav.js':"import('./handoff.js')", 'handoff.js':'z' });
      expect(stampEmbeddedKeys(path.join(dir,'nav.js'), dir, new Map())).toBe(0);
    });
  });

  test('nothing outside the built site can be keyed', () => {
    const dir = site({ 'index.html':'<script src="../../etc/passwd.js"></script>' });
    const before = read(dir,'index.html');
    stampPage(path.join(dir,'index.html'), dir, new Map());
    expect(read(dir,'index.html')).toBe(before);
  });

  test('the key is ten hex characters of the file’s sha256', () => {
    const dir = site({ 'a.js':'content' });
    expect(contentKey(path.join(dir,'a.js'))).toBe(sha('content').slice(0,10));
    expect(contentKey(path.join(dir,'a.js'))).toMatch(/^[0-9a-f]{10}$/);
  });

  // The bug this ordering exists to prevent, and it was not hypothetical: the
  // build stamps mobile-nav.js (it quotes device-handoff.js's key), which
  // changes mobile-nav.js's own bytes. Keying the pages first left 179 of them
  // naming a hash the file no longer had.
  describe('a file that is itself stamped', () => {
    test('settles before anything records its hash', () => {
      const dir = site({
        'index.html':'<script src="nav.js"></script>',
        'nav.js':"new URL('handoff.js?v=old', import.meta.url)",
        'handoff.js':'payload',
      });
      stampSite(dir);
      const key = read(dir,'index.html').match(/nav\.js\?v=([a-f0-9]+)/)[1];
      // the key on the page must describe nav.js as it was finally written
      expect(sha(read(dir,'nav.js'))).toMatch(new RegExp('^' + key));
      expect(read(dir,'nav.js')).toContain(`handoff.js?v=${sha('payload').slice(0,10)}`);
    });

    test('and two scripts quoting each other stop the build instead of shipping', () => {
      const dir = site({ 'a.js':"url('b.js?v=1')", 'b.js':"url('a.js?v=1')" });
      expect(() => stampSite(dir)).toThrow(/never settled/);
    });
  });

  // Pictures are re-keyed, never newly keyed. An image with no key revalidates
  // on its ETag and is fine; a wrong key is the defect. logo.svg shipped as
  // ?v=5 on 197 pages and ?v=3 on 140 -- one file, two cache entries, one set
  // of pages pinned to whichever had gone stale.
  describe('pictures', () => {
    test('a hand-numbered key becomes the file\'s hash', () => {
      const dir = site({ 'index.html':'<img src="logo.svg?v=5">', 'logo.svg':'<svg/>' });
      stampSite(dir);
      expect(read(dir,'index.html')).toContain(`logo.svg?v=${sha('<svg/>').slice(0,10)}`);
    });

    test('the same picture keyed differently on two pages ends up keyed once', () => {
      const dir = site({
        'a.html':'<img src="logo.svg?v=5">',
        'b.html':'<img src="logo.svg?v=3">',
        'logo.svg':'<svg/>',
      });
      stampSite(dir);
      const key = sha('<svg/>').slice(0,10);
      expect(read(dir,'a.html')).toContain(`logo.svg?v=${key}`);
      expect(read(dir,'b.html')).toContain(`logo.svg?v=${key}`);
    });

    // The deliberate limit. Adding query strings to the 941 unkeyed image
    // references would change URLs that feeds and caches have already recorded,
    // and buy nothing an ETag does not already give.
    test('a picture with no key is left without one', () => {
      const page = '<img src="photo.jpg">';
      const dir = site({ 'index.html':page, 'photo.jpg':'binary' });
      stampSite(dir);
      expect(read(dir,'index.html')).toBe(page);
    });

    test('each srcset variant is keyed by its own file', () => {
      const dir = site({
        'index.html':'<img srcset="small.jpg?v=1 960w, big.jpg?v=1 2400w">',
        'small.jpg':'small bytes',
        'big.jpg':'big bytes',
      });
      stampSite(dir);
      const html = read(dir,'index.html');
      expect(html).toContain(`small.jpg?v=${sha('small bytes').slice(0,10)} 960w`);
      expect(html).toContain(`big.jpg?v=${sha('big bytes').slice(0,10)} 2400w`);
      expect(sha('small bytes').slice(0,10)).not.toBe(sha('big bytes').slice(0,10));
    });

    // og:image is an absolute URL a feed reader has already stored. Ours to
    // leave alone, like any other host.
    test('an absolute image URL is untouched', () => {
      const meta = '<meta property="og:image" content="https://www.app-orma.com/images/hero.jpg?v=20260820-2">';
      const dir = site({ 'index.html':meta, 'images/hero.jpg':'x' });
      stampSite(dir);
      expect(read(dir,'index.html')).toBe(meta);
    });
  });
});
