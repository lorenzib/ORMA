const fs = require('fs');
const path = require('path');
const { isGeneratedDirectory } = require('./generated-directories');

const root = path.resolve(__dirname, '..');

function walk(directory){
  return fs.readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
    // Build output (dist, _site, the native app shells' copies of the app
    // bundle and Gradle's own reports) is not a source page.
    if(entry.isDirectory() && isGeneratedDirectory(entry.name)) return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const htmlFiles = walk(root).filter(file => file.endsWith('.html'));
const missing = [];

// The hosted backoffice pages are sources, not published pages: the hosting build
// renames them (backoffice-hosted-review.html -> backoffice-review.html), so their
// links only resolve inside dist/backoffice. Validate them there, via the hosting
// build, not against the public site root.
const BACKOFFICE_SOURCE_PAGES = new Set([
  'backoffice-hosted-review.html','backoffice-hosted-system.html','backoffice-hosted-login.html',
  'trail-verify-desk.html','community-moderation-desk.html',
]);

for(const file of htmlFiles){
  if(BACKOFFICE_SOURCE_PAGES.has(path.relative(root, file))) continue;
  const html = fs.readFileSync(file, 'utf8');
  // A page with <base href> (the one-page trail pilot) resolves its relative
  // links against that folder, as the browser does.
  const baseHref = (html.match(/<base\s+href=["']([^"']+)["']/i) || [])[1];
  const from = baseHref ? path.resolve(path.dirname(file), baseHref) : path.dirname(file);
  for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
    const raw = match[1];
    if(/^(?:https?:|mailto:|tel:|data:|#|javascript:|\/)/i.test(raw) || /[{}]/.test(raw)) continue;
    const clean = raw.split(/[?#]/)[0];
    if(!clean) continue;
    const target = path.resolve(from, clean);
    if(!fs.existsSync(target)) missing.push(`${path.relative(root, file)} -> ${raw}`);
  }
}

if(missing.length){
  console.error(`Missing local assets or pages (${missing.length}):\n${Array.from(new Set(missing)).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Static link check passed across ${htmlFiles.length} HTML files.`);
}
