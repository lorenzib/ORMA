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
  'privacy.html', 'reviews.html', 'safety-guide.html', 'saved.html', 'search.html',
  'settings.html', 'terms.html', 'trail-report.html', 'trail.html', 'walk.html',
];

// Files fetched at runtime by JS rather than referenced from markup.
// Sources: regions-runtime-manifest.js, detail-pois.js, script.js, hike-mode.js.
const RUNTIME_FILES = [
  'data/regions-manifest.json',
  'data/regions/dolomites-trails.js',
  'data/regions/savoy-trails.js',
  'data/regions/dolomites-water.geojson',
  'data/regions/savoy-water.geojson',
  'data/regions/dolomites-huts-bars.geojson',
  'data/regions/savoy-huts-bars.geojson',
  'data/trail-amenities/dolomites-amenities.geojson',
  'data/trail-amenities/savoy-amenities.geojson',
  'data/dynamic-hazards.json',
  'data/alpine-plants.json',
  'dog-friendly-routes.geojson',
  'dog-friendly-routes-savoy.geojson',
  'manifest.json',
];

// Whole directories that ship as-is.
const RUNTIME_DIRS = ['offline/packages', 'routing-graphs', 'trails', 'guides'];

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

const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');
const denied = (r) => DENY.some((pattern) => pattern.test(r));

const collected = new Set();
const missing = [];

function addFile(r){
  if(!r || denied(r) || collected.has(r)) return false;
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
        '/vendor/maplibre-gl/maplibre-gl.$1');
    if(after !== before){ fs.writeFileSync(dest, after); rewritten += 1; }
  }
  return rewritten;
}

for(const page of ENTRY_PAGES){
  if(addFile(page)) scanHtml(page);
}
for(const file of RUNTIME_FILES) addFile(file);
for(const dir of RUNTIME_DIRS) addDir(dir);

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
  console.error(`Missing ${missing.length} referenced file(s):\n${Array.from(new Set(missing)).join('\n')}`);
  process.exitCode = 1;
}
