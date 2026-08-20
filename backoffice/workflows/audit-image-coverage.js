'use strict';

const fs = require('fs/promises');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const STOP_WORDS = new Set(['with','your','dogs','dog','guide','hikes','hiking','trail','trails','the','and','for','from','this','that','orma']);

async function walkImages(directory, source, base){
  try{
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async entry => {
      const target = path.join(directory, entry.name);
      if(entry.isDirectory()) return walkImages(target, source, base);
      if(!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return [];
      return [{ source, fileName: entry.name, sourceRef: source === 'orma-library' ? path.relative(base, target) : null, absolutePath: target }];
    }));
    return nested.flat();
  }catch(error){ if(error.code === 'ENOENT') return []; throw error; }
}

function tokens(value){
  return [...new Set(String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(word => word.length > 2 && !STOP_WORDS.has(word)))];
}

function rankLibraryMatches(page, images){
  const words = tokens(`${page.slug} ${page.title}`);
  return images.map(image => {
    const name = tokens(image.fileName); const overlap = words.filter(word => name.includes(word));
    return { ...image, score: overlap.length, matchedTerms: overlap };
  }).filter(image => image.score > 1).sort((a,b) => b.score-a.score || a.fileName.localeCompare(b.fileName)).slice(0,3)
    .map(({absolutePath, ...image}) => image);
}

function titleFromHtml(html, fallback){
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || fallback;
  return h1.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function imageSignals(html){
  const imageTags = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
  const editorialImages = imageTags.filter(src => !/(?:logo|favicon|icon-512|apple-touch|paw-badge|footer)/i.test(src));
  const backgroundImages = [...html.matchAll(/background-image\s*:\s*url\(["']?([^)'"\s]+)["']?\)/gi)].map(match => match[1])
    .filter(src => !/(?:logo|favicon|icon-512)/i.test(src));
  const ogImage = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] || null;
  const hasEmptyHero = /class=["'][^"']*gp-hero-photo__inner[^"']*["'][^>]*>\s*<\/div>/i.test(html);
  return { imageTags, editorialImages, backgroundImages, ogImage, hasEmptyHero };
}

async function auditImageCoverage(root, options = {}){
  const at = options.at || new Date().toISOString();
  const guidesDirectory = path.join(root, 'guides');
  const names = (await fs.readdir(guidesDirectory)).filter(name => name.endsWith('.html')).sort();
  const personalRoot = options.personalLibraryPath || process.env.ORMA_PHOTO_LIBRARY_PATH || null;
  const [ormaImages, personalImages] = await Promise.all([
    walkImages(path.join(root, 'images'), 'orma-library', root),
    personalRoot ? walkImages(path.resolve(personalRoot), 'personal-library', root) : Promise.resolve([]),
  ]);
  const pages = await Promise.all(names.map(async name => {
    const sourceRef = path.join('guides', name); const html = await fs.readFile(path.join(root, sourceRef), 'utf8');
    const page = { slug: name.replace(/\.html$/, ''), title: titleFromHtml(html, name), sourceRef };
    const signals = imageSignals(html); const candidates = rankLibraryMatches(page, [...ormaImages, ...personalImages]);
    const hasEditorialImage = signals.editorialImages.length > 0 || signals.backgroundImages.length > 0;
    const placeholderSocialImage = !signals.ogImage || /icon-512|placeholder/i.test(signals.ogImage);
    const hasMeaningfulImage = hasEditorialImage || !placeholderSocialImage;
    const reasons = [];
    if(!hasMeaningfulImage) reasons.push('No meaningful editorial image is rendered on the page.');
    if(signals.hasEmptyHero) reasons.push('The page contains an empty hero image container.');
    if(!hasMeaningfulImage && placeholderSocialImage) reasons.push('The social preview also uses the ORMA icon or has no image.');
    return {
      ...page, coverageState: reasons.length ? 'missing' : 'covered', reasons,
      existingAssets: [...signals.editorialImages, ...signals.backgroundImages], ogImage: signals.ogImage,
      libraryMatches: candidates,
      recommendedRoute: candidates.length ? candidates[0].source : personalRoot ? 'licensed-search' : 'personal-library-first',
      priority: signals.hasEmptyHero ? 'high' : reasons.length > 1 ? 'high' : 'medium', status: reasons.length ? 'awaiting-review' : 'covered',
    };
  }));
  const gaps = pages.filter(page => page.coverageState === 'missing');
  return {
    contractVersion: '1.0.0', generatedAt: at, mode: 'coverage-audit', publicMutationAllowed: false,
    library: { ormaRoot: 'images/', ormaAssetsScanned: ormaImages.length, personalLibraryConnected: Boolean(personalRoot), personalAssetsScanned: personalImages.length },
    pages, gaps,
    summary: { pagesScanned: pages.length, covered: pages.length-gaps.length, missing: gaps.length, highPriority: gaps.filter(gap=>gap.priority==='high').length },
  };
}

module.exports = { tokens, rankLibraryMatches, imageSignals, auditImageCoverage };
