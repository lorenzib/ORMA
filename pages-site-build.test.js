/**
 * What the public site is allowed to contain.
 *
 * Two commits previously "excluded" operator data by editing _config.yml, and
 * neither changed anything: .nojekyll means Pages never runs Jekyll, so the
 * exclude list was decorative. The only way to know an exclusion is real is to
 * build the published directory and look inside it, which is what this does.
 *
 * The deploy workflow runs this between assembling _site/ and uploading it, so
 * a regression fails the deploy instead of publishing.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
let SITE;

beforeAll(() => {
  // Reuse the directory the workflow just built; otherwise build our own.
  const shipped = path.join(ROOT, '_site');
  if (fs.existsSync(path.join(shipped, 'index.html'))) {
    SITE = shipped;
    return;
  }
  SITE = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-pages-'));
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-pages-site.js'), SITE], { cwd: ROOT });
});

const inSite = relative => fs.existsSync(path.join(SITE, relative));

describe('the published site matches its allowlist', () => {
  // A denylist only catches the mistakes we already made. This compares the
  // built site against pages-public-manifest.json in BOTH directions, so a new
  // desk page added without a _config.yml exclude fails here even though no
  // rule names it — and a public page dropped by an over-broad exclude fails
  // too, instead of silently vanishing from the site.
  const manifest = () => JSON.parse(
    fs.readFileSync(path.join(ROOT, 'pages-public-manifest.json'), 'utf8'),
  );

  test('publishes nothing that is not on the allowlist', () => {
    const allowed = manifest();
    const entries = fs.readdirSync(SITE, { withFileTypes: true });
    const unexpected = entries
      .filter(entry => !(entry.isDirectory() ? allowed.directories : allowed.files).includes(entry.name))
      .map(entry => (entry.isDirectory() ? `${entry.name}/` : entry.name));
    // If this fails: either exclude it in _config.yml, or — if it really is
    // public — run `node scripts/build-pages-site.js --write-manifest`.
    expect(unexpected).toEqual([]);
  });

  test('publishes everything the allowlist promises', () => {
    const allowed = manifest();
    const missing = [...allowed.directories, ...allowed.files]
      .filter(name => !fs.existsSync(path.join(SITE, name)));
    expect(missing).toEqual([]);
  });

  test('the allowlist admits no operator surface', () => {
    const allowed = manifest();
    const suspicious = [...allowed.directories, ...allowed.files].filter(name =>
      /(^|-)desk\.|^backoffice|^moderation|-hosted\.|\.test\.js$|^firestore|^firebase\./i.test(name));
    expect(suspicious).toEqual([]);
  });
});

describe('the published site keeps operator data out', () => {
  // The exposure that started this: 4.7 MB of editorial queues, product ideas,
  // hazard packets and newsletter inputs served from www.app-orma.com.
  test.each([
    'backoffice-data',
    'backoffice',
    'backoffice-review.html',
    'backoffice-firebase.js',
    'backoffice-login.html',
    'moderation-page.js',
    'community-moderation-desk.html',
    'trail-dossier-desk.html',
    'newsletter-desk.js',
    'product-ideas-desk.js',
  ])('does not publish %s', entry => {
    expect(inSite(entry)).toBe(false);
  });

  test('publishes no Node test suite, at any depth', () => {
    const found = [];
    (function walk(dir, rel) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const next = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), next);
        else if (entry.name.endsWith('.test.js')) found.push(next);
      }
    })(SITE, '');
    expect(found).toEqual([]);
  });

  test('does not publish repository tooling, config or manifests', () => {
    ['docs', 'scripts', 'schemas', 'test-support', 'config', 'node_modules', '.git',
      'package.json', 'package-lock.json', 'prototypes',
      'firestore.rules', 'firestore.indexes.json', 'firebase.json',
      'AGENTS.md', 'README.md', '_config.yml'].forEach(entry => {
      expect({ entry, published: inSite(entry) }).toEqual({ entry, published: false });
    });
  });
});

describe('the published site is still the complete customer site', () => {
  // An over-broad exclude would silently amputate the site, so assert the
  // things a visitor actually needs.
  test.each([
    'index.html', 'trail.html', 'browse-trails.html', 'collections.html',
    'route-planner.html', 'walk.html', 'saved.html', 'account.html',
    'styles.css', 'script.js', 'trail-app.bundle.js', 'map-style.js',
    'sitemap.xml', 'robots.txt', 'manifest.json', 'sw.js',
    'CNAME', '.nojekyll',
  ])('publishes %s', entry => {
    expect(inSite(entry)).toBe(true);
  });

  test.each(['images', 'guides', 'data', 'scoring', 'trust', 'offline', 'trails'])(
    'publishes the %s directory, which the runtime loads',
    dir => {
      expect(inSite(dir)).toBe(true);
      expect(fs.readdirSync(path.join(SITE, dir)).length).toBeGreaterThan(0);
    },
  );

  test('every local asset referenced by a public page resolves', () => {
    const pages = fs.readdirSync(SITE).filter(file => file.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(20);

    const broken = [];
    for (const page of pages) {
      const html = fs.readFileSync(path.join(SITE, page), 'utf8');
      for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const raw = match[1];
        // Skip absolute URLs, anchors, and strings built by inline JS.
        if (/^(https?:|mailto:|tel:|#|data:|\/\/|\/)/.test(raw)) continue;
        if (raw.includes('${') || raw.includes("' +") || raw.includes('" +')) continue;
        const target = raw.split('?')[0].split('#')[0];
        if (!target) continue;
        if (!fs.existsSync(path.join(SITE, target))) broken.push(`${page} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
