const fs = require('fs');
const os = require('os');
const path = require('path');
const parity = require('./scripts/check-i18n-parity.js');

describe('I18N-01 dictionary and reference boundary', () => {
  test('English and Italian dictionaries have matching keys and placeholders', () => {
    const result = parity.audit(__dirname);
    expect(result.errors).toEqual([]);
    expect(result.en.size).toBeGreaterThan(350);
    expect(result.it.size).toBe(result.en.size);
  });

  test('placeholder extraction is order-independent but name-sensitive', () => {
    expect(parity.placeholders('{name} has {n} walks; hello {name}')).toEqual(['n', 'name']);
  });

  // dist/ and _site/ are generated copies of the files this audit already
  // reads, and they are rewritten while it runs: backoffice-hosting.test.js
  // rebuilds dist/backoffice in a parallel worker, so a path collected in one
  // tick had vanished by the time it was read. That failed roughly one full
  // run in twelve, as an ENOENT blamed on whichever suite reported it.
  describe('build output is not source', () => {
    const rootWith = extras => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-i18n-'));
      fs.writeFileSync(path.join(dir, 'i18n.js'), fs.readFileSync(path.join(__dirname, 'i18n.js')));
      for(const [name, body] of Object.entries(extras)){
        const full = path.join(dir, name);
        fs.mkdirSync(path.dirname(full), { recursive:true });
        fs.writeFileSync(full, body);
      }
      return dir;
    };
    const referenced = root => new Set(parity.referencedKeys(root).map(r => r.key));

    test('a key referenced only from dist/ is never collected', () => {
      const root = rootWith({ 'dist/backoffice/404.html':'<p data-i18n="only.in.dist">x</p>' });
      expect(referenced(root).has('only.in.dist')).toBe(false);
    });

    test('nor from _site/, .cache/ or .firebase/', () => {
      const root = rootWith({
        '_site/index.html':'<p data-i18n="only.in.site">x</p>',
        '.cache/thing.html':'<p data-i18n="only.in.cache">x</p>',
        '.firebase/thing.html':'<p data-i18n="only.in.firebase">x</p>',
      });
      const keys = referenced(root);
      expect(keys.has('only.in.site')).toBe(false);
      expect(keys.has('only.in.cache')).toBe(false);
      expect(keys.has('only.in.firebase')).toBe(false);
    });

    test('but a real source file is still read', () => {
      const root = rootWith({ 'page.html':'<p data-i18n="home.bubble">x</p>' });
      expect(referenced(root).has('home.bubble')).toBe(true);
    });

    // The shared list and .gitignore describe the same thing. If one grows a
    // new build directory the other has to know, or this comes back.
    test('the shared list covers every generated directory git ignores', () => {
      const { GENERATED_DIRECTORIES } = require('./scripts/generated-directories');
      const ignored = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8')
        .split('\n').map(line => line.trim().replace(/\/$/, ''))
        .filter(line => ['node_modules','dist','_site','.cache','.firebase','coverage'].includes(line));
      expect(ignored.length).toBeGreaterThan(3);
      for(const directory of ignored) expect(GENERATED_DIRECTORIES).toContain(directory);
    });

    // Two walkers kept private copies of this and they disagreed: one was
    // missing _site, which failed the whole suite locally for anyone who had
    // built the site. A third copy is how that happens again.
    test('no walker keeps a private copy of it', () => {
      for(const file of ['scripts/check-i18n-parity.js', 'match-vocabulary.test.js']){
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
        expect(source).toContain("require('./generated-directories')".replace('./', file.startsWith('scripts/') ? './' : './scripts/'));
        // the giveaway of a hand-rolled list: build directories spelled out together
        expect(source).not.toMatch(/node_modules[^\n]{0,40}(?:_site|dist)[^\n]{0,40}coverage/);
      }
    });
  });
});
