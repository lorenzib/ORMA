// Assembles the native-app web bundle in dist/app.
//
// The repository root doubles as the public site AND as the operator
// backoffice, editorial tooling, raw source data, and social share cards.
// A native binary must contain the public product only: shipping an operator
// desk inside an App Store build would publish an internal surface, and
// shipping the raw data tree would add hundreds of megabytes nobody opens.
//
// So this build is a whitelist, not a copy. It starts from the public HTML
// entry points, follows every local href/src it finds, and adds the runtime
// files that JavaScript fetches by name (which no markup scan can discover).
// Anything not reached that way does not ship.
//
// It then vendors the two remote dependencies the site loads from CDNs --
// Google Fonts and MapLibre -- because an app that needs the network to draw
// a map or render text is not an offline app. The site itself keeps using the
// CDNs: only the copies under dist/app are rewritten.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'app');
const modules = path.join(root, 'node_modules');

// Public entry points. Every other root page is an operator surface.
const ENTRY_PAGES = [
  'index.html', '404.html', 'about.html', 'account.html', 'browse-trails.html',
  'collection.html', 'collections.html', 'compare.html', 'contact.html',
  'downloads.html', 'how-scoring-works.html', 'journal.html',
  'my-trails.html', 'notifications.html', 'onboarding.html', 'photo-upload.html',
  'privacy.html', 'reviews.html', 'safety-guide.html', 'saved.html',
  'settings.html', 'terms.html', 'trail-report.html', 'trail.html', 'walk.html',
];

// Files fetched at runtime by JS rather than referenced from markup. Region
// files are not listed here: they come from the region manifest, below, so a
// new region or trail ships without anyone editing this script.
// Sources: detail-pois.js, script.js, hike-mode.js, alpine-plants-guide.js,
// and mobile-nav.js, which injects the two hazard scripts on every page.
const RUNTIME_FILES = [
  'data/regions-manifest.json',
  'hazard-location.js',
  'trail-hazards.js',
  'data/dynamic-hazards.json',
  'data/alpine-plants.json',
  'data/alpine-plants-it.json',
  'manifest.json',
  // Takes the place of regions-runtime-manifest.js on every app page.
  'app-trail-data.js',
  // Linked into every app page, below.
  'app-shell.css',
  'app-tabbar.js',
  // Linked into the app's Explore, trail and account pages only, below.
  'app-explore.js',
  'app-trail.js',
  'app-you.js',
  'app-welcome.js',
];

// Whole directories that ship as-is.
const RUNTIME_DIRS = ['offline/packages', 'routing-graphs', 'trails', 'guides', 'data/trail-text-it'];

// Never ships, even if something links to it.
const DENY = [
  /^backoffice/, /-desk\.html$/, /-hosted[.-]/, /^dist\//, /^node_modules\//,
  /^images\/social\//, /^scripts\//, /^schemas\//, /^docs\//, /^prototypes\//,
  /^experiments\//, /^tmp\//, /^\.cache\//, /\.test\.js$/, /^data\/examples\//,
];

// Local font faces to vendor: [package, weights]. Latin and latin-ext only --
// the product is English, Italian, French and German.
const FONTS = [
  ['inter', [400, 500, 600, 700, 800]],
  ['bricolage-grotesque', [600, 700]],
];

// The trail route lines on every map are tiles built at deploy time, so they
// exist only on the website. Like the base map, they need the network anyway.
const SITE_ORIGIN = 'https://www.app-orma.com';
const HIKING_ORIGIN_LINE = 'const HIKING_ORIGIN = null;';

// Trail photos are most of the bundle (~130 MB), and Apple warns before any
// download over 200 MB on mobile data. So the app loads them from the website,
// like AllTrails and Komoot do; an offline package carries no photos anyway.
const REMOTE = /^images\/trails\//;
const REMOTE_REF = /(["'(])(?:\.\.\/|\.\/|\/)?(images\/trails\/)/g;

// A trail published after a release should reach the app the same day, not with
// the next App Store update, so app pages read the trail list from the website
// when online. app-trail-data.js does that and falls back to the copy inside.
const MANIFEST_TAG = /<script src="regions-runtime-manifest\.js(?:\?[^"]*)?"><\/script>/g;
const APP_MANIFEST_TAG = '<script src="app-trail-data.js"></script>';

// The app draws under the clock and battery, so its pages opt into the full
// screen and load app-shell.css, which moves the header below that strip and
// drops the website's add-to-home-screen advice. They also hold the page at its
// own size: an iPhone zooms in on any text box set smaller than 16px when it is
// tapped, and many are, so a search left the page zoomed and cut off at the
// right. A native app never zooms its pages; maps still pinch to zoom. Root-absolute, like the
// vendored files, because trail pages sit one directory down.
const VIEWPORT_TAG = /<meta name="viewport" content="([^"]*)">/g;
const APP_VIEWPORT_TAG = (tag, content) => {
  const own = content.split(',').map(part => part.trim())
    .filter(part => part && !/^(?:maximum-scale|viewport-fit)=/.test(part));
  return `<meta name="viewport" content="${[...own, 'maximum-scale=1', 'viewport-fit=cover'].join(', ')}">`;
};
const APP_SHELL_TAG = '<link rel="stylesheet" href="/app-shell.css">';
// Every app page also gets the bottom tab bar (app-tabbar.js), which a
// native app is navigated by.
const APP_TABBAR_TAG = '<script src="/app-tabbar.js" defer></script>';
// The trail page opens on a big map with a Photo/Map switch (app-trail.js).
const APP_TRAIL_TAG = '<script src="/app-trail.js" defer></script>';
// Explore keeps Layers and Terrain together at the top of the map (app-explore.js).
const APP_EXPLORE_TAG = '<script src="/app-explore.js" defer></script>';
const APP_YOU_TAG = '<script src="/app-you.js" defer></script>';
// The first launch: what ORMA does, then add your dog or look around (app-welcome.js).
const APP_WELCOME_TAG = '<script src="/app-welcome.js" defer></script>';
// Marks the page as running inside the app before anything draws, so the
// homepage can open on the map instead of the website's guest landing page.
const APP_FLAG_TAG = '<script>document.documentElement.classList.add(\'orma-app\');</script>';

const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');
const denied = (r) => DENY.some((pattern) => pattern.test(r));

const collected = new Set();
const missing = [];

function addFile(r){
  if(!r || denied(r) || REMOTE.test(r) || collected.has(r)) return false;
  if(!fs.existsSync(path.join(root, r))) { missing.push(r); return false; }
  collected.add(r);
  return true;
}

function addDir(dir){
  const abs = path.join(root, dir);
  if(!fs.existsSync(abs)) { missing.push(dir); return; }
  for(const entry of fs.readdirSync(abs, { withFileTypes:true })){
    const child = `${dir}/${entry.name}`;
    if(entry.isDirectory()) addDir(child);
    else if(addFile(child) && child.endsWith('.html')) scanHtml(child);
  }
}

// Follows local href/src out of one HTML file. Mirrors the resolution rules in
// scripts/check-static-assets.js so both agree on what "a local asset" means.
function scanHtml(r){
  const html = fs.readFileSync(path.join(root, r), 'utf8');
  for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
    const raw = match[1];
    if(/^(?:https?:|mailto:|tel:|data:|#|javascript:|\/)/i.test(raw) || /[{}]/.test(raw)) continue;
    const clean = raw.split(/[?#]/)[0];
    if(!clean) continue;
    const target = rel(path.resolve(path.dirname(path.join(root, r)), clean));
    if(addFile(target) && target.endsWith('.html')) scanHtml(target);
  }
}

// Everything regional-trails-loader.js and detail-pois.js load for a region:
// its trail list, one detail file per trail, its water, huts and dog routes,
// and the amenities layer where one exists. The manifest is the loader's own
// index, so the app ships exactly what a page can ask for. Trail images are
// named only inside the trail records, so those are read out of the files.
function addRegionFiles(){
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/regions-manifest.json'), 'utf8'));
  const named = new Set();
  for(const [region, entry] of Object.entries(manifest.regions)){
    const files = [entry.trails, entry.water, entry.hutsBars, entry.dogRoutes,
      ...Object.values(entry.details || {}), ...(entry.optional || [])];
    for(const file of files){
      if(!file) continue;
      const clean = file.split(/[?#]/)[0];
      addFile(clean);
      if(/^data\/(regions|trail-details)\/.+\.js$/.test(clean)) named.add(clean);
    }
    const amenities = `data/trail-amenities/${region}-amenities.geojson`;
    if(fs.existsSync(path.join(root, amenities))) addFile(amenities);
  }
  for(const file of named){
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for(const match of source.matchAll(/"(images\/[^"?#]+)"/g)) addFile(match[1]);
  }
}

// Pictures a script or stylesheet names by path, such as the homepage's
// "how it works" images in homepage-search.js. The markup scan above reads
// only href and src, so these were left out and showed broken in the app.
const NAMED_IMAGE = /["'(`](?:\.\.\/|\.\/|\/)?(images\/[^"'`()?#\s${}]+\.(?:jpe?g|png|webp|svg|gif|avif))(?=[?#"'`)])/gi;
function addNamedImages(){
  for(const r of [...collected]){
    if(!/\.(js|css|html)$/.test(r)) continue;
    const text = fs.readFileSync(path.join(root, r), 'utf8');
    for(const match of text.matchAll(NAMED_IMAGE)) addFile(match[1]);
  }
}

// Smaller copies of a photo (lago-di-braies-480.webp) are swapped in by script
// for narrow screens, by name, so ship each one next to the photo it shrinks.
function addImageVariants(){
  const dir = path.join(root, 'images');
  const bases = new Set([...collected].filter((r) => r.startsWith('images/'))
    .map((r) => r.replace(/\.[a-z0-9]+$/i, '')));
  for(const name of fs.readdirSync(dir)){
    const base = `images/${name}`.replace(/-\d+\.[a-z0-9]+$/i, '');
    if(base !== `images/${name}` && bases.has(base)) addFile(`images/${name}`);
  }
}

// The whole whitelist, without copying anything, so tests can check it.
function collectAppFiles(){
  collected.clear();
  missing.length = 0;
  for(const page of ENTRY_PAGES){
    if(addFile(page)) scanHtml(page);
  }
  for(const file of RUNTIME_FILES) addFile(file);
  addRegionFiles();
  for(const dir of RUNTIME_DIRS) addDir(dir);
  addNamedImages();
  addImageVariants();
  return { files: new Set(collected), missing: Array.from(new Set(missing)) };
}

function write(r, contents){
  const dest = path.join(outDir, r);
  fs.mkdirSync(path.dirname(dest), { recursive:true });
  fs.writeFileSync(dest, contents);
}

function copyInto(from, r){
  const dest = path.join(outDir, r);
  fs.mkdirSync(path.dirname(dest), { recursive:true });
  fs.copyFileSync(from, dest);
  return fs.statSync(from).size;
}

// Builds vendor/fonts from the @fontsource packages: copies the latin woff2
// files and reassembles one stylesheet from the packages' own @font-face
// blocks, so the unicode-ranges stay exactly as upstream defines them.
function vendorFonts(){
  let bytes = 0;
  const blocks = [];
  for(const [pkg, weights] of FONTS){
    const dir = path.join(modules, '@fontsource', pkg);
    for(const weight of weights){
      const css = fs.readFileSync(path.join(dir, `${weight}.css`), 'utf8');
      for(const face of css.match(/@font-face\s*\{[^}]*\}/g) || []){
        const file = (face.match(/url\(\.\/files\/([^)]+\.woff2)\)/) || [])[1];
        if(!file || !/-latin(-ext)?-\d+-normal\.woff2$/.test(file)) continue;
        bytes += copyInto(path.join(dir, 'files', file), `vendor/fonts/${file}`);
        blocks.push(face
          .replace(/url\(\.\/files\//g, 'url(/vendor/fonts/')
          .replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, ''));
      }
    }
  }
  write('vendor/fonts/fonts.css', `${blocks.join('\n')}\n`);
  return bytes + Buffer.byteLength(blocks.join('\n'));
}

function vendorMaplibre(){
  const dir = path.join(modules, 'maplibre-gl', 'dist');
  return copyInto(path.join(dir, 'maplibre-gl.js'), 'vendor/maplibre-gl/maplibre-gl.js')
    + copyInto(path.join(dir, 'maplibre-gl.css'), 'vendor/maplibre-gl/maplibre-gl.css');
}

// Points the bundled copies at the vendored files. Paths are root-absolute
// because Capacitor serves dist/app from the server root, and because
// map-runtime.js is loaded by pages at two different directory depths --
// a relative URL inside it would resolve against the document, not the script.
function rewriteRemoteRefs(){
  let rewritten = 0;
  for(const r of collected){
    if(!/\.(html|js|css)$/.test(r)) continue;
    const dest = path.join(outDir, r);
    const before = fs.readFileSync(dest, 'utf8');
    const after = before
      .replace(/<link[^>]+href=["']https:\/\/fonts\.googleapis\.com\/css2[^"']*["'][^>]*>/g,
        '<link rel="stylesheet" href="/vendor/fonts/fonts.css">')
      .replace(/<link[^>]+rel=["']preconnect["'][^>]*href=["']https:\/\/fonts\.g(?:oogleapis|static)\.com["'][^>]*>\s*/g, '')
      .replace(/https:\/\/unpkg\.com\/maplibre-gl@[^/'"`]+\/dist\/maplibre-gl\.(js|css)/g,
        '/vendor/maplibre-gl/maplibre-gl.$1')
      .replace(HIKING_ORIGIN_LINE, `const HIKING_ORIGIN = '${SITE_ORIGIN}';`)
      .replace(REMOTE_REF, `$1${SITE_ORIGIN}/$2`)
      .replace(MANIFEST_TAG, APP_MANIFEST_TAG);
    const page = /\.html$/.test(r)
      ? after.replace(VIEWPORT_TAG, APP_VIEWPORT_TAG).replace('</head>', `${APP_FLAG_TAG}\n${APP_SHELL_TAG}\n${APP_TABBAR_TAG}\n${r === 'trail.html' ? `${APP_TRAIL_TAG}\n` : ''}${r === 'index.html' ? `${APP_EXPLORE_TAG}\n` : ''}${r === 'index.html' ? `${APP_WELCOME_TAG}\n` : ''}${r === 'account.html' ? `${APP_YOU_TAG}\n` : ''}</head>`)
      : after;
    if(page !== before){ fs.writeFileSync(dest, page); rewritten += 1; }
  }
  return rewritten;
}

function build(){
  const { missing } = collectAppFiles();
  fs.rmSync(outDir, { recursive:true, force:true });
  let bytes = 0;
  for(const r of collected) bytes += copyInto(path.join(root, r), r);
  bytes += vendorFonts() + vendorMaplibre();
  const rewritten = rewriteRemoteRefs();

  const files = fs.readdirSync(outDir, { recursive:true })
    .filter((entry) => fs.statSync(path.join(outDir, entry)).isFile()).length;
  console.log(`App bundle: ${files} files, ${(bytes / (1024 * 1024)).toFixed(1)} MB -> ${rel(outDir)}`);
  console.log(`Rewrote remote references in ${rewritten} file(s).`);
  if(missing.length){
    console.error(`Missing ${missing.length} referenced file(s):\n${missing.join('\n')}`);
    process.exitCode = 1;
  }
}

if(require.main === module) build();

module.exports = { collectAppFiles, ENTRY_PAGES, RUNTIME_DIRS, HIKING_ORIGIN_LINE, SITE_ORIGIN, REMOTE_REF, MANIFEST_TAG, APP_MANIFEST_TAG,
  VIEWPORT_TAG, APP_VIEWPORT_TAG, APP_SHELL_TAG, APP_TABBAR_TAG, APP_TRAIL_TAG, APP_EXPLORE_TAG, APP_YOU_TAG, APP_WELCOME_TAG, APP_FLAG_TAG };
