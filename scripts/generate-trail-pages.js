#!/usr/bin/env node
/**
 * generate-trail-pages.js, ORMA static trail page generator.
 *
 * Reads the three trail datasets plus trail-audits.js, assigns regions via
 * regions-config.js, and emits:
 *
 *   trails/<slug>.html     one crawlable, pre-rendered page per trail
 *   it/trails/<slug>.html  its Italian copy
 *   sitemap.xml          all public pages + every trail page
 *
 * Run at build time only (GitHub Actions or locally). Nothing here ships
 * as client-side JS. Pages reuse styles.css so they match the live site.
 *
 * Usage: node scripts/generate-trail-pages.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const evidenceContract = require('../trust/evidence-v1.js');
const recommendationContract = require('../scoring/recommendation-v1.js');
const photoProvenance = require('../trail-photo-provenance.js');
const { loadProductionTrails } = require('./load-production-trails');
const { buildCanonicalCatalog } = require('./trail-adapter');
const { loadSlugOverrides, allRetiredSlugs, validateSlugOverrides } = require('./trail-slug-overrides');
// The same module the app reads its trail numbers from, so a page and a card
// show the same numbers in the same order for the same walk.
const routeRefs = require('../trail-route-refs.js');
const routeGuidanceSources = require('../route-guidance-sources.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'trails');
// The Italian copies: it/trails/<slug>.html.
const IT_OUT_DIR = path.join(ROOT, 'it', 'trails');

/**
 * The page a retired address serves: a redirect a browser follows and a search
 * engine understands, with a link for anyone who lands on it without either.
 */
function retiredSlugPage(from, to, name, lang = 'en'){
  return inLanguage(lang, null, () => {
    const safeName = String(name).replace(/[&<>"]/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    return `<!doctype html>
<html lang="${lang}"${lang === 'it' ? ' data-orma-lang="it"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeName} &middot; ORMA</title>
<link rel="canonical" href="${BASE_URL}/${lang === 'it' ? 'it/' : ''}trails/${to}.html">
<meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url=./${to}.html">
</head>
<body style="font:16px/1.5 system-ui,sans-serif;margin:3rem auto;max-width:34rem;padding:0 1rem">
<p>${L('This walk is now at {link}.', { link: `<a href="./${to}.html">${safeName}</a>` })}</p>
</body>
</html>
`;
  });
}
const BASE_URL = 'https://www.app-orma.com';

// ---------------------------------------------------------------
// 1b. Language
//
// Every trail has an English page at trails/<slug>.html and an Italian one at
// it/trails/<slug>.html, written by the same templates. Fixed wording goes
// through L() with the English sentence and its {vars}: the English is its own key in the
// phrase table i18n-phrases-it.js (window.ORMA_PHRASES_IT), and a sentence
// with no Italian entry stays English. A trail's own words come from
// data/trail-text-it/<id>.js, keyed the same way (scripts/trail-text-it.js).
// The key passed to L() is always a plain string literal so it can be
// collected for translation.
// ---------------------------------------------------------------
const IT_DIR = 'it';
let LANG = 'en';
let TRAIL_TEXT = null;
let PHRASES_IT = null;
const TRAIL_TEXT_CACHE = new Map();
const hasOwn = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);

function runForWindowTable(file, name){
  if (!fs.existsSync(file)) return {};
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context.window[name] || {};
}

function phrasesIt() {
  if (PHRASES_IT) return PHRASES_IT;
  // ORMA_EXTRA_PHRASES lists JSON {English: Italian} files (path-delimited),
  // for trying out Italian that is not yet in the assembled table. The table
  // wins where both have a sentence.
  const extra = String(process.env.ORMA_EXTRA_PHRASES || '').split(path.delimiter).filter(Boolean)
    .reduce((all, file) => Object.assign(all, JSON.parse(fs.readFileSync(file, 'utf8'))), {});
  PHRASES_IT = Object.assign(extra, runForWindowTable(path.join(ROOT, 'i18n-phrases-it.js'), 'ORMA_PHRASES_IT'));
  return PHRASES_IT;
}

function trailTextIt(id) {
  if (!TRAIL_TEXT_CACHE.has(id)) {
    TRAIL_TEXT_CACHE.set(id, runForWindowTable(path.join(ROOT, 'data', 'trail-text-it', `${id}.js`), 'ORMA_TRAIL_TEXT_IT'));
  }
  return TRAIL_TEXT_CACHE.get(id);
}

// One pass, so a value that happens to contain "{word}" is never filled again.
function fillVars(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, key) => (hasOwn(vars, key) ? String(vars[key]) : match));
}

/** Fixed wording in the page's language. The English sentence is the key. */
function L(text, vars) {
  const table = LANG === 'it' ? phrasesIt() : null;
  return fillVars(hasOwn(table, text) && table[text] ? table[text] : text, vars);
}

/** A trail's own text in the page's language, English when not translated. */
function tr(text) {
  if (LANG !== 'it' || typeof text !== 'string') return text;
  return (hasOwn(TRAIL_TEXT, text) && TRAIL_TEXT[text]) || text;
}

const IT_NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 6 });
/** A number as the page's language writes it: 5.2 in English, 5,2 in Italian. */
function num(value) {
  if (LANG !== 'it') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return IT_NUMBER.format(value);
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return IT_NUMBER.format(Number(value));
  return value;
}

/**
 * Renders `fn` in `lang`. The shared modules this page borrows sentences from
 * (route-guidance-sources.js, trail-photo-provenance.js) translate through
 * window.DoloPawsI18n.phrase when it exists, so for an Italian page the
 * generator lends them its own phrase lookup for the length of the call.
 */
function inLanguage(lang, trailId, fn) {
  const previous = { LANG, TRAIL_TEXT };
  LANG = lang === 'it' ? 'it' : 'en';
  TRAIL_TEXT = LANG === 'it' && trailId ? trailTextIt(trailId) : null;
  const hook = LANG === 'it';
  const hadWindow = typeof globalThis.window !== 'undefined';
  const win = hadWindow ? globalThis.window : {};
  const hadI18n = hook && hasOwn(win, 'DoloPawsI18n');
  const previousI18n = hook ? win.DoloPawsI18n : undefined;
  if (hook) {
    win.DoloPawsI18n = { phrase: (text, vars) => L(text, vars) };
    if (!hadWindow) globalThis.window = win;
  }
  try {
    return fn();
  } finally {
    if (hook) {
      if (hadI18n) win.DoloPawsI18n = previousI18n;
      else delete win.DoloPawsI18n;
      if (!hadWindow) delete globalThis.window;
    }
    LANG = previous.LANG;
    TRAIL_TEXT = previous.TRAIL_TEXT;
  }
}

// Sentences of a trail text, for lining an English value up with its Italian.
function sentencesOf(text) {
  return String(text || '').trim().split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ“"'(])/u).filter(Boolean);
}

/**
 * The Italian of a directions line whose source sentence the page took off
 * (route-guidance-sources.js splitSources). The trail's table holds the whole
 * value, source sentence included, so the Italian drops the sentence at the
 * same place; when the two do not line up sentence for sentence, English.
 */
function trStripped(original, stripped) {
  if (LANG !== 'it') return stripped;
  const direct = tr(stripped);
  if (direct !== stripped || original === stripped) return direct;
  const whole = tr(original);
  if (whole === original) return stripped;
  const english = sentencesOf(original);
  const italian = sentencesOf(whole);
  if (english.length !== italian.length) return stripped;
  const sourceSentences = new Set(routeGuidanceSources.SOURCES.flatMap(source => source.sentences));
  const kept = italian.filter((sentence, index) => !sourceSentences.has(english[index]));
  return kept.length && kept.length < italian.length ? kept.join(' ') : stripped;
}

// ---------------------------------------------------------------
// 1. Load trail data exactly the way the browser does: concatenate
//    the scripts so they share one scope, then hand back `trails`.
// ---------------------------------------------------------------
function loadTrails() {
  return loadProductionTrails(ROOT);
}

// ---------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function truncate(s, n) {
  // One line. A published description is two paragraphs joined by a blank line,
  // and a meta tag carrying a literal newline is a meta tag with a line break
  // in the middle of the search snippet.
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

/**
 * A description as paragraphs.
 *
 * The published copy is "About the trail" and "Why it suits dogs" joined by a
 * blank line. Printed into one `<p>` it ran the two together with a raw newline
 * in the middle, which a browser renders as a single space: two paragraphs of
 * editorial copy arriving as one run-on block.
 */
function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n+/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(part => `<p>${escapeHtml(part)}</p>`)
    .join('\n  ');
}

function safetyClass(level) {
  if (level === 'low-risk') return 'safety-low';
  if (level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}

function safetyLabel(level) {
  if (level === 'low-risk') return L('Low-risk terrain');
  if (level === 'moderate') return L('Moderate terrain');
  return L('Caution terrain');
}

function displaySafetyLabel(t) {
  return safetyLabel(t.safetyLevel);
}

// These two mirror `waterPointLabel` and `startPointLabel` in trail-trust.js,
// which the app renders with. They keyed off curation instead of off the
// category review, and curation is not a review: a trail published with its
// directions established and its water never researched would have had its
// mapped points titled as reviewed water and the caveat taken off, and its
// start point printed with the raw "(OSM-verified access point)" wording and
// no "check current access" line. A test asserts the two agree for every trail
// in the catalogue, because this is a second copy and second copies drift.
const trailImported = t => !!t && t.curated === false;

const plainStartLabel = label => String(label || 'route start')
  .replace(/^Start here\s*[,.:;—–-]*\s*/i, '')
  .replace(/^Route start per OpenStreetMap\s*[,.:;—–-]*\s*/i, '')
  .replace(/\s*\(OSM-verified access point\)/gi, '')
  .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');

// trail-trust.js `withoutOsmTag`: a reviewed point keeps its name, not the
// importer's "(OSM-verified ...)" tag.
const withoutOsmTag = label => String(label || '')
  .replace(/\s*\(OSM-verified[^)]*\)/gi, '')
  .replace(/OSM-verified/gi, 'mapped in OpenStreetMap')
  .trim();

// The page's twin of waterLines in trail-trust.js: nearby fountains rounded
// to the same km print as one line with a count, not as repeats.
function displayWaterLines(t) {
  const lines = new Map();
  for (const point of Array.isArray(t.waterSources) ? t.waterSources : []) {
    if (!point) continue;
    const label = displayWaterLabel(t, point.label || point.name);
    const key = `${point.km}|${label}`;
    if (lines.has(key)) lines.get(key).count += 1;
    else lines.set(key, { km: point.km, label, count: 1 });
  }
  return [...lines.values()];
}

function displayWaterLabel(t, label) {
  const english = String(label || 'Water point')
    .replace(/Drinking water\s*\(OSM-verified location\)/i, 'Water point mapped in OpenStreetMap')
    .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
  // The two names the generator itself supplies are fixed wording; anything
  // else is the trail's own.
  const base = english === 'Water point' ? L('Water point')
    : english === 'Water point mapped in OpenStreetMap' ? L('Water point mapped in OpenStreetMap')
    : tr(english);
  if (!categoryVerified(t, 'water')) return L('{label}, availability can change', { label: base });
  return trailImported(t) ? base : tr(withoutOsmTag(label));
}

function displayStartLabel(t, label) {
  if (!categoryVerified(t, 'access') && !trailImported(t)) {
    return L('Suggested start, {label}. Check current access before travelling.', { label: tr(plainStartLabel(label)) });
  }
  if (!trailImported(t)) return tr(withoutOsmTag(label));
  return L('Mapped start suggestion, {label}. Check current access before travelling.', { label: tr(plainStartLabel(label)) });
}

const REGION_LABEL = { dolomites: 'Dolomites, Italy', savoy: 'Savoy, France', lombardy: 'Lombardy, Italy', friuli: 'Friuli Venezia Giulia, Italy', aosta: 'Valle d\'Aosta, Italy', piedmont: 'Piedmont, Italy', tyrol: 'Tyrol & Carinthia, Austria', switzerland: 'Switzerland' };
const REGION_COUNTRY = { savoy: 'FR', tyrol: 'AT', switzerland: 'CH' };

// REGION_LABEL in the page's language (the browse index stays English).
function regionLabelText(region) {
  switch (region) {
    case 'savoy': return L('Savoy, France');
    case 'lombardy': return L('Lombardy, Italy');
    case 'friuli': return L('Friuli Venezia Giulia, Italy');
    case 'aosta': return L('Valle d\'Aosta, Italy');
    case 'tyrol': return L('Tyrol & Carinthia, Austria');
    case 'switzerland': return L('Switzerland');
    default: return L('Dolomites, Italy');
  }
}

/**
 * One rule for the badge, shared with the app.
 *
 * This file had its own: "Verified by ORMA" once six categories were reviewed,
 * "Imported trail" otherwise, and no label in between. The app's rule has, since
 * #616, granted the seal only on the full eleven-check graduation. Measured
 * across the catalogue on 18 October 2026, the two disagreed about 22 live
 * pages: each showed a green Verified seal for a trail the app called Reviewed.
 * With the publication lane open the disagreement also ran the other way -- a
 * trail just published would read "Imported trail" on its own page.
 *
 * `evidenceContract.tierOf` is the rule both read now, and these are the words
 * trail-trust.js prints, so a card and a page say the same thing about the same
 * trail. A reviewed trail takes the muted pill and no icon, as it does in the
 * app, because the green tick is the seal.
 */
const TIER_BADGE = Object.freeze({
  verified: { label: 'Verified by ORMA', style: 'verified', icon: 'verified' },
  reviewed: { label: 'Reviewed by ORMA', style: 'neutral', icon: null },
  imported: { label: 'Imported trail', style: 'imported', icon: 'imported' },
});

/**
 * The badge for a trail, by the same route trail-trust.js takes.
 *
 * `mapped` means "route reviewed", which reads as Reviewed by ORMA on a curated
 * listing and as an imported trail on one nobody has prepared -- two trails in
 * the catalogue are in that state, an uncurated record carrying a route audit,
 * and a table keyed on the contract tier alone called them reviewed.
 */
function badgeForTrail(t) {
  const tier = evidenceContract.tierOf(t);
  if (tier === 'field-verified' || tier === 'route-audited') return TIER_BADGE.verified;
  if (tier === 'mapped' && t && t.curated !== false) return TIER_BADGE.reviewed;
  return TIER_BADGE.imported;
}
// TIER_BADGE's words in the page's language.
function tierLabelText(tier) {
  if (tier === TIER_BADGE.verified) return L('Verified by ORMA');
  if (tier === TIER_BADGE.reviewed) return L('Reviewed by ORMA');
  return L('Imported trail');
}

const REVIEW_CATEGORIES = ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];
const GRADUATION_CATEGORIES = ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', ...REVIEW_CATEGORIES];

function reviewProgress(t) {
  if (!t.verified || !Array.isArray(t.verified.categories)) return null;
  return REVIEW_CATEGORIES.filter(category => t.verified.categories.includes(category));
}

function graduationProgress(t) {
  if (!t.graduation || !Array.isArray(t.graduation.completed)) return null;
  const required = [...new Set([
    ...(Array.isArray(t.graduation.required) ? t.graduation.required : []),
    ...GRADUATION_CATEGORIES,
  ])];
  const completed = required.filter(check => t.graduation.completed.includes(check));
  return {
    completed: completed.length,
    total: required.length,
    verified: t.graduation.status === 'verified' && completed.length === required.length,
  };
}

function categoryVerified(t, category) {
  const progress = reviewProgress(t);
  // No recorded review means nothing is verified. See trail-trust.js.
  return progress !== null && progress.includes(category);
}

const IT_DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
function formatReviewDate(value) {
  if (LANG !== 'it') return evidenceContract.dateText(value);
  // evidenceContract.dateText's rule for a usable date, written the Italian way.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return L('date unknown');
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? L('date unknown') : IT_DATE.format(date);
}

/**
 * The directions, on the page a search engine can read.
 *
 * ORMA establishes four answers about following a walk -- where to start, what
 * the numbers are, the order they come in, and where they change -- and they
 * reached only the app. A reader arriving from a search engine got a page that
 * said how far the walk was and nothing about how to walk it, while the answers
 * sat in the same record the page was built from.
 *
 * The title, the labels and the sentences are the app's, from
 * trail-blueprint.js, because this is the same card in a second renderer and
 * two renderers of one card is how a page and an app come to say different
 * things about the same walk. A test compares them for every trail that has
 * guidance.
 *
 * `status` is printed when the record carries one. The five walks published
 * before the pipeline wrote that field have none, and it is the sentence saying
 * whether ORMA confirmed how the numbers appear on local signs -- what a reader
 * standing at a junction needs, and not a thing to drop in silence.
 */
function directionsSection(t) {
  const guidance = t && t.routeNumberGuidance && typeof t.routeNumberGuidance === 'object'
    ? t.routeNumberGuidance : null;
  if (!guidance) {
    // No structured guidance and no trail numbers: the route audit's own
    // sentence, when it is one a walker can follow, in the app's words.
    const written = routeRefs.writtenDirections(t);
    if (!written.written || routeRefs.forTrail(t).length) return '';
    return `<h2>${L('How to follow this route')}</h2>
    <p><b>${L('Directions:')}</b> ${escapeHtml(tr(written.text))}</p>
    <p class="sp-route-source">${escapeHtml(auditDirectionsNote())}</p>`;
  }
  const [start, sequence, switches] = ['start', 'sequence', 'switches']
    .map(field => String(guidance[field] || '').trim());
  // All three or none: half a set of directions is worse than none, because the
  // reader cannot tell which part is missing.
  if (!start || !sequence || !switches) return '';
  const landmarkLed = guidance.mode === 'landmarks';
  const status = String(guidance.status || '').trim();
  const numbers = routeRefs.forTrail(t);
  const shields = numbers.length
    ? `<div class="sp-route-refs" aria-label="${L('Trail numbers in order')}">${numbers.map((ref, index) =>
      `${index ? '<span class="sp-route-ref-arrow" aria-hidden="true">\u2192</span>' : ''}`
      + `<span class="sp-route-ref">${escapeHtml(ref)}</span>`).join('')}</div>`
    : '';
  // A walk with no numbers, turn by turn: the steps take the place of the
  // Route and Key turns lines, each tagged with the source it rests on.
  const stepped = routeGuidanceSources.landmarkSteps(guidance);
  // Each value ends with where it came from; the page says that once, under
  // the lines, instead of after every one of them.
  const given = [
    ['Start', start],
    ...(status && !stepped ? [['Trail numbers', status]] : []),
    ...(stepped ? [] : [
      [landmarkLed ? 'Route' : 'Trail numbers and route', sequence],
      [landmarkLed ? 'Key turns' : 'Where to switch', switches],
    ]),
  ];
  const split = routeGuidanceSources.splitSources(given);
  const note = split.note;
  const lines = split.lines.map(([label, text], index) => [label, trStripped(given[index][1], text)]);
  // Styled here rather than in the page head, so only the pages that have
  // steps carry the rules for them.
  const steps = stepped
    ? `\n    <style>.sp-route-badge{display:inline-block;margin:6px 0 2px;padding:3px 10px;border-radius:8px;background:#FBF1DC;color:#6B4A12;font-size:13px;}`
      + '.sp-route-steps{display:grid;gap:8px;margin:10px 0;padding-left:22px;}.sp-route-steps li::marker{color:#B54835;font-weight:800;}'
      + `.sp-route-step-from{color:#657369;font-size:12px;white-space:nowrap;}</style>
    <ol class="sp-route-steps">${stepped.steps.map(step =>
      `<li>${escapeHtml(tr(step.text))}${step.tags.length ? ` <span class="sp-route-step-from">${escapeHtml(step.tags.join(', '))}</span>` : ''}</li>`).join('')}</ol>${
      stepped.credits.map(credit => `\n    <p class="sp-route-credit">${escapeHtml(credit.before)}<a href="${
        escapeHtml(credit.url)}" rel="noopener">${escapeHtml(credit.label)}</a>${escapeHtml(credit.after)}</p>`).join('')}`
    : '';
  return `<h2>${L('How to follow this route')}</h2>
    ${shields}${stepped ? `<p class="sp-route-badge">${escapeHtml(stepped.badge)}</p>` : ''}
    ${lines.map(([label, text]) => label === 'Start' && /^Start\b/.test(text)
    // "Start: Start at …" read the word twice; the sentence's own first word
    // takes the bold instead (trail-blueprint.js does the same in the app).
    ? `<p><b>Start</b>${escapeHtml(text.slice(5))}</p>`
    : `<p><b>${escapeHtml(guidanceLabelText(label))}:</b> ${escapeHtml(text)}</p>`).join('\n    ')}${steps}${
    note ? `\n    <p class="sp-route-source">${escapeHtml(note)}</p>` : ''}`;
}

// The audit note is trail-route-refs.js's sentence; the page carries its
// Italian while the sentence is the one translated.
function auditDirectionsNote() {
  const english = routeRefs.AUDIT_DIRECTIONS_NOTE;
  return english === 'From ORMA\'s route audit of the official route description. Follow the mapped ORMA line and local signs.'
    ? L('From ORMA\'s route audit of the official route description. Follow the mapped ORMA line and local signs.')
    : english;
}

// The labels of the directions lines (trail-blueprint.js labelText).
function guidanceLabelText(label) {
  switch (label) {
    case 'Start': return L('Start');
    case 'Trail numbers': return L('Trail numbers');
    case 'Trail numbers and route': return L('Trail numbers and route');
    case 'Route': return L('Route');
    case 'Where to switch': return L('Where to switch');
    case 'Key turns': return L('Key turns');
    default: return label;
  }
}

// Valley hub guides (add here as new area guides are published)
const VALLEY_GUIDES = {
  // ../guides/ from trails/ is guides/, and from it/trails/ the Italian it/guides/.
  'Val Gardena': { href: '../guides/dog-friendly-hikes-val-gardena.html', get label() { return L('Dog-friendly hikes in Val Gardena'); } },
  'Alta Pusteria – Tre Cime': { href: '../guides/dog-friendly-hikes-lago-di-braies.html', get label() { return L('Lago di Braies & Tre Cime with a dog'); } },
};

// ---------------------------------------------------------------
// 2b. Per-trail visuals & computed copy (all derived from data, //     nothing invented; sections skip cleanly when data is absent)
// ---------------------------------------------------------------

// Inline SVG of the route line, same idea as the browse-page cards.
function routeSvg(t) {
  if (!Array.isArray(t.path) || t.path.length < 2) return '';
  const lats = t.path.map((p) => p[0]);
  const lngs = t.path.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 640, H = 280, pad = 24;
  const spanLat = (maxLat - minLat) || 1e-4;
  const spanLng = (maxLng - minLng) || 1e-4;
  const s = Math.min((W - pad * 2) / spanLng, (H - pad * 2) / spanLat);
  const pts = t.path.map(([lat, lng]) =>
    `${(pad + (lng - minLng) * s + (W - pad * 2 - spanLng * s) / 2).toFixed(1)},${(pad + (maxLat - lat) * s + (H - pad * 2 - spanLat * s) / 2).toFixed(1)}`
  ).join(' ');
  const [sx, sy] = pts.split(' ')[0].split(',');
  return `<svg class="sp-route" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(L('Route shape of {name}', { name: t.name }))}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" rx="12" fill="#E7ECE3"/>
    <polyline points="${pts}" fill="none" stroke="#2E4034" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${sx}" cy="${sy}" r="6" fill="#2E4034" stroke="#fff" stroke-width="2"/>
  </svg>`;
}

const RESPONSIVE_PHOTOS = {
  'images/lago-di-braies.webp': { widths:[480, 900], fallback:'images/lago-di-braies.jpg' },
  'images/lago-di-carezza.webp': { widths:[480, 900], fallback:'images/lago-di-carezza.jpg' },
  'images/boucle-du-marais-des-chassettes.webp': { widths:[480, 960, 1280], fallback:'images/boucle-du-marais-des-chassettes.jpg' },
  'images/itineraire-decouverte-de-la-nature.webp': { widths:[480, 960, 1280], fallback:'images/itineraire-decouverte-de-la-nature.jpg' },
};

function remoteAsset(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

// From trails/ the site root is one folder up; from it/trails/ it is two.
const rootPrefix = () => (LANG === 'it' ? '../../' : '../');

function trailPageAssetUrl(value) {
  const asset = String(value || '').trim();
  return remoteAsset(asset) ? asset : `${rootPrefix()}${asset.replace(/^\/+/, '')}`;
}

function publicAssetUrl(value) {
  const asset = String(value || '').trim();
  return remoteAsset(asset) ? asset : `${BASE_URL}/${asset.replace(/^\/+/, '')}`;
}

function photoHtml(t) {
  if(!t.imageIcon) return '';
  const responsive = RESPONSIVE_PHOTOS[t.imageIcon];
  const alt = tr(t.imageAlt) || t.name;
  if(!responsive) return `<img class="sp-img" src="${escapeHtml(trailPageAssetUrl(t.imageIcon))}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
  const stem = t.imageIcon.replace(/\.webp$/, '');
  const srcset = responsive.widths.map((width, index) => {
    const source = width === 900 ? t.imageIcon : `${stem}-${width}.webp`;
    return `${rootPrefix()}${source} ${width}w`;
  }).join(', ');
  return `<picture>
    <source type="image/webp" srcset="${srcset}" sizes="(max-width: 760px) 100vw, 1100px">
    <img class="sp-img" src="${rootPrefix()}${responsive.fallback}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
  </picture>`;
}

function photoCreditHtml(t){
  if(!t.imageIcon)return '';
  const credit=photoProvenance.heroCredit(t);if(!credit)return '';
  const label=escapeHtml(credit.label);
  let content=credit.url?`<a href="${escapeHtml(credit.url)}" rel="noopener nofollow">${label}</a>`:label;
  if(credit.url&&t.imageCreator&&t.imageLicence){
    const title=String(typeof t.imageCredit==='string'?t.imageCredit:t.name).split(/\s+[—·]\s+|,\s+/)[0].trim();
    const licence=t.imageLicenceUrl
      ?`<a href="${escapeHtml(t.imageLicenceUrl)}" rel="license noopener">${escapeHtml(t.imageLicence)}</a>`
      :escapeHtml(t.imageLicence);
    const publisher=/Wikimedia Commons/i.test(credit.text)?` <span aria-hidden="true">·</span> ${L('via Wikimedia Commons')}`:'';
    content=`${L('{title} by {creator}',{title:`<a href="${escapeHtml(credit.url)}" rel="noopener nofollow">${escapeHtml(title)}</a>`,creator:escapeHtml(t.imageCreator)})} <span aria-hidden="true">·</span> ${licence}${publisher}`;
  }
  if(credit.isIllustration){
    return `<details class="sp-photo-credit">
      <summary aria-label="${L('About this illustration')}" title="${L('About this illustration')}">i</summary>
      <div class="sp-photo-credit__body">${content}</div>
    </details>`;
  }
  return `<details class="sp-photo-credit">
      <summary aria-label="${L('Show photo credit')}" title="${L('Photo credit')}">C</summary>
      <div class="sp-photo-credit__body">${content} <span aria-hidden="true">·</span> ${L('Cropped for display.')}</div>
    </details>`;
}

// Inline SVG of the elevation profile.
function elevSvg(t) {
  const ep = t.elevationProfile;
  if (!Array.isArray(ep) || ep.length < 2) return '';
  const kms = ep.map((p) => p.km), els = ep.map((p) => p.elev);
  const minE = Math.min(...els), maxE = Math.max(...els);
  const maxK = Math.max(...kms) || 1;
  const spanE = (maxE - minE) || 1;
  const W = 640, H = 150, padX = 34, padY = 18;
  const X = (km) => padX + (km / maxK) * (W - padX * 2);
  const Y = (e) => padY + (1 - (e - minE) / spanE) * (H - padY * 2);
  const line = ep.map((p, i) => `${i ? 'L' : 'M'}${X(p.km).toFixed(1)},${Y(p.elev).toFixed(1)}`).join(' ');
  const area = `${line} L${X(maxK).toFixed(1)},${H - padY} L${padX},${H - padY} Z`;
  return `<figure class="sp-elev">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Elevation profile: {min} to {max} m', { min: num(minE), max: num(maxE) })}" xmlns="http://www.w3.org/2000/svg">
      <path d="${area}" fill="#2E4034" opacity="0.12"/>
      <path d="${line}" fill="none" stroke="#2E4034" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${padX}" y="${padY - 5}" font-size="12" fill="#666">${L('{m} m', { m: num(maxE) })}</text>
      <text x="${padX}" y="${H - 4}" font-size="12" fill="#666">${L('{m} m', { m: num(minE) })}</text>
      <text x="${W - padX}" y="${H - 4}" font-size="12" fill="#666" text-anchor="end">${L('{km} km', { km: num(maxK) })}</text>
    </svg>
    <figcaption class="sp-src">${L('Elevation profile: lowest {min} m, highest {max} m.', { min: num(minE), max: num(maxE) })}</figcaption>
  </figure>`;
}

function highestPoint(t) {
  const ep = t.elevationProfile;
  if (!Array.isArray(ep) || !ep.length) return null;
  return Math.max(...ep.map((p) => p.elev));
}

function isLoop(t) {
  if (!Array.isArray(t.path) || t.path.length < 3) return null;
  const a = t.path[0], b = t.path[t.path.length - 1];
  const dLat = (a[0] - b[0]) * 111320;
  const dLng = (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) < 120;
}

// A short, factual "at a glance" paragraph for imported trails, so the 147
// OSM pages read differently from one another. Every clause is computed
// from the trail's own data; sentence choice is keyed to the data, not random.
function atAGlance(t) {
  const bits = [];
  const loop = isLoop(t);
  const gain = typeof t.elevation === 'number' ? t.elevation : null;

  if (loop === true) bits.push(L('This is a true loop: it closes back on its own start point, so there\'s no return leg to plan'));
  else if (loop === false) bits.push(L('This is a point-to-point route, so plan the return: retrace your steps or check local buses'));

  if (gain !== null) {
    const m = num(gain);
    if (gain < 150) bits.push(L('with only {m} m of climbing, it\'s one of the gentler options in the area for older dogs or hot days', { m }));
    else if (gain < 400) bits.push(L('the {m} m of climbing is steady rather than steep, a fair ask for most fit dogs', { m }));
    else if (gain < 700) bits.push(L('{m} m of gain over {km} km is a real climb: budget rests, and halve expectations for short-legged dogs', { m, km: num(t.distance) }));
    else bits.push(L('{m} m of climbing makes this a big physical day, for conditioned dogs only, with turn-back discipline', { m }));
  }

  // Water/hut counts are NOT repeated here: the dedicated sections below
  // list them. Only the absence of water is called out (no section then).
  const w = Array.isArray(t.waterSources) ? t.waterSources.length : 0;
  if (w === 0) bits.push(L('no water points are mapped on this route, so carry everything your dog will drink'));

  if (!bits.length) return '';
  const text = bits.join('; ') + '.';
  return `<h2>${L('At a glance')}</h2>
    <p>${text.charAt(0).toUpperCase() + text.slice(1)}</p>`;
}

// Up to 4 other trails in the same valley (fill from region if needed).
function nearbySection(t, slug, all) {
  const sameValley = all.filter((o) => o.slug !== slug && o.valley === t.valley);
  const sameRegion = all.filter((o) => o.slug !== slug && o.region === t.region && o.valley !== t.valley);
  const picks = sameValley.slice(0, 4);
  for (const o of sameRegion) { if (picks.length >= 4) break; picks.push(o); }
  if (!picks.length) return '';
  const items = picks.map((o) =>
    `<a class="sp-near" href="${rootPrefix()}trail.html?id=${encodeURIComponent(o.slug || o.id)}">
        <span class="sp-near-name">${escapeHtml(o.name)}</span>
        <span class="sp-near-meta"><span class="dp-badge dp-badge--${o.safetyLevel}"><span data-dp-icon="${o.safetyLevel === 'low-risk' ? 'verified' : 'warning'}" data-dp-icon-size="13" aria-hidden="true"></span><span>${displaySafetyLabel(o)}</span></span> ${L('{km} km', { km: num(o.distance) })}</span>
      </a>`
  ).join('\n      ');
  const hub = VALLEY_GUIDES[t.valley];
  const hubLine = hub
    ? `\n    <p>${L('Planning a few days here? Read our area guide: {link}.', { link: `<a href="${hub.href}">${escapeHtml(hub.label)}</a>` })}</p>`
    : '';
  return `<h2>${L('Nearby trails')}</h2>
    <div class="sp-near-grid">
      ${items}
    </div>${hubLine}`;
}

// ---------------------------------------------------------------
// 3. Page template
// ---------------------------------------------------------------
/**
 * The page for one trail, in English (trails/<slug>.html) or Italian
 * (it/trails/<slug>.html).
 */
function trailPage(t, slug, all, lang = 'en') {
  return inLanguage(lang, t && t.id, () => renderTrailPage(t, slug, all));
}

// A page in the site root that the trail page links to. From it/trails/ the
// Italian copy is ../<page> when it/<page> exists, otherwise the English one.
function sitePageHref(page) {
  if (LANG !== 'it') return `../${page}`;
  return fs.existsSync(path.join(ROOT, IT_DIR, page)) ? `../${page}` : `../../${page}`;
}

/**
 * Imported trails carry a templated English description. Without its own
 * Italian, the Italian page reads the template (i18n.js translateImportedDesc).
 */
function importedDescText(t) {
  const text = tr(t.desc);
  if (LANG !== 'it' || text !== t.desc || t.curated !== false || typeof text !== 'string') return text;
  return text
    .replace(/^An? ([\d.]+) km (route|loop) near (.+?), imported from the OpenStreetMap hiking network(?: \(trail ([^)]+)\))?\./,
      (match, km, kind, place, ref) => {
        const vars = { km: num(km), place, ref };
        if (kind === 'loop') {
          return ref ? L('A {km} km loop near {place}, imported from the OpenStreetMap hiking network (trail {ref}).', vars)
            : L('A {km} km loop near {place}, imported from the OpenStreetMap hiking network.', vars);
        }
        return ref ? L('A {km} km route near {place}, imported from the OpenStreetMap hiking network (trail {ref}).', vars)
          : L('A {km} km route near {place}, imported from the OpenStreetMap hiking network.', vars);
      })
    .replace(/Passed automated dog-suitability screening: no via ferrata, no sac scale beyond mountain hiking, no explicit dog bans\./,
      () => L('Passed automated dog-suitability screening: no via ferrata, no sac scale beyond mountain hiking, no explicit dog bans.'))
    .replace(/Not yet individually verified by ORMA\./, () => L('Not yet individually verified by ORMA.'));
}

/**
 * The Italian page's dog-fit script: the English one, with its wording through
 * L(). The sentences are JSON strings, so an apostrophe in the Italian cannot
 * end one early, and the dog's name joins them where {name} was.
 */
function dogFitScriptIt(slug) {
  const NAME = '\u0001name\u0001';
  const marker = JSON.stringify(NAME).slice(1, -1);
  const js = text => JSON.stringify(text).replace(/</g, '\\u003c').split(marker).join('" + n + "');
  const id = encodeURIComponent(slug);
  return `<script>
    (function(){
      try{
        var raw = localStorage.getItem('dolopaws-profile-summary');
        if(!raw) return; // guest: keep the static pitch above
        var p = JSON.parse(raw);
        var box = document.getElementById('dogFit');
        if(!box || !p) return;
        var esc = function(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
        if(p.hasProfile){
          var n = p.name ? esc(p.name) : ${js(L('your dog'))};
          box.innerHTML = '<h2>' + ${js(L('Is this trail right for <em>{name}</em>?', { name: NAME }))} + '</h2>'
            + '<p>' + ${js(L('{name}’s profile is saved. Open the interactive trail guide to see their personalised match and any cautions.', { name: NAME }))} + '</p>'
            + '<p><a href="../../trail.html?id=${id}">' + ${js(L('See {name}’s match for this trail →', { name: NAME }))} + '</a></p>';
        } else {
          box.innerHTML = '<h2>' + ${js(L('One step left: save your dog’s profile'))} + '</h2>'
            + '<p>' + ${js(L('You’re signed in, but there’s no dog profile saved yet. Add your dog’s build, age and health once, and every trail, including this one, gets a personal match score.'))} + '</p>'
            + '<p><a href="../../account.html?next=trail.html%3Fid%3D${id}">' + ${js(L('Finish your dog’s profile →'))} + '</a></p>';
        }
      }catch(e){}
    })();
    </script>`;
}

function renderTrailPage(t, slug, all) {
  const it = LANG === 'it';
  const up = rootPrefix();
  const pageDesc = importedDescText(t);
  const title = L('{name}, dog-friendly trail, ORMA', { name: t.name });
  const desc = truncate(
    pageDesc || L('{name}: a {km} km dog-friendly trail near {area}.', { name: t.name, km: num(t.distance), area: t.area }),
    155
  );
  const englishUrl = `${BASE_URL}/trails/${slug}.html`;
  const italianUrl = `${BASE_URL}/${IT_DIR}/trails/${slug}.html`;
  const canonical = it ? italianUrl : englishUrl;
  const browseUrl = it && fs.existsSync(path.join(ROOT, IT_DIR, 'browse-trails.html'))
    ? `${BASE_URL}/${IT_DIR}/browse-trails.html` : `${BASE_URL}/browse-trails.html`;
  const regionLabel = regionLabelText(t.region);
  const verified = t.curated !== false; // curated file entries have no `curated` flag
  const badgeTier = badgeForTrail(t);
  // Whether anybody checked the water, not whether the listing is curated.
  // Curation was standing in for it, so a published trail whose water nobody
  // researched would have had its mapped points titled "Water on trail" with
  // the "availability can change" line removed.
  const waterReviewed = categoryVerified(t, 'water');
  const openChairlift = !!(t.liftAccess && t.liftAccess.dependency === 'required' && ['chairlift', 'mixed', 'unknown'].includes(t.liftAccess.type));
  const badge = `<span class="dp-badge dp-badge--${badgeTier.style}">${badgeTier.icon
    ? `<span data-dp-icon="${badgeTier.icon}" data-dp-icon-size="13" aria-hidden="true"></span>`
    : ''}<span>${tierLabelText(badgeTier)}</span></span>`;

  const ogImage = t.imageIcon ? publicAssetUrl(t.imageIcon) : `${BASE_URL}/icon-512.png`;

  // Guard against upstream "NaN%" surface strings (promote-osm-trails.js bug)
  const terrain = !categoryVerified(t, 'surfaceHazards')
    ? (tr(t.terrainType) || L('Variable mountain terrain'))
    : /NaN/.test(String(t.terrainType || ''))
    ? L('Surface data not yet mapped')
    : tr(t.terrainType);

  const highest = highestPoint(t);
  const facts = [
    [L('Distance'), L('{km} km', { km: num(t.distance) })],
    [L('Elevation gain'), t.elevation != null ? L('{m} m', { m: num(t.elevation) }) : null],
    [L('Highest point'), highest !== null ? L('{m} m', { m: num(highest) }) : null],
    [L('Duration'), t.hours != null ? L('{h} h', { h: num(t.hours) }) : null],
    [L('Terrain'), terrain],
    [L('Trail rating'), displaySafetyLabel(t)],
    [L('Area'), `${t.area} · ${regionLabel}`],
  ]
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<div class="sp-fact"><div class="sp-fact-k">${escapeHtml(k)}</div><div class="sp-fact-v">${escapeHtml(v)}</div></div>`
    )
    .join('\n      ');

  const waterHtml = !categoryVerified(t, 'water')
    ? `<h2>${L('Bring your own water')}</h2><p>${L('Do not rely on potential water locations being available or drinkable. Carry enough for the full walk.')}</p>`
    :
    Array.isArray(t.waterSources) && t.waterSources.length
      ? `<h2><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;vertical-align:-2.5px;margin-right:2px;"><path d="M12 3c3 3.6 4.8 6.3 4.8 8.8a4.8 4.8 0 11-9.6 0C7.2 9.3 9 6.6 12 3z" fill="#378ADD"></path></svg> ${waterReviewed ? L('Water on trail') : L('Potential water points')}</h2>
    <ul>${displayWaterLines(t)
          .map((w) => `<li>${L('km {km}', { km: escapeHtml(num(w.km)) })} · ${escapeHtml(w.label)}${w.count > 1 ? ` ${L('({count} points)', { count: w.count })}` : ''}</li>`)
          .join('')}</ul>${waterReviewed ? '' : `<p class="sp-src">${L('Availability can change. Carry a full supply.')}</p>`}`
      : '';

  const rifugiHtml =
    Array.isArray(t.rifugi) && t.rifugi.length
      ? `<h2><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;vertical-align:-2.5px;margin-right:2px;"><path d="M4 11l8-7 8 7" fill="none" stroke="#8A5A16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 10v9h12v-9" fill="#D6A038" stroke="#8A5A16" stroke-width="1.6" stroke-linejoin="round"></path><path d="M10 19v-5h4v5" fill="#8A5A16"></path></svg> ${L('Rifugi &amp; refreshment')}</h2>
    <ul>${t.rifugi
          .map((r) => `<li>${L('km {km}', { km: escapeHtml(num(r.km)) })} · ${escapeHtml(r.name || L('Rifugio'))}</li>`)
          .join('')}</ul>`
      : '';

  const tipsHtml = t.tips || !verified
    ? `<h2>${L('Good to know')}</h2>
    <p>${verified ? escapeHtml(tr(t.tips)) : L('Use the live forecast, check local access information and be ready for changing mountain conditions.')}</p>`
    : '';

  const startHtml =
    t.startPoint && t.startPoint.label
      ? `<h2><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;vertical-align:-2.5px;margin-right:2px;"><path d="M7 21V4" stroke="#2E4034" stroke-width="2" stroke-linecap="round"></path><path d="M7 5h10l-2.4 3.5L17 12H7z" fill="#E24B4A"></path></svg> ${L('Where to start')}</h2>
    <p>${escapeHtml(displayStartLabel(t, t.startPoint.label))}</p>`
      : '';

  const insightsHtml =
    Array.isArray(t.insights) && t.insights.length
      ? `<h2>${L('Field notes')}</h2>
    ${t.insights
          .map((i) => {
            const srcLabel = i.source ? escapeHtml(i.source) : '';
            const src = i.url
              ? ` <span class="sp-src">· <a href="${escapeHtml(i.url)}" rel="noopener">${srcLabel}</a></span>`
              : srcLabel
                ? ` <span class="sp-src">· ${srcLabel}</span>`
                : '';
            return `<p>${escapeHtml((it && i.it) || tr(i.en || ''))}${src}</p>`;
          })
          .join('\n    ')}`
      : '';

  const reviewDate = t.reviewedAt || (t.verified && t.verified.date);
  // The same words as the badge. This said "Verified by ORMA on <date>" for
  // any curated trail carrying a date, which is how a trail the app calls
  // reviewed signed its own page as verified.
  const reviewRecord = badgeTier.style !== 'imported' && reviewDate
    ? `<p class="sp-review-meta">${L('{badge} on {date}. Check current conditions before setting out.', { badge: tierLabelText(badgeTier), date: escapeHtml(formatReviewDate(reviewDate)) })}</p>`
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: t.name,
    description: desc,
    ...(it ? { inLanguage: 'it' } : {}),
    url: canonical,
    geo: { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lng },
    isAccessibleForFree: !t.paid,
    address: { '@type': 'PostalAddress', addressCountry: REGION_COUNTRY[t.region] || 'IT' },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: L('All trails'), item: browseUrl },
      { '@type': 'ListItem', position: 2, name: regionLabel, item: browseUrl },
      { '@type': 'ListItem', position: 3, name: t.name, item: canonical },
    ],
  };

  const glanceHtml = !verified ? atAGlance(t) : '';
  const directionsHtml = directionsSection(t);
  const routeHtml = routeSvg(t);
  const elevHtml = elevSvg(t);
  const nearbyHtml = nearbySection(t, slug, all);

  return `<!DOCTYPE html>
<html lang="${it ? 'it' : 'en'}"${it ? ' data-orma-lang="it"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="en" href="${englishUrl}">
<link rel="alternate" hreflang="it" href="${italianUrl}">
<link rel="alternate" hreflang="x-default" href="${englishUrl}">
<meta name="theme-color" content="#2E4034">
<meta property="og:type" content="article">${it ? '\n<meta property="og:locale" content="it_IT">' : ''}
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="${up}favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="${up}favicon-16.png">
<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}styles.css?v=20260916-5">
<style>
  .sp-hero{padding-top:28px;}
  .sp-breadcrumb{font-size:.85rem;color:var(--ink-soft,#666);margin-bottom:14px;}
  .sp-breadcrumb a{color:inherit;}
  /* What the name means, for a reader who does not speak the language it is
     signed in. Quieter than the title: the name is the thing on the signpost. */
  .sp-gloss{margin:6px 0 0;font-size:1rem;color:var(--ink-soft,#666);max-width:60ch;}
  .sp-badges{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 18px;}
  .sp-lift-warning{margin:0 0 16px;padding:12px 14px;border:1px solid #E7C2B8;border-left:4px solid #9C3A25;border-radius:10px;background:#FBF1EE;color:#4A2A22;font-size:14px;line-height:1.55;}
  .sp-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0 26px;}
  .sp-fact{background:rgba(0,0,0,.035);border-radius:10px;padding:10px 14px;}
  .sp-fact-k{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft,#666);}
  .sp-fact-v{font-weight:600;margin-top:2px;}
  .sp-body h2{margin-top:28px;}
  .sp-src{font-size:.85rem;color:var(--ink-soft,#666);}
  /* The waymark shield, as the app draws it in trail.html: a number a reader
     can match against the paint on a rock without reading a sentence first. */
  .sp-route-refs{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:10px 0 4px;}
  .sp-route-ref{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:36px;box-sizing:border-box;padding:5px 10px;border:3px solid #B54835;border-radius:8px;background:#fff;color:#202821;font:800 15px/1 'Inter',sans-serif;box-shadow:0 1px 2px rgba(32,40,33,.08);}
  .sp-route-ref-arrow{color:#657369;font-size:17px;font-weight:800;}
  .sp-route-source{margin-top:4px;color:#657369;font-size:13px;line-height:1.5;}
  .sp-route-credit{margin-top:6px;color:#8A968C;font-size:11.5px;line-height:1.45;}
  .sp-route-credit a{color:inherit;text-decoration:underline;text-decoration-color:rgba(138,150,140,.5);}
  /* The photo is lazy-loaded and the credit toggle is pinned to the figure's
     corner, so the figure reserves its height up front; otherwise the toggle
     floats over whatever sits above until the image arrives. */
  .sp-photo{position:relative;width:480px;max-width:100%;aspect-ratio:8/5;margin:6px 0 14px;overflow:hidden;border-radius:12px;}
  .sp-photo picture{display:block;height:100%;}
  .sp-photo .sp-img{width:100%;height:100%;max-height:none;margin:0;}
  .sp-photo-credit{position:absolute;right:10px;bottom:10px;z-index:2;color:#fff;}
  .sp-photo-credit summary{cursor:pointer;list-style:none;display:grid;place-items:center;width:28px;height:28px;margin-left:auto;border:1px solid rgba(255,255,255,.62);border-radius:50%;background:rgba(34,49,42,.88);color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.2);font:800 12px/1 'Inter',sans-serif;backdrop-filter:blur(5px);}
  .sp-photo-credit summary::-webkit-details-marker{display:none;}
  .sp-photo-credit summary:hover,.sp-photo-credit summary:focus-visible{background:rgba(34,49,42,.98);border-color:#fff;}
  .sp-photo-credit summary:focus-visible{outline:3px solid rgba(255,255,255,.45);outline-offset:2px;}
  .sp-photo-credit__body{position:absolute;right:0;bottom:calc(100% + 8px);width:min(340px,calc(100vw - 48px));padding:10px 12px;border-radius:10px;background:rgba(34,49,42,.96);box-shadow:0 8px 24px rgba(0,0,0,.24);font-size:11px;line-height:1.5;color:#fff;}
  .sp-photo-credit__body a{color:#fff;text-underline-offset:2px;}
  .sp-review-meta{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:28px 0 0;padding-top:14px;border-top:1px solid var(--paper-line,#ddd);font-size:.8rem;color:var(--ink-soft,#666);}
  .sp-review-meta a{flex:none;color:var(--forest,#2E4034);font-weight:700;text-decoration:none;}
  .sp-review-meta a:hover{text-decoration:underline;}
  .sp-cta{display:inline-block;margin:26px 0;padding:12px 22px;background:#2E4034;color:#fff;border-radius:10px;font-weight:600;text-decoration:none;}
  .sp-img{max-width:100%;width:480px;max-height:300px;object-fit:cover;border-radius:12px;margin:6px 0 14px;display:block;}
  .sp-route{max-width:100%;width:640px;display:block;margin:6px 0 14px;}
  .sp-elev{margin:14px 0;}
  .sp-elev svg{max-width:100%;width:640px;display:block;}
  .sp-near-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:14px 0;}
  .sp-near{display:block;border:1px solid var(--paper-line,#ddd);border-radius:12px;padding:13px 15px;text-decoration:none;color:inherit;background:var(--card,#fff);}
  .sp-near:hover{border-color:#2E4034;}
  .sp-near-name{display:block;font-weight:700;font-size:14.5px;margin-bottom:6px;}
  .sp-near-meta{display:block;font-size:12.5px;color:var(--ink-soft,#666);}
</style>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 1)}
</script>
<script type="application/ld+json">
${JSON.stringify(breadcrumbLd, null, 1)}
</script>
</head>
<body data-scoring-version="${recommendationContract.VERSION}">

<div class="topnav">
  <a class="brand" href="/"><img src="${up}logo.svg?v=3" alt="${L('ORMA logo')}">ORMA</a>
  <div class="links">
    <a href="${sitePageHref('browse-trails.html')}" class="active">${L('Trails')}</a>
    <a href="${sitePageHref('browse-trails.html')}#collections">${L('Collections')}</a>
    <a href="../safety-guide.html">${L('Safety library')}</a>
    <a href="${sitePageHref('journal.html')}">${L('My walk journal')}</a>
    <a class="account-btn" href="/?view=login&amp;next=${it ? `${IT_DIR}/` : ''}trails/${slug}.html" data-i18n="nav.login">${L('Log in')}</a>
  </div>
</div>

<div class="wrap sp-hero">
  <div class="sp-breadcrumb"><a href="${sitePageHref('browse-trails.html')}">${L('All trails')}</a> › ${escapeHtml(regionLabel)} › ${escapeHtml(t.valley || t.area)}</div>
  <h1>${escapeHtml(t.name)}</h1>
  ${t.nameGloss ? `<p class="sp-gloss">${escapeHtml(tr(t.nameGloss))}</p>` : ''}
  <div class="sp-badges">
    <span class="dp-badge dp-badge--${t.safetyLevel}"><span data-dp-icon="${t.safetyLevel === 'low-risk' ? 'verified' : 'warning'}" data-dp-icon-size="13" aria-hidden="true"></span><span>${displaySafetyLabel(t)}</span></span>
    ${badge}
    ${t.paid ? `<span class="dp-badge dp-badge--neutral"><span>${L('Paid access')}</span></span>` : ''}
    ${openChairlift ? `<span class="dp-badge dp-badge--caution"><span data-dp-icon="warning" data-dp-icon-size="13" aria-hidden="true"></span><span>${L('Chairlift-assisted · not for most dogs')}</span></span>` : ''}
  </div>
  ${openChairlift ? `<p class="sp-lift-warning">${L('<strong>This route depends on an open chairlift{lift}.</strong> A dog that is not used to one can panic and fall, which can be fatal. ORMA recommends it only for a dog of 8 kg or under that rides calmly held on a lap, harnessed and leashed; for every other dog it is graded as not recommended.', { lift: t.liftAccess.name ? ` (${escapeHtml(t.liftAccess.name)})` : '' })}</p>` : ''}
  ${t.imageIcon ? `<figure class="sp-photo">${photoHtml(t)}${photoCreditHtml(t)}</figure>` : routeHtml}
  ${!t.imageIcon && t.imagePlaceholder ? `<p class="sp-src" style="display:flex;align-items:center;gap:8px;margin:-6px 0 14px;"><img src="${up}logo.svg" alt="" width="22" height="22" style="flex:none;"> ${L('We\'re working on adding photos of this trail.')}</p>` : ''}
  ${paragraphs(pageDesc)}

  <div class="sp-facts">
      ${facts}
  </div>

  <a class="sp-cta" href="${up}trail.html?id=${encodeURIComponent(slug)}">${L('Open the full trail guide →')}</a>

  <div class="sp-body">
    ${glanceHtml}
    ${elevHtml}
    ${startHtml}
    ${directionsHtml}
    ${waterHtml}
    ${rifugiHtml}
    ${tipsHtml}
    ${insightsHtml}
${reviewRecord}
    <div id="dogFit">
    <h2>${L('Is this trail right for <em>your</em> dog?')}</h2>
    <!-- This used to say ORMA "can't tell you" how the route pairs with a
         dog's build, age and health. It can: the interactive guide scores
         every trail against a medium dog for a reader who has not added one,
         and says plainly that is what it has done. Denying the answer and
         asking for an account first made a signup the price of finding out. -->
    <p>${L('The trail rating above describes the mountain, and it\'s the same for every dog. How it suits <em>yours</em> depends on their build, age and health. <a href="{href}">See this route\'s match</a> — scored for a medium dog until you add your own, free and in a minute.', { href: `${up}trail.html?id=${encodeURIComponent(slug)}` })}</p>
    </div>
    ${it ? dogFitScriptIt(slug) : `<script>
    (function(){
      try{
        var raw = localStorage.getItem('dolopaws-profile-summary');
        if(!raw) return; // guest: keep the static pitch above
        var p = JSON.parse(raw);
        var box = document.getElementById('dogFit');
        if(!box || !p) return;
        var esc = function(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
        if(p.hasProfile){
          var n = p.name ? esc(p.name) : 'your dog';
          box.innerHTML = '<h2>Is this trail right for <em>' + n + '</em>?</h2>'
            + '<p>' + n + '\u2019s profile is saved. Open the interactive trail guide to see their personalised match and any cautions.</p>'
            + '<p><a href="../trail.html?id=${encodeURIComponent(slug)}">See ' + n + '\u2019s match for this trail \u2192</a></p>';
        } else {
          box.innerHTML = '<h2>One step left: save your dog\u2019s profile</h2>'
            + '<p>You\u2019re signed in, but there\u2019s no dog profile saved yet. Add your dog\u2019s build, age and health once, and every trail, including this one, gets a personal match score.</p>'
            + '<p><a href="../account.html?next=trail.html%3Fid%3D${encodeURIComponent(slug)}">Finish your dog\u2019s profile \u2192</a></p>';
        }
      }catch(e){}
    })();
    </script>`}
    <p class="sp-src">${L('Before you go: <a href="{safety}">the dog safety guide</a> · <a href="{water}">water for dogs on trail</a> · <a href="{cableCars}">dogs on cable cars</a> · <a href="{guardianDogs}">meeting a guardian dog</a>', {
      safety: '../safety-guide.html',
      water: '../guides/water-for-dogs-on-trail.html',
      cableCars: '../guides/dogs-on-cable-cars.html',
      guardianDogs: '../guides/livestock-guard-dogs.html',
    })}</p>
    ${nearbyHtml}
  </div>
</div>

<footer class="site-footer hp-footer">
  <div class="hp-footer-grid">
    <div>
      <div class="hp-footer-brand"><img src="${up}logo.svg?v=5" alt=""><span>ORMA</span></div>
      <p class="hp-footer-blurb">${L('The personalised trail guide for dogs and their humans, so every footprint left on the mountain is a safe one.')}</p>
      <div class="hp-footer-get">
        <div class="hp-footer-h">${L('Get the app')}</div>
        <div class="hp-footer-apps">
          <button type="button" class="hp-footer-install" data-orma-install hidden>${L('Add ORMA to your home screen')}</button>
        </div>
        <p class="hp-footer-appnote">${L('Add ORMA to your home screen from your browser menu for a full-screen map.')}</p>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">${L('Trails')}</div>
      <div class="hp-footer-links">
        <a href="${sitePageHref('browse-trails.html')}">${L('Browse all trails')}</a>
        <a href="${sitePageHref('collections.html')}">${L('Collections')}</a>
        <a href="${sitePageHref('compare.html')}">${L('Compare trails')}</a>
        <a href="${sitePageHref('how-scoring-works.html')}">${L('How scoring works')}</a>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">${L('Caring for your dog')}</div>
      <div class="hp-footer-links">
        <a href="../guides/water-for-dogs-on-trail.html">${L('Heat &amp; hydration')}</a>
        <a href="../guides/paw-protection.html">${L('Paw protection')}</a>
        <a href="../guides/breed-group-caveats.html">${L('Breed group caveats')}</a>
        <a href="../guides/alpine-plants-for-dogs.html">${L('Alpine plants guide')}</a>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">${L('Your walks')}</div>
      <div class="hp-footer-links">
        <a href="${sitePageHref('journal.html')}">${L('My walk journal')}</a>
        <a href="${sitePageHref('saved.html')}">${L('Saved trails')}</a>
        <a href="${sitePageHref('downloads.html')}">${L('Downloaded trails')}</a>
        <a href="${sitePageHref('walk.html')}">${L('Record a walk')}</a>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">${L('Company')}</div>
      <div class="hp-footer-links">
        <a href="${sitePageHref('about.html')}">${L('About us')}</a>
        <a href="${sitePageHref('contact.html')}">${L('Contact')}</a>
        <a href="${sitePageHref('privacy.html')}">${L('Privacy')}</a>
        <a href="${sitePageHref('terms.html')}">${L('Terms')}</a>
      </div>
    </div>
  </div>
  <div class="hp-footer-connect">
    <div class="hp-footer-connect-main">
      <span class="hp-footer-h">${L('Follow Us')}</span>
      <div class="hp-footer-social-row">
        <a href="https://www.instagram.com/app.orma/" target="_blank" rel="noopener" aria-label="${L('ORMA on Instagram')}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
      </div>
    </div>
  </div>
  <div class="hp-footer-base">
    <span>${L('© 2026 ORMA · Rooted in the Italian Dolomites')}</span>
  </div>
</footer>

<script src="${up}icon-system.js?v=20260717" defer></script>
${it ? `<script src="${up}i18n.js"></script>\n` : ''}<script src="${up}mobile-nav.js?v=20261030-1"></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------
// 4. Sitemap
// ---------------------------------------------------------------
function sitemap(urls) {
  // Filesystem mtimes change when CI copies the repository, so they cannot
  // produce a reproducible sitemap. Trail-data releases carry one explicit,
  // reviewed date instead.
  const releaseFile = path.join(ROOT, 'data', 'trail-data-release.json');
  const release = JSON.parse(fs.readFileSync(releaseFile, 'utf8'));
  if(release.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(release.lastModified || '')){
    throw new Error('data/trail-data-release.json must contain a valid lastModified date');
  }
  const lastmod = release.lastModified;
  const items = urls
    .map(
      (u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

// ---------------------------------------------------------------
// 5. Crawlable trail index injected into browse-trails.html
//    (between TRAIL-INDEX-START/END markers)
// ---------------------------------------------------------------
function updateBrowseIndex(entries) {
  const file = path.join(ROOT, 'browse-trails.html');
  if (!fs.existsSync(file)) return console.warn('browse-trails.html not found, skipping index.');
  const html = fs.readFileSync(file, 'utf8');
  const START = '<!-- TRAIL-INDEX-START (auto-generated by scripts/generate-trail-pages.js, do not edit by hand) -->';
  const END = '<!-- TRAIL-INDEX-END -->';
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a === -1 || b === -1) return console.warn('Index markers not found in browse-trails.html, skipping.');

  const byRegion = { dolomites: [], savoy: [], lombardy: [], friuli: [], aosta: [], piedmont: [], tyrol: [], switzerland: [] };
  for (const e of entries) (byRegion[e.region] || byRegion.dolomites).push(e);
  for (const k of Object.keys(byRegion)) byRegion[k].sort((x, y) => x.name.localeCompare(y.name));

  const block = ['dolomites', 'savoy', 'lombardy', 'friuli', 'aosta', 'piedmont', 'tyrol', 'switzerland']
    .filter((r) => byRegion[r].length)
    .map(
      (r) =>
        `<p style="font-weight:700;color:var(--ink);break-inside:avoid;">${escapeHtml(REGION_LABEL[r])}</p>\n` +
        byRegion[r]
          .map((e) => `<a href="trail.html?id=${encodeURIComponent(e.slug || e.id)}" style="display:block;color:inherit;">${escapeHtml(e.name)}</a>`)
          .join('\n')
    )
    .join('\n');

  fs.writeFileSync(file, html.slice(0, a + START.length) + '\n' + block + '\n' + html.slice(b), 'utf8');
  console.log(`Updated trail index in browse-trails.html (${entries.length} links).`);
}

// ---------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------
function main() {
  const sourceTrails = loadTrails();
  const slugOverrides = loadSlugOverrides(ROOT);
  const catalog = buildCanonicalCatalog(sourceTrails, { slugOverrides });
  if (catalog.errors.length) {
    throw new Error(
      `Production trail validation failed:\n${catalog.errors.map(error => `- ${error}`).join('\n')}`
    );
  }
  const publishedIds = new Set(
    catalog.records
      .filter(record => record.lifecycle === 'published')
      .map(record => record.id)
  );
  const canonicalSlug = new Map(catalog.records.map(record => [record.id, record.slug]));
  const slugProblems = validateSlugOverrides(slugOverrides, sourceTrails.map(trail => trail.id),
    Object.fromEntries(sourceTrails.map(trail => [trail.id, trail.name])));
  if (slugProblems.length) {
    throw new Error(`Trail slug overrides are unusable:\n  ${slugProblems.join('\n  ')}`);
  }
  const trails = sourceTrails.filter(trail => publishedIds.has(trail.id));
  console.log(
    `Loaded ${sourceTrails.length} trails; ${trails.length} pass publication validation `
    + `and ${catalog.excluded.length} remain drafts.`
  );

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(IT_OUT_DIR)) fs.mkdirSync(IT_OUT_DIR, { recursive: true });

  const seen = new Set();
  const urls = [
    `${BASE_URL}/`,
    `${BASE_URL}/browse-trails.html`,
    `${BASE_URL}/safety-guide.html`,
    `${BASE_URL}/about.html`,
    `${BASE_URL}/how-scoring-works.html`,
    `${BASE_URL}/contact.html`,
    `${BASE_URL}/privacy.html`,
    `${BASE_URL}/terms.html`,
    `${BASE_URL}/guides/dogs-on-cable-cars.html`,
    `${BASE_URL}/guides/livestock-guard-dogs.html`,
    `${BASE_URL}/guides/dog-friendly-hikes-val-gardena.html`,
    `${BASE_URL}/guides/dog-friendly-hikes-lago-di-braies.html`,
    `${BASE_URL}/guides/water-for-dogs-on-trail.html`,
    `${BASE_URL}/guides/dogs-at-rifugi.html`,
    `${BASE_URL}/guides/alpine-plants-for-dogs.html`,
  ];

  // Pass 1: assign slugs so every page can link to its neighbours.
  const entries = [];
  for (const t of trails) {
    const slug = canonicalSlug.get(t.id);
    if (seen.has(slug)) throw new Error(`Duplicate validated slug: ${slug}`);
    seen.add(slug);
    entries.push({ t, slug });
  }
  const all = entries.map(({ t, slug }) => ({
    id: t.id, slug, name: t.name, valley: t.valley, region: t.region,
    distance: t.distance, safetyLevel: t.safetyLevel,
  }));

  // Pass 2: write pages.
  let written = 0;
  const indexEntries = [];
  // The pages that have an Italian copy under it/, listed after every English
  // URL so the English part of the sitemap reads as it always has.
  const italianUrls = urls
    .map(url => url.slice(BASE_URL.length + 1))
    .filter(page => fs.existsSync(path.join(ROOT, IT_DIR, page || 'index.html')))
    .map(page => `${BASE_URL}/${IT_DIR}/${page}`);
  for (const { t, slug } of entries) {
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), trailPage(t, slug, all), 'utf8');
    fs.writeFileSync(path.join(IT_OUT_DIR, `${slug}.html`), trailPage(t, slug, all, 'it'), 'utf8');
    urls.push(`${BASE_URL}/trails/${slug}.html`);
    italianUrls.push(`${BASE_URL}/${IT_DIR}/trails/${slug}.html`);
    indexEntries.push({ id: t.id, slug, name: t.name, region: t.region });
    written++;
  }

  // A retired address keeps answering.
  //
  // A slug used to be read off the trail's name, so renaming a trail moved its
  // page and left the old URL dead -- which is why seven pages still carried a
  // tourist-office code. The override pins where a page lives; this keeps every
  // address it used to live at pointing there.
  //
  // Deliberately not in the sitemap and not in the browse index: a redirect is
  // not a page to crawl or to list, and `canonical` on the stub tells a search
  // engine which URL is the real one. It carries no stylesheet or script, so it
  // has no local asset to go stale.
  let redirects = 0;
  for (const [from, trailId] of allRetiredSlugs(slugOverrides)) {
    const to = canonicalSlug.get(trailId);
    if (!to || !seen.has(to)) continue;
    const name = (all.find(entry => entry.id === trailId) || {}).name || to;
    fs.writeFileSync(path.join(OUT_DIR, `${from}.html`), retiredSlugPage(from, to, name), 'utf8');
    fs.writeFileSync(path.join(IT_OUT_DIR, `${from}.html`), retiredSlugPage(from, to, name, 'it'), 'utf8');
    // So the stale-page sweep below keeps it rather than treating it as an orphan.
    seen.add(from);
    redirects++;
  }
  if (redirects) console.log(`Wrote ${redirects} retired-address redirect(s).`);

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap([...urls, ...italianUrls]), 'utf8');
  updateBrowseIndex(indexEntries);

  // Remove stale pages for trails that no longer exist in the datasets
  // (renamed, or pulled entirely, e.g. routes where dogs turned out to be
  // prohibited on the ground). Keeps GitHub Pages from serving orphans.
  let removed = 0;
  for (const dir of [OUT_DIR, IT_OUT_DIR]) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.html') || f === 'index.html') continue; // index.html is the directory redirect, not a trail page
      if (!seen.has(f.slice(0, -5))) {
        try { fs.unlinkSync(path.join(dir, f)); removed++; }
        catch (e) { console.warn(`Could not remove stale page ${f}: ${e.message}`); }
      }
    }
  }
  if (removed) console.log(`Removed ${removed} stale trail page(s).`);

  console.log(`Wrote ${written} trail pages, ${written} Italian copies and sitemap.xml (${urls.length + italianUrls.length} URLs).`);
}

if(require.main === module) main();

module.exports = { TIER_BADGE, badgeForTrail, directionsSection, displayStartLabel, displayWaterLabel, displayWaterLines, photoHtml, photoCreditHtml, publicAssetUrl, trailPageAssetUrl, trailPage };
